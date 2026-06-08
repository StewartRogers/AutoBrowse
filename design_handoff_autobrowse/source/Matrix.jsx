// Matrix.jsx — weighted decision matrix
function Matrix({ store, matrix, setMatrix, onOpen }) {
  const factors = matrix;
  const totalW = factors.reduce((a, f) => a + (f.weight || 0), 0);
  const results = matrixScores(store.vehicles, factors);
  const used = factors.map(f => f.metric);
  const available = Object.keys(MATRIX_METRICS).filter(m => !used.includes(m));

  const setWeight = (i, w) => setMatrix(factors.map((f, idx) => idx === i ? { ...f, weight: w } : f));
  const removeFactor = i => setMatrix(factors.filter((_, idx) => idx !== i));
  const addFactor = m => m && setMatrix([...factors, { metric: m, weight: 10 }]);
  const normalize = () => {
    if (!totalW) return;
    setMatrix(factors.map(f => ({ ...f, weight: Math.round((f.weight / totalW) * 100) })));
  };

  const maxScore = results[0] ? results[0].score : 100;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 30 }}>Decision Matrix</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 14.5, maxWidth: 560 }}>
            Weight the factors that matter to you. Every vehicle gets scored 0–100 on each factor, then blended by weight into one number.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 26, alignItems: 'start', marginTop: 18 }}>
        {/* Weights panel */}
        <div className="card" style={{ padding: '20px 22px', boxShadow: 'var(--shadow)', position: 'sticky', top: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionLabel>Factors & weights</SectionLabel>
            <span className="num" style={{ fontSize: 13, fontWeight: 600, color: totalW === 100 ? 'var(--good)' : 'var(--warn)' }}>{totalW}%</span>
          </div>

          {factors.map((f, i) => {
            const m = MATRIX_METRICS[f.metric];
            const pct = totalW ? Math.round((f.weight / totalW) * 100) : 0;
            return (
              <div key={f.metric} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m ? m.label : f.metric}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{m && m.dir === 'low' ? 'lower=better' : 'higher=better'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="num" style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, minWidth: 34, textAlign: 'right' }}>{pct}%</span>
                    <button className="btn ghost sm" onClick={() => removeFactor(i)} style={{ padding: '2px 5px' }}><Icon name="x" size={13} /></button>
                  </div>
                </div>
                <input type="range" min="0" max="50" value={f.weight} onChange={e => setWeight(i, Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
              </div>
            );
          })}

          {available.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
              <Select value="" onChange={addFactor} options={[{ value: '', label: '+ Add a factor…' }, ...available.map(m => ({ value: m, label: MATRIX_METRICS[m].label }))]} />
            </div>
          )}
          {totalW !== 100 && (
            <button className="btn sm" onClick={normalize} style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>Normalize to 100%</button>
          )}
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {results.length === 0 ? (
            <EmptyState icon="matrix" title="No active vehicles" body="Add vehicles to your garage to see them ranked." />
          ) : results.map((r, i) => {
            const v = r.vehicle;
            return (
              <div key={v.id} className="card" style={{ padding: '18px 20px', boxShadow: 'var(--shadow)', borderColor: i === 0 ? 'var(--accent-soft)' : 'var(--line)', position: 'relative', overflow: 'hidden' }}>
                {i === 0 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)' }}></div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="num" style={{ fontSize: 26, fontWeight: 600, color: i === 0 ? 'var(--accent)' : 'var(--ink-faint)', width: 30 }}>{i + 1}</div>
                  <div style={{ width: 7, height: 44, borderRadius: 4, background: v.accent }}></div>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen(v.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <h3 style={{ fontSize: 18 }}>{vehicleName(v)}</h3>
                      <PowertrainBadge type={v.powertrain} size="sm" />
                      {i === 0 && <span className="chip" style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}>★ Top pick</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{v.trim}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 30, fontWeight: 600, color: i === 0 ? 'var(--accent)' : 'var(--ink)', lineHeight: 1 }}>{r.score.toFixed(1)}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.05em' }}>weighted</div>
                  </div>
                </div>
                {/* breakdown */}
                <div style={{ display: 'flex', gap: 3, marginTop: 16, height: 9, borderRadius: 6, overflow: 'hidden', background: 'var(--line-soft)' }}>
                  {factors.map(f => {
                    const b = r.breakdown[f.metric];
                    if (!b) return null;
                    const w = totalW ? (f.weight / totalW) * 100 : 0;
                    return (
                      <div key={f.metric} title={`${MATRIX_METRICS[f.metric].label}: ${b.contrib.toFixed(1)} pts`}
                        style={{ width: w + '%', background: v.accent, opacity: 0.35 + b.norm * 0.65, transition: 'all .4s' }}></div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 11 }}>
                  {factors.map(f => {
                    const b = r.breakdown[f.metric];
                    if (!b) return null;
                    return (
                      <div key={f.metric} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-soft)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: v.accent, opacity: 0.35 + b.norm * 0.65 }}></span>
                        {MATRIX_METRICS[f.metric].label}
                        <span className="num" style={{ color: 'var(--ink-faint)' }}>+{b.contrib.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Matrix });
