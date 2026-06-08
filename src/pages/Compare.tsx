import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  SPEC_FIELDS, RATING_CATS, TESTDRIVE_CATS,
  financeCalc, leaseCalc, ownershipCalc,
  type Vehicle,
} from '../lib/data';
import { money } from '../lib/fmt';
import Icon from '../components/Icon';
import PowertrainBadge from '../components/PowertrainBadge';
import ScoreBar from '../components/ScoreBar';
import Modal from '../components/Modal';
import styles from './Compare.module.css';

type RankBy = 'selected' | 'price' | 'payment' | 'lease' | 'ownership' | 'economy' | 'rating' | 'power';

const RANK_OPTIONS: { value: RankBy; label: string }[] = [
  { value: 'selected', label: 'As selected' },
  { value: 'price', label: 'Lowest price' },
  { value: 'payment', label: 'Lowest payment' },
  { value: 'lease', label: 'Lowest lease' },
  { value: 'ownership', label: 'Lowest 5-yr cost' },
  { value: 'economy', label: 'Best economy' },
  { value: 'rating', label: 'Highest rating' },
  { value: 'power', label: 'Most power' },
];

const SECTIONS = ['Specifications', 'Your Ratings', 'Test Drive', 'Pricing', 'Finance', 'Lease', 'Cost to Own'] as const;
type Section = typeof SECTIONS[number];

// ── Cell best-in-row highlight logic ─────────────────────────────────────────
function bestIndices(values: (number | undefined)[], better?: 'high' | 'low'): number[] {
  if (!better) return [];
  const nums = values.map((v, i) => ({ v, i })).filter(x => x.v !== undefined && !isNaN(x.v as number));
  if (nums.length < 2) return [];
  const best = better === 'high'
    ? Math.max(...nums.map(x => x.v as number))
    : Math.min(...nums.map(x => x.v as number));
  return nums.filter(x => x.v === best).map(x => x.i);
}

// ── Vehicle picker modal ──────────────────────────────────────────────────────
function ComparePicker({ vehicles, selected, onToggle, onClose }: {
  vehicles: Vehicle[];
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Choose vehicles to compare" onClose={onClose} width={440}
      footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {vehicles.length === 0 && (
          <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No active vehicles in your garage.</div>
        )}
        {vehicles.map(v => {
          const on = selected.includes(v.id);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onToggle(v.id)}
              className={styles.pickerRow}
              style={{ background: on ? 'var(--accent-tint)' : undefined, borderColor: on ? 'var(--accent-soft)' : undefined }}
            >
              <div style={{ width: 3, height: 32, borderRadius: 1.5, background: v.accent, flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--serif)' }}>{v.year} {v.make} {v.model}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{v.trim}</div>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: 4, border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'var(--accent)' : 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on && <Icon name="check" size={12} style={{ color: '#fff' }} />}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Row types ─────────────────────────────────────────────────────────────────
interface CompareRow {
  label: string;
  section: Section;
  values: (string | number | undefined)[];
  better?: 'high' | 'low';
  numericValues?: (number | undefined)[];
  renderCell?: (val: string | number | undefined, v: Vehicle) => React.ReactNode;
}

function buildRows(vehicles: Vehicle[], activeSections: Set<Section>): CompareRow[] {
  const rows: CompareRow[] = [];

  if (activeSections.has('Specifications')) {
    SPEC_FIELDS.forEach(f => {
      const values = vehicles.map(v => {
        if (f.evOnly && v.powertrain !== 'ev') return undefined;
        if (f.evHide && v.powertrain === 'ev') return undefined;
        return (v.specs as Record<string, string | number | undefined>)[f.key];
      });
      if (values.every(val => val === undefined)) return;
      rows.push({
        label: f.label + (f.unit ? ` (${f.unit})` : ''),
        section: 'Specifications',
        values,
        better: f.better,
        numericValues: f.kind !== 'text' ? values.map(v => typeof v === 'number' ? v : undefined) : undefined,
      });
    });
  }

  if (activeSections.has('Your Ratings')) {
    RATING_CATS.forEach(cat => {
      const values = vehicles.map(v => v.ratings[cat.key] || 0);
      rows.push({
        label: cat.label,
        section: 'Your Ratings',
        values,
        better: 'high',
        numericValues: values,
        renderCell: (val, v) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="num">{val || '—'}</span>
            {typeof val === 'number' && val > 0 && <ScoreBar value={val} max={10} accent={v.accent} height={3} />}
          </div>
        ),
      });
    });
  }

  if (activeSections.has('Test Drive')) {
    TESTDRIVE_CATS.forEach(cat => {
      const values = vehicles.map(v => v.testDrive[cat.key] || 0);
      rows.push({
        label: cat.label,
        section: 'Test Drive',
        values,
        better: 'high',
        numericValues: values,
        renderCell: (val, v) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="num">{val || '—'}</span>
            {typeof val === 'number' && val > 0 && <ScoreBar value={val} max={10} accent={v.accent} height={3} />}
          </div>
        ),
      });
    });
  }

  if (activeSections.has('Pricing')) {
    rows.push({ label: 'MSRP', section: 'Pricing', values: vehicles.map(v => v.pricing.msrp), better: 'low', numericValues: vehicles.map(v => v.pricing.msrp), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: 'Selling Price', section: 'Pricing', values: vehicles.map(v => v.pricing.sellingPrice), better: 'low', numericValues: vehicles.map(v => v.pricing.sellingPrice), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: 'Incentives', section: 'Pricing', values: vehicles.map(v => v.pricing.incentives), better: 'high', numericValues: vehicles.map(v => v.pricing.incentives), renderCell: (val) => <span className="num" style={{ color: (val as number) > 0 ? 'var(--good)' : undefined }}>{val ? money(val as number) : '—'}</span> });
    rows.push({ label: 'Out-the-door', section: 'Pricing', values: vehicles.map(v => { const p = v.pricing; const t = Math.max(0, p.sellingPrice-p.tradeValue)*(p.taxRate/100); return p.sellingPrice + t + p.fees - p.incentives; }), better: 'low', numericValues: vehicles.map(v => { const p = v.pricing; const t = Math.max(0,p.sellingPrice-p.tradeValue)*(p.taxRate/100); return p.sellingPrice+t+p.fees-p.incentives; }), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
  }

  if (activeSections.has('Finance')) {
    rows.push({ label: 'Monthly Payment', section: 'Finance', values: vehicles.map(v => financeCalc(v).monthly), better: 'low', numericValues: vehicles.map(v => financeCalc(v).monthly), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: 'APR', section: 'Finance', values: vehicles.map(v => v.finance.apr), better: 'low', numericValues: vehicles.map(v => v.finance.apr), renderCell: (val) => <span className="num">{val}%</span> });
    rows.push({ label: 'Term', section: 'Finance', values: vehicles.map(v => `${v.finance.termMonths} mo`) });
    rows.push({ label: 'Total Interest', section: 'Finance', values: vehicles.map(v => financeCalc(v).totalInterest), better: 'low', numericValues: vehicles.map(v => financeCalc(v).totalInterest), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
  }

  if (activeSections.has('Lease')) {
    rows.push({ label: 'Monthly Lease', section: 'Lease', values: vehicles.map(v => leaseCalc(v).monthly), better: 'low', numericValues: vehicles.map(v => leaseCalc(v).monthly), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: 'Term', section: 'Lease', values: vehicles.map(v => `${v.lease.termMonths} mo`) });
    rows.push({ label: 'Residual', section: 'Lease', values: vehicles.map(v => leaseCalc(v).residual), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: 'Total Lease Cost', section: 'Lease', values: vehicles.map(v => leaseCalc(v).totalLease), better: 'low', numericValues: vehicles.map(v => leaseCalc(v).totalLease), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
  }

  if (activeSections.has('Cost to Own')) {
    rows.push({ label: '1-yr Cost', section: 'Cost to Own', values: vehicles.map(v => ownershipCalc(v).y1), better: 'low', numericValues: vehicles.map(v => ownershipCalc(v).y1), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: '3-yr Cost', section: 'Cost to Own', values: vehicles.map(v => ownershipCalc(v).y3), better: 'low', numericValues: vehicles.map(v => ownershipCalc(v).y3), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: '5-yr Cost', section: 'Cost to Own', values: vehicles.map(v => ownershipCalc(v).y5), better: 'low', numericValues: vehicles.map(v => ownershipCalc(v).y5), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
    rows.push({ label: 'Annual Energy', section: 'Cost to Own', values: vehicles.map(v => ownershipCalc(v).energy), better: 'low', numericValues: vehicles.map(v => ownershipCalc(v).energy), renderCell: (val) => <span className="num">{val ? money(val as number) : '—'}</span> });
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Compare() {
  const navigate = useNavigate();
  const allVehicles = useStore(s => s.vehicles);
  const { compareIds, toggleCompare, setCompareIds } = useStore();
  const [rankBy, setRankBy] = useState<RankBy>('selected');
  const [activeSections, setActiveSections] = useState<Set<Section>>(new Set(['Specifications', 'Your Ratings', 'Pricing', 'Finance']));
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeVehicles = allVehicles.filter(v => !v.archived);

  // Ranked / sorted vehicles
  const vehicles = useMemo(() => {
    const base = compareIds
      .map(id => allVehicles.find(v => v.id === id && !v.archived))
      .filter((v): v is Vehicle => !!v);

    if (rankBy === 'selected') return base;
    return [...base].sort((a, b) => {
      switch (rankBy) {
        case 'price': return (a.pricing.sellingPrice || a.pricing.msrp) - (b.pricing.sellingPrice || b.pricing.msrp);
        case 'payment': return financeCalc(a).monthly - financeCalc(b).monthly;
        case 'lease': return leaseCalc(a).monthly - leaseCalc(b).monthly;
        case 'ownership': return ownershipCalc(a).y5 - ownershipCalc(b).y5;
        case 'economy': {
          const eco = (v: Vehicle) => v.powertrain === 'ev' ? (v.specs.mpge || 0) : (v.specs.mpgCombined || 0);
          return eco(b) - eco(a);
        }
        case 'rating': {
          const avg = (v: Vehicle) => { const vals = RATING_CATS.map(c => v.ratings[c.key]).filter((x): x is number => typeof x === 'number' && x > 0); return vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : 0; };
          return avg(b) - avg(a);
        }
        case 'power': return (b.specs.horsepower || 0) - (a.specs.horsepower || 0);
        default: return 0;
      }
    });
  }, [compareIds, allVehicles, rankBy]);

  const rows = useMemo(() => buildRows(vehicles, activeSections), [vehicles, activeSections]);

  const toggleSection = (s: Section) => {
    setActiveSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  };

  if (compareIds.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
        <Icon name="compare" size={40} style={{ opacity: .3, marginBottom: 12 }} />
        <div style={{ fontSize: 16 }}>No vehicles selected to compare</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Use the compare toggle on garage cards to add vehicles.</div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setPickerOpen(true)}>
          <Icon name="plus" size={14} /> Choose vehicles
        </button>
        {pickerOpen && (
          <ComparePicker
            vehicles={activeVehicles}
            selected={compareIds}
            onToggle={toggleCompare}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    );
  }

  // Group rows by section for rendering
  const sectionOrder = SECTIONS.filter(s => activeSections.has(s));

  return (
    <div>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30 }}>Compare</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            Side-by-side across {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}. Best value in each row is marked.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="label">RANK BY</span>
            <select className="input select" style={{ width: 180 }} value={rankBy} onChange={e => setRankBy(e.target.value as RankBy)}>
              {RANK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setPickerOpen(true)}>
            <Icon name="plus" size={14} /> Vehicles
          </button>
        </div>
      </div>

      {/* Section toggles */}
      <div className={styles.sectionToggles}>
        {SECTIONS.map(s => (
          <button
            key={s}
            className={`${styles.sectionToggle} ${activeSections.has(s) ? styles.sectionToggleOn : ''}`}
            onClick={() => toggleSection(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <div
          className={styles.table}
          style={{ gridTemplateColumns: `220px repeat(${vehicles.length}, minmax(168px, 1fr))` }}
        >
          {/* Sticky header row */}
          <div className={styles.headerCell} style={{ gridColumn: 1 }} />
          {vehicles.map((v, i) => (
            <div key={v.id} className={styles.vehicleHeader} style={{ gridColumn: i + 2 }}>
              <div style={{ width: '100%', height: 3, borderRadius: 1.5, background: v.accent, marginBottom: 8 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <PowertrainBadge powertrain={v.powertrain} size="sm" />
                <button
                  className="btn btn-ghost"
                  style={{ padding: '2px 4px', marginLeft: 'auto', color: 'var(--ink-faint)' }}
                  onClick={() => { const next = compareIds.filter(id => id !== v.id); setCompareIds(next); }}
                  title="Remove from compare"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
              <button
                onClick={() => navigate(`/vehicle/${v.id}`)}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}
              >
                <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{v.year} {v.make} {v.model}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{v.trim}</div>
              </button>
              <div className="num" style={{ fontSize: 14, fontWeight: 600, color: v.accent, marginTop: 6 }}>
                {money(v.pricing.sellingPrice || v.pricing.msrp)}
              </div>
            </div>
          ))}

          {/* Section bands + rows */}
          {sectionOrder.map(section => {
            const sectionRows = rows.filter(r => r.section === section);
            if (!sectionRows.length) return null;
            return (
              <React.Fragment key={section}>
                {/* Section band */}
                <div
                  className={styles.sectionBand}
                  style={{ gridColumn: `1 / span ${vehicles.length + 1}` }}
                >
                  {section}
                </div>

                {/* Data rows */}
                {sectionRows.map((row, ri) => {
                  const winnerIdxs = bestIndices(row.numericValues ?? [], row.better);
                  return (
                    <React.Fragment key={`${section}-${ri}`}>
                      <div className={`${styles.labelCell} ${ri % 2 === 1 ? styles.zebra : ''}`}>
                        {row.label}
                      </div>
                      {vehicles.map((v, ci) => {
                        const val = row.values[ci];
                        const isWinner = winnerIdxs.includes(ci);
                        return (
                          <div
                            key={v.id}
                            className={`${styles.dataCell} ${ri % 2 === 1 ? styles.zebra : ''} ${isWinner ? styles.winner : ''}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {row.renderCell
                                ? row.renderCell(val, v)
                                : <span className="num">{val !== undefined ? String(val) : '—'}</span>
                              }
                              {isWinner && (
                                <Icon name="check" size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {pickerOpen && (
        <ComparePicker
          vehicles={activeVehicles}
          selected={compareIds}
          onToggle={toggleCompare}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// Need React for JSX in renderCell closures
import React from 'react';
