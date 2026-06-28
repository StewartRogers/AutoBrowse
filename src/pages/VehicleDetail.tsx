import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  SPEC_FIELDS, FEATURE_FIELDS, RATING_CATS, TESTDRIVE_CATS,
  financeCalc, leaseCalc, ownershipCalc, outTheDoor, bcTax,
  sellingPriceOf, discountExceedsMsrp, avgRating,
  FEE_CATALOG, feeCatalogEntry, makeFee,
  type Vehicle, type Fee, type FeeType,
} from '../lib/data';
import { money, vehicleName } from '../lib/fmt';
import Icon from '../components/Icon';
import PowertrainBadge from '../components/PowertrainBadge';
import PhotoSlot from '../components/PhotoSlot';
import ScoreBar from '../components/ScoreBar';
import RatingDots from '../components/RatingDots';
import Field from '../components/Field';
import MoneyInput from '../components/MoneyInput';
import Segmented from '../components/Segmented';
import SectionLabel from '../components/SectionLabel';
import ExcludeModal from '../features/ExcludeModal';
import styles from './VehicleDetail.module.css';

const TABS = [
  'Overview', 'Specifications', 'Ratings', 'Test Drive',
  'Pricing', 'Finance', 'Lease', 'Cost to Own', 'Attachments',
] as const;
type Tab = typeof TABS[number];

// ── Sticky result sidebar card ──────────────────────────────────────────────
function ResultStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={styles.resultStat}>
      <div className="label">{label}</div>
      <div className={`num ${styles.resultVal} ${accent ? styles.resultAccent : ''}`}>{value}</div>
      {sub && <div className={styles.resultSub}>{sub}</div>}
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  const finance = financeCalc(v);
  const lease = leaseCalc(v);
  const own = ownershipCalc(v);
  const rating = avgRating(v);

  const eco = v.powertrain === 'ev'
    ? v.specs.evRange ? `${v.specs.evRange} km range` : '—'
    : v.specs.fuelL100km ? `${v.specs.fuelL100km} L/100km` : '—';

  return (
    <div className={styles.overviewLayout}>
      <div className={styles.overviewLeft}>
        <PhotoSlot color={v.color || undefined} accent={v.accent} height={230} photoUrl={v.photoUrl || undefined} />

        {/* Key specs */}
        <div className={styles.keySpecs}>
          {[
            { label: v.powertrain === 'ev' ? 'Motor' : 'Engine', value: v.specs.engine || '—' },
            { label: v.powertrain === 'ev' ? 'Range' : 'Economy', value: eco },
            { label: 'Seating', value: v.specs.seating ? `${v.specs.seating} seats` : '—' },
            { label: 'Cargo', value: v.specs.cargoL ? `${v.specs.cargoL} L` : '—' },
            { label: 'Drivetrain', value: v.specs.drivetrain || '—' },
            { label: 'HP', value: v.specs.horsepower ? `${v.specs.horsepower} hp` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className={styles.keySpec}>
              <div className="label">{label}</div>
              <div className="num" style={{ fontSize: 14, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Notes</div>
          <textarea
            className="input"
            rows={4}
            placeholder="Running thoughts about this vehicle…"
            value={v.notes}
            onChange={e => update({ notes: e.target.value })}
          />
        </div>
      </div>

      {/* Right rail — result stats */}
      <div className={styles.overviewRight}>
        <div className={`card ${styles.resultCard}`}>
          <ResultStat label="Out-the-door" value={money(outTheDoor(v.pricing))} accent />

          <div className={styles.resultGrid2}>
            <ResultStat label="Finance / Mo" value={money(finance.monthly)} sub={`${v.finance.termMonths}mo`} />
            <ResultStat label="Lease / Mo" value={money(lease.monthly)} sub={`${v.lease.termMonths}mo`} />
          </div>

          <ResultStat label="5-yr Running Cost" value={money(own.y5)} />

          {rating > 0 && (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Overall Rating</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="num" style={{ fontSize: 20, fontWeight: 600, color: v.accent }}>{rating.toFixed(1)}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>/10</span>
                <ScoreBar value={rating} max={10} accent={v.accent} height={6} />
              </div>
            </div>
          )}

          {v.listingUrl && (
            <a href={v.listingUrl} target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost" style={{ justifyContent: 'center', width: '100%', marginTop: 4 }}>
              <Icon name="link" size={13} /> View listing
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Specifications tab ────────────────────────────────────────────────────────
function SpecsTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  const specGroups = [...new Set(SPEC_FIELDS.map(f => f.group))];
  const featureGroups = [...new Set(FEATURE_FIELDS.map(f => f.group))];
  const features = v.features ?? {};

  const setFeature = (key: string, val: unknown) =>
    update({ features: { ...features, [key]: val } });

  return (
    <div className={styles.tabContent}>
      {/* Numeric specs */}
      {specGroups.map(group => {
        const fields = SPEC_FIELDS.filter(f => {
          if (f.evOnly && v.powertrain !== 'ev') return false;
          if (f.evHide && v.powertrain === 'ev') return false;
          return f.group === group;
        });
        if (!fields.length) return null;
        return (
          <div key={group} className={styles.specGroup}>
            <SectionLabel>{group}</SectionLabel>
            <div className={styles.specRows}>
              {fields.map(f => (
                <div key={f.key} className={styles.specRow}>
                  <div className={styles.specLabel}>{f.label}{f.unit && <span className={styles.specUnit}> ({f.unit})</span>}</div>
                  {f.kind === 'text'
                    ? <input className="input" value={(v.specs as Record<string, string | number | undefined>)[f.key] as string ?? ''} onChange={e => update({ specs: { ...v.specs, [f.key]: e.target.value } })} />
                    : <input className="input num" type="number" value={(v.specs as Record<string, string | number | undefined>)[f.key] as number ?? ''} onChange={e => update({ specs: { ...v.specs, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) } })} />
                  }
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Feature flags */}
      {featureGroups.map(group => {
        const fields = FEATURE_FIELDS.filter(f => f.group === group);
        return (
          <div key={group} className={styles.specGroup}>
            <SectionLabel>{group}</SectionLabel>
            <div className={styles.specRows}>
              {fields.map(f => {
                const val = (features as Record<string, unknown>)[f.key];
                return (
                  <div key={f.key} className={styles.specRow}>
                    <div className={styles.specLabel}>{f.label}</div>
                    {f.type === 'boolean' ? (
                      <select
                        className="input select"
                        value={val === undefined ? '' : val ? 'yes' : 'no'}
                        onChange={e => setFeature(f.key, e.target.value === '' ? undefined : e.target.value === 'yes')}
                      >
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <select
                        className="input select"
                        value={(val as string) ?? ''}
                        onChange={e => setFeature(f.key, e.target.value === '' ? null : e.target.value)}
                      >
                        <option value="">—</option>
                        {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Ratings tab ───────────────────────────────────────────────────────────────
function RatingsTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  const avg = avgRating(v);
  return (
    <div className={styles.tabContent}>
      {/* Summary card */}
      {avg > 0 && (
        <div className={`card ${styles.ratingSummary}`} style={{ borderTop: `3px solid ${v.accent}` }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Overall average</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <span className="num" style={{ fontSize: 34, fontWeight: 500, color: v.accent }}>{avg.toFixed(1)}</span>
            <div style={{ flex: 1 }}><ScoreBar value={avg} max={10} accent={v.accent} height={8} /></div>
            <span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>/10</span>
          </div>
        </div>
      )}
      <div className={styles.ratingRows}>
        {RATING_CATS.map(cat => (
          <div key={cat.key} className={styles.ratingRow}>
            <div className={styles.ratingLabel}>{cat.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RatingDots
                value={v.ratings[cat.key] ?? 0}
                accent={v.accent}
                onChange={val => update({ ratings: { ...v.ratings, [cat.key]: val } })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Test Drive tab ────────────────────────────────────────────────────────────
function TestDriveTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  return (
    <div className={styles.tabContent}>
      {TESTDRIVE_CATS.map(cat => (
        <div key={cat.key} className={styles.tdRow}>
          <div className={styles.tdHeader}>
            <div className={styles.ratingLabel}>{cat.label}</div>
            <RatingDots
              value={v.testDrive[cat.key] ?? 0}
              accent={v.accent}
              onChange={val => update({ testDrive: { ...v.testDrive, [cat.key]: val } })}
            />
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder={`Impressions: ${cat.label.toLowerCase()}…`}
            value={v.testDriveNotes[cat.key] ?? ''}
            onChange={e => update({ testDriveNotes: { ...v.testDriveNotes, [cat.key]: e.target.value } })}
          />
        </div>
      ))}
    </div>
  );
}

// ── Pricing tab ───────────────────────────────────────────────────────────────
function PricingTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  const p = v.pricing;
  const tax = bcTax(p);
  const otd = tax.outTheDoor;
  const selling = sellingPriceOf(p);
  const overDiscount = discountExceedsMsrp(p);

  const setP = (patch: Partial<Vehicle['pricing']>) => update({ pricing: { ...p, ...patch } });
  const setFee = (id: string, patch: Partial<Fee>) =>
    setP({ fees: p.fees.map(f => (f.id === id ? { ...f, ...patch } : f)) });
  // Picking a type re-applies the catalog label + default tax treatment (clears any override).
  const onFeeType = (id: string, type: FeeType) => {
    const e = feeCatalogEntry(type);
    setFee(id, { type, label: e.label, gst: e.gstDefault, pst: e.pstDefault, taxOverridden: false });
  };
  const addFee = () => setP({ fees: [...p.fees, makeFee('documentation')] });
  const removeFee = (id: string) => setP({ fees: p.fees.filter(f => f.id !== id) });

  return (
    <div className={styles.pricingLayout}>
      <div>
        <SectionLabel>Negotiation</SectionLabel>
        <div className={styles.fieldStack}>
          <Field label="MSRP"><MoneyInput value={p.msrp} onChange={msrp => setP({ msrp })} /></Field>
          <Field label="Discount" hint={overDiscount ? undefined : 'Selling price = MSRP − discount'}>
            <MoneyInput value={p.discount} onChange={discount => setP({ discount })} />
            {overDiscount && (
              <span style={{ fontSize: 11, color: 'var(--red, #c0392b)' }}>
                Discount can’t exceed MSRP ({money(p.msrp)}) — capped.
              </span>
            )}
          </Field>
          <Field label="Selling Price" hint="Derived from MSRP − discount">
            <div className="input num" style={{ background: 'var(--paper-2)', display: 'flex', alignItems: 'center' }}>{money(selling)}</div>
          </Field>
          <Field label="Incentives / Rebates"><MoneyInput value={p.incentives} onChange={incentives => setP({ incentives })} /></Field>
          <Field label="Trade-in Value"><MoneyInput value={p.tradeValue} onChange={tradeValue => setP({ tradeValue })} /></Field>
        </div>

        <SectionLabel>Fees</SectionLabel>
        <div className={styles.fieldStack}>
          {p.fees.map(f => {
            const cat = feeCatalogEntry(f.type);
            return (
              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px auto auto auto', gap: 6, alignItems: 'center' }}>
                  <select className="input select" value={f.type} onChange={e => onFeeType(f.id, e.target.value as FeeType)}>
                    {FEE_CATALOG.map(c => <option key={c.type} value={c.type}>{c.label}</option>)}
                  </select>
                  <MoneyInput value={f.amount} onChange={amount => setFee(f.id, { amount: Math.max(0, amount) })} />
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 11, opacity: f.gst ? 1 : 0.45 }}
                    title="Toggle GST (5%) on this fee"
                    onClick={() => setFee(f.id, { gst: !f.gst, taxOverridden: true })}>
                    GST
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 11, opacity: f.pst ? 1 : 0.45 }}
                    title="Toggle BC PST on this fee"
                    onClick={() => setFee(f.id, { pst: !f.pst, taxOverridden: true })}>
                    PST
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => removeFee(f.id)}>✕</button>
                </div>
                {f.type === 'custom' && (
                  <input className="input" style={{ fontSize: 12 }} value={f.label} placeholder="Fee name" onChange={e => setFee(f.id, { label: e.target.value })} />
                )}
                {(cat.verify || f.taxOverridden || cat.note) && (
                  <span style={{ fontSize: 11, color: f.taxOverridden ? 'var(--ink-soft)' : 'var(--ink-faint)' }}>
                    {f.taxOverridden && 'Tax manually set. '}
                    {cat.verify && 'Verify against your bill of sale. '}
                    {cat.note}
                  </span>
                )}
              </div>
            );
          })}
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={addFee}>+ Add fee</button>
        </div>

        <SectionLabel>BC Tax</SectionLabel>
        <div className={styles.fieldStack}>
          <Field label="Seller">
            <Segmented
              options={[{ value: 'dealer', label: 'Dealer' }, { value: 'private', label: 'Private' }]}
              value={p.sellerType ?? 'dealer'}
              onChange={sellerType => setP({ sellerType })}
            />
          </Field>
          <Field label="Vehicle Type">
            <Segmented
              options={[{ value: 'passenger', label: 'Passenger' }, { value: 'other', label: 'Other' }]}
              value={(p.isPassengerVehicle ?? true) ? 'passenger' : 'other'}
              onChange={t => setP({ isPassengerVehicle: t === 'passenger' })}
            />
          </Field>
          <Field label="Zero-emission (ZEV)" hint="ZEV PST schedule applies until 2027-02-22">
            <Segmented
              options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]}
              value={(p.isZEV ?? false) ? 'yes' : 'no'}
              onChange={z => setP({ isZEV: z === 'yes' })}
            />
          </Field>
        </div>
      </div>

      {/* OTD breakdown */}
      <div className={`card ${styles.otdCard}`}>
        <SectionLabel>Out-the-door</SectionLabel>
        <div className={styles.otdRows}>
          <div className={styles.otdRow}><span>MSRP</span><span className="num">{money(p.msrp)}</span></div>
          {tax.discount > 0 && <div className={`${styles.otdRow} ${styles.green}`}><span>Discount</span><span className="num">−{money(tax.discount)}</span></div>}
          <div className={styles.otdRow}><span>Selling price</span><span className="num">{money(tax.sellingPrice)}</span></div>
          {(p.sellerType ?? 'dealer') === 'dealer' && <div className={styles.otdRow}><span>GST (5%)</span><span className="num">{money(tax.gst)}</span></div>}
          <div className={styles.otdRow}><span>PST ({tax.pstRate}%)</span><span className="num">{money(tax.pst)}</span></div>
          {tax.luxuryTax > 0 && <div className={styles.otdRow}><span>Luxury tax</span><span className="num">{money(tax.luxuryTax)}</span></div>}
          {tax.fees.map((f, i) => (
            <div key={i} className={styles.otdRow}><span>{f.label}{!f.gst && !f.pst ? ' (no tax)' : !f.gst ? ' (PST only)' : !f.pst ? ' (GST only)' : ''}</span><span className="num">{money(f.amount)}</span></div>
          ))}
          {p.incentives > 0 && <div className={`${styles.otdRow} ${styles.green}`}><span>Incentives</span><span className="num">−{money(p.incentives)}</span></div>}
          {p.tradeValue > 0 && <div className={`${styles.otdRow} ${styles.note}`}><span>Trade-in (applied to loan)</span><span className="num">−{money(p.tradeValue)}</span></div>}
        </div>
        <div className={styles.otdTotal}>
          <span>Total out-the-door</span>
          <span className="num" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 600 }}>{money(otd)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Finance tab ───────────────────────────────────────────────────────────────
function FinanceTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  const f = v.finance;
  const p = v.pricing;
  const result = financeCalc(v);
  const otd = outTheDoor(p);
  const setF = (patch: Partial<Vehicle['finance']>) => update({ finance: { ...f, ...patch } });
  const TERMS = [{ value: '24', label: '24 mo' }, { value: '36', label: '36 mo' }, { value: '48', label: '48 mo' }, { value: '60', label: '60 mo' }, { value: '72', label: '72 mo' }, { value: '84', label: '84 mo' }, { value: '96', label: '96 mo' }];

  return (
    <div className={styles.financeLayout}>
      <div>
        <div className={styles.fieldStack}>
          <Field label="Down Payment"><MoneyInput value={f.downPayment} onChange={downPayment => setF({ downPayment })} /></Field>
          <Field label="APR (%)"><input className="input num" type="number" step="0.01" value={f.apr} onChange={e => setF({ apr: Number(e.target.value) })} /></Field>
          <Field label="Loan Term">
            <Segmented options={TERMS} value={String(f.termMonths)} onChange={val => setF({ termMonths: Number(val) })} />
          </Field>
        </div>
      </div>
      {/* Top-down breakdown: out-the-door price → what's financed → monthly payment.
          Pricing carries over here via outTheDoor(v.pricing). */}
      <div className={`card ${styles.resultSideCard}`}>
        <SectionLabel>Payment breakdown</SectionLabel>
        <div className={styles.otdRows}>
          <div className={styles.otdRow}><span>Out-the-door price</span><span className="num">{money(otd)}</span></div>
          {f.downPayment > 0 && <div className={`${styles.otdRow} ${styles.green}`}><span>Down payment</span><span className="num">−{money(f.downPayment)}</span></div>}
          {p.tradeValue > 0 && <div className={`${styles.otdRow} ${styles.green}`}><span>Trade-in</span><span className="num">−{money(p.tradeValue)}</span></div>}
          <div className={styles.otdRow}><span>Amount financed</span><span className="num">{money(result.principal)}</span></div>
          <div className={styles.otdRow}><span>APR</span><span className="num">{f.apr}%</span></div>
          <div className={styles.otdRow}><span>Term</span><span className="num">{f.termMonths} mo</span></div>
        </div>
        <div className={styles.otdTotal}>
          <span>Monthly payment</span>
          <span className="num" style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 600 }}>{money(result.monthly)}</span>
        </div>
        <div className={styles.otdRows} style={{ marginTop: 8 }}>
          <div className={`${styles.otdRow} ${styles.note}`} style={{ borderBottom: 'none' }}><span>Total interest</span><span className="num">{money(result.totalInterest)}</span></div>
          <div className={`${styles.otdRow} ${styles.note}`} style={{ borderBottom: 'none' }}><span>Total of payments (loan)</span><span className="num">{money(result.totalOfPayments)}</span></div>
          <div className={`${styles.otdRow} ${styles.note}`} style={{ borderBottom: 'none' }}><span>Total cost (out of pocket)</span><span className="num">{money(result.totalCost)}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Lease tab ─────────────────────────────────────────────────────────────────
function LeaseTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  const l = v.lease;
  const result = leaseCalc(v);
  const setL = (patch: Partial<Vehicle['lease']>) => update({ lease: { ...l, ...patch } });
  const TERMS = [{ value: '24', label: '24 mo' }, { value: '36', label: '36 mo' }, { value: '39', label: '39 mo' }, { value: '48', label: '48 mo' }];

  return (
    <div className={styles.financeLayout}>
      <div>
        <div className={styles.fieldStack}>
          <Field label="Drive-off / Down"><MoneyInput value={l.downPayment} onChange={downPayment => setL({ downPayment })} /></Field>
          <Field label="Lease Term">
            <Segmented options={TERMS} value={String(l.termMonths)} onChange={val => setL({ termMonths: Number(val) })} />
          </Field>
          <Field label="Residual (% of MSRP)">
            <input className="input num" type="number" step="0.1" value={l.residualPct} onChange={e => setL({ residualPct: Number(e.target.value) })} />
          </Field>
          <Field label="Annual km">
            <input className="input num" type="number" value={l.annualKm} onChange={e => setL({ annualKm: Number(e.target.value) })} />
          </Field>
          <Field label="Money Factor" hint={`≈ ${(l.moneyFactor * 2400).toFixed(2)}% APR`}>
            <input className="input num" type="number" step="0.0001" value={l.moneyFactor} onChange={e => setL({ moneyFactor: Number(e.target.value) })} />
          </Field>
        </div>
      </div>
      <div className={`card ${styles.resultSideCard}`}>
        <SectionLabel>Results</SectionLabel>
        <div className={styles.resultSideRows}>
          <ResultStat label="Monthly Payment" value={money(result.monthly)} accent />
          <ResultStat label="Total Lease Cost" value={money(result.totalLease)} />
          <ResultStat label="Residual / Buyout" value={money(result.residual)} />
        </div>
      </div>
    </div>
  );
}

// ── Cost to Own tab ───────────────────────────────────────────────────────────
function CostToOwnTab({ v, update }: { v: Vehicle; update: (p: Partial<Vehicle>) => void }) {
  const o = v.ownership;
  const result = ownershipCalc(v);
  const setO = (patch: Partial<Vehicle['ownership']>) => update({ ownership: { ...o, ...patch } });

  return (
    <div className={styles.financeLayout}>
      <div>
        <div className={styles.fieldStack}>
          <Field label="Annual km">
            <input className="input num" type="number" value={o.annualKm} onChange={e => setO({ annualKm: Number(e.target.value) })} />
          </Field>
          {v.powertrain !== 'ev'
            ? <Field label="Fuel Cost / L"><input className="input num" type="number" step="0.01" value={o.fuelCostPerL} onChange={e => setO({ fuelCostPerL: Number(e.target.value) })} /></Field>
            : <Field label="Electricity / kWh"><input className="input num" type="number" step="0.01" value={o.electricityPerKwh} onChange={e => setO({ electricityPerKwh: Number(e.target.value) })} /></Field>
          }
          <Field label="Insurance / Year"><input className="input num" type="number" value={o.insuranceYr} onChange={e => setO({ insuranceYr: Number(e.target.value) })} /></Field>
          <Field label="Maintenance / Year"><input className="input num" type="number" value={o.maintenanceYr} onChange={e => setO({ maintenanceYr: Number(e.target.value) })} /></Field>
        </div>
      </div>
      <div className={`card ${styles.resultSideCard}`}>
        <SectionLabel>Projections</SectionLabel>
        <div className={styles.resultSideRows}>
          <ResultStat label="Energy / Year" value={money(result.energy)} />
          <ResultStat label="All-in / Year" value={money(result.perYear)} />
          <ResultStat label="1-Year Total" value={money(result.y1)} />
          <ResultStat label="3-Year Total" value={money(result.y3)} />
          <ResultStat label="5-Year Total" value={money(result.y5)} accent />
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 8, lineHeight: 1.5 }}>
          Includes energy, insurance, and maintenance. Excludes depreciation.
        </div>
      </div>
    </div>
  );
}

// ── Attachments tab ───────────────────────────────────────────────────────────
function AttachmentsTab({ v }: { v: Vehicle }) {
  return (
    <div className={styles.tabContent}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-secondary" disabled title="Wire to real uploads in production">
          <Icon name="pdf" size={14} /> Add PDF / quote
        </button>
        <button className="btn btn-secondary" disabled title="Wire to real uploads in production">
          <Icon name="image" size={14} /> Add photo
        </button>
      </div>
      {v.attachments.length === 0 ? (
        <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No attachments yet. Add window stickers, quotes, or photos.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {v.attachments.map(a => (
            <div key={a.id} className={`card ${styles.attachmentTile}`}>
              <Icon name={a.type === 'image' ? 'image' : 'pdf'} size={28} style={{ color: 'var(--ink-faint)' }} />
              <div style={{ fontSize: 12, marginTop: 8, wordBreak: 'break-word' }}>{a.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  onEdit: (v: Vehicle) => void;
}

export default function VehicleDetail({ onEdit }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vehicle = useStore(s => s.vehicles.find(v => v.id === id));
  const updateVehicle = useStore(s => s.updateVehicle);
  const setExcluded = useStore(s => s.setExcluded);
  const duplicateVehicle = useStore(s => s.duplicateVehicle);
  const touchViewed = useStore(s => s.touchViewed);
  const [tab, setTab] = useState<Tab>('Overview');
  const [excludeOpen, setExcludeOpen] = useState(false);

  useEffect(() => { if (id) touchViewed(id); }, [id, touchViewed]);

  if (!vehicle) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-faint)' }}>
        Vehicle not found. <Link to="/garage">Back to garage</Link>
      </div>
    );
  }

  const v = vehicle;
  const update = (patch: Partial<Vehicle>) => updateVehicle(v.id, patch);

  return (
    <div>
      {/* Back link */}
      <Link to="/garage" className={styles.backLink}>
        <Icon name="chevron-left" size={14} /> Back to garage
      </Link>

      {/* Header */}
      <div className={styles.detailHeader}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
          <div style={{ width: 4, borderRadius: 2, background: v.accent, marginRight: 16, flexShrink: 0 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500 }}>{vehicleName(v)}</h1>
              <PowertrainBadge powertrain={v.powertrain} />
              {v.archived && (
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', padding: '2px 8px', borderRadius: 99, background: 'var(--paper-2)', color: 'var(--ink-faint)', border: '1px solid var(--line)' }}>EXCLUDED</span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
              {[v.trim, v.condition, v.bodyStyle, v.dealer].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={() => onEdit(v)}><Icon name="edit" size={13} /> Edit</button>
          <button className="btn btn-secondary" onClick={() => { const nid = duplicateVehicle(v.id); if (nid) navigate(`/vehicle/${nid}`); }}>
            <Icon name="copy" size={13} /> Duplicate
          </button>
          {v.archived
            ? <button className="btn btn-secondary" onClick={() => setExcluded(v.id, false)}><Icon name="restore" size={13} /> Restore</button>
            : <button className="btn btn-secondary" onClick={() => setExcludeOpen(true)}><Icon name="archive" size={13} /> Exclude</button>
          }
        </div>
      </div>

      {/* Excluded banner */}
      {v.archived && (
        <div className={styles.excludedBanner}>
          <span>Set aside from your shortlist.{v.excludeReason ? ` — ${v.excludeReason}` : ''}</span>
          <button className="btn btn-secondary" onClick={() => setExcluded(v.id, false)}>
            <Icon name="restore" size={13} /> Restore to shortlist
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tabBtn} ${t === tab ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <div className={styles.tabScrollFade} />
      </div>

      {/* Tab content */}
      <div key={tab} className="fade-in">
        {tab === 'Overview'       && <OverviewTab v={v} update={update} />}
        {tab === 'Specifications' && <SpecsTab v={v} update={update} />}
        {tab === 'Ratings'        && <RatingsTab v={v} update={update} />}
        {tab === 'Test Drive'     && <TestDriveTab v={v} update={update} />}
        {tab === 'Pricing'        && <PricingTab v={v} update={update} />}
        {tab === 'Finance'        && <FinanceTab v={v} update={update} />}
        {tab === 'Lease'          && <LeaseTab v={v} update={update} />}
        {tab === 'Cost to Own'    && <CostToOwnTab v={v} update={update} />}
        {tab === 'Attachments'    && <AttachmentsTab v={v} />}
      </div>

      {excludeOpen && (
        <ExcludeModal
          vehicle={v}
          onConfirm={(reason) => { setExcluded(v.id, true, reason); setExcludeOpen(false); }}
          onClose={() => setExcludeOpen(false)}
        />
      )}
    </div>
  );
}
