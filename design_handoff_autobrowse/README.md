# Handoff: AutoBrowse — Personal Car-Shopping Workbook

## Overview
AutoBrowse is a **personal, single-user car-shopping workbook** — a local-first app that replaces the spreadsheet people build when cross-shopping cars. It lets one person log the vehicles they're considering, record specs / ratings / test-drive impressions, model purchase / finance / lease / ownership costs, and — the centerpiece — **compare vehicles side-by-side** and rank them with a weighted **decision matrix**.

There are no accounts, no backend, no notifications, no dealer CRM. All data lives on the user's device.

---

## About the Design Files
The files in `source/` are a **design reference implemented in HTML/React-via-Babel** — a working prototype that demonstrates the intended look, layout, calculations, and interactions. **They are not meant to be shipped as-is.**

The task is to **recreate this design in the target codebase's environment**, using its established framework, component library, state management, and styling conventions. If there is no existing codebase yet, pick an appropriate stack (the prototype maps cleanly onto React + TypeScript + a CSS solution of your choice, or any component framework) and implement the designs there.

The prototype loads React 18 + Babel from a CDN and splits the app across plain `.jsx` files that attach components to `window`. That loading strategy is a prototyping convenience — **replace it with the codebase's normal module system / build pipeline.** The *logic* in `data.jsx` (data model + financial math) is the most directly reusable part and should be ported close to verbatim.

---

## Fidelity
**High-fidelity.** Final colors, typography, spacing, component styling, interactions, and calculations are all specified. Recreate the UI faithfully using the codebase's existing primitives. The one exception: vehicle photos are intentionally rendered as **striped placeholders** — wire these to real image upload/display in production.

---

## Tech Stack of the Prototype (for reference)
- **React 18.3.1** (UMD, via CDN) with in-browser **Babel** transform.
- No router — a single `route` state string (`'dashboard' | 'garage' | 'compare' | 'matrix' | 'detail'`) drives which view renders. Replace with the codebase's router.
- **Persistence:** the entire app state is serialized to `localStorage` under the key `autobrowse_v1` on every change, and re-hydrated on load. Seed data is used only when nothing is stored.
- Fonts via Google Fonts: **Newsreader** (serif), **Hanken Grotesk** (sans), **IBM Plex Mono** (mono/numbers).

### File map (`source/`)
| File | Responsibility |
|---|---|
| `index.html` | Document shell, CSS custom properties (design tokens), global CSS, font + script loading, boot splash. |
| `data.jsx` | **Data model, seed vehicles, all financial calculations, decision-matrix scoring, and the `useStore` persistence hook.** Port this first. |
| `ui.jsx` | Shared primitives: money/number formatters, `PowertrainBadge`, `ScoreBar`, `RatingDots`, `Field`, `TextInput`, `NumInput`, `Select`, `Segmented`, `Stat`, `Modal`, `Icon`, `EmptyState`, `SectionLabel`, `PhotoSlot`, `vehicleName`. |
| `Dashboard.jsx` | Shortlist overview screen. |
| `Garage.jsx` | Vehicle library (cards, filtering, sorting, exclude/restore). |
| `VehicleForm.jsx` | Add/edit modal + `ExcludeModal` (set-aside reason capture). |
| `VehicleDetail.jsx` | Tabbed single-vehicle workbook (9 tabs). |
| `Compare.jsx` | Side-by-side comparison table (the hero) + ranking + vehicle picker. |
| `Matrix.jsx` | Weighted decision matrix. |
| `App.jsx` | Shell, sidebar nav, routing, modal orchestration, Tweaks panel. |
| `tweaks-panel.jsx` | Prototype-only theming panel. **Omit from production** — it's a design-exploration tool, not a product feature. |

---

## Design Tokens

All tokens are defined as CSS custom properties in `index.html` (`:root`). Exact values:

### Colors
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#faf6ef` | App background (warm cream) |
| `--paper-2` | `#f4eee3` | Subtle raised/zebra background, segmented track |
| `--card` | `#fffdf8` | Card / panel surface |
| `--ink` | `#2e2620` | Primary text |
| `--ink-soft` | `#6f6457` | Secondary text |
| `--ink-faint` | `#9b8f7e` | Labels, captions, placeholders |
| `--line` | `#e4dccd` | Borders |
| `--line-soft` | `#ece5d8` | Inner dividers, row separators |
| `--accent` | `#b4552d` | Primary action / brand (burnt orange) |
| `--accent-soft` | `#f0d9c9` | Accent border tint |
| `--accent-tint` | `#fbeee4` | Accent fill (selected rows, "best" cells, badges) |
| `--neutral` | `#d9cdba` | Scrollbar, muted chips |
| `--good` | `#4f7a52` | Positive deltas (discounts, hybrid) |
| `--good-tint` | `#e6efe4` | Hybrid badge bg |
| `--warn` | `#b07d2a` | Warning (weight ≠ 100%) |
| `--bad` | `#a9492f` | Destructive (delete) |

**Powertrain accent colors** (used for badges + the per-vehicle "spine" accent default): gas `#8a7a5c`, hybrid `#4f7a52`, ev `#3f6f8f`.
**Per-vehicle accent palette** (user-selectable per car): `#b4552d`, `#4f7a52`, `#3f6f8f`, `#7a5aa8`, `#8a7a5c`, `#a9492f`. Each vehicle stores its own `accent`, used for its spine bar, score bars, and stat highlights.

### Typography
| Token | Stack |
|---|---|
| `--serif` | `'Newsreader', Georgia, serif` — all headings (`h1`–`h4`), vehicle names |
| `--sans` | `'Hanken Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif` — body, UI, labels |
| `--mono` | `'IBM Plex Mono', ui-monospace, monospace` — **all numbers** (prices, specs, scores), via `.num` class with `font-variant-numeric: tabular-nums` |

Headings: `font-weight: 500`, `letter-spacing: -0.01em`, `line-height: 1.12`.
Type sizes in use (px): page title `30–32`, section/spotlight title `21–27`, card title `17–19`, body `13.5–14.5`, labels `11` (uppercase, `letter-spacing: .06–.08em`), big stat numbers `20–34`.

### Radius / Shadow / Spacing
| Token | Value |
|---|---|
| `--r-sm` | `6px` (buttons, inputs) |
| `--r` | `10px` (cards) |
| `--r-lg` | `16px` (modals) |
| `--shadow` | `0 1px 2px rgba(46,38,32,.04), 0 8px 24px -16px rgba(46,38,32,.18)` |
| `--shadow-lg` | `0 1px 2px rgba(46,38,32,.05), 0 24px 48px -28px rgba(46,38,32,.30)` (modals, hover) |

Layout: sidebar fixed **246px**; main content `max-width: 1320px`, centered, horizontal padding driven by a density setting (compact 24 / regular 36 / comfy 48 px). Card grids use `repeat(auto-fill, minmax(296px, 1fr))` with `20px` gap.

### Motion
- Page/section entrance: `.fade-in` → `@keyframes fade { from { transform: translateY(7px) } to { transform: none } }`, `0.4s cubic-bezier(.2,.7,.2,1)`. **Note: animate transform only, never opacity from 0** — an opacity-0 start can leave content invisible if the animation clock is throttled (offscreen iframe / print). Keep content visible by default.
- Score/progress bars: `width` transition `0.4–0.5s cubic-bezier(.2,.7,.2,1)`.
- Buttons / interactive: `all .14s ease`.

---

## Data Model

One TypeScript-style shape per vehicle (see `blankVehicle()` in `data.jsx`):

```ts
type Powertrain = 'gas' | 'hybrid' | 'ev';

interface Vehicle {
  id: string;
  archived: boolean;          // true === "excluded / set aside"
  excludeReason: string;      // optional reason text
  excludedAt: number;         // timestamp
  createdAt: number;
  viewedAt: number;           // for "recently viewed"

  // Identity
  make: string; model: string; year: number; trim: string;
  bodyStyle: string;          // Sedan | Coupe | Hatchback | SUV | Crossover | Truck | Minivan | Wagon
  condition: 'New' | 'Used' | 'CPO';
  mileage: number; color: string; dealer: string; listingUrl: string;
  accent: string;             // hex, per-vehicle accent
  powertrain: Powertrain;
  notes: string;

  specs: {                    // all optional; EV-only vs gas/hybrid fields differ
    engine?: string; horsepower?: number; torque?: number;
    transmission?: string; drivetrain?: string;
    mpgCombined?: number;     // gas/hybrid
    mpge?: number; evRange?: number; batteryKwh?: number;  // EV only
    seating?: number; cargoCuFt?: number; towingLbs?: number;
    lengthIn?: number; legroomFront?: number; legroomRear?: number; groundClear?: number;
  };

  ratings: Record<string, number>;        // 1–10 per category (comfort, driving, interior, technology, appearance, cargo, value)
  testDrive: Record<string, number>;      // 1–10 per category (rideQuality, visibility, seatComfort, cabinNoise, acceleration, steeringFeel)
  testDriveNotes: Record<string, string>; // free text per test-drive category

  pricing: { msrp; sellingPrice; discounts; incentives; tradeValue; taxRate /* % */; fees };
  finance: { downPayment; apr /* % */; termMonths };
  lease:   { termMonths; residualPct /* % of MSRP */; downPayment; annualMiles; moneyFactor };
  ownership: { annualMiles; fuelCostPerGal; electricityPerKwh; insuranceYr; maintenanceYr };

  attachments: { id: string; name: string; type: 'pdf' | 'image' | string }[];
}
```

The spec fields, rating categories, test-drive categories, and matrix metrics are all defined as **data arrays** at the top of `data.jsx` (`SPEC_FIELDS`, `RATING_CATS`, `TESTDRIVE_CATS`, `MATRIX_METRICS`) — driving both the forms and the comparison rows. Preserve this data-driven approach; don't hard-code field lists in the views.

`SPEC_FIELDS` entries carry: `key`, `label`, `group` (Powertrain / Efficiency / Practicality / Dimensions / Comfort), optional `unit`, `kind: 'text'`, `better: 'high' | 'low'` (drives best-in-row highlighting), and `evOnly` / `evHide` flags to show/hide by powertrain.

---

## Financial Calculations
Port these **exactly** — they're the product's substance. All in `data.jsx`.

- **Taxes:** `taxableAmount = max(0, sellingPrice − tradeValue)`; `taxes = taxable × taxRate%`.
- **Out-the-door:** `sellingPrice + taxes + fees − incentives`. (Trade-in is applied to the loan principal, not OTD.)
- **Finance** (`financeCalc`): `principal = max(0, OTD − downPayment − tradeValue)`; standard amortization `monthly = principal·r / (1 − (1+r)^−n)` where `r = apr/100/12`, `n = termMonths` (handle `r === 0`). Also returns `totalPaid = monthly·n + downPayment` and `totalInterest = monthly·n − principal`.
- **Lease** (`leaseCalc`): `cap = max(0, sellingPrice − downPayment − tradeValue − incentives)`; `residual = (msrp||sellingPrice) × residualPct%`; `depreciation = (cap − residual)/term`; `financeCharge = (cap + residual) × moneyFactor`; `monthly = (depreciation + financeCharge) × (1 + taxRate%)`; `totalLease = monthly·term + downPayment`; `buyout = residual`. (Money factor → APR ≈ `moneyFactor × 2400`.)
- **Energy/fuel per year** (`energyCostPerYear`): EV → `(annualMiles / 3.3 miPerKwh) × electricityPerKwh`; gas/hybrid → `(annualMiles / mpgCombined) × fuelCostPerGal`.
- **Ownership** (`ownershipCalc`): `perYear = energy + insuranceYr + maintenanceYr`; returns `y1`, `y3` (×3), `y5` (×5). **Excludes depreciation** by design.
- **Average rating** (`avgRating`): mean of non-zero `ratings` values.

### Decision Matrix Scoring (`matrixScores`)
1. Take active (non-archived) vehicles + a list of `{ metric, weight }` factors.
2. For each factor, compute each vehicle's raw value via `MATRIX_METRICS[metric].fn(v)`, then **min-max normalize across the active set** to 0..1. If the metric's `dir === 'low'` (lower is better, e.g. price), invert: `n = 1 − n`.
3. Contribution per factor = `n × 100 × (weight / totalWeight)`. Vehicle score = sum of contributions. Sort descending.
4. Return `{ vehicle, score, breakdown: { [metric]: { raw, norm, contrib } } }[]`.

Available metrics (`MATRIX_METRICS`): price (low), monthly payment (low), 5-yr ownership (low), comfort/seatComfort/interior/tech ratings (high), rear legroom (high), cargo (high), efficiency (high), performance/hp (high). **Default factors & weights:** Price 30, Comfort 20, Seat Comfort 15, Rear Legroom 10, 5-yr Ownership 15, Interior 10.

---

## Screens / Views

### 1. App Shell (`App.jsx`)
- **Layout:** fixed 246px left **sidebar** (`--card` bg, right border) + scrolling main column (max 1320px, centered).
- **Sidebar contents (top→bottom):** brand lockup (40px accent rounded square with car glyph + "AutoBrowse" serif / "shopping workbook" caption); nav list (Dashboard, Garage, Compare, Decision Matrix) — active item has `--accent-tint` bg + `--accent` text + 600 weight; Compare item shows a count badge of selected vehicles; footer with a full-width primary "Add vehicle" button and a "{n} active · saved on this device" line.
- **Nav active states:** detail view keeps "Garage" highlighted. Hover on inactive = `--paper-2` bg.

### 2. Dashboard (`Dashboard.jsx`)
- **Header:** date eyebrow (mono, uppercase) + "Your shortlist" (serif 32). Right: "Compare {n}" + "Decision matrix" buttons.
- **Summary band** (card, 4-col grid of `Stat`): In the running (active/total), Price range, Lowest payment (car name), Top match (matrix points + car).
- **Top-pick spotlight** (clickable card): left = 270px photo placeholder; right = "★ Best overall match" + powertrain chips, serif name, trim, and a row of 4 stats (weighted score, price, est./mo, your rating). Sourced from `matrixScores(...)[0]`.
- **Four panel cards** (2×2 grid): *Best monthly payment*, *Lowest 5-year cost*, *Top matches* (with "Adjust weights" link to Matrix), *Recently viewed*. Leader rows show rank, vehicle accent spine, name/trim, a mini progress bar, and the metric value. Rows hover `--paper-2`, click → vehicle detail.

### 3. Garage (`Garage.jsx`)
- **Header:** "Garage" + subtitle "{active} in consideration · {selected} selected to compare · {n} excluded". Right: primary "Log a vehicle".
- **Controls row:** powertrain `Segmented` (All / Gas / Hybrid / Electric) on the left; "Sort" `Select` (Recently added, Lowest price, Lowest payment, Highest rating, Best economy, Name A–Z) and a status `Select` (In consideration (n) / Excluded (n) / Show all) on the right.
- **Card grid:** `auto-fill minmax(296px,1fr)`, 20px gap. **VehicleCard:**
  - Photo placeholder (140px) with the vehicle's color label and accent stripe; powertrain badge top-left; **compare toggle button** top-right (30px; checked = filled accent with check icon; unchecked = bordered with compare icon) — *hidden on excluded cards*.
  - Body: "{year} · {bodyStyle}" eyebrow, "{make} {model}" serif title (ellipsis), trim; a **⋯ overflow menu** (Edit details, Duplicate, Exclude/Restore, divider, Delete-in-red with confirm).
  - **Active card** footer: 2×2 grid — Price (accent), Est./mo (+term), Your rating (score bar), 5-yr cost — then full-width "Open workbook →".
  - **Excluded card:** whole card slightly muted (opacity .9), photo gets a dark scrim + "EXCLUDED" chip; footer shows "Set aside: {reason}" and a "Restore" + "Open" button pair. Not selectable for compare.

### 4. Vehicle Detail / Workbook (`VehicleDetail.jsx`)
- **Back link** → garage. **Header:** accent spine bar + serif name + powertrain badge (+ "Excluded" chip if archived); subtitle "{trim} · {condition} · {bodyStyle} · {dealer}". Right: Edit, Duplicate, and **Exclude / Restore** buttons.
- **Excluded banner** (when archived): muted card with "Set aside from your shortlist. — {reason}" + "Restore to shortlist".
- **Tab bar** (horizontally scrollable, accent underline on active): **Overview, Specifications, Ratings, Test Drive, Pricing, Finance, Lease, Cost to Own, Attachments.**
  - **Overview:** 230px photo, key-spec grid (hp, economy/range, seating, cargo, towing, drivetrain), editable Notes textarea; right rail of result stats (Out-the-door big/accent, Finance/mo, Lease/mo, 5-yr running cost, overall rating) + "View listing" link.
  - **Specifications:** grouped editable rows (text or number-with-unit), EV-only fields shown only for EVs.
  - **Ratings:** accent summary card (overall average /10 + bar) then a `RatingDots` (1–10 clickable squares) row per category.
  - **Test Drive:** per category, a `RatingDots` score **and** a free-text impression input.
  - **Pricing:** left = editable negotiation/trade/charges fields; right = sticky **out-the-door breakdown** (line items with discounts/incentives shown as green negatives, total in accent).
  - **Finance / Lease / Cost to Own:** left = inputs (with `Segmented` term pickers, sliders where noted); right = sticky live-computed `ResultStat` cards. All recompute on every keystroke.
  - **Attachments:** "PDF / quote" and "Photo" add buttons; grid of placeholder tiles with name + remove. (Wire to real uploads in production.)

### 5. Compare — THE HERO (`Compare.jsx`)
- **Header:** "Compare" + "Side-by-side across {n} vehicles. Best value in each row is marked." Right: "Rank by" `Select` + "Vehicles" button (opens picker).
- **Section toggle pills** (rounded, accent when on, `white-space: nowrap`): Specifications, Your Ratings, Test Drive, Pricing, Finance, Lease, Cost to Own. Toggling includes/excludes whole sections from the table.
- **Rank by** reorders the *columns*: As selected, Lowest price, Lowest payment, Lowest lease, Lowest 5-yr cost, Best economy, Highest rating, Most power.
- **The table:** CSS grid, `220px` label column + one `minmax(168px,1fr)` column per vehicle; horizontally scrollable; sticky header row.
  - **Column header:** remove (×) button, accent bar, powertrain badge, serif vehicle name (click → detail), trim, price in the vehicle's accent.
  - **Section bands:** full-width `--paper-2` strip with accent uppercase section label.
  - **Rows:** label cell (left) + one cell per vehicle. Zebra striping. Numbers in mono. Rating/test-drive rows also render a score bar in the vehicle's accent.
  - **Best-in-row highlighting:** for rows with a `better` direction and ≥2 numeric values, the winning cell(s) get `--accent-tint` bg, accent text, 600 weight, and a small check icon. Computed in `buildRows()`.
- **Vehicle picker modal** (`ComparePicker`): list of active vehicles as toggle rows (accent when selected, check box on the right). Excluded vehicles never appear and are auto-removed from the comparison.

### 6. Decision Matrix (`Matrix.jsx`)
- **Header:** title + explainer.
- **Left panel (sticky):** "Factors & weights" with running total % (green at 100, warn otherwise). Each factor: name + "higher/lower = better" tag, live % of total, remove ×, and a `0–50` range slider (accent thumb). A "+ Add a factor…" select for unused metrics, and a "Normalize to 100%" button when the total ≠ 100.
- **Right (results):** one ranked card per active vehicle — rank number, accent spine, name + powertrain + "★ Top pick" on #1, and a big weighted score. Below: a **segmented contribution bar** (each factor a slice, width = its weight share, opacity = that vehicle's normalized strength on the factor) and a legend listing each factor's `+contribution`. #1 card has an accent top border.

---

## Interactions & Behavior
- **Add a vehicle:** "Log a vehicle" / "Add vehicle" → `VehicleForm` modal (identity, powertrain `Segmented`, condition, pricing snapshot, listing URL, accent swatch). Requires make + model. New cars prepend to the list and start in consideration.
- **Edit:** same modal pre-filled; replaces the vehicle wholesale (`replaceVehicle`). Inline edits inside the detail tabs patch immediately (`updateVehicle` deep-merges) and persist.
- **Duplicate:** deep-clones a vehicle, appends " (scenario)" to the trim — for modeling alternate pricing/financing on the same car.
- **Exclude (set aside):** `ExcludeModal` — vehicle summary + the line "It'll drop out of comparisons, rankings and the matrix — but stays saved under Excluded, so you can bring it back anytime." Reason chips (Over budget, Too small / not enough cargo, Didn't like the drive, Reliability concerns, A better option won out, No longer available) + free-text "Or write your own…". Confirm sets `archived = true`, stores the reason, **and removes the car from the compare selection.** Excluded cars are filtered out of Dashboard, Compare, Matrix, and the default Garage view.
- **Restore:** one click from the card, detail header, or banner → `archived = false`.
- **Delete:** overflow menu → native confirm → permanent removal.
- **Compare selection:** persists in app state (`compareIds`); seeded with the first 3 active vehicles; toggled from Garage cards or the Compare picker; auto-pruned when a car is deleted or excluded.
- **Recently viewed:** opening a vehicle stamps `viewedAt`.

## State Management
- Single source of truth: `{ vehicles: Vehicle[], matrix: Factor[] }`, owned by `useStore` and mirrored to `localStorage['autobrowse_v1']` on change. Replace with the codebase's store (Redux/Zustand/Context/etc.) and, if a backend is ever added, swap the localStorage mirror for API calls — the action surface is small and already centralized.
- **Store actions:** `addVehicle, updateVehicle (deep-merge patch), replaceVehicle, removeVehicle, toggleArchive, setExcluded(id, bool, reason), duplicateVehicle, touchViewed, setMatrix, resetAll`.
- **UI state in `App`:** `route`, `vehicleId`, `compareIds`, `formOpen`, `editing`, `excludeTarget`. Replace `route`/`vehicleId` with real routes (`/`, `/garage`, `/compare`, `/matrix`, `/vehicle/:id`).

## Assets
- **No real images.** Vehicle photos and attachments are striped CSS placeholders (`PhotoSlot`) — implement real image upload/storage and render here.
- **Icons** are inline SVG paths in `ui.jsx`'s `Icon` component (dashboard, garage, compare, matrix, rank, plus, edit, trash, copy, archive, car, star, link, check, x, chevron, gauge, note, money). Swap for the codebase's icon set; names map intuitively.
- **Fonts:** Newsreader, Hanken Grotesk, IBM Plex Mono (Google Fonts). Substitute brand fonts if the codebase has them; keep the serif-display / sans-UI / mono-numbers split.

## Notes & Recommendations
- **Don't port `tweaks-panel.jsx`** — it's a design-time theming tool, not product UI.
- The **mono-for-all-numbers** rule (`.num` class, tabular figures) is core to the workbook feel — keep it.
- Seed data in `data.jsx` (Accord Hybrid, Model 3, RAV4, IONIQ 6) is illustrative; replace with an empty state or onboarding for real users.
- Calculations are intentionally transparent client-side math — no rounding surprises. Keep them unit-tested if ported.
- Suggested future work the prototype is structured for: a **depreciation/resale** line in Cost-to-Own, image uploads, and a **printable one-page comparison** export.
