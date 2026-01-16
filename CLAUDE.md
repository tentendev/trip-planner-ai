# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trip OS is an AI-powered travel planning application that generates comprehensive, actionable travel itineraries using Google's Gemini API. Built with React 19, TypeScript, and Vite.

## Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

Set `OPENROUTER_API_KEY` in `.env.local` for the OpenRouter API integration.

## Architecture

### Application Flow

1. **App.tsx** - Main orchestrator: manages language state (11 languages), loading states, localStorage persistence, and routes between InputForm and ItineraryDisplay
2. **InputForm.tsx** - Multi-section form with custom date picker, multi-select chips, and smart suggestions
3. **ItineraryDisplay.tsx** - Renders generated plans with export options (copy, download markdown, print)
4. **geminiService.ts** - Constructs prompts with language-specific instructions and calls Gemini API with Google Search grounding

### State Management

- Uses React useState/useEffect (no external state library)
- Persists trip input and generated plans to localStorage under `trip_os_v1_state`
- Language detection: URL param (`?lang=`) → browser language → fallback to `zh-TW`

### Key Data Types (types.ts)

- `TripInput`: 16-field form data (destination, dates, budget, pace, interests, constraints, etc.)
- `GeneratedPlan`: Contains markdown output and grounding sources from Gemini
- `LoadingState`: IDLE → GENERATING → SUCCESS/ERROR
- `Language`: 11 supported locales (en, zh-CN, zh-TW, ja, ko, hi, es, fr, ar, pt, ru)

### Internationalization (utils/i18n.ts)

- `TRANSLATIONS` object contains all UI strings for 11 languages
- `LANGUAGE_NAMES` maps language codes to native display names
- RTL support for Arabic (`dir="rtl"`)

### OpenRouter Integration (services/geminiService.ts)

- Uses OpenRouter API with `xiaomi/mimo-v2-flash:free` model
- System instructions define "Trip OS" persona with strict output format requirements:
  - Weather table with forecast/historical data
  - Daily itinerary as markdown tables
  - Geo-clustering logic, Plan B alternatives, budget breakdown

### Custom Markdown Renderer (components/MarkdownRenderer.tsx)

- Purpose-built for Trip OS output format
- Handles tables, headers (h2-h4), ordered/unordered lists, checkboxes, blockquotes
- Special formatting for `[Context]` brackets (amber highlight)

### Path Aliases

- `@/*` maps to project root (configured in tsconfig.json)
