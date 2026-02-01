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

Set `OPENROUTER_API_KEY` in `.env.local` for the OpenRouter API integration.

## Architecture

### Application Flow

1. **App.tsx** - Main orchestrator: manages language state (11 languages), loading states, localStorage persistence, routes between InputForm/ItineraryDisplay, handles share links via `?share=` URL param
2. **InputForm.tsx** - Multi-section form with custom date picker, multi-select chips for interests/constraints/transport/diet
3. **ItineraryDisplay.tsx** - Renders generated plans with export options (copy, download markdown, print, share link, share card)
4. **services/geminiService.ts** - Constructs prompts with language-specific instructions, calls OpenRouter API

### Component Hierarchy

- **LoadingOverlay.tsx** - Animated loading screen with rotating tips (uses Lottie)
- **MarkdownRenderer.tsx** - Custom renderer for Trip OS output format (tables, headers, checkboxes, blockquotes, `[Context]` highlights)
- **ShareCard.tsx** - Visual share card for social media (destination, dates, itinerary preview)
- **SocialProof.tsx** - Display component for social proof elements

### State Management

- React useState/useEffect only (no external state library)
- Persists to localStorage under `trip_os_v1_state` (trip input + generated plans)
- Language detection: URL `?lang=` → browser language → fallback to `zh-TW`

### Sharing System (utils/shareStorage.ts)

- Stores shared plans in localStorage under `trip_os_shared_plans` (max 50 plans)
- Generates 8-character URL-safe IDs for share links
- Share URL format: `?share={id}&lang={lang}`

### Key Data Types (types.ts)

- `TripInput`: 16-field form data (destination, dates, budget, pace, interests, constraints, etc.)
- `GeneratedPlan`: Contains markdown output and sources array
- `LoadingState`: IDLE → GENERATING → SUCCESS/ERROR
- `Language`: 11 supported locales (en, zh-CN, zh-TW, ja, ko, hi, es, fr, ar, pt, ru)

### Internationalization (utils/i18n.ts)

- `TRANSLATIONS` object contains all UI strings for 11 languages
- `LANGUAGE_NAMES` maps language codes to native display names
- RTL support for Arabic (`dir="rtl"`)

### OpenRouter Integration

- Uses `xiaomi/mimo-v2-flash:free` model via OpenRouter API
- System instructions define strict output format:
  - Weather table (Date | Condition | Temp | Rain Probability | Strategic Advice)
  - Daily itinerary as markdown tables (Time Range | Activity | Logistics & Notes)
  - Geo-clustering logic, Plan B alternatives, budget breakdown

### Path Aliases

- `@/*` maps to project root (configured in tsconfig.json and vite.config.ts)
