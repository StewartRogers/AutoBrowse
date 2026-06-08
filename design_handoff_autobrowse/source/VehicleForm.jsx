// VehicleForm.jsx — add / edit core vehicle identity + pricing
function VehicleForm({ open, initial, onSave, onClose }) {
  const [v, setV] = useState(initial || blankVehicle());
  useEffect(() => { setV(initial ? JSON.parse(JSON.stringify(initial)) : blankVehicle()); }, [initial, open]);

  const set = (k, val) => setV(s => ({ ...s, [k]: val }));
  const setPrice = (k, val) => setV(s => ({ ...s, pricing: { ...s.pricing, [k]: val } }));
  const isEdit = !!initial;
  const accents = ['#b4552d', '#4f7a52', '#3f6f8f', '#7a5aa8', '#8a7a5c', '#a9492f'];

  const valid = v.make && v.model;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Vehicle' : 'Add a Vehicle'} width={760}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!valid} style={{ opacity: valid ? 1 : .5 }}
          onClick={() => onSave(v)}>{isEdit ? 'Save changes' : 'Add to garage'}</button>
      </>}>
      <div style={{ padding: '24px 26px' }}>
        <SectionLabel>Identity</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          <Field label="Year" span={1}><NumInput value={v.year} onChange={x => set('year', x)} /></Field>
          <Field label="Make" span={2}><TextInput value={v.make} onChange={x => set('make', x)} placeholder="Honda" /></Field>
          <Field label="Model" span={3}><TextInput value={v.model} onChange={x => set('model', x)} placeholder="Accord" /></Field>
          <Field label="Trim" span={3}><TextInput value={v.trim} onChange={x => set('trim', x)} placeholder="Hybrid Touring" /></Field>
          <Field label="Body style" span={3}><Select value={v.bodyStyle} onChange={x => set('bodyStyle', x)} options={BODY_STYLES} /></Field>
        </div>

        <div style={{ height: 22 }}></div>
        <SectionLabel>Powertrain & condition</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, alignItems: 'end' }}>
          <Field label="Powertrain" span={3}>
            <Segmented value={v.powertrain} onChange={x => set('powertrain', x)}
              options={[{ value: 'gas', label: 'Gas' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'ev', label: 'Electric' }]} />
          </Field>
          <Field label="Condition" span={1}><Select value={v.condition} onChange={x => set('condition', x)} options={['New', 'Used', 'CPO']} /></Field>
          <Field label="Mileage" span={2}><NumInput value={v.mileage} onChange={x => set('mileage', x)} suffix="mi" /></Field>
          <Field label="Exterior color" span={3}><TextInput value={v.color} onChange={x => set('color', x)} placeholder="Platinum White" /></Field>
          <Field label="Dealer" span={3}><TextInput value={v.dealer} onChange={x => set('dealer', x)} placeholder="Metro Honda" /></Field>
        </div>

        <div style={{ height: 22 }}></div>
        <SectionLabel>Pricing snapshot</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          <Field label="MSRP" span={2}><NumInput value={v.pricing.msrp} onChange={x => setPrice('msrp', x)} prefix="$" /></Field>
          <Field label="Selling price" span={2}><NumInput value={v.pricing.sellingPrice} onChange={x => setPrice('sellingPrice', x)} prefix="$" /></Field>
          <Field label="Incentives" span={2}><NumInput value={v.pricing.incentives} onChange={x => setPrice('incentives', x)} prefix="$" /></Field>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 9 }}>
          Finance, lease, ratings, specs and notes are all editable on the vehicle's page after you add it.
        </div>

        <div style={{ height: 22 }}></div>
        <SectionLabel>Reference</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, alignItems: 'end' }}>
          <Field label="Listing URL" span={4}><TextInput value={v.listingUrl} onChange={x => set('listingUrl', x)} placeholder="https://…" /></Field>
          <Field label="Accent" span={2}>
            <div style={{ display: 'flex', gap: 7 }}>
              {accents.map(c => (
                <button key={c} onClick={() => set('accent', c)} title="accent color"
                  style={{ width: 28, height: 28, borderRadius: 7, background: c, border: v.accent === c ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer', outline: '1px solid var(--line)' }} />
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ExcludeModal — capture why a car is being set aside
const EXCLUDE_REASONS = ['Over budget', 'Too small / not enough cargo', "Didn't like the drive", 'Reliability concerns', 'A better option won out', 'No longer available'];

function ExcludeModal({ vehicle, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  useEffect(() => { setReason(vehicle ? (vehicle.excludeReason || '') : ''); }, [vehicle]);
  if (!vehicle) return null;
  return (
    <Modal open={!!vehicle} onClose={onClose} title="Set this car aside" width={520}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onConfirm(reason)}>Exclude from shortlist</button>
      </>}>
      <div style={{ padding: '22px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
          <div style={{ width: 6, height: 40, borderRadius: 4, background: vehicle.accent }}></div>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{vehicleName(vehicle)}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{vehicle.trim}</div>
          </div>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0 0 16px' }}>
          It'll drop out of comparisons, rankings and the matrix — but stays saved under <strong>Excluded</strong>, so you can bring it back anytime.
        </p>
        <label className="field-label">Reason (optional)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {EXCLUDE_REASONS.map(r => {
            const on = reason === r;
            return (
              <button key={r} onClick={() => setReason(on ? '' : r)}
                style={{ border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent-tint)' : 'var(--card)',
                  color: on ? 'var(--accent)' : 'var(--ink-soft)', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .14s' }}>
                {r}
              </button>
            );
          })}
        </div>
        <input className="inp" value={reason} placeholder="Or write your own…" onChange={e => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

Object.assign(window, { VehicleForm, ExcludeModal });
