// data.ts — data model, seed vehicles, financial calculations, decision-matrix scoring
// Ported close to verbatim from design_handoff_autobrowse/source/data.jsx

// ---------- types ----------

export type Powertrain = 'gas' | 'hybrid' | 'ev';
export type Condition = 'New' | 'Used' | 'CPO';
export type BodyStyle = 'Sedan' | 'Coupe' | 'Hatchback' | 'SUV' | 'Crossover' | 'Truck' | 'Minivan' | 'Wagon';
export type MatrixMetricKey = keyof typeof MATRIX_METRICS;

export interface SpecFields {
  engine?: string;
  horsepower?: number;
  torque?: number;
  transmission?: string;
  drivetrain?: string;
  mpgCombined?: number;
  mpge?: number;
  evRange?: number;
  batteryKwh?: number;
  seating?: number;
  cargoCuFt?: number;
  towingLbs?: number;
  lengthIn?: number;
  legroomFront?: number;
  legroomRear?: number;
  groundClear?: number;
}

export interface Pricing {
  msrp: number;
  sellingPrice: number;
  discounts: number;
  incentives: number;
  tradeValue: number;
  taxRate: number; // %
  fees: number;
}

export interface Finance {
  downPayment: number;
  apr: number; // %
  termMonths: number;
}

export interface Lease {
  termMonths: number;
  residualPct: number; // % of MSRP
  downPayment: number;
  annualMiles: number;
  moneyFactor: number;
}

export interface Ownership {
  annualMiles: number;
  fuelCostPerGal: number;
  electricityPerKwh: number;
  insuranceYr: number;
  maintenanceYr: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'image' | string;
}

export interface Vehicle {
  id: string;
  archived: boolean;
  excludeReason: string;
  excludedAt: number;
  createdAt: number;
  viewedAt: number;

  // Identity
  make: string;
  model: string;
  year: number;
  trim: string;
  bodyStyle: BodyStyle;
  condition: Condition;
  mileage: number;
  color: string;
  dealer: string;
  listingUrl: string;
  accent: string; // hex, per-vehicle accent
  powertrain: Powertrain;
  notes: string;

  specs: SpecFields;
  ratings: Record<string, number>; // 1–10 per category
  testDrive: Record<string, number>; // 1–10 per category
  testDriveNotes: Record<string, string>;

  pricing: Pricing;
  finance: Finance;
  lease: Lease;
  ownership: Ownership;
  attachments: Attachment[];
}

export interface MatrixFactor {
  metric: string;
  weight: number;
  // internal, computed during scoring
  _min?: number;
  _max?: number;
}

export interface MatrixBreakdown {
  raw: number;
  norm: number;
  contrib: number;
}

export interface MatrixResult {
  vehicle: Vehicle;
  score: number;
  breakdown: Record<string, MatrixBreakdown>;
}

// ---------- uid ----------
export const uid = (): string => Math.random().toString(36).slice(2, 9);

// ---------- spec field definitions ----------
export interface SpecFieldDef {
  key: keyof SpecFields;
  label: string;
  group: string;
  unit?: string;
  kind?: 'text';
  better?: 'high' | 'low';
  evOnly?: boolean;
  evHide?: boolean;
}

export const SPEC_FIELDS: SpecFieldDef[] = [
  { key: 'engine',       label: 'Engine',           group: 'Powertrain',  kind: 'text' },
  { key: 'horsepower',   label: 'Horsepower',        group: 'Powertrain',  unit: 'hp',    better: 'high' },
  { key: 'torque',       label: 'Torque',            group: 'Powertrain',  unit: 'lb-ft', better: 'high' },
  { key: 'transmission', label: 'Transmission',      group: 'Powertrain',  kind: 'text' },
  { key: 'drivetrain',   label: 'Drivetrain',        group: 'Powertrain',  kind: 'text' },
  { key: 'mpgCombined',  label: 'Fuel Economy',      group: 'Efficiency',  unit: 'mpg',   better: 'high', evHide: true },
  { key: 'mpge',         label: 'Efficiency',        group: 'Efficiency',  unit: 'MPGe',  better: 'high', evOnly: true },
  { key: 'evRange',      label: 'EV Range',          group: 'Efficiency',  unit: 'mi',    better: 'high', evOnly: true },
  { key: 'batteryKwh',   label: 'Battery',           group: 'Efficiency',  unit: 'kWh',   better: 'high', evOnly: true },
  { key: 'seating',      label: 'Seating',           group: 'Practicality',unit: 'seats', better: 'high' },
  { key: 'cargoCuFt',    label: 'Cargo',             group: 'Practicality',unit: 'cu-ft', better: 'high' },
  { key: 'towingLbs',    label: 'Towing',            group: 'Practicality',unit: 'lb',    better: 'high' },
  { key: 'lengthIn',     label: 'Length',            group: 'Dimensions',  unit: 'in' },
  { key: 'legroomFront', label: 'Front Legroom',     group: 'Comfort',     unit: 'in',    better: 'high' },
  { key: 'legroomRear',  label: 'Rear Legroom',      group: 'Comfort',     unit: 'in',    better: 'high' },
  { key: 'groundClear',  label: 'Ground Clearance',  group: 'Comfort',     unit: 'in',    better: 'high' },
];

export const RATING_CATS = [
  { key: 'comfort',    label: 'Comfort' },
  { key: 'driving',    label: 'Driving Enjoyment' },
  { key: 'interior',   label: 'Interior Quality' },
  { key: 'technology', label: 'Technology' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'cargo',      label: 'Cargo Space' },
  { key: 'value',      label: 'Value' },
];

export const TESTDRIVE_CATS = [
  { key: 'rideQuality',  label: 'Ride Quality' },
  { key: 'visibility',   label: 'Visibility' },
  { key: 'seatComfort',  label: 'Seat Comfort' },
  { key: 'cabinNoise',   label: 'Cabin Quietness' },
  { key: 'acceleration', label: 'Acceleration' },
  { key: 'steeringFeel', label: 'Steering Feel' },
];

export const POWERTRAINS: Record<Powertrain, { label: string; color: string; tint: string }> = {
  gas:    { label: 'Gas',      color: 'var(--gas)',    tint: '#efe9dc' },
  hybrid: { label: 'Hybrid',   color: 'var(--hybrid)', tint: 'var(--good-tint)' },
  ev:     { label: 'Electric', color: 'var(--ev)',     tint: '#e3edf2' },
};

export const BODY_STYLES: BodyStyle[] = [
  'Sedan', 'Coupe', 'Hatchback', 'SUV', 'Crossover', 'Truck', 'Minivan', 'Wagon',
];

export const ACCENT_PALETTE = ['#b4552d', '#4f7a52', '#3f6f8f', '#7a5aa8', '#8a7a5c', '#a9492f'];

// ---------- defaults ----------
export function blankVehicle(): Vehicle {
  return {
    id: uid(),
    archived: false,
    excludeReason: '',
    excludedAt: 0,
    createdAt: Date.now(),
    viewedAt: Date.now(),
    make: '', model: '', year: new Date().getFullYear(), trim: '', bodyStyle: 'Sedan',
    condition: 'New', mileage: 0, color: '', dealer: '', listingUrl: '',
    accent: '#b4552d', powertrain: 'gas', notes: '',
    specs: {},
    ratings: {},
    testDrive: {}, testDriveNotes: {},
    pricing: { msrp: 0, sellingPrice: 0, discounts: 0, incentives: 0, tradeValue: 0, taxRate: 8.0, fees: 1200 },
    finance: { downPayment: 3000, apr: 6.4, termMonths: 60 },
    lease: { termMonths: 36, residualPct: 58, downPayment: 2500, annualMiles: 12000, moneyFactor: 0.0022 },
    ownership: { annualMiles: 12000, fuelCostPerGal: 3.65, electricityPerKwh: 0.17, insuranceYr: 1700, maintenanceYr: 700 },
    attachments: [],
  };
}

// ---------- financial math ----------

export function taxesOn(p: Pricing): number {
  const taxable = Math.max(0, (p.sellingPrice || 0) - (p.tradeValue || 0));
  return taxable * ((p.taxRate || 0) / 100);
}

export function outTheDoor(p: Pricing): number {
  return (p.sellingPrice || 0) + taxesOn(p) + (p.fees || 0) - (p.incentives || 0);
}

export interface FinanceResult {
  principal: number;
  monthly: number;
  totalPaid: number;
  totalInterest: number;
}

export function financeCalc(v: Pick<Vehicle, 'pricing' | 'finance'>): FinanceResult {
  const p = v.pricing, f = v.finance;
  const principal = Math.max(0, outTheDoor(p) - (f.downPayment || 0) - (p.tradeValue || 0));
  const r = (f.apr || 0) / 100 / 12;
  const n = f.termMonths || 1;
  const monthly = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  const totalPaid = monthly * n + (f.downPayment || 0);
  const totalInterest = monthly * n - principal;
  return { principal, monthly, totalPaid, totalInterest };
}

export interface LeaseResult {
  monthly: number;
  residual: number;
  totalLease: number;
  buyout: number;
}

export function leaseCalc(v: Pick<Vehicle, 'pricing' | 'lease'>): LeaseResult {
  const p = v.pricing, l = v.lease;
  const cap = Math.max(
    0,
    (p.sellingPrice || 0) - (l.downPayment || 0) - (p.tradeValue || 0) - (p.incentives || 0)
  );
  const residual = (p.msrp || p.sellingPrice || 0) * ((l.residualPct || 0) / 100);
  const depreciation = (cap - residual) / (l.termMonths || 1);
  const financeCharge = (cap + residual) * (l.moneyFactor || 0);
  const base = depreciation + financeCharge;
  // Guard: if cap < residual (very large trade/incentives) depreciation goes negative;
  // clamp monthly to 0 — a negative lease payment is meaningless.
  const monthly = Math.max(0, base * (1 + (p.taxRate || 0) / 100));
  const totalLease = monthly * (l.termMonths || 0) + (l.downPayment || 0);
  return { monthly, residual, totalLease, buyout: residual };
}

export function energyCostPerYear(v: Pick<Vehicle, 'powertrain' | 'ownership' | 'specs'>): number {
  const o = v.ownership;
  const miles = o.annualMiles || 0;
  if (v.powertrain === 'ev') {
    const miPerKwh = 3.3;
    return (miles / miPerKwh) * (o.electricityPerKwh || 0);
  }
  const mpg = v.specs.mpgCombined || 30;
  return (miles / mpg) * (o.fuelCostPerGal || 0);
}

export interface OwnershipResult {
  perYear: number;
  y1: number;
  y3: number;
  y5: number;
  energy: number;
}

export function ownershipCalc(v: Pick<Vehicle, 'powertrain' | 'ownership' | 'specs'>): OwnershipResult {
  const o = v.ownership;
  const energy = energyCostPerYear(v);
  const perYear = energy + (o.insuranceYr || 0) + (o.maintenanceYr || 0);
  return { perYear, y1: perYear, y3: perYear * 3, y5: perYear * 5, energy };
}

export function avgRating(v: Pick<Vehicle, 'ratings'>): number {
  const vals = RATING_CATS.map(c => v.ratings[c.key]).filter(
    (x): x is number => typeof x === 'number' && x > 0
  );
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ---------- decision matrix ----------

export interface MetricDef {
  label: string;
  dir: 'high' | 'low';
  fn: (v: Vehicle) => number;
  fmt: 'money' | 'score' | 'in' | 'cuft' | 'hp' | 'raw';
}

export const MATRIX_METRICS: Record<string, MetricDef> = {
  price:       { label: 'Price',          dir: 'low',  fn: v => v.pricing.sellingPrice || v.pricing.msrp || 0, fmt: 'money' },
  payment:     { label: 'Monthly Cost',   dir: 'low',  fn: v => financeCalc(v).monthly,    fmt: 'money' },
  ownership:   { label: '5-yr Ownership', dir: 'low',  fn: v => ownershipCalc(v).y5,       fmt: 'money' },
  comfort:     { label: 'Comfort',        dir: 'high', fn: v => v.ratings.comfort || 0,    fmt: 'score' },
  seatComfort: { label: 'Seat Comfort',   dir: 'high', fn: v => v.testDrive.seatComfort || 0, fmt: 'score' },
  rear:        { label: 'Rear Legroom',   dir: 'high', fn: v => v.specs.legroomRear || 0,  fmt: 'in' },
  interior:    { label: 'Interior',       dir: 'high', fn: v => v.ratings.interior || 0,   fmt: 'score' },
  cargo:       { label: 'Cargo Space',    dir: 'high', fn: v => v.specs.cargoCuFt || 0,    fmt: 'cuft' },
  tech:        { label: 'Technology',     dir: 'high', fn: v => v.ratings.technology || 0, fmt: 'score' },
  efficiency:  { label: 'Efficiency',     dir: 'high', fn: v => v.powertrain === 'ev' ? (v.specs.mpge || 0) : (v.specs.mpgCombined || 0) * 3, fmt: 'raw' },
  performance: { label: 'Performance',   dir: 'high', fn: v => v.specs.horsepower || 0,  fmt: 'hp' },
};

export const DEFAULT_MATRIX: MatrixFactor[] = [
  { metric: 'price',       weight: 30 },
  { metric: 'comfort',     weight: 20 },
  { metric: 'seatComfort', weight: 15 },
  { metric: 'rear',        weight: 10 },
  { metric: 'ownership',   weight: 15 },
  { metric: 'interior',    weight: 10 },
];

export function matrixScores(vehicles: Vehicle[], factors: MatrixFactor[]): MatrixResult[] {
  const active = vehicles.filter(v => !v.archived);
  const totalW = factors.reduce((a, f) => a + (f.weight || 0), 0) || 1;

  // pre-compute min/max per factor across active vehicles
  const ranges: Record<string, { min: number; max: number }> = {};
  factors.forEach(f => {
    const m = MATRIX_METRICS[f.metric];
    if (!m) return;
    const vals = active.map(v => m.fn(v));
    ranges[f.metric] = { min: Math.min(...vals), max: Math.max(...vals) };
  });

  return active
    .map(v => {
      let score = 0;
      const breakdown: Record<string, MatrixBreakdown> = {};
      factors.forEach(f => {
        const m = MATRIX_METRICS[f.metric];
        if (!m) return;
        const raw = m.fn(v);
        const { min, max } = ranges[f.metric];
        const span = (max - min) || 1;
        let norm = (raw - min) / span; // 0..1, high raw → 1
        if (m.dir === 'low') norm = 1 - norm;
        const contrib = norm * 100 * ((f.weight || 0) / totalW);
        breakdown[f.metric] = { raw, norm, contrib };
        score += contrib;
      });
      return { vehicle: v, score, breakdown };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------- deep merge ----------
export function deepMerge<T extends object>(base: T, patch: Partial<T>): T {
  const out = { ...base } as T;
  for (const k in patch) {
    const patchVal = patch[k];
    const baseVal = base[k];
    if (
      patchVal !== null &&
      patchVal !== undefined &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null
    ) {
      out[k] = deepMerge(baseVal as object, patchVal as object) as T[typeof k];
    } else if (patchVal !== undefined) {
      out[k] = patchVal as T[typeof k];
    }
  }
  return out;
}

// ---------- seed data ----------
export function SEED_VEHICLES(): Vehicle[] {
  const mk = (data: Partial<Vehicle>): Vehicle => ({ ...blankVehicle(), ...data, id: uid() });
  return [
    mk({
      make: 'Honda', model: 'Accord', year: 2025, trim: 'Hybrid Touring', bodyStyle: 'Sedan',
      condition: 'New', mileage: 12, color: 'Platinum White Pearl', dealer: 'Metro Honda', powertrain: 'hybrid',
      accent: '#4f7a52', listingUrl: 'https://example.com/accord',
      notes: 'Roomy, refined, great real-world economy. Top trim has everything.',
      specs: { engine: '2.0L 4-cyl + 2 motors', horsepower: 204, torque: 247, transmission: 'e-CVT', drivetrain: 'FWD',
        mpgCombined: 44, seating: 5, cargoCuFt: 16.7, towingLbs: 0, lengthIn: 195.7, legroomFront: 42.3, legroomRear: 40.8, groundClear: 5.5 },
      ratings: { comfort: 8, driving: 7, interior: 8, technology: 8, appearance: 7, cargo: 7, value: 9 },
      testDrive: { rideQuality: 8, visibility: 8, seatComfort: 9, cabinNoise: 8, acceleration: 7, steeringFeel: 7 },
      testDriveNotes: { rideQuality: 'Composed over rough pavement', seatComfort: 'Best seats of the three I drove' },
      pricing: { msrp: 38990, sellingPrice: 37800, discounts: 600, incentives: 500, tradeValue: 9000, taxRate: 8.25, fees: 1150 },
      finance: { downPayment: 4000, apr: 6.2, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 57, downPayment: 2500, annualMiles: 12000, moneyFactor: 0.00210 },
      ownership: { annualMiles: 12000, fuelCostPerGal: 3.65, electricityPerKwh: 0.17, insuranceYr: 1650, maintenanceYr: 620 },
      attachments: [{ id: uid(), name: 'Window Sticker.pdf', type: 'pdf' }, { id: uid(), name: 'Dealer Quote.pdf', type: 'pdf' }],
    }),
    mk({
      make: 'Tesla', model: 'Model 3', year: 2025, trim: 'Long Range AWD', bodyStyle: 'Sedan',
      condition: 'New', mileage: 6, color: 'Stealth Grey', dealer: 'Tesla Direct', powertrain: 'ev',
      accent: '#3f6f8f', listingUrl: 'https://example.com/model3',
      notes: 'Quickest of the group, lowest energy cost. Ride is firmer; tech-forward cabin.',
      specs: { engine: 'Dual motor', horsepower: 394, torque: 377, transmission: 'Single-speed', drivetrain: 'AWD',
        mpge: 132, evRange: 363, batteryKwh: 79, seating: 5, cargoCuFt: 21.0, towingLbs: 0, lengthIn: 185.8, legroomFront: 42.7, legroomRear: 35.2, groundClear: 5.5 },
      ratings: { comfort: 7, driving: 9, interior: 7, technology: 9, appearance: 8, cargo: 8, value: 7 },
      testDrive: { rideQuality: 6, visibility: 7, seatComfort: 7, cabinNoise: 9, acceleration: 10, steeringFeel: 8 },
      testDriveNotes: { acceleration: 'Effortless, instant', rideQuality: 'Firm over expansion joints' },
      pricing: { msrp: 47490, sellingPrice: 47490, discounts: 0, incentives: 7500, tradeValue: 9000, taxRate: 8.25, fees: 995 },
      finance: { downPayment: 4000, apr: 6.9, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 56, downPayment: 3000, annualMiles: 12000, moneyFactor: 0.00250 },
      ownership: { annualMiles: 12000, fuelCostPerGal: 3.65, electricityPerKwh: 0.17, insuranceYr: 1980, maintenanceYr: 380 },
      attachments: [{ id: uid(), name: 'Configurator.png', type: 'image' }],
    }),
    mk({
      make: 'Toyota', model: 'RAV4', year: 2025, trim: 'XLE Premium AWD', bodyStyle: 'SUV',
      condition: 'New', mileage: 18, color: 'Cavalry Blue', dealer: 'Sunrise Toyota', powertrain: 'gas',
      accent: '#8a7a5c', listingUrl: 'https://example.com/rav4',
      notes: 'Higher seating, most cargo and ground clearance. Engine is a bit coarse under load.',
      specs: { engine: '2.5L 4-cyl', horsepower: 203, torque: 184, transmission: '8-speed auto', drivetrain: 'AWD',
        mpgCombined: 30, seating: 5, cargoCuFt: 37.6, towingLbs: 3500, lengthIn: 180.9, legroomFront: 41.0, legroomRear: 37.8, groundClear: 8.4 },
      ratings: { comfort: 7, driving: 6, interior: 6, technology: 7, appearance: 7, cargo: 9, value: 8 },
      testDrive: { rideQuality: 7, visibility: 9, seatComfort: 7, cabinNoise: 6, acceleration: 6, steeringFeel: 6 },
      testDriveNotes: { visibility: 'Commanding view, easy to park', cabinNoise: 'Engine drones on the highway' },
      pricing: { msrp: 35450, sellingPrice: 34900, discounts: 550, incentives: 0, tradeValue: 9000, taxRate: 8.25, fees: 1100 },
      finance: { downPayment: 3500, apr: 6.4, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 60, downPayment: 2500, annualMiles: 12000, moneyFactor: 0.00230 },
      ownership: { annualMiles: 12000, fuelCostPerGal: 3.65, electricityPerKwh: 0.17, insuranceYr: 1580, maintenanceYr: 720 },
      attachments: [],
    }),
    mk({
      make: 'Hyundai', model: 'IONIQ 6', year: 2025, trim: 'SEL AWD', bodyStyle: 'Sedan',
      condition: 'New', mileage: 9, color: 'Serenity White', dealer: 'Capital Hyundai', powertrain: 'ev',
      accent: '#7a5aa8', listingUrl: 'https://example.com/ioniq6',
      notes: 'Quietest, very efficient, comfy ride. Lower roofline hurts rear headroom a touch.',
      specs: { engine: 'Dual motor', horsepower: 320, torque: 446, transmission: 'Single-speed', drivetrain: 'AWD',
        mpge: 121, evRange: 316, batteryKwh: 77, seating: 5, cargoCuFt: 11.2, towingLbs: 0, lengthIn: 191.1, legroomFront: 42.3, legroomRear: 39.2, groundClear: 5.1 },
      ratings: { comfort: 9, driving: 8, interior: 8, technology: 8, appearance: 8, cargo: 6, value: 8 },
      testDrive: { rideQuality: 9, visibility: 6, seatComfort: 9, cabinNoise: 10, acceleration: 8, steeringFeel: 7 },
      testDriveNotes: { cabinNoise: 'Library quiet at speed', seatComfort: 'Relaxation seats are excellent' },
      pricing: { msrp: 45600, sellingPrice: 44200, discounts: 1400, incentives: 7500, tradeValue: 9000, taxRate: 8.25, fees: 1050 },
      finance: { downPayment: 4000, apr: 6.6, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 54, downPayment: 2500, annualMiles: 12000, moneyFactor: 0.00190 },
      ownership: { annualMiles: 12000, fuelCostPerGal: 3.65, electricityPerKwh: 0.17, insuranceYr: 1820, maintenanceYr: 420 },
      attachments: [{ id: uid(), name: 'Spec Sheet.pdf', type: 'pdf' }],
    }),
  ];
}
