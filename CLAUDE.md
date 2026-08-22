# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trip OS is an AI-powered travel planning application that generates comprehensive, actionable travel itineraries. Built with React 19, TypeScript (strict), Vite 6, and compiled Tailwind v4.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 3000; API routes do NOT run under vite — see below)
npm run build        # tsc --noEmit && vite build (typecheck is part of build)
npm run preview      # Preview production build
```

**Local dev caveat:** `/api/*` serverless functions only execute under the Vercel runtime (`vercel dev` or deployment). Under bare `vite dev` they 404. The app degrades gracefully: without `OPENROUTER_API_KEY`/`NVIDIA_API_KEY`, `/api/chat` returns `CONFIG_ERROR` and the client automatically streams a built-in demo itinerary (`?demo=1` forces it).

## Environment Setup

LLM provider is selected server-side in `api/chat.ts` with this priority:
1. `OPENROUTER_API_KEY` (preferred). Optional: `OPENROUTER_MODEL` (default `minimax/minimax-m2.7`), `OPENROUTER_FAST_MODEL` (default `openai/gpt-5-mini`, used via the client model alias `'fast'`).
2. `NVIDIA_API_KEY` (fallback). Optional: `NVIDIA_MODEL`.
3. Other env vars: `SERPAPI_KEY` (flights/hotels), `BLOB_READ_WRITE_TOKEN` (share links), `ALLOWED_ORIGINS` (extra origins for the API same-origin gate), `RATE_LIMIT_*` tuning.
4. If both LLM keys are unset, `/api/chat` returns `503 CONFIG_ERROR` and the frontend falls back to demo mode.

## Architecture

### Application Flow

1. **App.tsx** - Main orchestrator: language state (11 languages), LoadingState machine (IDLE → PRE_ANALYZING → GENERATING → SUCCESS/ERROR), streaming generation wiring (AbortController + onDelta), share links via `?share=`, back-button history claim, localStorage persistence (guarded; shared views are never persisted over a visitor's own data)
2. **InputForm.tsx** - Three-section form with custom date picker (keyboard accessible), validation (destination/dates/past-date), ISO-date serialization (`... · YYYY-MM-DD/YYYY-MM-DD` tail consumed by prompt + SerpAPI extraction)
3. **PreAnalysisView.tsx** - Clarify-then-generate step; robust JSON validation upstream
4. **ItineraryDisplay.tsx** - Renders plan: FlightOffersSection / HotelOffersSection / WeatherStrip / DayNav above the markdown; export menu (copy, .md, .ics calendar, print)
5. **services/geminiService.ts** - Prompt construction per language, streaming SSE consumption with `{signal, onDelta}`, FriendlyError mapping (proxy error codes → localized copy), demo-mode fallback
6. **services/travelData.ts** - Parallel gathering of flights/hotels/weather with hard time budget; formats real data into the system prompt ([REAL WEATHER FORECAST] replaces fabricated numbers)
7. **components/ErrorBoundary.tsx** - Top-level crash guard with reset action

### Streaming & Demo Mode

- Client requests `stream: true`; `api/chat.ts` forwards upstream SSE with heartbeat + stall detection (90s) and machine-readable error codes
- `LoadingOverlay` renders partial markdown live (auto-stick scrolling) with elapsed timer and Stop button (aborts fetch; cancel resets silently)
- `services/demoPlan.ts`: `?demo=1` or CONFIG_ERROR → streams a crafted Kyoto demo plan; product works with zero configuration

### Sharing System (utils/shareStorage.ts + api/share.ts)

- Vercel Blob via `/api/share`; upload is awaited before the link is copied (dead-link race fixed); localStorage cache under `trip_os_shared_plans` (max 50)
- Share payloads persist markdown + sources + flights + hotels + weather + tripInput summary so visitors get identical cards
- `middleware.ts` rewrites `/?share=` to `/api/preview` for server-side OG meta injection

### API Hardening (lib/apiGuard.ts)

All endpoints apply: same-origin enforcement (Origin/host match or `ALLOWED_ORIGINS`), per-instance sliding-window rate limits (speed bump only — pair with Vercel Firewall for real protection), strict param validators. `/api/chat` whitelists request fields, clamps temperature/max_tokens, caps payload at 256KB.

### Real-time Data (SerpAPI + Open-Meteo)

- `api/flights/search.ts` / `api/hotels/search.ts` - thin SerpAPI wrappers with validated params and edge caching headers
- `api/weather.ts` - Open-Meteo geocoding + forecast (no key needed), WMO code mapping, 30-min in-memory cache
- Weather beyond the ~16-day forecast horizon is labeled as typical-climate estimate in both UI and prompt — never fabricated precision

### Internationalization (utils/i18n.ts)

- `TRANSLATIONS` for 11 locales (en, zh-CN, zh-TW, ja, ko, hi, es, fr, ar, pt, ru); locales spread BASE_EN and override nested blocks wholesale — when adding keys, add them to BASE_EN AND every locale that explicitly overrides that block
- RTL Arabic: layout uses logical CSS properties (ms/me/ps/pe/text-start/border-s); MarkdownRenderer mirrors correctly
- Honest-copy rule: no fabricated usage stats/reviews anywhere; capability claims must be verifiable in-product

### Styling

- Compiled Tailwind v4 via `@tailwindcss/vite`; global styles/custom classes live in `index.css` (unlayered rules intentionally win over utility layers)
- No runtime CDN, no external decorative assets (the old grainy-gradient noise SVG was removed)
- Print stylesheet in index.css: page break before each Day section, chrome hidden via `.no-print`

### Path Aliases

- `@/*` maps to project root (configured in tsconfig.json and vite.config.ts)
