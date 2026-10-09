import { makeFee, POWERTRAINS, BODY_STYLES, type Vehicle, type Features, type Condition, type Powertrain } from './data';

const EXTRACT_PROMPT = `You are a car data expert. Given a URL, identify the vehicle and return its details
using your training knowledge of that model. The URL may be a manufacturer model page or a dealer listing.

Return ONLY a valid JSON object — no markdown fences, no explanation.
Omit any field you are not confident about. Never fabricate values you don't know.

UNITS: All values must be in Canadian/metric units:
- Range / distance → kilometres (km)
- Dimensions → centimetres (cm)
- Cargo volume → litres (L)
- Torque → Newton-metres (Nm)
- Towing capacity → kilograms (kg)
- Fuel economy → litres per 100 km (L/100km)
- EV efficiency → litres equivalent per 100 km (Le/100km)
- Prices → CAD as shown on the page

PHOTO: Use the og:image meta tag URL if present (most reliable). Otherwise use the
src of the largest primary vehicle hero image. Always return a fully-qualified absolute URL.

{
  "make": "string",
  "model": "string",
  "year": 0,
  "trim": "string (base trim name, or most common trim shown)",
  "powertrain": "gas" | "hybrid" | "ev",
  "bodyStyle": "Sedan" | "Coupe" | "Hatchback" | "SUV" | "Crossover" | "Truck" | "Minivan" | "Wagon",
  "condition": "New" | "Used" | "CPO",
  "mileage": 0,
  "color": "string (exterior color name, if a specific car)",
  "dealer": "string (dealership name, if a dealer listing)",
  "photoUrl": "string (absolute URL to primary vehicle image)",

  "pricing": {
    "msrp": 0,
    "sellingPrice": 0,
    "discounts": 0,
    "incentives": 0,
    "fees": 0
  },

  "finance": {
    "apr": 0,
    "termMonths": 0
  },

  "lease": {
    "termMonths": 0,
    "residualPct": 0,
    "downPayment": 0,
    "annualKm": 0,
    "moneyFactor": 0
  },

  "specs": {
    "engine": "string",
    "horsepower": 0,
    "torque": 0,
    "transmission": "string",
    "drivetrain": "string",
    "fuelL100km": 0,
    "fuelL100kmCity": 0,
    "fuelL100kmHwy": 0,
    "mpge": 0,
    "evRange": 0,
    "batteryKwh": 0,
    "chargeTimeLvl2Hr": 0,
    "chargeTimeDCMins": 0,
    "seating": 0,
    "cargoL": 0,
    "cargoLSeatsDown": 0,
    "towingKg": 0,
    "lengthCm": 0,
    "legroomFront": 0,
    "legroomRear": 0,
    "rearHeadroomCm": 0,
    "groundClear": 0
  },

  "features": {
    "heatedSeats": "front" | "front+rear" | null,
    "cooledSeats": "front" | "front+rear" | null,
    "heatedSteeringWheel": true | false,
    "powerSeats": "driver" | "both" | null,
    "interiorMaterial": "cloth" | "leatherette" | "leather" | null,
    "sunroof": true | false,
    "thirdRow": true | false,
    "rearClimateControls": true | false,
    "rearVents": true | false,
    "frontWirelessCharging": true | false,
    "frontPluginCharging": true | false,
    "rearWirelessCharging": true | false,
    "rearPluginCharging": true | false,
    "blindspotMonitor": true | false,
    "backupCamera": true | false,
    "powerFoldingMirrors": true | false,
    "roofRack": true | false
  }
}

FEATURES: Return features that are standard (included) on this specific trim. Return false for features that are definitely not available. Omit features you are unsure about.`;

const SPECS_PROMPT = `You are an automotive data expert with deep knowledge of vehicle specifications.
Given a vehicle's year, make, model, and trim, return its technical specifications.

Return ONLY a valid JSON object — no markdown fences, no explanation.
Omit any field you are not confident about. Never fabricate values you don't know.
Use Canadian/metric units:
- Dimensions → centimetres (cm)
- Cargo volume → litres (L)
- Torque → Newton-metres (Nm)
- Towing capacity → kilograms (kg)
- Fuel economy → litres per 100 km (L/100km)
- EV efficiency → litres equivalent per 100 km (Le/100km)
- EV range → kilometres (km)

{
  "powertrain": "gas" | "hybrid" | "ev",
  "bodyStyle": "Sedan" | "Coupe" | "Hatchback" | "SUV" | "Crossover" | "Truck" | "Minivan" | "Wagon",
  "photoUrl": "string (absolute URL to an official manufacturer press/media photo for this model year and trim — must be a real, publicly accessible URL you are confident exists)",

  "specs": {
    "engine": "string",
    "horsepower": 0,
    "torque": 0,
    "transmission": "string",
    "drivetrain": "string",
    "fuelL100km": 0,
    "fuelL100kmCity": 0,
    "fuelL100kmHwy": 0,
    "mpge": 0,
    "evRange": 0,
    "batteryKwh": 0,
    "chargeTimeLvl2Hr": 0,
    "chargeTimeDCMins": 0,
    "seating": 0,
    "cargoL": 0,
    "cargoLSeatsDown": 0,
    "towingKg": 0,
    "lengthCm": 0,
    "legroomFront": 0,
    "legroomRear": 0,
    "rearHeadroomCm": 0,
    "groundClear": 0
  },

  "features": {
    "heatedSeats": "front" | "front+rear" | null,
    "cooledSeats": "front" | "front+rear" | null,
    "heatedSteeringWheel": true | false,
    "powerSeats": "driver" | "both" | null,
    "interiorMaterial": "cloth" | "leatherette" | "leather" | null,
    "sunroof": true | false,
    "thirdRow": true | false,
    "rearClimateControls": true | false,
    "rearVents": true | false,
    "frontWirelessCharging": true | false,
    "frontPluginCharging": true | false,
    "rearWirelessCharging": true | false,
    "rearPluginCharging": true | false,
    "blindspotMonitor": true | false,
    "backupCamera": true | false,
    "powerFoldingMirrors": true | false,
    "roofRack": true | false
  }
}

FEATURES: Return features that are standard (included) on this specific trim. Return false for features that are definitely not available. Omit features you are unsure about.`;

export type SpecsLookupResult = {
  ok: true;
  data: { powertrain?: Vehicle['powertrain']; bodyStyle?: Vehicle['bodyStyle']; photoUrl?: string; specs: Partial<Vehicle['specs']>; features?: Partial<Features> };
} | {
  ok: false;
  error: string;
};

export async function lookupVehicleSpecs(
  year: number,
  make: string,
  model: string,
  trim: string,
  signal?: AbortSignal,
): Promise<SpecsLookupResult> {
  const prompt = `${SPECS_PROMPT}\n\nVehicle: ${year} ${make} ${model}${trim ? ' ' + trim : ''}`;
  const res = await callGemini(prompt, signal);
  if (!res.ok) return { ok: false, error: res.error };

  try {
    const raw = extractJson(res.text);
    if (!raw) return { ok: false, error: 'No specs returned. Try entering make/model/year/trim more specifically.' };

    const result: Extract<SpecsLookupResult, { ok: true }>['data'] = { specs: {} };

    const powertrain = oneOf(raw.powertrain, POWERTRAIN_KEYS);
    const bodyStyle  = oneOf(raw.bodyStyle, BODY_STYLES);
    const photoUrl   = httpUrl(raw.photoUrl);
    if (powertrain) result.powertrain = powertrain;
    if (bodyStyle)  result.bodyStyle  = bodyStyle;
    if (photoUrl)   result.photoUrl   = photoUrl;

    if (raw.specs) result.specs = parseSpecs(raw.specs);

    if (raw.features) {
      result.features = parseFeatures(raw.features);
    }

    return { ok: true, data: result };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlyError(raw) };
  }
}

export type ScrapeResult = {
  ok: true;
  data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']>; features?: Partial<Features> };
} | {
  ok: false;
  error: string;
};

// How long to wait for the Gemini proxy before giving up. LLM generation is slow,
// so this is generous — but without it a hung request leaves the UI spinning
// forever (the Add-a-vehicle dialog disables Cancel while a lookup is in flight).
const GEMINI_TIMEOUT_MS = 30_000;

// Calls the server-side Gemini proxy (POST /api/gemini). The API key lives only on
// the server, so it is never bundled into or exposed by the browser app.
// An optional `signal` lets the caller cancel the request (e.g. the user closing
// the dialog); it is merged with the internal timeout so either can abort.
async function callGemini(contents: string, signal?: AbortSignal): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort);
  }
  try {
    const r = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal: controller.signal,
    });
    const j = await r.json();
    if (!j?.ok) return { ok: false, error: friendlyError(j?.error ?? 'Gemini request failed.') };
    return { ok: true, text: j.text ?? '' };
  } catch (err: unknown) {
    // Caller-initiated cancel: a benign message the caller ignores after unmount.
    if (signal?.aborted) return { ok: false, error: 'Cancelled.' };
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: `Lookup timed out after ${GEMINI_TIMEOUT_MS / 1000}s. The AI service may be busy or unreachable — please try again.` };
    }
    return { ok: false, error: friendlyError(err instanceof Error ? err.message : String(err)) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function scrapeVehicleFromUrl(url: string): Promise<ScrapeResult> {
  const res = await callGemini(`${EXTRACT_PROMPT}\n\nURL: ${url}`);
  if (!res.ok) return { ok: false, error: res.error };

  try {
    const raw = extractJson(res.text);
    if (!raw) return { ok: false, error: 'Gemini returned no JSON. The listing page may block scrapers.' };

    const data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> } = {};

    // The model's reply is untrusted (the URL it read may be attacker-controlled):
    // keep only well-typed values so a bad field can't break rendering later.
    const fields = {
      make:       text(raw.make),
      model:      text(raw.model),
      year:       num(raw.year),
      trim:       text(raw.trim),
      powertrain: oneOf(raw.powertrain, POWERTRAIN_KEYS),
      bodyStyle:  oneOf(raw.bodyStyle, BODY_STYLES),
      condition:  oneOf(raw.condition, CONDITIONS),
      mileage:    num(raw.mileage),
      color:      text(raw.color),
      dealer:     text(raw.dealer),
      photoUrl:   httpUrl(raw.photoUrl),
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v) Object.assign(data, { [k]: v });
    }

    if (raw.pricing) {
      const pr = raw.pricing;
      // Selling price is now derived (msrp − discount). The listing still reports an
      // msrp and a selling price, so back out the discount from the two. If only a
      // selling price is given (or it's above msrp), treat it as the msrp.
      const msrp = Number(pr.msrp) || 0;
      const selling = Number(pr.sellingPrice) || 0;
      let msrpOut = msrp;
      let discount = Number(pr.discounts) || 0;
      if (selling > 0) {
        if (msrp >= selling) discount = msrp - selling;
        else { msrpOut = selling; discount = 0; }
      }
      const feeAmt = Number(pr.fees) || 0;
      data.pricing = {
        msrp:       msrpOut,
        discount,
        incentives: Number(pr.incentives) || 0,
        tradeValue: 0,
        taxRate:    0,
        // A scraped lump "fees" is usually a doc/admin fee (taxable). The user can
        // change the type, flip the flag, or split it on the Pricing tab.
        fees:       feeAmt > 0 ? [{ ...makeFee('documentation'), amount: feeAmt }] : [],
      };
    }

    if (raw.finance) {
      const f = raw.finance;
      if (f.apr || f.termMonths) {
        data.finance = {
          apr:        Number(f.apr)        || 0,
          termMonths: Number(f.termMonths) || 60,
          downPayment: 0,
        };
      }
    }

    if (raw.lease) {
      const l = raw.lease;
      if (l.termMonths || l.moneyFactor) {
        data.lease = {
          termMonths:  Number(l.termMonths)  || 36,
          residualPct: Number(l.residualPct) || 0,
          downPayment: Number(l.downPayment) || 0,
          annualKm: Number(l.annualKm) || 20000,
          moneyFactor: Number(l.moneyFactor) || 0,
        };
      }
    }

    if (raw.specs) data.specs = parseSpecs(raw.specs);

    if (raw.features) {
      data.features = parseFeatures(raw.features);
    }

    return { ok: true, data };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlyError(raw) };
  }
}

// ─── Value guards for model output ──────────────────────────────────────────

const MAX_TEXT_CHARS = 200;
const POWERTRAIN_KEYS = Object.keys(POWERTRAINS) as Powertrain[];
const CONDITIONS: readonly Condition[] = ['New', 'Used', 'CPO'];

function text(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_TEXT_CHARS) : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v !== 'number' && typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return (allowed as readonly unknown[]).includes(v) ? v as T : undefined;
}

function httpUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 2048) return undefined;
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol) ? v : undefined;
  } catch {
    return undefined;
  }
}

// Pulls the first {...} object out of a model reply (tolerating ```json fences).
// Returns null when there is none; throws if the object is not valid JSON.
function extractJson(text: string) {
  const match = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

const TEXT_SPEC_KEYS = ['engine', 'transmission', 'drivetrain'] as const;
const NUMERIC_SPEC_KEYS = [
  'horsepower', 'torque', 'fuelL100km', 'fuelL100kmCity', 'fuelL100kmHwy', 'mpge',
  'evRange', 'batteryKwh', 'chargeTimeLvl2Hr', 'chargeTimeDCMins', 'seating', 'cargoL',
  'cargoLSeatsDown', 'towingKg', 'lengthCm', 'legroomFront', 'legroomRear',
  'rearHeadroomCm', 'groundClear',
] as const;

// Copies the spec fields the model actually filled in (falsy values are omitted).
function parseSpecs(s: Record<string, unknown>): Partial<Vehicle['specs']> {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_SPEC_KEYS) { const v = text(s[k]); if (v) out[k] = v; }
  for (const k of NUMERIC_SPEC_KEYS) { const v = num(s[k]); if (v) out[k] = v; }
  return out as Partial<Vehicle['specs']>;
}

const BOOLEAN_FEATURE_KEYS = [
  'heatedSteeringWheel', 'sunroof', 'thirdRow', 'rearClimateControls', 'rearVents',
  'frontWirelessCharging', 'frontPluginCharging', 'rearWirelessCharging',
  'rearPluginCharging', 'blindspotMonitor', 'backupCamera', 'powerFoldingMirrors', 'roofRack',
] as const;

function parseFeatures(f: Record<string, unknown>): Partial<Features> {
  const out: Partial<Features> = {};
  const bool = (v: unknown) => v === true || v === 'true';
  const boolDef = (v: unknown) => v !== undefined && v !== null ? bool(v) : undefined;

  if (f.heatedSeats !== undefined)         out.heatedSeats         = (f.heatedSeats === 'front' || f.heatedSeats === 'front+rear') ? f.heatedSeats : null;
  if (f.cooledSeats !== undefined)         out.cooledSeats         = (f.cooledSeats === 'front' || f.cooledSeats === 'front+rear') ? f.cooledSeats : null;
  if (f.powerSeats !== undefined)          out.powerSeats          = (f.powerSeats === 'driver' || f.powerSeats === 'both') ? f.powerSeats : null;
  if (f.interiorMaterial !== undefined)    out.interiorMaterial    = (['cloth', 'leatherette', 'leather'] as const).includes(f.interiorMaterial as 'cloth') ? f.interiorMaterial as Features['interiorMaterial'] : null;
  for (const k of BOOLEAN_FEATURE_KEYS) if (f[k] !== undefined) out[k] = boolDef(f[k]);
  return out;
}

function friendlyError(raw: string): string {
  // Parse Gemini API error JSON embedded in the message
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const code   = parsed?.error?.code;
      const status = parsed?.error?.status;
      if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
        return 'Rate limit reached — you\'ve hit your Gemini API quota. Wait a minute then try again, or check your plan at ai.dev/rate-limit.';
      }
      if (code === 400) return `Bad request: ${parsed?.error?.message ?? raw}`;
      if (code === 401 || code === 403) return 'API key rejected. Check GEMINI_API_KEY in your .env file.';
      if (code === 404) return `Model not found — check GEMINI_MODEL in your .env. Raw: ${parsed?.error?.message ?? raw}`;
      if (parsed?.error?.message) return parsed.error.message;
    }
  } catch { /* fall through */ }
  return raw;
}
