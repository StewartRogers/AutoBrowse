// data.ts — data model, seed vehicles, financial calculations, decision-matrix scoring
// Ported close to verbatim from design_handoff_autobrowse/source/data.jsx

// ---------- types ----------

export type Powertrain = 'gas' | 'hybrid' | 'ev';
export type Condition = 'New' | 'Used' | 'CPO';
export type PricingMode = 'cash' | 'finance' | 'lease';
export type BodyStyle = 'Sedan' | 'Coupe' | 'Hatchback' | 'SUV' | 'Crossover' | 'Truck' | 'Minivan' | 'Wagon';
export type MatrixMetricKey = keyof typeof MATRIX_METRICS;

export interface SpecFields {
  engine?: string;
  horsepower?: number;
  torque?: number;
  transmission?: string;
  drivetrain?: string;
  fuelL100km?: number;
  fuelL100kmCity?: number;
  fuelL100kmHwy?: number;
  mpge?: number;
  evRange?: number;
  batteryKwh?: number;
  chargeTimeLvl2Hr?: number;
  chargeTimeDCMins?: number;
  seating?: number;
  cargoL?: number;
  cargoLSeatsDown?: number;
  towingKg?: number;
  lengthCm?: number;
  legroomFront?: number;
  legroomRear?: number;
  rearHeadroomCm?: number;
  groundClear?: number;
}

export interface Features {
  heatedSeats?: 'front' | 'front+rear' | null;
  cooledSeats?: 'front' | 'front+rear' | null;
  heatedSteeringWheel?: boolean;
  powerSeats?: 'driver' | 'both' | null;
  interiorMaterial?: 'cloth' | 'leatherette' | 'leather' | null;
  sunroof?: boolean;
  thirdRow?: boolean;
  rearClimateControls?: boolean;
  rearVents?: boolean;
  frontWirelessCharging?: boolean;
  frontPluginCharging?: boolean;
  rearWirelessCharging?: boolean;
  rearPluginCharging?: boolean;
  blindspotMonitor?: boolean;
  backupCamera?: boolean;
  powerFoldingMirrors?: boolean;
  roofRack?: boolean;
}

export type SellerType = 'dealer' | 'private';

export type FeeType =
  | 'documentation' | 'finance' | 'freight_pdi' | 'registration_icbc'
  | 'tire_levy' | 'ac_excise' | 'vsa_consumer_fee' | 'battery_levy'
  | 'extended_warranty' | 'delivery_destination' | 'ppsa' | 'environmental'
  | 'custom';

export interface FeeCatalogEntry {
  type: FeeType;
  label: string;
  gstDefault: boolean;   // GST (5%) applies to this fee by default
  pstDefault: boolean;   // BC PST applies to this fee by default
  verify: boolean;       // true → nudge the user to confirm against the bill of sale
  note?: string;
}

// Common BC dealer-purchase fees and their default tax treatment. Each fee has
// independent GST/PST defaults. Sources: a fee that forms part of the purchase
// price is taxable (PST Bulletin 116, GST+PST); financial services (a genuine
// credit-arranging fee) are GST-exempt under the federal Excise Tax Act; government
// registration fees carry no GST/PST; eco levies (tire, A/C, battery) are
// government-mandated pass-throughs — GST applies, PST-exempt. The CONFIDENT
// entries have verify=false; the rest prompt the user to check the bill of sale.
export const FEE_CATALOG: FeeCatalogEntry[] = [
  { type: 'documentation',         label: 'Documentation',               gstDefault: true,  pstDefault: true,  verify: false },
  { type: 'finance',               label: 'Finance fee',                 gstDefault: false, pstDefault: false, verify: false, note: 'Exempt only if it is a genuine financing fee; if it is dealer margin relabeled, it is taxable.' },
  { type: 'freight_pdi',           label: 'Freight / PDI',               gstDefault: true,  pstDefault: true,  verify: false },
  { type: 'delivery_destination',  label: 'Delivery & destination',      gstDefault: true,  pstDefault: true,  verify: false },
  { type: 'registration_icbc',     label: 'Registration (ICBC)',         gstDefault: false, pstDefault: false, verify: false },
  { type: 'ppsa',                  label: 'PPSA fee',                    gstDefault: true,  pstDefault: true,  verify: false, note: 'The actual gov filing is exempt but dealers typically bundle it as a taxable admin fee.' },
  { type: 'tire_levy',             label: 'Tire levy',                   gstDefault: true,  pstDefault: false, verify: false },
  { type: 'ac_excise',             label: 'A/C excise tax',              gstDefault: true,  pstDefault: false, verify: false },
  { type: 'battery_levy',          label: 'Battery levy',                gstDefault: true,  pstDefault: false, verify: false },
  { type: 'environmental',         label: 'Environmental fee',           gstDefault: true,  pstDefault: false, verify: true, note: 'Eco levies are PST-exempt; generic dealer "environmental admin" fees are usually fully taxable.' },
  { type: 'vsa_consumer_fee',      label: 'VSA consumer fee',            gstDefault: true,  pstDefault: true,  verify: true },
  { type: 'extended_warranty',     label: 'Extended warranty',           gstDefault: true,  pstDefault: true,  verify: true },
  { type: 'custom',                label: 'Custom fee',                  gstDefault: false, pstDefault: false, verify: true },
];

export function feeCatalogEntry(type: FeeType): FeeCatalogEntry {
  return FEE_CATALOG.find(e => e.type === type) ?? FEE_CATALOG[FEE_CATALOG.length - 1];
}

// A single line-item fee. `type` is chosen from FEE_CATALOG, which fills `label`
// and the default GST/PST flags. The user can still flip them; when they do we set
// `taxOverridden` so the defaults aren't silently re-applied on the next type change.
export interface Fee {
  id: string;
  type: FeeType;
  label: string;
  amount: number;
  gst: boolean;           // GST (5%) applies
  pst: boolean;           // BC PST applies
  taxOverridden: boolean;
}

// Build a fresh fee row of the given type, pre-filled from the catalog.
export function makeFee(type: FeeType = 'custom'): Fee {
  const e = feeCatalogEntry(type);
  return { id: uid(), type, label: e.label, amount: 0, gst: e.gstDefault, pst: e.pstDefault, taxOverridden: false };
}

// Best-effort mapping of a free-form legacy fee label onto a catalog type.
export function inferFeeType(label: string): FeeType {
  const l = label.toLowerCase();
  if (l.includes('doc')) return 'documentation';
  if (l.includes('financ')) return 'finance';
  if (l.includes('freight') || l.includes('pdi')) return 'freight_pdi';
  if (l.includes('delivery') || l.includes('destination')) return 'delivery_destination';
  if (l.includes('regist') || l.includes('icbc')) return 'registration_icbc';
  if (l.includes('ppsa')) return 'ppsa';
  if (l.includes('tire') || l.includes('tyre')) return 'tire_levy';
  if (l.includes('a/c') || l.includes('excise') || l.includes('air con')) return 'ac_excise';
  if (l.includes('vsa')) return 'vsa_consumer_fee';
  if (l.includes('battery')) return 'battery_levy';
  if (l.includes('environ')) return 'environmental';
  if (l.includes('warranty')) return 'extended_warranty';
  return 'custom';
}

// Normalize one stored/legacy fee into the structured shape. Accepts the old
// { label, amount, taxable } objects (and already-migrated rows with gst/pst)
// and fills in id/type/taxOverridden without losing the entered amount or label.
export function migrateFee(raw: unknown): Fee {
  const ff = (raw ?? {}) as Record<string, unknown>;
  const label = String(ff.label ?? 'Fee');
  const amount = Number.isFinite(Number(ff.amount)) ? Number(ff.amount) : 0;
  const validType = FEE_CATALOG.some(c => c.type === ff.type);
  const type = (validType ? ff.type : inferFeeType(label)) as FeeType;
  const cat = feeCatalogEntry(type);
  const id = typeof ff.id === 'string' && ff.id ? ff.id : uid();

  // Already has per-tax flags (new format)
  if (typeof ff.gst === 'boolean') {
    const gst = !!ff.gst;
    const pst = !!ff.pst;
    const taxOverridden = ff.taxOverridden !== undefined
      ? !!ff.taxOverridden
      : gst !== cat.gstDefault || pst !== cat.pstDefault;
    return { id, type, label, amount, gst, pst, taxOverridden };
  }

  // Old format: single `taxable` boolean → map to per-tax flags
  const taxable = !!ff.taxable;
  const gst = taxable;
  const pst = taxable;
  const taxOverridden = ff.taxableOverridden !== undefined
    ? !!ff.taxableOverridden
    : gst !== cat.gstDefault || pst !== cat.pstDefault;
  return { id, type, label, amount, gst, pst, taxOverridden };
}

export interface Pricing {
  msrp: number;
  discount: number;   // selling price is DERIVED, not entered: sellingPriceOf(p) = max(0, msrp − clamp(discount, 0, msrp)). msrp is display-only (shows the buyer their saving).
  incentives: number; // post-tax rebate (reduces the out-the-door total, not the taxable base)
  tradeValue: number;
  taxRate: number;    // % — legacy flat rate; still drives lease tax (leaseCalc). BC purchase tax is computed from the fields below.
  fees: Fee[];        // itemized; each fee carries independent GST/PST flags
  // BC vehicle-tax inputs (see bcTax / PST Bulletin 308). All optional with
  // dealer/passenger/non-ZEV defaults so existing data and callers don't break.
  sellerType?: SellerType;       // default 'dealer' (private sales pay no GST)
  isZEV?: boolean;               // default false (zero-emission vehicle PST schedule)
  isPassengerVehicle?: boolean;  // default true  (non-passenger = flat PST)
}

// Selling price is computed from MSRP minus the discount (never an input). Discount
// is clamped to [0, msrp] so the price can never go negative or exceed MSRP.
export function sellingPriceOf(p: Pricing): number {
  const msrp = p.msrp || 0;
  const discount = Math.min(Math.max(0, p.discount || 0), msrp);
  return Math.max(0, msrp - discount);
}

// True when the entered discount is larger than MSRP — surface this as a validation
// error in the UI. (The math itself clamps via sellingPriceOf, so it never breaks.)
export function discountExceedsMsrp(p: Pricing): boolean {
  return (p.discount || 0) > (p.msrp || 0);
}

// Upgrade a legacy pricing blob to the current shape: manual `sellingPrice` and
// numeric `discounts` → derived `discount`; numeric `fees` → a single non-taxable
// pass-through fee (legacy fees were added untaxed, so this preserves old totals).
// Idempotent, so it's safe to run on already-migrated data (used at store load).
export function migratePricing(raw: unknown): Pricing {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);

  let fees: Fee[];
  if (Array.isArray(r.fees)) {
    fees = r.fees.map(migrateFee);
  } else {
    // Oldest shape: a single numeric `fees` total (added untaxed) → one custom row.
    const amt = num(r.fees);
    fees = amt > 0 ? [migrateFee({ label: 'Fees', amount: amt, taxable: false })] : [];
  }

  let msrp = num(r.msrp);
  let discount: number;
  if (r.discount !== undefined && r.discount !== null) {
    discount = num(r.discount);
  } else if (Number.isFinite(Number(r.sellingPrice)) && Number(r.sellingPrice) > 0) {
    const selling = Number(r.sellingPrice);
    if (msrp >= selling) discount = msrp - selling;
    else { msrp = selling; discount = 0; } // legacy used-car row with blank MSRP
  } else {
    discount = num(r.discounts);
  }

  return {
    msrp,
    discount,
    incentives: num(r.incentives),
    tradeValue: num(r.tradeValue),
    taxRate: num(r.taxRate),
    fees,
    sellerType: r.sellerType === 'private' ? 'private' : 'dealer',
    isZEV: !!r.isZEV,
    isPassengerVehicle: r.isPassengerVehicle === undefined ? true : !!r.isPassengerVehicle,
  };
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
  annualKm: number;
  moneyFactor: number;
}

export interface Ownership {
  annualKm: number;
  fuelCostPerL: number;
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

  // Pricing scenario
  pricingMode: PricingMode;  // what mode this entry represents
  groupId: string;            // shared across copies of the same car

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
  photoUrl: string;
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
  features?: Features;
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
  { key: 'engine',       label: 'Engine',           group: 'Powertrain',   kind: 'text' },
  { key: 'horsepower',   label: 'Horsepower',        group: 'Powertrain',   unit: 'hp',       better: 'high' },
  { key: 'torque',       label: 'Torque',            group: 'Powertrain',   unit: 'Nm',       better: 'high' },
  { key: 'transmission', label: 'Transmission',      group: 'Powertrain',   kind: 'text' },
  { key: 'drivetrain',   label: 'Drivetrain',        group: 'Powertrain',   kind: 'text' },
  { key: 'fuelL100km',        label: 'Fuel Economy (comb.)',    group: 'Efficiency',   unit: 'L/100km',  better: 'low',  evHide: true },
  { key: 'fuelL100kmCity',    label: 'Fuel Economy (city)',    group: 'Efficiency',   unit: 'L/100km',  better: 'low',  evHide: true },
  { key: 'fuelL100kmHwy',     label: 'Fuel Economy (hwy)',     group: 'Efficiency',   unit: 'L/100km',  better: 'low',  evHide: true },
  { key: 'mpge',              label: 'Efficiency',             group: 'Efficiency',   unit: 'Le/100km', better: 'low',  evOnly: true },
  { key: 'evRange',           label: 'EV Range',               group: 'Efficiency',   unit: 'km',       better: 'high', evOnly: true },
  { key: 'batteryKwh',        label: 'Battery',                group: 'Efficiency',   unit: 'kWh',      better: 'high', evOnly: true },
  { key: 'chargeTimeLvl2Hr',  label: 'Charge Time (L2, full)', group: 'Efficiency',   unit: 'hr',       better: 'low',  evOnly: true },
  { key: 'chargeTimeDCMins',  label: 'DC Fast Charge (80%)',   group: 'Efficiency',   unit: 'min',      better: 'low',  evOnly: true },
  { key: 'seating',      label: 'Seating',           group: 'Practicality', unit: 'seats',    better: 'high' },
  { key: 'cargoL',          label: 'Cargo (seats up)',   group: 'Practicality', unit: 'L',  better: 'high' },
  { key: 'cargoLSeatsDown', label: 'Cargo (seats down)', group: 'Practicality', unit: 'L',  better: 'high' },
  { key: 'towingKg',        label: 'Towing',             group: 'Practicality', unit: 'kg', better: 'high' },
  { key: 'lengthCm',     label: 'Length',            group: 'Dimensions',   unit: 'cm' },
  { key: 'legroomFront',   label: 'Front Legroom',    group: 'Comfort',      unit: 'cm',       better: 'high' },
  { key: 'legroomRear',   label: 'Rear Legroom',     group: 'Comfort',      unit: 'cm',       better: 'high' },
  { key: 'rearHeadroomCm',label: 'Rear Headroom',    group: 'Comfort',      unit: 'cm',       better: 'high' },
  { key: 'groundClear',   label: 'Ground Clearance', group: 'Comfort',      unit: 'cm',       better: 'high' },
];

export interface FeatureFieldDef {
  key: keyof Features;
  label: string;
  group: string;
  type: 'boolean' | 'select';
  options?: { value: string; label: string }[];
}

export const FEATURE_FIELDS: FeatureFieldDef[] = [
  { key: 'heatedSeats',           label: 'Heated Seats',              group: 'Comfort',     type: 'select',  options: [{ value: 'front', label: 'Front only' }, { value: 'front+rear', label: 'Front + rear' }] },
  { key: 'cooledSeats',           label: 'Cooled / Ventilated Seats', group: 'Comfort',     type: 'select',  options: [{ value: 'front', label: 'Front only' }, { value: 'front+rear', label: 'Front + rear' }] },
  { key: 'heatedSteeringWheel',   label: 'Heated Steering Wheel',     group: 'Comfort',     type: 'boolean' },
  { key: 'powerSeats',            label: 'Power Seats',               group: 'Comfort',     type: 'select',  options: [{ value: 'driver', label: 'Driver only' }, { value: 'both', label: 'Both front' }] },
  { key: 'interiorMaterial',      label: 'Interior Material',         group: 'Interior',    type: 'select',  options: [{ value: 'cloth', label: 'Cloth' }, { value: 'leatherette', label: 'Leatherette / synthetic' }, { value: 'leather', label: 'Real leather' }] },
  { key: 'sunroof',               label: 'Sunroof / Moonroof',        group: 'Interior',    type: 'boolean' },
  { key: 'thirdRow',              label: '3rd Row Seating',           group: 'Interior',    type: 'boolean' },
  { key: 'rearClimateControls',   label: 'Rear Climate Controls',     group: 'Interior',    type: 'boolean' },
  { key: 'rearVents',             label: 'Rear HVAC Vents',           group: 'Interior',    type: 'boolean' },
  { key: 'frontWirelessCharging', label: 'Front Wireless Charging',   group: 'Technology',  type: 'boolean' },
  { key: 'frontPluginCharging',   label: 'Front USB Charging',        group: 'Technology',  type: 'boolean' },
  { key: 'rearWirelessCharging',  label: 'Rear Wireless Charging',    group: 'Technology',  type: 'boolean' },
  { key: 'rearPluginCharging',    label: 'Rear USB Charging',         group: 'Technology',  type: 'boolean' },
  { key: 'blindspotMonitor',      label: 'Blind Spot Monitor',        group: 'Safety',      type: 'boolean' },
  { key: 'backupCamera',          label: 'Backup Camera',             group: 'Safety',      type: 'boolean' },
  { key: 'powerFoldingMirrors',   label: 'Power Folding Mirrors',     group: 'Exterior',    type: 'boolean' },
  { key: 'roofRack',              label: 'Roof Rack',                 group: 'Exterior',    type: 'boolean' },
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
  const id = uid();
  return {
    id,
    archived: false,
    excludeReason: '',
    excludedAt: 0,
    createdAt: Date.now(),
    viewedAt: Date.now(),
    pricingMode: 'finance',
    groupId: id,
    make: '', model: '', year: new Date().getFullYear(), trim: '', bodyStyle: 'Sedan',
    condition: 'New', mileage: 0, color: '', dealer: '', listingUrl: '',
    photoUrl: '',
    accent: '#b4552d', powertrain: 'gas', notes: '',
    specs: {},
    ratings: {},
    testDrive: {}, testDriveNotes: {},
    pricing: { msrp: 0, discount: 0, incentives: 0, tradeValue: 0, taxRate: 13, fees: [{ ...makeFee('documentation'), amount: 1000 }], sellerType: 'dealer', isZEV: false, isPassengerVehicle: true },
    finance: { downPayment: 3000, apr: 6.4, termMonths: 60 },
    lease: { termMonths: 36, residualPct: 58, downPayment: 2500, annualKm: 20000, moneyFactor: 0.0022 },
    ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.13, insuranceYr: 1700, maintenanceYr: 700 },
    attachments: [],
    features: {},
  };
}

// ---------- British Columbia vehicle tax ----------
//
// Source: BC PST Bulletin 308, "PST on Vehicles" (gov.bc.ca). GST is the 5%
// federal tax; PST is tiered by price, seller type, ZEV status, and whether the
// vehicle is a passenger vehicle. Rates live in data-driven tables below so a
// future rate change is a one-line edit.
//
// NOTE: rebates are NOT a tax and are handled separately (p.incentives, applied
// in outTheDoor). As of mid-2026 BC offers no purchase rebate for passenger EVs,
// so there is nothing to net out here.
//
// TODO(2027-02-22): the ZEV passenger PST schedule below expires on this date,
// after which ZEVs revert to the standard (non-ZEV) passenger table. bcTax()
// already switches automatically based on `asOf`; revisit/remove once expired.

// Each tier's `rate` applies when base price >= `min` and below the next entry's
// `min`. Lookup = the last entry whose `min` is <= base. Rates are decimals.
interface PstTier { min: number; rate: number }

const PST_DEALER_PASSENGER: PstTier[] = [
  { min: 0, rate: 0.07 },
  { min: 55_000, rate: 0.08 },
  { min: 56_000, rate: 0.09 },
  { min: 57_000, rate: 0.10 },
  { min: 125_000, rate: 0.15 },
  { min: 150_000, rate: 0.20 },
];

// In effect until 2027-02-22 (see TODO above), then reverts to the non-ZEV table.
const PST_DEALER_PASSENGER_ZEV: PstTier[] = [
  { min: 0, rate: 0.07 },
  { min: 75_000, rate: 0.08 },
  { min: 76_000, rate: 0.09 },
  { min: 77_000, rate: 0.10 },
  { min: 125_000, rate: 0.15 },
  { min: 150_000, rate: 0.20 },
];

// Private passenger sales: ZEV and non-ZEV are identical.
const PST_PRIVATE_PASSENGER: PstTier[] = [
  { min: 0, rate: 0.12 },
  { min: 125_000, rate: 0.15 },
  { min: 150_000, rate: 0.20 },
];

// Non-passenger vehicles (trucks, etc.): flat regardless of price.
const PST_DEALER_NONPASSENGER: PstTier[] = [{ min: 0, rate: 0.07 }];
const PST_PRIVATE_NONPASSENGER: PstTier[] = [{ min: 0, rate: 0.12 }];

const ZEV_PST_SUNSET = Date.parse('2027-02-22T00:00:00');

function pstTiers(p: Pricing, asOf: Date): PstTier[] {
  const sellerType = p.sellerType ?? 'dealer';
  const isPassenger = p.isPassengerVehicle ?? true;
  if (!isPassenger) return sellerType === 'private' ? PST_PRIVATE_NONPASSENGER : PST_DEALER_NONPASSENGER;
  if (sellerType === 'private') return PST_PRIVATE_PASSENGER;
  const zevActive = (p.isZEV ?? false) && asOf.getTime() < ZEV_PST_SUNSET;
  return zevActive ? PST_DEALER_PASSENGER_ZEV : PST_DEALER_PASSENGER;
}

function pstRate(tiers: PstTier[], base: number): number {
  let rate = tiers[0].rate;
  for (const t of tiers) if (base >= t.min) rate = t.rate;
  return rate;
}

export interface FeeBreakdown {
  label: string;
  amount: number;     // face value (added to the total exactly once)
  gst: boolean;
  pst: boolean;
  feeGst: number;     // GST attributable to this fee
  feePst: number;     // PST attributable to this fee
  taxApplied: number; // total tax on this fee (feeGst + feePst)
}

export interface TaxBreakdown {
  // Inputs surfaced for display
  msrp: number;
  discount: number;
  sellingPrice: number;     // derived: msrp − discount
  // Tax
  gst: number;              // 5% federal, dealer purchases only
  pst: number;              // tiered BC provincial tax
  pstRate: number;          // the PST rate applied, as a percentage (e.g. 7, 10, 12) — for display
  luxuryTax: number;        // federal luxury tax (sellingPrice > 100k)
  totalTax: number;         // gst + pst + luxuryTax
  fees: FeeBreakdown[];
  outTheDoor: number;       // sellingPrice + totalTax + all fee amounts − incentives
  totalPrice: number;       // back-compat: sellingPrice + totalTax (before fees/incentives/trade)
}

// ---------- financial math ----------

// BC vehicle tax + out-the-door breakdown. `asOf` controls the ZEV-schedule sunset
// and defaults to now; tests pass a fixed date for determinism.
//
// Sources: PST rates per BC PST Bulletin 308; fees forming part of the purchase
// price per Bulletin 116; financial services (a genuine credit-arranging fee) are
// GST-exempt under the federal Excise Tax Act. The finance-fee exemption depends on
// how the dealer characterizes it — verify against the bill of sale.
export function bcTax(p: Pricing, asOf: Date = new Date()): TaxBreakdown {
  const msrp = p.msrp || 0;
  const discount = Math.min(Math.max(0, p.discount || 0), msrp);
  const sellingPrice = Math.max(0, msrp - discount);
  const sellerType = p.sellerType ?? 'dealer';
  const fees = p.fees ?? [];
  const isDealer = sellerType === 'dealer';

  // Fees with GST/PST flags independently contribute to the GST and PST bases.
  // A fee can be GST-only (eco levies), PST-only, both, or neither.
  const gstFeeTotal = fees.reduce((s, f) => s + (f.gst ? (f.amount || 0) : 0), 0);
  const pstFeeTotal = fees.reduce((s, f) => s + (f.pst ? (f.amount || 0) : 0), 0);

  // Dealer: a trade-in reduces both GST and PST. Private sale: PST on the full
  // price, no GST, and a trade-in does not reduce the base.
  const tradeReduction = isDealer ? (p.tradeValue || 0) : 0;
  const gstBase = Math.max(0, sellingPrice - tradeReduction + gstFeeTotal);
  const pstBase = Math.max(0, sellingPrice - tradeReduction + pstFeeTotal);

  // Federal luxury tax: only above $100k, the LESSER of 10% of price or 20% of the
  // amount over $100k. Computed on the selling price, before the fee adjustments.
  const luxuryTax = sellingPrice > 100_000
    ? Math.min(0.10 * sellingPrice, 0.20 * (sellingPrice - 100_000))
    : 0;

  // PST band is chosen from the pstBase, so a PST-taxable fee can push the price
  // into a higher tier. GST and PST are parallel — neither is charged on the other
  // — but GST is charged on top of the luxury tax (existing rule).
  const rate = pstRate(pstTiers(p, asOf), pstBase);
  const pst = pstBase * rate;
  const gst = isDealer ? 0.05 * (gstBase + luxuryTax) : 0;
  const totalTax = gst + pst + luxuryTax;

  // Per-fee tax attribution for display: each fee independently carries its GST
  // and/or PST based on its own flags. Private sales never have GST.
  const feeBreakdown: FeeBreakdown[] = fees.map(f => {
    const amt = f.amount || 0;
    const fg = (f.gst && isDealer) ? amt * 0.05 : 0;
    const fp = f.pst ? amt * rate : 0;
    return { label: f.label, amount: amt, gst: !!f.gst, pst: !!f.pst, feeGst: fg, feePst: fp, taxApplied: fg + fp };
  });

  // Every fee's principal is added to the total exactly once here; the tax on the
  // taxable ones is already inside totalTax (via gstBase/pstBase), not re-added.
  const allFees = fees.reduce((s, f) => s + (f.amount || 0), 0);
  const outTheDoor = sellingPrice + totalTax + allFees - (p.incentives || 0);

  // Round the display rate to 2 decimals — `rate * 100` yields FP noise like
  // 7.000000000000001 for 0.07. The tier rates are whole percents in practice.
  const ratePct = Math.round(rate * 10000) / 100;
  return {
    msrp, discount, sellingPrice,
    gst, pst, pstRate: ratePct, luxuryTax, totalTax,
    fees: feeBreakdown, outTheDoor,
    totalPrice: sellingPrice + totalTax,
  };
}

// Single-number tax total, kept for backward compatibility (all callers).
export function taxesOn(p: Pricing, asOf: Date = new Date()): number {
  return bcTax(p, asOf).totalTax;
}

export function outTheDoor(p: Pricing, asOf: Date = new Date()): number {
  return bcTax(p, asOf).outTheDoor;
}

export interface FinanceResult {
  principal: number;        // = amountFinanced (kept name for backward compatibility)
  amountFinanced: number;   // outTheDoor − downPayment − tradeValue, floored at 0
  monthly: number;
  totalInterest: number;
  totalOfPayments: number;  // monthly × term — the LOAN only (NO down payment)
  totalCost: number;        // buyer's total out of pocket = downPayment + totalOfPayments
  totalPaid: number;        // kept name for backward compatibility; equals totalCost
}

export function financeCalc(v: Pick<Vehicle, 'pricing' | 'finance'>): FinanceResult {
  const p = v.pricing, f = v.finance;
  const otd = outTheDoor(p);
  // Trade-in reduces the loan (existing behaviour); with no trade this is just
  // outTheDoor − downPayment, per the spec.
  const amountFinanced = Math.max(0, otd - (f.downPayment || 0) - (p.tradeValue || 0));
  const r = (f.apr || 0) / 100 / 12;
  const n = f.termMonths || 1;
  const monthly = r === 0 ? amountFinanced / n : (amountFinanced * r) / (1 - Math.pow(1 + r, -n));

  // Total of payments is the sum of the monthly payments only — financed amount
  // plus interest. The down payment is paid up front and is NOT part of it
  // (folding it in here double-counts money already in the out-the-door price).
  const totalOfPayments = monthly * n;
  const totalInterest = totalOfPayments - amountFinanced;
  // Total out of pocket = down payment + the loan's total of payments. Expressed via
  // the OTD so an oversized down payment can't inflate it past the price; equals
  // downPayment + totalOfPayments for normal inputs (and OTD − trade + interest).
  const totalCost = Math.max(0, otd - (p.tradeValue || 0)) + totalInterest;

  return {
    principal: amountFinanced,
    amountFinanced,
    monthly,
    totalInterest,
    totalOfPayments,
    totalCost,
    totalPaid: totalCost,
  };
}

export interface LeaseResult {
  monthly: number;
  residual: number;
  totalLease: number;
  buyout: number;
}

export function leaseCalc(v: Pick<Vehicle, 'pricing' | 'lease'>): LeaseResult {
  const p = v.pricing, l = v.lease;
  const selling = sellingPriceOf(p);
  const cap = Math.max(
    0,
    selling - (l.downPayment || 0) - (p.tradeValue || 0) - (p.incentives || 0)
  );
  const residual = (p.msrp || selling || 0) * ((l.residualPct || 0) / 100);
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
  const km = o.annualKm || 0;
  if (v.powertrain === 'ev') {
    const kWhPer100km = 20; // default; ~equivalent to 3.3 mi/kWh
    return (km / 100) * kWhPer100km * (o.electricityPerKwh || 0);
  }
  const l100km = v.specs.fuelL100km || 9.0; // default fallback ~30 mpg equivalent
  return (km / 100) * l100km * (o.fuelCostPerL || 0);
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
  fmt: 'money' | 'score' | 'cm' | 'L' | 'hp' | 'raw';
}

export const MATRIX_METRICS: Record<string, MetricDef> = {
  price:       { label: 'Price',          dir: 'low',  fn: v => sellingPriceOf(v.pricing), fmt: 'money' },
  payment:     { label: 'Monthly Cost',   dir: 'low',  fn: v => financeCalc(v).monthly,    fmt: 'money' },
  ownership:   { label: '5-yr Ownership', dir: 'low',  fn: v => ownershipCalc(v).y5,       fmt: 'money' },
  comfort:     { label: 'Comfort',        dir: 'high', fn: v => v.ratings.comfort || 0,    fmt: 'score' },
  seatComfort: { label: 'Seat Comfort',   dir: 'high', fn: v => v.testDrive.seatComfort || 0, fmt: 'score' },
  rear:        { label: 'Rear Legroom',   dir: 'high', fn: v => v.specs.legroomRear || 0,  fmt: 'cm' },
  interior:    { label: 'Interior',       dir: 'high', fn: v => v.ratings.interior || 0,   fmt: 'score' },
  cargo:       { label: 'Cargo Space',    dir: 'high', fn: v => v.specs.cargoL || 0,       fmt: 'L' },
  tech:        { label: 'Technology',     dir: 'high', fn: v => v.ratings.technology || 0, fmt: 'score' },
  efficiency:  { label: 'Efficiency',     dir: 'high', fn: v => v.powertrain === 'ev' ? (v.specs.mpge ? 100 / v.specs.mpge : 0) : (v.specs.fuelL100km ? 100 / v.specs.fuelL100km : 0), fmt: 'raw' },
  performance: { label: 'Performance',    dir: 'high', fn: v => v.specs.horsepower || 0,   fmt: 'hp' },
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
  const mk = (data: Partial<Vehicle>): Vehicle => {
    const id = uid();
    return { ...blankVehicle(), ...data, id, groupId: id };
  };
  return [
    mk({
      make: 'Honda', model: 'Accord', year: 2025, trim: 'Hybrid Touring', bodyStyle: 'Sedan',
      condition: 'New', mileage: 12, color: 'Platinum White Pearl', dealer: 'Metro Honda', powertrain: 'hybrid',
      accent: '#4f7a52', listingUrl: 'https://example.com/accord',
      notes: 'Roomy, refined, great real-world economy. Top trim has everything.',
      specs: { engine: '2.0L 4-cyl + 2 motors', horsepower: 204, torque: 335, transmission: 'e-CVT', drivetrain: 'FWD',
        fuelL100km: 5.4, seating: 5, cargoL: 473, towingKg: 0, lengthCm: 497, legroomFront: 107, legroomRear: 104, groundClear: 14 },
      ratings: { comfort: 8, driving: 7, interior: 8, technology: 8, appearance: 7, cargo: 7, value: 9 },
      testDrive: { rideQuality: 8, visibility: 8, seatComfort: 9, cabinNoise: 8, acceleration: 7, steeringFeel: 7 },
      testDriveNotes: { rideQuality: 'Composed over rough pavement', seatComfort: 'Best seats of the three I drove' },
      pricing: { msrp: 38990, discount: 1190, incentives: 500, tradeValue: 9000, taxRate: 13, fees: [{ ...makeFee('documentation'), amount: 1000 }] },
      finance: { downPayment: 4000, apr: 6.2, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 57, downPayment: 2500, annualKm: 20000, moneyFactor: 0.00210 },
      ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.13, insuranceYr: 1650, maintenanceYr: 620 },
      attachments: [{ id: uid(), name: 'Window Sticker.pdf', type: 'pdf' }, { id: uid(), name: 'Dealer Quote.pdf', type: 'pdf' }],
    }),
    mk({
      make: 'Tesla', model: 'Model 3', year: 2025, trim: 'Long Range AWD', bodyStyle: 'Sedan',
      condition: 'New', mileage: 6, color: 'Stealth Grey', dealer: 'Tesla Direct', powertrain: 'ev',
      accent: '#3f6f8f', listingUrl: 'https://example.com/model3',
      notes: 'Quickest of the group, lowest energy cost. Ride is firmer; tech-forward cabin.',
      specs: { engine: 'Dual motor', horsepower: 394, torque: 511, transmission: 'Single-speed', drivetrain: 'AWD',
        mpge: 1.78, evRange: 584, batteryKwh: 79, seating: 5, cargoL: 595, towingKg: 0, lengthCm: 472, legroomFront: 108, legroomRear: 89, groundClear: 14 },
      ratings: { comfort: 7, driving: 9, interior: 7, technology: 9, appearance: 8, cargo: 8, value: 7 },
      testDrive: { rideQuality: 6, visibility: 7, seatComfort: 7, cabinNoise: 9, acceleration: 10, steeringFeel: 8 },
      testDriveNotes: { acceleration: 'Effortless, instant', rideQuality: 'Firm over expansion joints' },
      pricing: { msrp: 47490, discount: 0, incentives: 7500, tradeValue: 9000, taxRate: 13, fees: [{ ...makeFee('documentation'), amount: 995 }] },
      finance: { downPayment: 4000, apr: 6.9, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 56, downPayment: 3000, annualKm: 20000, moneyFactor: 0.00250 },
      ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.13, insuranceYr: 1980, maintenanceYr: 380 },
      attachments: [{ id: uid(), name: 'Configurator.png', type: 'image' }],
    }),
    mk({
      make: 'Toyota', model: 'RAV4', year: 2025, trim: 'XLE Premium AWD', bodyStyle: 'SUV',
      condition: 'New', mileage: 18, color: 'Cavalry Blue', dealer: 'Sunrise Toyota', powertrain: 'gas',
      accent: '#8a7a5c', listingUrl: 'https://example.com/rav4',
      notes: 'Higher seating, most cargo and ground clearance. Engine is a bit coarse under load.',
      specs: { engine: '2.5L 4-cyl', horsepower: 203, torque: 250, transmission: '8-speed auto', drivetrain: 'AWD',
        fuelL100km: 7.8, seating: 5, cargoL: 1065, towingKg: 1588, lengthCm: 460, legroomFront: 104, legroomRear: 96, groundClear: 21 },
      ratings: { comfort: 7, driving: 6, interior: 6, technology: 7, appearance: 7, cargo: 9, value: 8 },
      testDrive: { rideQuality: 7, visibility: 9, seatComfort: 7, cabinNoise: 6, acceleration: 6, steeringFeel: 6 },
      testDriveNotes: { visibility: 'Commanding view, easy to park', cabinNoise: 'Engine drones on the highway' },
      pricing: { msrp: 35450, discount: 550, incentives: 0, tradeValue: 9000, taxRate: 13, fees: [{ ...makeFee('documentation'), amount: 1000 }] },
      finance: { downPayment: 3500, apr: 6.4, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 60, downPayment: 2500, annualKm: 20000, moneyFactor: 0.00230 },
      ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.13, insuranceYr: 1580, maintenanceYr: 720 },
      attachments: [],
    }),
    mk({
      make: 'Hyundai', model: 'IONIQ 6', year: 2025, trim: 'SEL AWD', bodyStyle: 'Sedan',
      condition: 'New', mileage: 9, color: 'Serenity White', dealer: 'Capital Hyundai', powertrain: 'ev',
      accent: '#7a5aa8', listingUrl: 'https://example.com/ioniq6',
      notes: 'Quietest, very efficient, comfy ride. Lower roofline hurts rear headroom a touch.',
      specs: { engine: 'Dual motor', horsepower: 320, torque: 605, transmission: 'Single-speed', drivetrain: 'AWD',
        mpge: 1.94, evRange: 509, batteryKwh: 77, seating: 5, cargoL: 317, towingKg: 0, lengthCm: 486, legroomFront: 107, legroomRear: 100, groundClear: 13 },
      ratings: { comfort: 9, driving: 8, interior: 8, technology: 8, appearance: 8, cargo: 6, value: 8 },
      testDrive: { rideQuality: 9, visibility: 6, seatComfort: 9, cabinNoise: 10, acceleration: 8, steeringFeel: 7 },
      testDriveNotes: { cabinNoise: 'Library quiet at speed', seatComfort: 'Relaxation seats are excellent' },
      pricing: { msrp: 45600, discount: 1400, incentives: 7500, tradeValue: 9000, taxRate: 13, fees: [{ ...makeFee('documentation'), amount: 1000 }] },
      finance: { downPayment: 4000, apr: 6.6, termMonths: 60 },
      lease: { termMonths: 36, residualPct: 54, downPayment: 2500, annualKm: 20000, moneyFactor: 0.00190 },
      ownership: { annualKm: 20000, fuelCostPerL: 1.65, electricityPerKwh: 0.13, insuranceYr: 1820, maintenanceYr: 420 },
      attachments: [{ id: uid(), name: 'Spec Sheet.pdf', type: 'pdf' }],
    }),
  ];
}
