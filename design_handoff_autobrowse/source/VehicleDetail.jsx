// VehicleDetail.jsx — single-vehicle tabbed workbook (view + inline edit)
const DETAIL_TABS = [
  { key: 'overview', label: 'Overview', icon: 'car' },
  { key: 'specs', label: 'Specifications', icon: 'gauge' },
  { key: 'ratings', label: 'Ratings', icon: 'star' },
  { key: 'testdrive', label: 'Test Drive', icon: 'note' },
  { key: 'pricing', label: 'Pricing', icon: 'money' },
  { key: 'finance', label: 'Finance', icon: 'money' },
  { key: 'lease', label: 'Lease', icon: 'money' },
  { key: 'ownership', label: 'Cost to Own', icon: 'gauge' },
  { key: 'files', label: 'Attachments', icon: 'note' },
];

// generic labeled editable row
function EditRow({ label, children, hint }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 18, alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultStat({ label, value, big, accent, sub }) {
  return (
    <div className="card" style={{ padding: '16px 18px', background: accent ? 'var(--accent-tint)' : 'var(--card)', borderColor: accent ? 'var(--accent-soft)' : 'var(--line)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: accent ? 'var(--accent)' : 'var(--ink-faint)', marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: big ? 28 : 20, fontWeight: 500, color: accent ? 'var(--accent)' : 'var(--ink)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function TabSpecs({ v, up }) {
  const setSpec = (k, val) => up({ specs: { [k]: val } });
  const groups = {};
  SPEC_FIELDS.forEach(f => {
    if (f.evOnly && v.powertrain !== 'ev') return;
    if (f.evHide && v.powertrain === 'ev') return;
    (groups[f.group] = groups[f.group] || []).push(f);
  });
  return (
    <div>
      {Object.entries(groups).map(([g, fields]) => (
        <div key={g} style={{ marginBottom: 26 }}>
          <SectionLabel>{g}</SectionLabel>
          {fields.map(f => (
            <EditRow key={f.key} label={f.label} hint={f.unit && f.kind !== 'text' ? f.unit : null}>
              {f.kind === 'text'
                ? <TextInput value={v.specs[f.key]} onChange={x => setSpec(f.key, x)} placeholder="—" />
                : <NumInput value={v.specs[f.key]} onChange={x => setSpec(f.key, x)} suffix={f.unit} />}
            </EditRow>
          ))}
        </div>
      ))}
    </div>
  );
}

function TabRatings({ v, up }) {
  const setR = (k, val) => up({ ratings: { [k]: val } });
  const avg = avgRating(v);
  return (
    <div>
      <div className="card" style={{ padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 22, background: 'var(--accent-tint)', borderColor: 'var(--accent-soft)' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>Overall average</div>
          <div className="num" style={{ fontSize: 34, color: 'var(--accent)', lineHeight: 1 }}>{avg ? avg.toFixed(1) : '—'}<span style={{ fontSize: 18, color: 'var(--ink-faint)' }}>/10</span></div>
        </div>
        <div style={{ flex: 1, maxWidth: 320 }}><ScoreBar value={avg} color="var(--accent)" showVal={false} width="100%" /></div>
      </div>
      {RATING_CATS.map(c => (
        <EditRow key={c.key} label={c.label}>
          <RatingDots value={v.ratings[c.key] || 0} onChange={x => setR(c.key, x)} color={v.accent} />
        </EditRow>
      ))}
    </div>
  );
}

function TabTestDrive({ v, up }) {
  const setT = (k, val) => up({ testDrive: { [k]: val } });
  const setN = (k, val) => up({ testDriveNotes: { [k]: val } });
  return (
    <div>
      <SectionLabel>Impressions from behind the wheel</SectionLabel>
      {TESTDRIVE_CATS.map(c => (
        <div key={c.key} style={{ padding: '14px 0', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</div>
            <RatingDots value={v.testDrive[c.key] || 0} onChange={x => setT(c.key, x)} color={v.accent} />
          </div>
          <input className="inp" value={v.testDriveNotes[c.key] || ''} placeholder={`Notes on ${c.label.toLowerCase()}…`}
            onChange={e => setN(c.key, e.target.value)} style={{ fontSize: 13.5 }} />
        </div>
      ))}
    </div>
  );
}

function TabPricing({ v, up }) {
  const p = v.pricing;
  const setP = (k, val) => up({ pricing: { [k]: val } });
  const otd = outTheDoor(p);
  const tax = taxesOn(p);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 30, alignItems: 'start' }}>
      <div>
        <SectionLabel>Negotiation</SectionLabel>
        <EditRow label="MSRP"><NumInput value={p.msrp} onChange={x => setP('msrp', x)} prefix="$" /></EditRow>
        <EditRow label="Selling price" hint="agreed before tax & fees"><NumInput value={p.sellingPrice} onChange={x => setP('sellingPrice', x)} prefix="$" /></EditRow>
        <EditRow label="Dealer discount"><NumInput value={p.discounts} onChange={x => setP('discounts', x)} prefix="$" /></EditRow>
        <EditRow label="Incentives / rebates" hint="manufacturer or EV credit"><NumInput value={p.incentives} onChange={x => setP('incentives', x)} prefix="$" /></EditRow>
        <div style={{ height: 18 }}></div>
        <SectionLabel>Trade & charges</SectionLabel>
        <EditRow label="Trade-in value"><NumInput value={p.tradeValue} onChange={x => setP('tradeValue', x)} prefix="$" /></EditRow>
        <EditRow label="Sales tax rate"><NumInput value={p.taxRate} onChange={x => setP('taxRate', x)} suffix="%" step={0.25} /></EditRow>
        <EditRow label="Doc & registration fees"><NumInput value={p.fees} onChange={x => setP('fees', x)} prefix="$" /></EditRow>
      </div>
      <div className="card" style={{ padding: 0, position: 'sticky', top: 20, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', background: 'var(--paper-2)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Out-the-door</div>
        </div>
        <div style={{ padding: '8px 20px 16px' }}>
          {[['Selling price', p.sellingPrice], ['Discount', -(p.discounts || 0)], ['Incentives', -(p.incentives || 0)], [`Sales tax (${p.taxRate}%)`, tax], ['Fees', p.fees]].map(([l, val]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5 }}>
              <span style={{ color: 'var(--ink-soft)' }}>{l}</span>
              <span className="num" style={{ color: val < 0 ? 'var(--good)' : 'var(--ink)' }}>{val < 0 ? '−' : ''}{fmtMoney(Math.abs(val))}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Total</span>
            <span className="num" style={{ fontWeight: 600, fontSize: 20, color: 'var(--accent)' }}>{fmtMoney(otd)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 8 }}>Trade-in of {fmtMoney(p.tradeValue)} applied to financing, not shown here.</div>
        </div>
      </div>
    </div>
  );
}

function TabFinance({ v, up }) {
  const f = v.finance;
  const setF = (k, val) => up({ finance: { [k]: val } });
  const r = financeCalc(v);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 30, alignItems: 'start' }}>
      <div>
        <SectionLabel>Loan terms</SectionLabel>
        <EditRow label="Down payment"><NumInput value={f.downPayment} onChange={x => setF('downPayment', x)} prefix="$" /></EditRow>
        <EditRow label="Trade-in applied" hint="from Pricing tab"><div className="num" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{fmtMoney(v.pricing.tradeValue)}</div></EditRow>
        <EditRow label="APR"><NumInput value={f.apr} onChange={x => setF('apr', x)} suffix="%" step={0.1} /></EditRow>
        <EditRow label="Term">
          <Segmented value={f.termMonths} onChange={x => setF('termMonths', x)} options={[{ value: 36, label: '36' }, { value: 48, label: '48' }, { value: 60, label: '60' }, { value: 72, label: '72' }]} />
        </EditRow>
      </div>
      <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ResultStat label="Monthly payment" value={fmtMoney(r.monthly)} big accent sub={`${f.termMonths} payments`} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ResultStat label="Amount financed" value={fmtMoney(r.principal)} />
          <ResultStat label="Total interest" value={fmtMoney(r.totalInterest)} />
        </div>
        <ResultStat label="Total cost of loan" value={fmtMoney(r.totalPaid)} sub="incl. down payment" />
      </div>
    </div>
  );
}

function TabLease({ v, up }) {
  const l = v.lease;
  const setL = (k, val) => up({ lease: { [k]: val } });
  const r = leaseCalc(v);
  const apr = (l.moneyFactor * 2400).toFixed(1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 30, alignItems: 'start' }}>
      <div>
        <SectionLabel>Lease terms</SectionLabel>
        <EditRow label="Term">
          <Segmented value={l.termMonths} onChange={x => setL('termMonths', x)} options={[{ value: 24, label: '24' }, { value: 36, label: '36' }, { value: 39, label: '39' }, { value: 48, label: '48' }]} />
        </EditRow>
        <EditRow label="Down / drive-off"><NumInput value={l.downPayment} onChange={x => setL('downPayment', x)} prefix="$" /></EditRow>
        <EditRow label="Residual value" hint={`% of MSRP — est. ${fmtMoney(r.residual)}`}><NumInput value={l.residualPct} onChange={x => setL('residualPct', x)} suffix="%" /></EditRow>
        <EditRow label="Money factor" hint={`≈ ${apr}% APR`}><NumInput value={l.moneyFactor} onChange={x => setL('moneyFactor', x)} step={0.0001} /></EditRow>
        <EditRow label="Annual mileage"><Select value={l.annualMiles} onChange={x => setL('annualMiles', Number(x))} options={[{ value: 10000, label: '10,000 mi' }, { value: 12000, label: '12,000 mi' }, { value: 15000, label: '15,000 mi' }]} /></EditRow>
      </div>
      <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ResultStat label="Monthly lease" value={fmtMoney(r.monthly)} big accent sub={`${l.termMonths} months`} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ResultStat label="Total lease cost" value={fmtMoney(r.totalLease)} />
          <ResultStat label="Buyout at end" value={fmtMoney(r.buyout)} />
        </div>
      </div>
    </div>
  );
}

function TabOwnership({ v, up }) {
  const o = v.ownership;
  const setO = (k, val) => up({ ownership: { [k]: val } });
  const r = ownershipCalc(v);
  const isEv = v.powertrain === 'ev';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 30, alignItems: 'start' }}>
      <div>
        <SectionLabel>Usage & running costs</SectionLabel>
        <EditRow label="Annual mileage"><NumInput value={o.annualMiles} onChange={x => setO('annualMiles', x)} suffix="mi" /></EditRow>
        {isEv
          ? <EditRow label="Electricity price" hint={`${v.specs.mpge || '—'} MPGe`}><NumInput value={o.electricityPerKwh} onChange={x => setO('electricityPerKwh', x)} prefix="$" suffix="/kWh" step={0.01} /></EditRow>
          : <EditRow label="Fuel price" hint={`${v.specs.mpgCombined || '—'} mpg combined`}><NumInput value={o.fuelCostPerGal} onChange={x => setO('fuelCostPerGal', x)} prefix="$" suffix="/gal" step={0.05} /></EditRow>}
        <EditRow label="Insurance / year"><NumInput value={o.insuranceYr} onChange={x => setO('insuranceYr', x)} prefix="$" /></EditRow>
        <EditRow label="Maintenance / year"><NumInput value={o.maintenanceYr} onChange={x => setO('maintenanceYr', x)} prefix="$" /></EditRow>
        <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--paper-2)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
          {isEv ? 'Energy cost' : 'Fuel cost'} this year: <strong className="num" style={{ color: 'var(--ink)' }}>{fmtMoney(r.energy)}</strong>. Excludes depreciation — track that via lease residual or resale notes.
        </div>
      </div>
      <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ResultStat label="Per year" value={fmtMoney(r.perYear)} big accent />
        <ResultStat label="1 year" value={fmtMoney(r.y1)} />
        <ResultStat label="3 years" value={fmtMoney(r.y3)} />
        <ResultStat label="5 years" value={fmtMoney(r.y5)} sub="running costs only" />
      </div>
    </div>
  );
}

function TabFiles({ v, up }) {
  const files = v.attachments || [];
  const addFile = (kind) => {
    const name = prompt(`Name this ${kind}:`, kind === 'pdf' ? 'Document.pdf' : 'Photo.jpg');
    if (name) up({ attachments: [...files, { id: uid(), name, type: kind }] });
  };
  const remove = (id) => up({ attachments: files.filter(f => f.id !== id) });
  const iconFor = t => t === 'pdf' ? 'note' : t === 'image' ? 'car' : 'link';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <SectionLabel>Window stickers · quotes · screenshots</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm" onClick={() => addFile('pdf')}><Icon name="plus" size={13} /> PDF / quote</button>
          <button className="btn sm" onClick={() => addFile('image')}><Icon name="plus" size={13} /> Photo</button>
        </div>
      </div>
      {files.length === 0
        ? <EmptyState icon="note" title="No attachments yet" body="Drop in window stickers, dealer quotes, or photos so everything for this car lives in one place." />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {files.map(f => (
              <div key={f.id} className="card" style={{ overflow: 'hidden', position: 'relative' }}>
                <PhotoSlot height={110} label={f.type} accent={v.accent} />
                <div style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Icon name={iconFor(f.type)} size={15} />
                  <span style={{ fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                  <button className="btn ghost sm" onClick={() => remove(f.id)} style={{ padding: '2px 6px' }}><Icon name="x" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function TabOverview({ v, up, onEdit }) {
  const fin = financeCalc(v), lease = leaseCalc(v), own = ownershipCalc(v);
  const keySpecs = SPEC_FIELDS.filter(f => ['horsepower', 'mpgCombined', 'mpge', 'evRange', 'seating', 'cargoCuFt', 'towingLbs', 'drivetrain'].includes(f.key))
    .filter(f => !(f.evOnly && v.powertrain !== 'ev') && !(f.evHide && v.powertrain === 'ev'));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 30, alignItems: 'start' }}>
      <div>
        <PhotoSlot height={230} label={v.color || 'vehicle photo'} accent={v.accent} />
        <div style={{ marginTop: 24 }}>
          <SectionLabel right={<button className="btn ghost sm" onClick={onEdit}><Icon name="edit" size={13} /> Edit</button>}>At a glance</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px 14px' }}>
            {keySpecs.map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 4 }}>{f.label}</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 500 }}>{v.specs[f.key] != null && v.specs[f.key] !== '' ? fmtNum(v.specs[f.key], f.unit) : (typeof v.specs[f.key] === 'string' ? v.specs[f.key] : '—')}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 26 }}>
          <SectionLabel>Notes</SectionLabel>
          <textarea className="inp" value={v.notes || ''} onChange={e => up({ notes: e.target.value })} placeholder="Your running notes on this vehicle…" style={{ minHeight: 96 }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20 }}>
        <ResultStat label="Out-the-door" value={fmtMoney(outTheDoor(v.pricing))} big accent />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ResultStat label="Finance / mo" value={fmtMoney(fin.monthly)} sub={`${v.finance.termMonths}mo`} />
          <ResultStat label="Lease / mo" value={fmtMoney(lease.monthly)} sub={`${v.lease.termMonths}mo`} />
        </div>
        <ResultStat label="5-yr running cost" value={fmtMoney(own.y5)} />
        <ResultStat label="Your overall rating" value={(avgRating(v) || 0).toFixed(1) + ' / 10'} />
        {v.listingUrl && <a className="btn" href={v.listingUrl} target="_blank" style={{ justifyContent: 'center', textDecoration: 'none' }}><Icon name="link" size={15} /> View listing</a>}
      </div>
    </div>
  );
}

function VehicleDetail({ v, store, onBack, onEdit, startEdit, onExclude, onRestore }) {
  const [tab, setTab] = useState('overview');
  const up = (patch) => store.updateVehicle(v.id, patch);

  const TABMAP = {
    overview: <TabOverview v={v} up={up} onEdit={onEdit} />,
    specs: <TabSpecs v={v} up={up} />,
    ratings: <TabRatings v={v} up={up} />,
    testdrive: <TabTestDrive v={v} up={up} />,
    pricing: <TabPricing v={v} up={up} />,
    finance: <TabFinance v={v} up={up} />,
    lease: <TabLease v={v} up={up} />,
    ownership: <TabOwnership v={v} up={up} />,
    files: <TabFiles v={v} up={up} />,
  };

  return (
    <div className="fade-in">
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 16, marginLeft: -8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg> Back to garage
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 6, height: 52, borderRadius: 4, background: v.accent }}></div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 30 }}>{vehicleName(v)}</h1>
              <PowertrainBadge type={v.powertrain} />
              {v.archived && <span className="chip" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>Excluded</span>}
            </div>
            <div style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginTop: 3 }}>{v.trim} · {v.condition} · {v.bodyStyle}{v.dealer ? ' · ' + v.dealer : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onEdit}><Icon name="edit" size={15} /> Edit</button>
          <button className="btn" onClick={() => store.duplicateVehicle(v.id)}><Icon name="copy" size={15} /> Duplicate</button>
          {v.archived
            ? <button className="btn" onClick={() => onRestore(v.id)}><Icon name="archive" size={15} /> Restore</button>
            : <button className="btn" onClick={() => onExclude(v.id)}><Icon name="archive" size={15} /> Exclude</button>}
        </div>
      </div>

      {v.archived && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', marginBottom: 22, background: 'var(--paper-2)', borderColor: 'var(--line)' }}>
          <span style={{ color: 'var(--ink-soft)', display: 'flex' }}><Icon name="archive" size={18} /></span>
          <div style={{ flex: 1, fontSize: 13.5, color: 'var(--ink-soft)' }}>
            <strong style={{ color: 'var(--ink)' }}>Set aside from your shortlist.</strong>{v.excludeReason ? ' — ' + v.excludeReason : ''} It won't appear in comparisons or rankings.
          </div>
          <button className="btn sm" onClick={() => onRestore(v.id)}>Restore to shortlist</button>
        </div>
      )}

      {/* tabs */}
      <div className="scroll-x" style={{ borderBottom: '1px solid var(--line)', marginBottom: 26, display: 'flex', gap: 2 }}>
        {DETAIL_TABS.map(t => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ border: 'none', background: 'transparent', padding: '11px 15px', fontSize: 14, fontWeight: on ? 600 : 500,
                color: on ? 'var(--accent)' : 'var(--ink-soft)', cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap', transition: 'color .14s' }}>
              {t.label}
              {on && <div style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 2.5, background: 'var(--accent)', borderRadius: 3 }}></div>}
            </button>
          );
        })}
      </div>

      <div key={tab} className="fade-in" style={{ minHeight: 320 }}>{TABMAP[tab]}</div>
    </div>
  );
}

Object.assign(window, { VehicleDetail });
