// Add / edit vehicle modal
import { useState } from 'react';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Segmented from '../components/Segmented';
import { blankVehicle, BODY_STYLES, ACCENT_PALETTE, type Vehicle, type Powertrain, type Condition } from '../lib/data';

interface Props {
  initial?: Vehicle;
  onSave: (v: Vehicle) => void;
  onClose: () => void;
}

const PT_OPTIONS = [
  { value: 'gas' as Powertrain, label: 'Gas' },
  { value: 'hybrid' as Powertrain, label: 'Hybrid' },
  { value: 'ev' as Powertrain, label: 'Electric' },
];

const COND_OPTIONS = [
  { value: 'New' as Condition, label: 'New' },
  { value: 'Used' as Condition, label: 'Used' },
  { value: 'CPO' as Condition, label: 'CPO' },
];

export default function VehicleForm({ initial, onSave, onClose }: Props) {
  const [v, setV] = useState<Vehicle>(() => initial ? { ...initial } : blankVehicle());

  const set = (patch: Partial<Vehicle>) => setV(prev => ({ ...prev, ...patch }));
  const setPricing = (patch: Partial<Vehicle['pricing']>) => setV(prev => ({ ...prev, pricing: { ...prev.pricing, ...patch } }));

  const canSave = v.make.trim().length > 0 && v.model.trim().length > 0;

  return (
    <Modal
      title={initial ? `Edit ${v.year} ${v.make} ${v.model}` : 'Log a vehicle'}
      onClose={onClose}
      width={600}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave(v)}>
            {initial ? 'Save changes' : 'Add to garage'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Powertrain */}
        <Field label="Powertrain">
          <Segmented options={PT_OPTIONS} value={v.powertrain} onChange={(val) => set({ powertrain: val })} />
        </Field>

        {/* Identity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Make" required>
            <input className="input" value={v.make} onChange={e => set({ make: e.target.value })} placeholder="Honda" />
          </Field>
          <Field label="Model" required>
            <input className="input" value={v.model} onChange={e => set({ model: e.target.value })} placeholder="Accord" />
          </Field>
          <Field label="Year">
            <input className="input num" type="number" value={v.year} onChange={e => set({ year: Number(e.target.value) })} />
          </Field>
          <Field label="Trim">
            <input className="input" value={v.trim} onChange={e => set({ trim: e.target.value })} placeholder="Hybrid Touring" />
          </Field>
        </div>

        {/* Body / Condition */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Body Style">
            <select className="input select" value={v.bodyStyle} onChange={e => set({ bodyStyle: e.target.value as typeof v.bodyStyle })}>
              {BODY_STYLES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Condition">
            <Segmented options={COND_OPTIONS} value={v.condition} onChange={(val) => set({ condition: val })} />
          </Field>
          <Field label="Mileage">
            <input className="input num" type="number" value={v.mileage} onChange={e => set({ mileage: Number(e.target.value) })} />
          </Field>
        </div>

        {/* Color / Dealer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Color">
            <input className="input" value={v.color} onChange={e => set({ color: e.target.value })} placeholder="Platinum White Pearl" />
          </Field>
          <Field label="Dealer">
            <input className="input" value={v.dealer} onChange={e => set({ dealer: e.target.value })} placeholder="Metro Honda" />
          </Field>
        </div>

        {/* Pricing snapshot */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="MSRP">
            <input className="input num" type="number" value={v.pricing.msrp || ''} onChange={e => setPricing({ msrp: Number(e.target.value) })} placeholder="38990" />
          </Field>
          <Field label="Selling Price">
            <input className="input num" type="number" value={v.pricing.sellingPrice || ''} onChange={e => setPricing({ sellingPrice: Number(e.target.value) })} placeholder="37800" />
          </Field>
          <Field label="Tax Rate (%)">
            <input className="input num" type="number" step="0.01" value={v.pricing.taxRate} onChange={e => setPricing({ taxRate: Number(e.target.value) })} />
          </Field>
        </div>

        {/* Listing URL */}
        <Field label="Listing URL">
          <input className="input" type="url" value={v.listingUrl} onChange={e => set({ listingUrl: e.target.value })} placeholder="https://..." />
        </Field>

        {/* Accent color */}
        <Field label="Accent Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACCENT_PALETTE.map(hex => (
              <button
                key={hex}
                type="button"
                onClick={() => set({ accent: hex })}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: hex,
                  border: v.accent === hex ? `3px solid var(--ink)` : '2px solid transparent',
                  outline: v.accent === hex ? `1px solid ${hex}` : 'none',
                  transition: 'all .12s',
                }}
                aria-label={hex}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
