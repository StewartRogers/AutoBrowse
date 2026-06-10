// Add / edit vehicle modal
import { useState } from 'react';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Segmented from '../components/Segmented';
import { blankVehicle, BODY_STYLES, ACCENT_PALETTE, type Vehicle, type Powertrain, type Condition, type PricingMode } from '../lib/data';
import { scrapeVehicleFromUrl, lookupVehicleSpecs } from '../lib/geminiScrape';
import { scrapeVehicleHtmlFromUrl } from '../lib/htmlScrape';

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

const PM_OPTIONS = [
  { value: 'cash' as PricingMode, label: 'Cash' },
  { value: 'finance' as PricingMode, label: 'Finance' },
  { value: 'lease' as PricingMode, label: 'Lease' },
];

export default function VehicleForm({ initial, onSave, onClose }: Props) {
  const [v, setV] = useState<Vehicle>(() => initial ? { ...initial } : blankVehicle());
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const [htmlStatus, setHtmlStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [htmlError, setHtmlError] = useState('');
  const [specsStatus, setSpecsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [specsError, setSpecsError] = useState('');
  const [photoBlocked, setPhotoBlocked] = useState(false);

  const set = (patch: Partial<Vehicle>) => setV(prev => ({ ...prev, ...patch }));
  const setPricing = (patch: Partial<Vehicle['pricing']>) => setV(prev => ({ ...prev, pricing: { ...prev.pricing, ...patch } }));

  const canSave = v.make.trim().length > 0 && v.model.trim().length > 0;

  async function handleAiFill() {
    if (!v.listingUrl.trim()) return;
    setAiStatus('loading');
    setAiError('');
    const result = await scrapeVehicleFromUrl(v.listingUrl.trim());
    if (!result.ok) {
      setAiStatus('error');
      setAiError(result.error);
      return;
    }
    const { specs, pricing, ...rest } = result.data;
    setV(prev => ({
      ...prev,
      ...rest,
      specs: specs ? { ...prev.specs, ...specs } : prev.specs,
      pricing: pricing ? { ...prev.pricing, ...pricing } : prev.pricing,
    }));
    setAiStatus('idle');
  }

  async function handleSpecsLookup() {
    if (!v.make.trim() || !v.model.trim()) return;
    setSpecsStatus('loading');
    setSpecsError('');
    const result = await lookupVehicleSpecs(v.year, v.make.trim(), v.model.trim(), v.trim.trim());
    if (!result.ok) {
      setSpecsStatus('error');
      setSpecsError(result.error);
      return;
    }
    const { specs, powertrain, bodyStyle } = result.data;
    setV(prev => ({
      ...prev,
      ...(powertrain ? { powertrain } : {}),
      ...(bodyStyle  ? { bodyStyle  } : {}),
      specs: { ...prev.specs, ...specs },
    }));
    setSpecsStatus('idle');
  }

  async function handleHtmlFill() {
    if (!v.listingUrl.trim()) return;
    setHtmlStatus('loading');
    setHtmlError('');
    const result = await scrapeVehicleHtmlFromUrl(v.listingUrl.trim());
    if (!result.ok) {
      setHtmlStatus('error');
      setHtmlError(result.error);
      return;
    }
    const { specs, pricing, ...rest } = result.data;
    setV(prev => ({
      ...prev,
      ...rest,
      specs: specs ? { ...prev.specs, ...specs } : prev.specs,
      pricing: pricing ? { ...prev.pricing, ...pricing } : prev.pricing,
    }));
    setHtmlStatus('idle');
  }

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
        {/* Pricing mode + Powertrain */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Pricing Mode">
            <Segmented options={PM_OPTIONS} value={v.pricingMode ?? 'finance'} onChange={(val) => set({ pricingMode: val })} />
          </Field>
          <Field label="Powertrain">
            <Segmented options={PT_OPTIONS} value={v.powertrain} onChange={(val) => set({ powertrain: val })} />
          </Field>
        </div>

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

        {/* AI Specs Lookup */}
        <div>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={!v.make.trim() || !v.model.trim() || specsStatus === 'loading'}
            onClick={handleSpecsLookup}
            title="Ask AI to fill in specs based on make/model/year/trim — no URL needed"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {specsStatus === 'loading' ? 'Looking up specs…' : '✨ Lookup Specs from AI'}
          </button>
          {specsStatus === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--red, #c0392b)', marginTop: 4 }}>{specsError}</div>
          )}
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

        {/* Listing URL + AI Fill */}
        <Field label="Listing URL">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="input"
              type="url"
              value={v.listingUrl}
              onChange={e => set({ listingUrl: e.target.value })}
              placeholder="https://..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!v.listingUrl.trim() || aiStatus === 'loading'}
              onClick={handleAiFill}
              title="Use Gemini AI to fill in details from this URL"
              style={{ whiteSpace: 'nowrap' }}
            >
              {aiStatus === 'loading' ? 'Fetching…' : '✨ AI Fill'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!v.listingUrl.trim() || htmlStatus === 'loading'}
              onClick={handleHtmlFill}
              title="Use a plain HTML scrape to try filling from this URL without Gemini"
              style={{ whiteSpace: 'nowrap' }}
            >
              {htmlStatus === 'loading' ? 'Scraping…' : '⬇ HTML Fill'}
            </button>
            </div>
          </div>
          {aiStatus === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--red, #c0392b)', marginTop: 4 }}>{aiError}</div>
          )}
          {htmlStatus === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--red, #c0392b)', marginTop: 4 }}>{htmlError}</div>
          )}
        </Field>

        {/* Photo preview — shown after AI Fill captures a photoUrl */}
        {v.photoUrl && (
          <Field label="Photo">
            <div style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--paper-2)', border: '1px solid var(--line)', minHeight: 48 }}>
              {!photoBlocked ? (
                <img
                  key={v.photoUrl}
                  src={v.photoUrl}
                  alt="Vehicle"
                  style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
                  onError={() => setPhotoBlocked(true)}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', fontSize: 12, color: 'var(--ink-muted, #888)' }}>
                  ⚠️ Image blocked by source site —{' '}
                  <a href={v.photoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                    open in new tab
                  </a>{' '}to copy a working URL.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                className="input"
                type="url"
                value={v.photoUrl}
                onChange={e => { set({ photoUrl: e.target.value }); setPhotoBlocked(false); }}
                placeholder="https://..."
                style={{ flex: 1, fontSize: 12 }}
              />
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => { set({ photoUrl: '' }); setPhotoBlocked(false); }}>Clear</button>
            </div>
          </Field>
        )}

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
