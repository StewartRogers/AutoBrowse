import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { financeCalc, ownershipCalc, avgRating, type Vehicle, type Powertrain } from '../lib/data';
import { money } from '../lib/fmt';
import Icon from '../components/Icon';
import PowertrainBadge from '../components/PowertrainBadge';
import PhotoSlot from '../components/PhotoSlot';
import ScoreBar from '../components/ScoreBar';
import Segmented from '../components/Segmented';
import ExcludeModal from '../features/ExcludeModal';
import styles from './Garage.module.css';

type SortKey = 'recent' | 'price' | 'payment' | 'rating' | 'economy' | 'name';
type StatusFilter = 'active' | 'excluded' | 'all';
type PtFilter = 'all' | Powertrain;

const SORT_OPTIONS = [
  { value: 'recent' as SortKey, label: 'Recently added' },
  { value: 'price' as SortKey, label: 'Lowest price' },
  { value: 'payment' as SortKey, label: 'Lowest payment' },
  { value: 'rating' as SortKey, label: 'Highest rating' },
  { value: 'economy' as SortKey, label: 'Best economy' },
  { value: 'name' as SortKey, label: 'Name A–Z' },
];

const PT_OPTS = [
  { value: 'all' as PtFilter, label: 'All' },
  { value: 'gas' as PtFilter, label: 'Gas' },
  { value: 'hybrid' as PtFilter, label: 'Hybrid' },
  { value: 'ev' as PtFilter, label: 'Electric' },
];

interface CardMenuProps {
  v: Vehicle;
  onEdit: () => void;
  onDuplicate: () => void;
  onExclude: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

function CardMenu({ v, onEdit, onDuplicate, onExclude, onRestore, onDelete }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.menuWrap}>
      <button className="btn btn-ghost" style={{ padding: '4px 6px' }} onClick={() => setOpen(o => !o)}>
        <Icon name="more-horizontal" size={16} />
      </button>
      {open && (
        <>
          <div className={styles.menuOverlay} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
            <button className={styles.menuItem} onClick={() => { onEdit(); setOpen(false); }}>
              <Icon name="edit" size={14} /> Edit details
            </button>
            <button className={styles.menuItem} onClick={() => { onDuplicate(); setOpen(false); }}>
              <Icon name="copy" size={14} /> Duplicate
            </button>
            {v.archived
              ? <button className={styles.menuItem} onClick={() => { onRestore(); setOpen(false); }}>
                  <Icon name="restore" size={14} /> Restore
                </button>
              : <button className={styles.menuItem} onClick={() => { onExclude(); setOpen(false); }}>
                  <Icon name="archive" size={14} /> Exclude
                </button>
            }
            <div className="divider" style={{ margin: '4px 0' }} />
            <button className={`${styles.menuItem} ${styles.menuDanger}`} onClick={() => {
              if (window.confirm(`Delete ${v.year} ${v.make} ${v.model}? This cannot be undone.`)) {
                onDelete();
              }
              setOpen(false);
            }}>
              <Icon name="trash" size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface VehicleCardProps {
  v: Vehicle;
  selected: boolean;
  onToggleCompare: () => void;
  onEdit: () => void;
  onExclude: () => void;
  onRestore: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClick: () => void;
}

function VehicleCard({ v, selected, onToggleCompare, onEdit, onExclude, onRestore, onDuplicate, onDelete, onClick }: VehicleCardProps) {
  const finance = financeCalc(v);
  const own = ownershipCalc(v);
  const rating = avgRating(v);

  return (
    <div className={`card ${styles.card} ${v.archived ? styles.excluded : ''}`}>
      {/* Photo area */}
      <div className={styles.photoWrap}>
        <div className={styles.ptBadge}>
          <PowertrainBadge powertrain={v.powertrain} size="sm" />
        </div>
        {!v.archived && (
          <button
            className={`${styles.compareBtn} ${selected ? styles.compareBtnActive : ''}`}
            onClick={e => { e.stopPropagation(); onToggleCompare(); }}
            title={selected ? 'Remove from compare' : 'Add to compare'}
          >
            {selected
              ? <Icon name="check" size={14} style={{ color: '#fff' }} />
              : <Icon name="compare-check" size={14} />
            }
          </button>
        )}
        <div onClick={onClick} style={{ cursor: 'pointer' }}>
          <PhotoSlot
            color={v.color || undefined}
            accent={v.accent}
            height={140}
          />
        </div>
        {v.archived && (
          <div className={styles.excludedScrim}>
            <span className={styles.excludedChip}>EXCLUDED</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.eyebrow}>{v.year} · {v.bodyStyle}</div>
        <div className={styles.titleRow}>
          <h3 className={`${styles.name} truncate`} onClick={onClick} style={{ cursor: 'pointer' }}>
            {v.make} {v.model}
          </h3>
          <CardMenu
            v={v}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onExclude={onExclude}
            onRestore={onRestore}
            onDelete={onDelete}
          />
        </div>
        <div className={styles.trim}>{v.trim}</div>

        {!v.archived ? (
          <>
            {/* Stats grid */}
            <div className={styles.statsGrid}>
              <div>
                <div className="label">Price</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginTop: 2 }}>
                  {money(v.pricing.sellingPrice || v.pricing.msrp)}
                </div>
              </div>
              <div>
                <div className="label">Est. / Mo</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>
                  {money(finance.monthly)}<span style={{ fontSize: 11, color: 'var(--ink-faint)' }}> /{v.finance.termMonths}mo</span>
                </div>
              </div>
              <div>
                <div className="label">Your Rating</div>
                {rating > 0
                  ? <><div className="num" style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>{rating.toFixed(1)}</div>
                      <ScoreBar value={rating} max={10} accent={v.accent} height={3} />
                    </>
                  : <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 4 }}>—</div>
                }
              </div>
              <div>
                <div className="label">5-yr Cost</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>
                  {money(own.y5)}
                </div>
              </div>
            </div>
            <button className={`btn ${styles.openBtn}`} onClick={onClick}>
              Open workbook →
            </button>
          </>
        ) : (
          <div className={styles.excludedFooter}>
            {v.excludeReason && (
              <div className={styles.excludeReason}>Set aside: {v.excludeReason}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onRestore}>
                <Icon name="restore" size={13} /> Restore
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClick}>
                Open
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface GarageProps {
  onAddVehicle: () => void;
  onEditVehicle: (v: Vehicle) => void;
}

export default function Garage({ onAddVehicle, onEditVehicle }: GarageProps) {
  const navigate = useNavigate();
  const { vehicles, toggleCompare, setExcluded, duplicateVehicle, removeVehicle } = useStore();
  const compareIds = useStore(s => s.compareIds);

  const [ptFilter, setPtFilter] = useState<PtFilter>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [excludeTarget, setExcludeTarget] = useState<Vehicle | null>(null);

  const active = vehicles.filter(v => !v.archived);
  const excluded = vehicles.filter(v => v.archived);

  let filtered = status === 'active' ? active : status === 'excluded' ? excluded : vehicles;
  if (ptFilter !== 'all') filtered = filtered.filter(v => v.powertrain === ptFilter);

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'price': return (a.pricing.sellingPrice || a.pricing.msrp) - (b.pricing.sellingPrice || b.pricing.msrp);
      case 'payment': return financeCalc(a).monthly - financeCalc(b).monthly;
      case 'rating': return avgRating(b) - avgRating(a);
      case 'economy': {
        const eco = (v: Vehicle) => v.powertrain === 'ev'
          ? (v.specs.mpge ? 1 / v.specs.mpge : 0)
          : (v.specs.fuelL100km ? 1 / v.specs.fuelL100km : 0);
        return eco(b) - eco(a);
      }
      case 'name': return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
      default: return b.createdAt - a.createdAt;
    }
  });

  const statusLabel = (s: StatusFilter) => {
    if (s === 'active') return `In consideration (${active.length})`;
    if (s === 'excluded') return `Excluded (${excluded.length})`;
    return `Show all (${vehicles.length})`;
  };

  return (
    <div>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, marginBottom: 4 }}>Garage</h1>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {active.length} in consideration
            {compareIds.length > 0 && ` · ${compareIds.length} selected to compare`}
            {excluded.length > 0 && ` · ${excluded.length} excluded`}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onAddVehicle}>
          <Icon name="plus" size={15} /> Log a vehicle
        </button>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <Segmented options={PT_OPTS} value={ptFilter} onChange={setPtFilter} />
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
          <span className="label" style={{ whiteSpace: 'nowrap' }}>SORT</span>
          <select
            className="input select"
            style={{ width: 180 }}
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ marginBottom: 20 }}>
        <select
          className="input select"
          style={{ width: 220 }}
          value={status}
          onChange={e => setStatus(e.target.value as StatusFilter)}
        >
          <option value="active">{statusLabel('active')}</option>
          <option value="excluded">{statusLabel('excluded')}</option>
          <option value="all">{statusLabel('all')}</option>
        </select>
      </div>

      {/* Card grid */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
          <Icon name="car" size={40} style={{ opacity: .3, marginBottom: 12 }} />
          <div style={{ fontSize: 16 }}>No vehicles here yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            {status === 'excluded' ? 'No excluded vehicles.' : 'Add your first vehicle to get started.'}
          </div>
          {status === 'active' && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onAddVehicle}>
              <Icon name="plus" size={14} /> Add vehicle
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {sorted.map(v => (
            <VehicleCard
              key={v.id}
              v={v}
              selected={compareIds.includes(v.id)}
              onToggleCompare={() => toggleCompare(v.id)}
              onEdit={() => onEditVehicle(v)}
              onExclude={() => setExcludeTarget(v)}
              onRestore={() => setExcluded(v.id, false)}
              onDuplicate={() => {
                const newId = duplicateVehicle(v.id);
                if (newId) navigate(`/vehicle/${newId}`);
              }}
              onDelete={() => removeVehicle(v.id)}
              onClick={() => navigate(`/vehicle/${v.id}`)}
            />
          ))}
        </div>
      )}

      {/* Exclude modal */}
      {excludeTarget && (
        <ExcludeModal
          vehicle={excludeTarget}
          onConfirm={(reason) => { setExcluded(excludeTarget.id, true, reason); setExcludeTarget(null); }}
          onClose={() => setExcludeTarget(null)}
        />
      )}
    </div>
  );
}
