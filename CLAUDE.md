# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start both Express API (port 3000) and Vite dev server concurrently
npm run dev:api      # Express API only
npm run dev:vite     # Vite only
npm run build        # tsc + vite build
npm run lint         # eslint
npm run test         # vitest run (single pass)
npm run test:watch   # vitest watch mode
```

Run a single test file: `npx vitest run src/__tests__/data.test.ts`

## Environment

Copy `.env.example` to `.env` and add a Gemini API key (from aistudio.google.com) before using AI features:

```
VITE_GEMINI_API_KEY=AIza...
VITE_GEMINI_MODEL=gemini-2.0-flash   # optional override
```

## Architecture

**Two-process dev setup:** Vite proxies all `/api/*` requests to the Express server on port 3000 (`vite.config.ts`). The Express server (`server.cjs`) is CommonJS (not ESM) because it runs directly with Node and uses `better-sqlite3`.

**Data persistence:** SQLite via `better-sqlite3` in `garage.db`. The schema stores vehicles and matrix config as JSON blobs — no column-per-field. All mutations go through `useStore.ts`, which calls the REST API fire-and-forget (mutations are optimistic).

**State management:** Single Zustand store (`src/store/useStore.ts`). `init()` loads from the API on app mount; if the DB is empty it seeds demo vehicles. All vehicle mutations update local state immediately, then persist to the API with `.catch(console.error)`.

**Data model (`src/lib/data.ts`):** The central file. Contains:
- All TypeScript types (`Vehicle`, `MatrixFactor`, `Pricing`, `Finance`, `Lease`, etc.)
- Financial math functions: `financeCalc`, `leaseCalc`, `ownershipCalc`, `outTheDoor`, `taxesOn`
- Matrix scoring: `matrixScores` normalizes metrics min–max across active vehicles then applies weights
- Seed vehicles and `DEFAULT_MATRIX`
- `deepMerge` utility used for partial vehicle updates

**Pricing scenarios:** Each `Vehicle` has a `pricingMode` (`cash | finance | lease`) and a `groupId`. Duplicating a vehicle preserves `groupId`, enabling the same physical car to be compared across payment modes on the Garage page.

**AI features (`src/lib/geminiScrape.ts`):**
- `scrapeVehicleFromUrl(url)` — sends the URL to Gemini; model uses training knowledge to return vehicle fields as JSON
- `lookupVehicleSpecs(year, make, model, trim)` — specs-only lookup, no URL needed
- Both use `VITE_GEMINI_API_KEY` / `VITE_GEMINI_MODEL` from env. Friendly error messages are extracted from Gemini's error JSON in `friendlyError()`.
- HTML fallback (`src/lib/htmlScrape.ts`) hits `GET /api/scrape-html?url=...` which fetches the page server-side and parses `og:*` meta tags.

**Pages:** `Dashboard`, `Garage`, `VehicleDetail`, `Compare`, `Matrix` — each paired with a `.module.css`. Routes are defined in `src/App.tsx`. `VehicleDetail` has tabs: Overview, Specifications, Ratings, Test Drive, Pricing, Finance, Lease, Cost to Own, Attachments.

**Components:** Small, focused UI atoms in `src/components/` (`Field`, `Icon`, `Modal`, `PhotoSlot`, `PowertrainBadge`, `RatingDots`, `ScoreBar`, `SectionLabel`, `Segmented`, `Stat`). Icons are referenced from `public/icons.svg` as SVG sprites.

**Styling:** CSS Modules per component/page. Global design tokens in `src/styles/tokens.css`; base resets in `src/styles/global.css`. No CSS-in-JS, no Tailwind.

**Tests:** Vitest + jsdom. Only `src/lib/data.ts` has tests (`src/__tests__/data.test.ts`). Tests cover all financial math and matrix scoring.

## Key invariants

- `taxesOn()` taxes `(sellingPrice − tradeValue)`, not the full price. Trade-in reduces the taxable base.
- `financeCalc()` principal = `outTheDoor − downPayment − tradeValue` (trade reduces loan, not OTD).
- `leaseCalc()` monthly is clamped to `≥ 0` (extreme trade/incentives can make cap < residual).
- `matrixScores()` only scores non-archived vehicles; `archived: true` = excluded from matrix.
- `deepMerge` replaces arrays entirely rather than merging them (intentional — used for `attachments`).
