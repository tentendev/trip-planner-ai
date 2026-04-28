# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trip OS is an AI-powered travel planning application that generates comprehensive, actionable travel itineraries. Built with React 19, TypeScript, and Vite.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run preview      # Preview production build
```

## Environment Setup

LLM provider is selected server-side in `api/chat.ts` with this priority:
1. `OPENROUTER_API_KEY` (preferred). Optional: `OPENROUTER_MODEL` (default `minimax/minimax-m2.7`).
2. `NVIDIA_API_KEY` (fallback, build.nvidia.com). Optional: `NVIDIA_MODEL` (default `minimaxai/minimax-m2.7`).
If both are unset, `/api/chat` returns 500.

Set `BLOB_READ_WRITE_TOKEN` in Vercel env vars for cross-device share link storage (Vercel Blob).

## Architecture

### Application Flow

1. **App.tsx** - Main orchestrator: manages language state (11 languages), loading states, localStorage persistence, routes between InputForm/ItineraryDisplay, handles share links via `?share=` URL param
2. **InputForm.tsx** - Multi-section form with custom date picker, multi-select chips for interests/constraints/transport/diet
3. **ItineraryDisplay.tsx** - Renders generated plans with export options (copy, download markdown, print, share link, share card)
4. **services/geminiService.ts** - Constructs prompts with language-specific instructions, calls NVIDIA's OpenAI-compatible chat completions API

### Component Hierarchy

- **LoadingOverlay.tsx** - Animated loading screen with rotating tips (uses Lottie)
- **MarkdownRenderer.tsx** - Custom renderer for Trip OS output format (tables, headers, checkboxes, blockquotes, `[Context]` highlights)
- **ShareCard.tsx** - Visual share card for social media (destination, dates, itinerary preview)
- **SocialProof.tsx** - Display component for social proof elements

### State Management

- React useState/useEffect only (no external state library)
- Persists to localStorage under `trip_os_v1_state` (trip input + generated plans)
- Language detection: URL `?lang=` → browser language → fallback to `zh-TW`

### Sharing System (utils/shareStorage.ts + api/share.ts)

- Primary storage: Vercel Blob via `/api/share` serverless function (cross-device)
- Fallback/cache: localStorage under `trip_os_shared_plans` (max 50 plans)
- Generates 8-character URL-safe IDs for share links
- Share URL format: `?share={id}&lang={lang}`
- Requires `BLOB_READ_WRITE_TOKEN` env var for Vercel Blob persistence

### Key Data Types (types.ts)

- `TripInput`: 16-field form data (destination, dates, budget, pace, interests, constraints, etc.)
- `GeneratedPlan`: Contains markdown output and sources array
- `LoadingState`: IDLE → GENERATING → SUCCESS/ERROR
- `Language`: 11 supported locales (en, zh-CN, zh-TW, ja, ko, hi, es, fr, ar, pt, ru)

### Internationalization (utils/i18n.ts)

- `TRANSLATIONS` object contains all UI strings for 11 languages
- `LANGUAGE_NAMES` maps language codes to native display names
- RTL support for Arabic (`dir="rtl"`)

### LLM Integration (`api/chat.ts` proxy)

- Browser → `/api/chat` (Vercel serverless function) → upstream LLM
- Provider selection: OpenRouter first (`OPENROUTER_API_KEY`), NVIDIA as fallback (`NVIDIA_API_KEY`)
- OpenRouter: `https://openrouter.ai/api/v1/chat/completions`, default model `minimax/minimax-m2.7`
- NVIDIA: `https://integrate.api.nvidia.com/v1/chat/completions`, default model `minimaxai/minimax-m2.7`
- Auto-retries upstream 5xx up to 3× with backoff
- Response includes `X-LLM-Provider` header indicating which provider served the request
- System instructions define strict output format:
  - Weather table (Date | Condition | Temp | Rain Probability | Strategic Advice)
  - Daily itinerary as markdown tables (Time Range | Activity | Logistics & Notes)
  - Geo-clustering logic, Plan B alternatives, budget breakdown

### Path Aliases

- `@/*` maps to project root (configured in tsconfig.json and vite.config.ts)
