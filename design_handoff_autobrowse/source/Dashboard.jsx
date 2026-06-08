// Dashboard.jsx — shortlist overview
function MiniBar({ value, max, color }) {
  return (
    <div style={{ flex: 1, height: 8, background: 'var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ width: Math.max(3, (value / max) * 100) + '%', height: '100%', background: color, borderRadius: 10, transition: 'width .5s cubic-bezier(.2,.7,.2,1)' }}></div>
    </div>
  );
}

function LeaderRow({ rank, v, label, value, max, valColor, onOpen }) {
  return (
    <div onClick={() => onOpen(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 6px', borderRadius: 8, cursor: 'pointer', transition: 'background .14s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--paper-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div className="num" style={{ width: 22, fontSize: 14, fontWeight: 600, color: rank === 1 ? 'var(--accent)' : 'var(--ink-faint)', textAlign: 'center' }}>{rank}</div>
      <div style={{ width: 9, height: 38, borderRadius: 4, background: v.accent, flexShrink: 0 }}></div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vehicleName(v)}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{v.trim}</div>
      </div>
      <div style={{ width: 120 }}><MiniBar value={value} max={max} color={v.accent} /></div>
      <div className="num" style={{ width: 90, textAlign: 'right', fontSize: 14.5, fontWeight: 500, color: valColor || 'var(--ink)' }}>{label}</div>
    </div>
  );
}

function PanelCard({ title, icon, children, action }) {
  return (
    <div className="card" style={{ padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--ink)' }}>
          <span style={{ color: 'var(--accent)' }}><Icon name={icon} size={17} /></span>
          <h3 style={{ fontSize: 16.5 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Dashboard({ store, matrix, onOpen, onGo, compareIds }) {
  const active = store.vehicles.filter(v => !v.archived);
  const ranked = matrixScores(store.vehicles, matrix);
  const top = ranked[0];

  const byPayment = active.slice().sort((a, b) => financeCalc(a).monthly - financeCalc(b).monthly);
  const byOwnership = active.slice().sort((a, b) => ownershipCalc(a).y5 - ownershipCalc(b).y5);
  const recent = store.vehicles.slice().sort((a, b) => b.viewedAt - a.viewedAt).slice(0, 4);

  const maxPay = Math.max(...byPayment.map(v => financeCalc(v).monthly), 1);
  const maxOwn = Math.max(...byOwnership.map(v => ownershipCalc(v).y5), 1);
  const priceRange = active.length ? [Math.min(...active.map(v => v.pricing.sellingPrice || v.pricing.msrp)), Math.max(...active.map(v => v.pricing.sellingPrice || v.pricing.msrp))] : [0, 0];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="num" style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1 style={{ fontSize: 32 }}>Your shortlist</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => onGo('compare')}><Icon name="compare" size={16} /> Compare {compareIds.length || ''}</button>
          <button className="btn primary" onClick={() => onGo('matrix')}><Icon name="matrix" size={16} /> Decision matrix</button>
        </div>
      </div>

      {/* Summary band */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: 22, boxShadow: 'var(--shadow)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 26 }}>
        <Stat label="In the running" value={active.length} sub={`of ${store.vehicles.length} total`} />
        <Stat label="Price range" value={priceRange[0] === priceRange[1] ? fmtMoney(priceRange[0]) : `${fmtMoney(priceRange[0])}`} sub={priceRange[0] === priceRange[1] ? 'all vehicles' : `up to ${fmtMoney(priceRange[1])}`} />
        <Stat label="Lowest payment" value={byPayment[0] ? fmtMoney(financeCalc(byPayment[0]).monthly) + '/mo' : '—'} sub={byPayment[0] ? vehicleName(byPayment[0], false) : ''} />
        <Stat label="Top match" value={top ? Math.round(top.score) + ' pts' : '—'} sub={top ? vehicleName(top.vehicle, false) : ''} accent="var(--accent)" />
      </div>

      {/* Top pick spotlight */}
      {top && (
        <div className="card" style={{ display: 'flex', overflow: 'hidden', marginBottom: 22, boxShadow: 'var(--shadow)', cursor: 'pointer' }} onClick={() => onOpen(top.vehicle.id)}>
          <div style={{ width: 270, flexShrink: 0, position: 'relative' }}>
            <PhotoSlot height={196} label={top.vehicle.color || 'top match'} accent={top.vehicle.accent} />
          </div>
          <div style={{ padding: '22px 26px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="chip" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>★ Best overall match</span>
              <PowertrainBadge type={top.vehicle.powertrain} />
            </div>
            <h2 style={{ fontSize: 27 }}>{vehicleName(top.vehicle)}</h2>
            <div style={{ color: 'var(--ink-soft)', fontSize: 14.5, marginTop: 2 }}>{top.vehicle.trim}</div>
            <div style={{ display: 'flex', gap: 36, marginTop: 18 }}>
              <Stat label="Weighted score" value={top.score.toFixed(1)} accent="var(--accent)" />
              <Stat label="Price" value={fmtMoney(top.vehicle.pricing.sellingPrice || top.vehicle.pricing.msrp)} />
              <Stat label="Est. / mo" value={fmtMoney(financeCalc(top.vehicle).monthly)} />
              <Stat label="Your rating" value={avgRating(top.vehicle).toFixed(1) + '/10'} />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
        <PanelCard title="Best monthly payment" icon="money">
          {byPayment.slice(0, 4).map((v, i) => (
            <LeaderRow key={v.id} rank={i + 1} v={v} value={maxPay - financeCalc(v).monthly + maxPay * .15} max={maxPay * 1.15}
              label={fmtMoney(financeCalc(v).monthly) + '/mo'} onOpen={onOpen} />
          ))}
        </PanelCard>

        <PanelCard title="Lowest 5-year cost" icon="gauge">
          {byOwnership.slice(0, 4).map((v, i) => (
            <LeaderRow key={v.id} rank={i + 1} v={v} value={maxOwn - ownershipCalc(v).y5 + maxOwn * .15} max={maxOwn * 1.15}
              label={fmtMoney(ownershipCalc(v).y5)} onOpen={onOpen} />
          ))}
        </PanelCard>

        <PanelCard title="Top matches" icon="rank" action={<button className="btn ghost sm" onClick={() => onGo('matrix')}>Adjust weights</button>}>
          {ranked.slice(0, 4).map((r, i) => (
            <LeaderRow key={r.vehicle.id} rank={i + 1} v={r.vehicle} value={r.score} max={ranked[0].score}
              label={r.score.toFixed(1)} valColor="var(--accent)" onOpen={onOpen} />
          ))}
        </PanelCard>

        <PanelCard title="Recently viewed" icon="car">
          {recent.map((v) => (
            <div key={v.id} onClick={() => onOpen(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 6px', borderRadius: 8, cursor: 'pointer', transition: 'background .14s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--paper-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 9, height: 38, borderRadius: 4, background: v.accent, flexShrink: 0 }}></div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vehicleName(v)}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{v.trim}</div>
              </div>
              <PowertrainBadge type={v.powertrain} size="sm" />
              <Icon name="chevron" size={15} />
            </div>
          ))}
        </PanelCard>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard });
