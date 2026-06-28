# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start both Express API (port 3000) and Vite dev server concurrently
npm run dev:api      # Express API only
npm run dev:vite     # Vite only
npm run build        # tsc -b + vite build
npm run lint         # eslint
npm run test         # vitest run (single pass)
npm run test:watch   # vitest watch mode
```

Run a single test file: `npx vitest run src/__tests__/data.test.ts`

**Type-checking:** The root `tsconfig.json` is references-only (no `include`). Running `npx tsc --noEmit` checks nothing. Always use `npx tsc -b` to type-check via project references.

## Environment

Copy `.env.example` to `.env` and add a Gemini API key (from aistudio.google.com) before using AI features. The key is **server-side only** (no `VITE_` prefix) — the API proxies Gemini so it is never shipped to the browser:

```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-3.1-flash-lite   # optional override
```

## Architecture

**Two-process dev setup:** Vite proxies all `/api/*` requests to the Express server on port 3000 (`vite.config.ts`). The Express server (`server.js`) is ESM and exports the `app` (it only calls `listen()` when run directly, so a serverless handler can import it). Requires Node 22 (`engines` field + `.nvmrc`).

**Data persistence:** libSQL via `@libsql/client` (`db.js`). Connection is env-driven: with no env it falls back to a local SQLite file (`file:garage.db`) so dev runs fully offline; set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` to use a hosted Turso DB (production/Vercel). The client API is async — all server route handlers `await db.execute(...)`. The schema stores vehicles and matrix config as JSON blobs — no column-per-field. All mutations go through `useStore.ts`, which calls the REST API fire-and-forget (mutations are optimistic).

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
- Both call the server-side proxy `POST /api/gemini` (the browser never holds the key). The server (`server.js`) reads `GEMINI_API_KEY` / `GEMINI_MODEL` (server-only — no `VITE_` prefix) and forwards to Gemini. Friendly error messages are extracted from Gemini's error JSON in `friendlyError()` on the client.
- HTML fallback (`src/lib/htmlScrape.ts`) hits `GET /api/scrape-html?url=...` which fetches the page server-side and parses `og:*` meta tags.
- Wikipedia photo fallback (`GET /api/wiki-photo?year=&make=&model=`) tries progressively simpler Wikipedia article titles to find a vehicle photo.

**Formatters (`src/lib/fmt.ts`):** `money()`, `moneyK()`, `pct()`, `score()`, `vehicleName()`. Uses `en-CA` locale (Canadian dollar formatting). All UI numbers should go through these.

**Features (`src/features/`):** `VehicleForm` is the main vehicle add/edit modal (handles both AI fill and manual entry). `ExcludeModal` manages matrix exclusions.

**Layout:** `AppShell` (`src/layouts/AppShell.tsx`) wraps all pages with the nav sidebar.

**REST API endpoints (server.js):** `GET/POST /api/vehicles`, `PUT/DELETE /api/vehicles/:id`, `GET/PUT /api/matrix`, `POST /api/gemini` (Gemini proxy — the browser never holds the key), `GET /api/scrape-html?url=`, `GET /api/wiki-photo?year=&make=&model=`. Auth endpoints (registered in `auth.js`): `GET /api/auth`, `POST /api/login`, `POST /api/logout`. Vehicles and matrix are stored as JSON blobs in libSQL/SQLite — the schema has no column-per-field.

**Auth (`auth.js`):** Single-superuser gate over the whole API. `installAuthRoutes(app)` registers the public endpoints — `GET /api/auth` (status), `POST /api/login`, `POST /api/logout` — and must be mounted *before* `app.use('/api', requireAuth)` so the data routes are gated but login is reachable. The API, not the UI, is the security boundary (the SPA shell is static and anyone can call `/api/*`). Sessions are **stateless**: an HMAC-signed, expiring token in an HttpOnly+SameSite=Lax cookie (`ab_session`), so it works across ephemeral serverless instances with no session store. The gate is **enabled only when a password is configured** — with no `AUTH_PASSWORD`/`AUTH_PASSWORD_HASH` set, `requireAuth` is a no-op, so local dev stays open and offline. Prefer `AUTH_PASSWORD_HASH` (scrypt `salt:hash` from `node scripts/hash-password.mjs '...'`) over plaintext `AUTH_PASSWORD`. Frontend gate is `src/features/AuthGate.tsx` (wraps `<App/>` in `main.tsx`) + `src/features/Login.tsx`; sign-out lives in `AppShell` and reloads to re-gate.

**Deployment (Vercel):** `api/index.js` re-exports the Express `app` as a single serverless function. `vercel.json` rewrites `/api/*` to that function and falls everything else back to `index.html` (SPA). Locally the same `app` is served by `server.js` via the Vite proxy; nothing about local dev changes. All required env vars are **server-side** (none are `VITE_`/public): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and (to enable the login gate) `AUTH_PASSWORD_HASH` (or `AUTH_PASSWORD`) + optional `AUTH_USERNAME` / `AUTH_SECRET` / `AUTH_SESSION_DAYS`. Set them in the Vercel dashboard. Locally, `node` loads them via `--env-file-if-exists=.env` (see the `dev`/`dev:api` scripts).

**Pages:** `Dashboard`, `Garage`, `VehicleDetail`, `Compare`, `Matrix` — each paired with a `.module.css`. Routes are defined in `src/App.tsx`. `VehicleDetail` has tabs: Overview, Specifications, Ratings, Test Drive, Pricing, Finance, Lease, Cost to Own, Attachments.

**Components:** Small, focused UI atoms in `src/components/` (`Field`, `Icon`, `Modal`, `PhotoSlot`, `PowertrainBadge`, `RatingDots`, `ScoreBar`, `SectionLabel`, `Segmented`, `Stat`). Icons are referenced from `public/icons.svg` as SVG sprites.

**Styling:** CSS Modules per component/page. Global design tokens in `src/styles/tokens.css`; base resets in `src/styles/global.css`. No CSS-in-JS, no Tailwind.

**Tests:** Vitest + jsdom. Suites live in `src/__tests__/`: `data.test.ts` (financial math + matrix scoring), `fmt.test.ts` (formatters), `geminiScrape.test.ts` and `htmlScrape.test.ts` (AI/scrape JSON parsing), and `store.test.ts` (Zustand store).

## Key invariants

- `taxesOn()` returns BC vehicle tax (`bcTax().totalTax` = GST + tiered PST + federal luxury tax) per PST Bulletin 308; it no longer uses the flat `pricing.taxRate`. Dealer base = `sellingPrice − tradeValue`; private sale = full `sellingPrice` with no GST. Use `bcTax()` for the `{ gst, pst, luxuryTax, totalTax, totalPrice }` breakdown. The legacy `taxRate` field now only drives `leaseCalc` lease-payment tax. ZEV PST schedule sunsets 2027-02-22 (`bcTax(p, asOf)`).
- `financeCalc()` principal = `outTheDoor − downPayment − tradeValue` (trade reduces loan, not OTD).
- `leaseCalc()` monthly is clamped to `≥ 0` (extreme trade/incentives can make cap < residual).
- `matrixScores()` only scores non-archived vehicles; `archived: true` = excluded from matrix.
- `deepMerge` replaces arrays entirely rather than merging them (intentional — used for `attachments`).
