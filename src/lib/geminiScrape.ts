import { GoogleGenAI } from '@google/genai';
import type { Vehicle } from './data';


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
    "mpge": 0,
    "evRange": 0,
    "batteryKwh": 0,
    "seating": 0,
    "cargoL": 0,
    "towingKg": 0,
    "lengthCm": 0,
    "legroomFront": 0,
    "legroomRear": 0,
    "groundClear": 0
  }
}`;

export type ScrapeResult = {
  ok: true;
  data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> };
} | {
  ok: false;
  error: string;
};

export function getGeminiConfig(): { apiKey: string; model: string } {
  return {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
    model:  import.meta.env.VITE_GEMINI_MODEL  || 'gemini-2.0-flash',
  };
}

export async function scrapeVehicleFromUrl(url: string): Promise<ScrapeResult> {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    return { ok: false, error: 'No Gemini API key set. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model,
      contents: `${EXTRACT_PROMPT}\n\nURL: ${url}`,
      config: {
        temperature: 0,
      },
    });

    const text = response.text ?? '';
    const jsonMatch = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: 'Gemini returned no JSON. The listing page may block scrapers.' };

    const raw = JSON.parse(jsonMatch[0]);
    const data: Partial<Vehicle> & { specs?: Partial<Vehicle['specs']> } = {};

    if (raw.make)       data.make       = raw.make;
    if (raw.model)      data.model      = raw.model;
    if (raw.year)       data.year       = Number(raw.year);
    if (raw.trim)       data.trim       = raw.trim;
    if (raw.powertrain) data.powertrain = raw.powertrain;
    if (raw.bodyStyle)  data.bodyStyle  = raw.bodyStyle;
    if (raw.condition)  data.condition  = raw.condition;
    if (raw.mileage)    data.mileage    = Number(raw.mileage);
    if (raw.color)      data.color      = raw.color;
    if (raw.dealer)     data.dealer     = raw.dealer;
    if (raw.photoUrl)   data.photoUrl   = raw.photoUrl;

    if (raw.pricing) {
      const pr = raw.pricing;
      data.pricing = {
        msrp:         Number(pr.msrp)         || 0,
        sellingPrice: Number(pr.sellingPrice)  || 0,
        discounts:    Number(pr.discounts)     || 0,
        incentives:   Number(pr.incentives)    || 0,
        fees:         Number(pr.fees)          || 0,
        tradeValue:   0,
        taxRate:      0,
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

    if (raw.specs) {
      data.specs = {};
      const s = raw.specs;
      if (s.engine)        data.specs.engine        = s.engine;
      if (s.horsepower)    data.specs.horsepower    = Number(s.horsepower);
      if (s.torque)        data.specs.torque        = Number(s.torque);
      if (s.transmission)  data.specs.transmission  = s.transmission;
      if (s.drivetrain)    data.specs.drivetrain    = s.drivetrain;
      if (s.fuelL100km)    data.specs.fuelL100km    = Number(s.fuelL100km);
      if (s.mpge)          data.specs.mpge          = Number(s.mpge);
      if (s.evRange)       data.specs.evRange       = Number(s.evRange);
      if (s.batteryKwh)    data.specs.batteryKwh    = Number(s.batteryKwh);
      if (s.seating)       data.specs.seating       = Number(s.seating);
      if (s.cargoL)        data.specs.cargoL        = Number(s.cargoL);
      if (s.towingKg)      data.specs.towingKg      = Number(s.towingKg);
      if (s.lengthCm)      data.specs.lengthCm      = Number(s.lengthCm);
      if (s.legroomFront)  data.specs.legroomFront  = Number(s.legroomFront);
      if (s.legroomRear)   data.specs.legroomRear   = Number(s.legroomRear);
      if (s.groundClear)   data.specs.groundClear   = Number(s.groundClear);
    }

    return { ok: true, data };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlyError(raw) };
  }
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
      if (code === 401 || code === 403) return 'API key rejected. Check VITE_GEMINI_API_KEY in your .env file.';
      if (code === 404) return `Model not found — check VITE_GEMINI_MODEL in your .env. Raw: ${parsed?.error?.message ?? raw}`;
      if (parsed?.error?.message) return parsed.error.message;
    }
  } catch { /* fall through */ }
  return raw;
}
