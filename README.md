# AutoBrowse

A personal car-shopping workbook. AutoBrowse is a **local, private tool for your own research** — not a marketplace, dealer platform, or listing service. It helps you track vehicles you're considering, compare them side-by-side, and model the real cost of each option across cash, finance, and lease scenarios.

## Features

- **Garage** — add and manage vehicles you're shopping. Duplicate a vehicle to compare the same car across different payment modes (cash vs. finance vs. lease).
- **Compare** — side-by-side comparison of up to four vehicles across specs, pricing, and financials.
- **Matrix** — weighted scoring across configurable factors (price, range, reliability, etc.) to rank your options objectively.
- **Financial modeling** — monthly payment, total cost of ownership, out-the-door price, tax, trade-in offset, and lease residual calculations.
- **AI fill** — paste a URL or enter year/make/model/trim and Gemini fills in vehicle specs automatically.
- **Photo attachments** — attach images and notes to each vehicle.

Data is stored locally in a SQLite database (`garage.db`). Nothing leaves your machine except optional AI lookups to the Gemini API.

## Prerequisites

- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/) (free; required only for AI fill features)

## Installation

```bash
npm install
```

Copy the example env file and add your Gemini API key:

```bash
cp .env.example .env
# then edit .env and set VITE_GEMINI_API_KEY=AIza...
```

## Running

```bash
npm run dev        # start both API server (port 3000) and Vite dev server
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Other commands:

```bash
npm run build      # production build (tsc + vite)
npm run test       # run tests (vitest)
npm run lint       # eslint
```

## Architecture

Two-process dev setup: Vite (frontend) proxies `/api/*` requests to an Express server on port 3000. The Express server (`server.cjs`) uses `better-sqlite3` for local SQLite persistence. State is managed client-side with Zustand; all mutations are optimistic with API persistence fire-and-forget.

## License

MIT — see [LICENSE](LICENSE)
