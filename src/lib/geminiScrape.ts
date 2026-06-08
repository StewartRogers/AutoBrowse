import { GoogleGenAI } from '@google/genai';
import type { Vehicle } from './data';

// Known valid Gemini model prefixes — catches obvious typos like "gemini-3.1-flash-lite"
const KNOWN_MODELS = [
  'gemini-2.5-pro', 'gemini-2.5-flash',
  'gemini-2.0-flash', 'gemini-2.0-pro',
  'gemini-1.5-pro', 'gemini-1.5-flash',
];

const EXTRACT_PROMPT = `You are extracting car details from a webpage. The page may be a dealer listing
(specific car for sale) or a manufacturer model page (spec sheet for a model line).

Return ONLY a valid JSON object — no markdown fences, no explanation.
Omit any field you cannot find on the page. Never fabricate or guess values.

UNITS: All numeric values must be in US Imperial units:
- Range / distance → miles (convert km ÷ 1.609 if the page shows km)
- Dimensions → inches (convert mm ÷ 25.4 if the page shows mm)
- Cargo volume → cubic feet (convert L × 0.0353 if the page shows litres)
- Torque → lb-ft (convert Nm × 0.7376 if the page shows Nm)
- Towing → pounds (convert kg × 2.205 if the page shows kg)
- Prices → use whatever currency the page shows (note CAD vs USD as-is)

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
    "annualMiles": 0,
    "moneyFactor": 0
  },

  "specs": {
    "engine": "string (e.g. '2.0L 4-Cyl Turbo', '150kW Permanent Magnet Motor')",
    "horsepower": 0,
    "torque": 0,
    "transmission": "string (e.g. 'CVT', '10-Speed Automatic', 'Single-Speed')",
    "drivetrain": "string (e.g. 'AWD', 'FWD', 'RWD')",
    "mpgCombined": 0,
    "mpge": 0,
    "evRange": 0,
    "batteryKwh": 0,
    "seating": 0,
    "cargoCuFt": 0,
    "towingLbs": 0,
    "lengthIn": 0,
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

export function getGeminiConfig(): { apiKey: string; model: string; modelError?: string } {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
  const model  = import.meta.env.VITE_GEMINI_MODEL  || 'gemini-2.0-flash';
  const valid  = KNOWN_MODELS.some(m => model.startsWith(m));
  return {
    apiKey,
    model,
    modelError: valid ? undefined : `Unknown model "${model}". Valid options: ${KNOWN_MODELS.join(', ')}. Update VITE_GEMINI_MODEL in .env and restart.`,
  };
}

export async function scrapeVehicleFromUrl(url: string): Promise<ScrapeResult> {
  const { apiKey, model, modelError } = getGeminiConfig();

  if (!apiKey) {
    return { ok: false, error: 'No Gemini API key set. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.' };
  }
  if (modelError) {
    return { ok: false, error: modelError };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model,
      contents: `${EXTRACT_PROMPT}\n\nURL: ${url}`,
      config: {
        tools: [{ urlContext: {} }],
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
          annualMiles: Number(l.annualMiles) || 12000,
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
      if (s.mpgCombined)   data.specs.mpgCombined   = Number(s.mpgCombined);
      if (s.mpge)          data.specs.mpge          = Number(s.mpge);
      if (s.evRange)       data.specs.evRange       = Number(s.evRange);
      if (s.batteryKwh)    data.specs.batteryKwh    = Number(s.batteryKwh);
      if (s.seating)       data.specs.seating       = Number(s.seating);
      if (s.cargoCuFt)     data.specs.cargoCuFt     = Number(s.cargoCuFt);
      if (s.towingLbs)     data.specs.towingLbs     = Number(s.towingLbs);
      if (s.lengthIn)      data.specs.lengthIn      = Number(s.lengthIn);
      if (s.legroomFront)  data.specs.legroomFront  = Number(s.legroomFront);
      if (s.legroomRear)   data.specs.legroomRear   = Number(s.legroomRear);
      if (s.groundClear)   data.specs.groundClear   = Number(s.groundClear);
    }

    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
