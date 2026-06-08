import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { MATRIX_METRICS, DEFAULT_MATRIX, matrixScores, type MatrixFactor } from '../lib/data';
import Icon from '../components/Icon';
import PowertrainBadge from '../components/PowertrainBadge';
import styles from './Matrix.module.css';

export default function Matrix() {
  const navigate = useNavigate();
  const vehicles = useStore(s => s.vehicles);
  const matrix = useStore(s => s.matrix);
  const { setMatrix } = useStore();

  const activeVehicles = vehicles.filter(v => !v.archived);
  const results = matrixScores(activeVehicles, matrix);

  const totalWeight = matrix.reduce((a, f) => a + (f.weight || 0), 0);
  const isBalanced = Math.abs(totalWeight - 100) < 0.5;

  const updateFactor = (idx: number, patch: Partial<MatrixFactor>) => {
    setMatrix(matrix.map((f, i) => i === idx ? { ...f, ...patch } : f));
  };

  const removeFactor = (idx: number) => {
    setMatrix(matrix.filter((_, i) => i !== idx));
  };

  const addFactor = (metric: string) => {
    setMatrix([...matrix, { metric, weight: 10 }]);
  };

  const normalize = () => {
    if (!totalWeight) return;
    setMatrix(matrix.map(f => ({ ...f, weight: Math.round((f.weight / totalWeight) * 100) })));
  };

  const unusedMetrics = Object.keys(MATRIX_METRICS).filter(k => !matrix.find(f => f.metric === k));

  return (
    <div className={styles.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, marginBottom: 6 }}>Decision Matrix</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
          Weight the factors that matter to you. Every vehicle gets scored 0–100 on each factor, then blended by weight into one number.
        </p>
      </div>

      <div className={styles.layout}>
        {/* Left panel: factors */}
        <div className={`card ${styles.factorsPanel}`}>
          <div className={styles.factorsHeader}>
            <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
              Factors &amp; Weights
            </span>
            <span
              className="num"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: isBalanced ? 'var(--good)' : 'var(--warn)',
              }}
            >
              {totalWeight}%
            </span>
          </div>

          <div className={styles.factorList}>
            {matrix.map((f, idx) => {
              const m = MATRIX_METRICS[f.metric];
              if (!m) return null;
              const pct = totalWeight ? ((f.weight / totalWeight) * 100).toFixed(0) : 0;
              return (
                <div key={f.metric} className={styles.factorRow}>
                  <div className={styles.factorTop}>
                    <div>
                      <div className={styles.factorName}>{m.label}</div>
                      <div className={styles.factorDir}>{m.dir === 'high' ? 'Higher = better' : 'Lower = better'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', minWidth: 36, textAlign: 'right' }}>
                        {pct}%
                      </span>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '2px 5px', color: 'var(--ink-faint)' }}
                        onClick={() => removeFactor(idx)}
                        title="Remove factor"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={f.weight}
                    className={styles.slider}
                    onChange={e => updateFactor(idx, { weight: Number(e.target.value) })}
                  />
                </div>
              );
            })}
          </div>

          {/* Add factor */}
          {unusedMetrics.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <select
                className="input select"
                style={{ fontSize: 12 }}
                value=""
                onChange={e => { if (e.target.value) { addFactor(e.target.value); } }}
              >
                <option value="">+ Add a factor…</option>
                {unusedMetrics.map(k => (
                  <option key={k} value={k}>{MATRIX_METRICS[k].label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Normalize button */}
          {!isBalanced && totalWeight > 0 && (
            <button className="btn btn-secondary" style={{ marginTop: 12, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={normalize}>
              Normalize to 100%
            </button>
          )}

          {/* Reset */}
          <button
            className="btn btn-ghost"
            style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 12, color: 'var(--ink-faint)' }}
            onClick={() => setMatrix(DEFAULT_MATRIX)}
          >
            Reset to defaults
          </button>
        </div>

        {/* Right panel: results */}
        <div className={styles.results}>
          {activeVehicles.length === 0 && (
            <div style={{ color: 'var(--ink-faint)', padding: 24 }}>Add vehicles to your garage to see rankings.</div>
          )}
          {results.map((r, rank) => {
            const isTop = rank === 0;
            const slices = matrix.map(f => {
              const m = MATRIX_METRICS[f.metric];
              const breakdown = r.breakdown[f.metric];
              const weightShare = totalWeight ? (f.weight / totalWeight) : 0;
              const strength = breakdown?.norm ?? 0;
              return { metric: f.metric, label: m?.label ?? f.metric, weightShare, strength, contrib: breakdown?.contrib ?? 0, color: `hsl(${160 + rank * 40}, 35%, 45%)` };
            });

            return (
              <div
                key={r.vehicle.id}
                className={`card ${styles.resultCard} ${isTop ? styles.topCard : ''}`}
                onClick={() => navigate(`/vehicle/${r.vehicle.id}`)}
              >
                <div className={styles.resultHeader}>
                  <div className={styles.rank}>{rank + 1}</div>
                  <div style={{ width: 3, height: 52, borderRadius: 1.5, background: r.vehicle.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 2 }}>{r.vehicle.year}</div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, lineHeight: 1.15 }}>
                          {r.vehicle.make} {r.vehicle.model}
                        </div>
                      </div>
                      <PowertrainBadge powertrain={r.vehicle.powertrain} size="sm" />
                      {isTop && (
                        <span className={styles.topBadge}>
                          <Icon name="star" size={10} style={{ fill: 'currentColor' }} /> TOP PICK
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{r.vehicle.trim}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="num" style={{ fontSize: 32, fontWeight: 500, color: r.vehicle.accent, lineHeight: 1 }}>
                      {r.score.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>pts</div>
                  </div>
                </div>

                {/* Contribution bar */}
                <div className={styles.contribBar}>
                  {slices.map(sl => (
                    <div
                      key={sl.metric}
                      title={`${sl.label}: +${sl.contrib.toFixed(1)}`}
                      style={{
                        flex: sl.weightShare,
                        height: '100%',
                        background: r.vehicle.accent,
                        opacity: 0.2 + sl.strength * 0.8,
                        minWidth: 2,
                      }}
                    />
                  ))}
                </div>

                {/* Factor legend */}
                <div className={styles.factorLegend}>
                  {slices.filter(sl => sl.contrib > 0.1).map(sl => (
                    <span key={sl.metric} className={styles.legendItem}>
                      <span className={styles.legendDot} style={{ background: r.vehicle.accent, opacity: 0.2 + sl.strength * 0.8 }} />
                      {sl.label} <span className="num">+{sl.contrib.toFixed(1)}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
