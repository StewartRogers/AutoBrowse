// Garage.jsx — vehicle library
function VehicleCard({ v, store, onOpen, selected, onToggleSelect, onExclude, onRestore }) {
  const [menu, setMenu] = useState(false);
  const fin = financeCalc(v);
  const own = ownershipCalc(v);
  const rating = avgRating(v);
  const price = v.pricing.sellingPrice || v.pricing.msrp;

  return (
    <div className="card" style={{ overflow: 'hidden', position: 'relative', transition: 'box-shadow .18s, transform .18s, border-color .18s',
      boxShadow: selected ? '0 0 0 2px var(--accent), var(--shadow)' : 'var(--shadow)',
      opacity: v.archived ? .9 : 1 }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
      <div style={{ position: 'relative' }}>
        <PhotoSlot height={140} label={v.color || 'vehicle photo'} accent={v.accent} />
        <div style={{ position: 'absolute', top: 12, left: 14 }}><PowertrainBadge type={v.powertrain} /></div>
        {!v.archived && (
          <button onClick={() => onToggleSelect(v.id)} title={selected ? 'In comparison' : 'Add to comparison'}
            style={{ position: 'absolute', top: 11, right: 12, width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--line)'), background: selected ? 'var(--accent)' : 'var(--card)',
              color: selected ? '#fff' : 'var(--ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow)' }}>
            <Icon name={selected ? 'check' : 'compare'} size={15} />
          </button>
        )}
        {v.archived && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(46,38,32,.30)', display: 'flex', alignItems: 'flex-end', padding: 12 }}>
            <span className="chip" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>Excluded</span>
          </div>
        )}
      </div>

      <div style={{ padding: '15px 17px 17px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div onClick={() => onOpen(v.id)} style={{ cursor: 'pointer', minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontWeight: 600 }}>{v.year} · {v.bodyStyle}</div>
            <h3 style={{ fontSize: 19, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.make} {v.model}</h3>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 1 }}>{v.trim || '—'}</div>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn ghost sm" onClick={() => setMenu(m => !m)} style={{ padding: '4px 7px' }}>
              <span style={{ fontSize: 17, lineHeight: .5, letterSpacing: 1 }}>⋯</span>
            </button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }}></div>
                <div className="card fade-in" style={{ position: 'absolute', right: 0, top: 34, zIndex: 50, width: 168, boxShadow: 'var(--shadow-lg)', padding: 5, overflow: 'hidden' }}>
                  {[
                    { ic: 'edit', label: 'Edit details', fn: () => onOpen(v.id, true) },
                    { ic: 'copy', label: 'Duplicate', fn: () => store.duplicateVehicle(v.id) },
                    { ic: 'archive', label: v.archived ? 'Restore to shortlist' : 'Exclude', fn: () => v.archived ? onRestore(v.id) : onExclude(v.id) },
                  ].map(it => (
                    <button key={it.label} className="menu-item" onClick={() => { it.fn(); setMenu(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent',
                        padding: '8px 10px', borderRadius: 6, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--paper-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Icon name={it.ic} size={15} /> {it.label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }}></div>
                  <button className="menu-item" onClick={() => { if (confirm('Delete ' + vehicleName(v) + '? This cannot be undone.')) store.removeVehicle(v.id); setMenu(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent',
                      padding: '8px 10px', borderRadius: 6, fontSize: 13.5, color: 'var(--bad)', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fbeeea'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Icon name="trash" size={15} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {v.archived ? (
          <div style={{ marginTop: 14, paddingTop: 15, borderTop: '1px solid var(--line-soft)' }}>
            {v.excludeReason
              ? <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>Set aside:</span> {v.excludeReason}</div>
              : <div style={{ fontSize: 13, color: 'var(--ink-faint)', fontStyle: 'italic' }}>Set aside — no reason noted.</div>}
            <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
              <button className="btn" onClick={() => onRestore(v.id)} style={{ flex: 1, justifyContent: 'center' }}><Icon name="archive" size={14} /> Restore</button>
              <button className="btn" onClick={() => onOpen(v.id)} style={{ justifyContent: 'center' }}>Open</button>
            </div>
          </div>
        ) : (<>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 12px', marginTop: 16, paddingTop: 15, borderTop: '1px solid var(--line-soft)' }}>
            <Stat label="Price" value={fmtMoney(price)} accent={v.accent} />
            <Stat label="Est. / mo" value={fmtMoney(fin.monthly)} sub={`${v.finance.termMonths}mo finance`} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6 }}>Your rating</div>
              <ScoreBar value={rating} color={v.accent} width={'100%'} />
            </div>
            <Stat label="5-yr cost" value={fmtMoney(own.y5)} sub="own + run" />
          </div>

          <button className="btn" onClick={() => onOpen(v.id)} style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
            Open workbook <Icon name="chevron" size={14} />
          </button>
        </>)}
      </div>
    </div>
  );
}

function Garage({ store, onOpen, compareIds, onToggleCompare, onAdd, onExclude, onRestore }) {
  const [sort, setSort] = useState('recent');
  const [filter, setFilter] = useState('active');
  const [pt, setPt] = useState('all');

  let list = store.vehicles.slice();
  if (filter === 'active') list = list.filter(v => !v.archived);
  if (filter === 'archived') list = list.filter(v => v.archived);
  if (pt !== 'all') list = list.filter(v => v.powertrain === pt);

  const sorters = {
    recent: (a, b) => b.createdAt - a.createdAt,
    price: (a, b) => (a.pricing.sellingPrice || a.pricing.msrp || 9e9) - (b.pricing.sellingPrice || b.pricing.msrp || 9e9),
    payment: (a, b) => financeCalc(a).monthly - financeCalc(b).monthly,
    rating: (a, b) => avgRating(b) - avgRating(a),
    economy: (a, b) => (b.specs.mpgCombined || b.specs.mpge / 3 || 0) - (a.specs.mpgCombined || a.specs.mpge / 3 || 0),
    name: (a, b) => vehicleName(a).localeCompare(vehicleName(b)),
  };
  list.sort(sorters[sort]);

  const activeCount = store.vehicles.filter(v => !v.archived).length;
  const excludedCount = store.vehicles.filter(v => v.archived).length;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 30 }}>Garage</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 14.5 }}>
            {activeCount} in consideration · {compareIds.length} selected to compare{excludedCount ? ` · ${excludedCount} excluded` : ''}
          </p>
        </div>
        <button className="btn primary" onClick={onAdd}><Icon name="plus" size={16} /> Log a vehicle</button>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
        <Segmented value={pt} onChange={setPt} options={[{ value: 'all', label: 'All' }, { value: 'gas', label: 'Gas' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'ev', label: 'Electric' }]} />
        <div style={{ flex: 1 }}></div>
        <span className="field-label" style={{ margin: 0 }}>Sort</span>
        <div style={{ width: 180 }}>
          <Select value={sort} onChange={setSort} options={[
            { value: 'recent', label: 'Recently added' }, { value: 'price', label: 'Lowest price' },
            { value: 'payment', label: 'Lowest payment' }, { value: 'rating', label: 'Highest rating' },
            { value: 'economy', label: 'Best economy' }, { value: 'name', label: 'Name (A–Z)' }]} />
        </div>
        <div style={{ width: 168 }}>
          <Select value={filter} onChange={setFilter} options={[
            { value: 'active', label: `In consideration (${activeCount})` }, { value: 'archived', label: `Excluded (${excludedCount})` }, { value: 'all', label: 'Show all' }]} />
        </div>
      </div>

      {list.length === 0 ? (
        filter === 'archived'
          ? <EmptyState icon="archive" title="Nothing set aside" body="Cars you exclude from your shortlist will collect here, so you can revisit or restore them later." />
          : <EmptyState icon="garage" title="No vehicles here yet"
              body="Log the cars you're considering to start building specs, ratings and cost scenarios."
              action={<button className="btn primary" onClick={onAdd}><Icon name="plus" size={16} /> Log your first vehicle</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(296px, 1fr))', gap: 20 }}>
          {list.map(v => (
            <VehicleCard key={v.id} v={v} store={store} onOpen={onOpen}
              selected={compareIds.includes(v.id)} onToggleSelect={onToggleCompare}
              onExclude={onExclude} onRestore={onRestore} />
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Garage, VehicleCard });
