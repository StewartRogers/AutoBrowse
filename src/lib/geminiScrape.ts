import { GoogleGenAI } from '@google/genai';
import type { Vehicle, Features } from './data';


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
  data: { powertrain?: Vehicle['powertrain']; bodyStyle?: Vehicle['bodyStyle']; specs: Partial<Vehicle['specs']>; features?: Partial<Features> };
} | {
  ok: false;
  error: string;
};

export async function lookupVehicleSpecs(
  year: number,
  make: string,
  model: string,
  trim: string,
): Promise<SpecsLookupResult> {
  const { apiKey, model: aiModel } = getGeminiConfig();

  if (!apiKey) {
    return { ok: false, error: 'No Gemini API key set. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${SPECS_PROMPT}\n\nVehicle: ${year} ${make} ${model}${trim ? ' ' + trim : ''}`;

    const response = await ai.models.generateContent({
      model: aiModel,
      contents: prompt,
      config: { temperature: 0 },
    });

    const text = response.text ?? '';
    const jsonMatch = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: 'No specs returned. Try entering make/model/year/trim more specifically.' };

    const raw = JSON.parse(jsonMatch[0]);
    const result: Extract<SpecsLookupResult, { ok: true }>['data'] = { specs: {} };

    if (raw.powertrain) result.powertrain = raw.powertrain;
    if (raw.bodyStyle)  result.bodyStyle  = raw.bodyStyle;

    if (raw.specs) {
      const s = raw.specs;
      if (s.engine)             result.specs.engine             = s.engine;
      if (s.horsepower)         result.specs.horsepower         = Number(s.horsepower);
      if (s.torque)             result.specs.torque             = Number(s.torque);
      if (s.transmission)       result.specs.transmission       = s.transmission;
      if (s.drivetrain)         result.specs.drivetrain         = s.drivetrain;
      if (s.fuelL100km)         result.specs.fuelL100km         = Number(s.fuelL100km);
      if (s.fuelL100kmCity)     result.specs.fuelL100kmCity     = Number(s.fuelL100kmCity);
      if (s.fuelL100kmHwy)      result.specs.fuelL100kmHwy      = Number(s.fuelL100kmHwy);
      if (s.mpge)               result.specs.mpge               = Number(s.mpge);
      if (s.evRange)            result.specs.evRange            = Number(s.evRange);
      if (s.batteryKwh)         result.specs.batteryKwh         = Number(s.batteryKwh);
      if (s.chargeTimeLvl2Hr)   result.specs.chargeTimeLvl2Hr   = Number(s.chargeTimeLvl2Hr);
      if (s.chargeTimeDCMins)   result.specs.chargeTimeDCMins   = Number(s.chargeTimeDCMins);
      if (s.seating)            result.specs.seating            = Number(s.seating);
      if (s.cargoL)             result.specs.cargoL             = Number(s.cargoL);
      if (s.towingKg)           result.specs.towingKg           = Number(s.towingKg);
      if (s.lengthCm)           result.specs.lengthCm           = Number(s.lengthCm);
      if (s.legroomFront)       result.specs.legroomFront       = Number(s.legroomFront);
      if (s.legroomRear)        result.specs.legroomRear        = Number(s.legroomRear);
      if (s.rearHeadroomCm)     result.specs.rearHeadroomCm     = Number(s.rearHeadroomCm);
      if (s.groundClear)        result.specs.groundClear        = Number(s.groundClear);
    }

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

export function getGeminiConfig(): { apiKey: string; model: string } {
  return {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
    model:  import.meta.env.VITE_GEMINI_MODEL  || 'gemini-2.0-flash-lite',
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
      if (s.engine)             data.specs.engine             = s.engine;
      if (s.horsepower)         data.specs.horsepower         = Number(s.horsepower);
      if (s.torque)             data.specs.torque             = Number(s.torque);
      if (s.transmission)       data.specs.transmission       = s.transmission;
      if (s.drivetrain)         data.specs.drivetrain         = s.drivetrain;
      if (s.fuelL100km)         data.specs.fuelL100km         = Number(s.fuelL100km);
      if (s.fuelL100kmCity)     data.specs.fuelL100kmCity     = Number(s.fuelL100kmCity);
      if (s.fuelL100kmHwy)      data.specs.fuelL100kmHwy      = Number(s.fuelL100kmHwy);
      if (s.mpge)               data.specs.mpge               = Number(s.mpge);
      if (s.evRange)            data.specs.evRange            = Number(s.evRange);
      if (s.batteryKwh)         data.specs.batteryKwh         = Number(s.batteryKwh);
      if (s.chargeTimeLvl2Hr)   data.specs.chargeTimeLvl2Hr   = Number(s.chargeTimeLvl2Hr);
      if (s.chargeTimeDCMins)   data.specs.chargeTimeDCMins   = Number(s.chargeTimeDCMins);
      if (s.seating)            data.specs.seating            = Number(s.seating);
      if (s.cargoL)             data.specs.cargoL             = Number(s.cargoL);
      if (s.towingKg)           data.specs.towingKg           = Number(s.towingKg);
      if (s.lengthCm)           data.specs.lengthCm           = Number(s.lengthCm);
      if (s.legroomFront)       data.specs.legroomFront       = Number(s.legroomFront);
      if (s.legroomRear)        data.specs.legroomRear        = Number(s.legroomRear);
      if (s.rearHeadroomCm)     data.specs.rearHeadroomCm     = Number(s.rearHeadroomCm);
      if (s.groundClear)        data.specs.groundClear        = Number(s.groundClear);
    }

    if (raw.features) {
      data.features = parseFeatures(raw.features);
    }

    return { ok: true, data };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: friendlyError(raw) };
  }
}

function parseFeatures(f: Record<string, unknown>): Partial<Features> {
  const out: Partial<Features> = {};
  const bool = (v: unknown) => v === true || v === 'true';
  const boolDef = (v: unknown) => v !== undefined && v !== null ? bool(v) : undefined;

  if (f.heatedSeats !== undefined)         out.heatedSeats         = (f.heatedSeats === 'front' || f.heatedSeats === 'front+rear') ? f.heatedSeats : null;
  if (f.cooledSeats !== undefined)         out.cooledSeats         = (f.cooledSeats === 'front' || f.cooledSeats === 'front+rear') ? f.cooledSeats : null;
  if (f.heatedSteeringWheel !== undefined) out.heatedSteeringWheel = boolDef(f.heatedSteeringWheel);
  if (f.powerSeats !== undefined)          out.powerSeats          = (f.powerSeats === 'driver' || f.powerSeats === 'both') ? f.powerSeats : null;
  if (f.interiorMaterial !== undefined)    out.interiorMaterial    = (['cloth', 'leatherette', 'leather'] as const).includes(f.interiorMaterial as 'cloth') ? f.interiorMaterial as Features['interiorMaterial'] : null;
  if (f.sunroof !== undefined)             out.sunroof             = boolDef(f.sunroof);
  if (f.thirdRow !== undefined)            out.thirdRow            = boolDef(f.thirdRow);
  if (f.rearClimateControls !== undefined) out.rearClimateControls = boolDef(f.rearClimateControls);
  if (f.rearVents !== undefined)           out.rearVents           = boolDef(f.rearVents);
  if (f.frontWirelessCharging !== undefined) out.frontWirelessCharging = boolDef(f.frontWirelessCharging);
  if (f.frontPluginCharging !== undefined) out.frontPluginCharging = boolDef(f.frontPluginCharging);
  if (f.rearWirelessCharging !== undefined) out.rearWirelessCharging = boolDef(f.rearWirelessCharging);
  if (f.rearPluginCharging !== undefined)  out.rearPluginCharging  = boolDef(f.rearPluginCharging);
  if (f.blindspotMonitor !== undefined)    out.blindspotMonitor    = boolDef(f.blindspotMonitor);
  if (f.backupCamera !== undefined)        out.backupCamera        = boolDef(f.backupCamera);
  if (f.powerFoldingMirrors !== undefined) out.powerFoldingMirrors = boolDef(f.powerFoldingMirrors);
  if (f.roofRack !== undefined)            out.roofRack            = boolDef(f.roofRack);
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
      if (code === 401 || code === 403) return 'API key rejected. Check VITE_GEMINI_API_KEY in your .env file.';
      if (code === 404) return `Model not found — check VITE_GEMINI_MODEL in your .env. Raw: ${parsed?.error?.message ?? raw}`;
      if (parsed?.error?.message) return parsed.error.message;
    }
  } catch { /* fall through */ }
  return raw;
}
