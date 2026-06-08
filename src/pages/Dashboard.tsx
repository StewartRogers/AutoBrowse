import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { financeCalc, ownershipCalc, avgRating, matrixScores } from '../lib/data';
import { money, vehicleName } from '../lib/fmt';
import Icon from '../components/Icon';
import PowertrainBadge from '../components/PowertrainBadge';
import PhotoSlot from '../components/PhotoSlot';
import ScoreBar from '../components/ScoreBar';
import styles from './Dashboard.module.css';

// ── Mini leader row for panel cards ──────────────────────────────────────────
function LeaderRow({
  rank, vehicle, metricLabel, metricValue, onClick,
}: {
  rank: number;
  vehicle: ReturnType<typeof useStore.getState>['vehicles'][0];
  metricLabel?: string;
  metricValue: string;
  onClick: () => void;
}) {
  return (
    <div className={styles.leaderRow} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className={styles.leaderRank}>{rank}</div>
      <div style={{ width: 3, height: 28, borderRadius: 1.5, background: vehicle.accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={`truncate ${styles.leaderName}`}>{vehicleName(vehicle)}</div>
        <div className={styles.leaderTrim}>{vehicle.trim}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{metricValue}</div>
        {metricLabel && <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{metricLabel}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const vehicles = useStore(s => s.vehicles);
  const matrix = useStore(s => s.matrix);
  const compareIds = useStore(s => s.compareIds);

  const active = vehicles.filter(v => !v.archived);
  const total = vehicles.length;

  // Stat band calculations
  const prices = active.map(v => v.pricing.sellingPrice || v.pricing.msrp || 0).filter(Boolean);
  const priceRangeMax = prices.length ? money(Math.max(...prices)) : '';

  const paymentsByVehicle = active.map(v => ({ v, mo: financeCalc(v).monthly })).sort((a, b) => a.mo - b.mo);
  const lowestPayment = paymentsByVehicle[0];

  const matrixResults = matrixScores(active, matrix);
  const topMatch = matrixResults[0];

  // Date eyebrow
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  // Panel: best monthly payment
  const paymentLeaders = [...active].sort((a, b) => financeCalc(a).monthly - financeCalc(b).monthly).slice(0, 4);

  // Panel: lowest 5-yr cost
  const ownLeaders = [...active].sort((a, b) => ownershipCalc(a).y5 - ownershipCalc(b).y5).slice(0, 4);

  // Panel: top matrix matches
  const matrixLeaders = matrixResults.slice(0, 4);

  // Panel: recently viewed
  const recentLeaders = [...active].sort((a, b) => b.viewedAt - a.viewedAt).slice(0, 4);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={`num label`} style={{ marginBottom: 6 }}>{dateStr}</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32 }}>Your shortlist</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/compare" className="btn btn-secondary">
            <Icon name="compare" size={14} /> Compare {compareIds.length > 0 && compareIds.length}
          </Link>
          <Link to="/matrix" className="btn btn-primary">
            <Icon name="matrix" size={14} /> Decision matrix
          </Link>
        </div>
      </div>

      {/* Summary band */}
      {active.length > 0 && (
        <div className={`card ${styles.summaryBand}`}>
          <div className={styles.summaryItem}>
            <div className="label">In the Running</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 500, marginTop: 4 }}>{active.length}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>of {total} total</div>
          </div>
          <div className={styles.summaryItem}>
            <div className="label">Price Range</div>
            <div className="num" style={{ fontSize: prices.length ? 22 : 26, fontWeight: 500, marginTop: 4 }}>
              {prices.length === 1 ? money(prices[0]) : (prices.length ? money(Math.min(...prices)) : '—')}
            </div>
            {prices.length > 1 && <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>up to {priceRangeMax}</div>}
          </div>
          <div className={styles.summaryItem}>
            <div className="label">Lowest Payment</div>
            {lowestPayment ? (
              <>
                <div className="num" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>
                  {money(lowestPayment.mo)}/mo
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{lowestPayment.v.make} {lowestPayment.v.model}</div>
              </>
            ) : <div className="num" style={{ fontSize: 22, marginTop: 4 }}>—</div>}
          </div>
          <div className={styles.summaryItem}>
            <div className="label">Top Match</div>
            {topMatch ? (
              <>
                <div className="num" style={{ fontSize: 22, fontWeight: 500, color: 'var(--accent)', marginTop: 4 }}>
                  {topMatch.score.toFixed(0)} pts
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{topMatch.vehicle.make} {topMatch.vehicle.model}</div>
              </>
            ) : <div className="num" style={{ fontSize: 22, marginTop: 4 }}>—</div>}
          </div>
        </div>
      )}

      {/* Spotlight — top pick */}
      {topMatch && (
        <div
          className={`card ${styles.spotlight}`}
          onClick={() => navigate(`/vehicle/${topMatch.vehicle.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && navigate(`/vehicle/${topMatch.vehicle.id}`)}
        >
          <div className={styles.spotlightPhoto}>
            <PhotoSlot color={topMatch.vehicle.color || undefined} accent={topMatch.vehicle.accent} height={220} photoUrl={topMatch.vehicle.photoUrl || undefined} />
          </div>
          <div className={styles.spotlightInfo}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className={styles.bestBadge}>
                <Icon name="star" size={10} style={{ fill: 'currentColor' }} /> Best overall match
              </span>
              <PowertrainBadge powertrain={topMatch.vehicle.powertrain} />
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, marginBottom: 4 }}>
              {topMatch.vehicle.year} {topMatch.vehicle.make} {topMatch.vehicle.model}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>{topMatch.vehicle.trim}</div>
            <div className={styles.spotlightStats}>
              <div>
                <div className="label">Weighted Score</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 500, color: topMatch.vehicle.accent, marginTop: 4 }}>
                  {topMatch.score.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="label">Price</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>
                  {money(topMatch.vehicle.pricing.sellingPrice || topMatch.vehicle.pricing.msrp)}
                </div>
              </div>
              <div>
                <div className="label">Est. / Mo</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>
                  {money(financeCalc(topMatch.vehicle).monthly)}
                </div>
              </div>
              {avgRating(topMatch.vehicle) > 0 && (
                <div>
                  <div className="label">Your Rating</div>
                  <div className="num" style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>
                    {avgRating(topMatch.vehicle).toFixed(1)}
                    <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>/10</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {active.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
          <Icon name="car" size={48} style={{ opacity: .25, marginBottom: 16 }} />
          <h2 style={{ fontFamily: 'var(--serif)', marginBottom: 8 }}>Your shortlist is empty</h2>
          <p style={{ fontSize: 13, marginBottom: 20 }}>Add vehicles to start comparing and ranking them.</p>
          <Link to="/garage" className="btn btn-primary"><Icon name="plus" size={14} /> Go to Garage</Link>
        </div>
      )}

      {/* 2×2 panel grid */}
      {active.length > 0 && (
        <div className={styles.panelGrid}>
          {/* Best monthly payment */}
          <div className={`card ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <Icon name="money" size={14} style={{ color: 'var(--accent)' }} />
              <span>Best monthly payment</span>
            </div>
            <div className={styles.panelRows}>
              {paymentLeaders.map((v, i) => (
                <LeaderRow
                  key={v.id} rank={i + 1} vehicle={v}
                  metricValue={money(financeCalc(v).monthly) + '/mo'}
                  onClick={() => navigate(`/vehicle/${v.id}`)}
                />
              ))}
            </div>
          </div>

          {/* Lowest 5-yr cost */}
          <div className={`card ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <Icon name="gauge" size={14} style={{ color: 'var(--accent)' }} />
              <span>Lowest 5-year cost</span>
            </div>
            <div className={styles.panelRows}>
              {ownLeaders.map((v, i) => (
                <LeaderRow
                  key={v.id} rank={i + 1} vehicle={v}
                  metricValue={money(ownershipCalc(v).y5)}
                  onClick={() => navigate(`/vehicle/${v.id}`)}
                />
              ))}
            </div>
          </div>

          {/* Top matrix matches */}
          <div className={`card ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <Icon name="star" size={14} style={{ color: 'var(--accent)', fill: 'var(--accent)' }} />
              <span>Top matches</span>
              <Link to="/matrix" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>Adjust weights</Link>
            </div>
            <div className={styles.panelRows}>
              {matrixLeaders.map((r, i) => (
                <div key={r.vehicle.id} className={styles.leaderRow} onClick={() => navigate(`/vehicle/${r.vehicle.id}`)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate(`/vehicle/${r.vehicle.id}`)}>
                  <div className={styles.leaderRank}>{i + 1}</div>
                  <div style={{ width: 3, height: 28, borderRadius: 1.5, background: r.vehicle.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={`truncate ${styles.leaderName}`}>{vehicleName(r.vehicle)}</div>
                    <ScoreBar value={r.score} max={100} accent={r.vehicle.accent} height={3} />
                  </div>
                  <div className="num" style={{ fontSize: 14, fontWeight: 600 }}>{r.score.toFixed(0)} pts</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recently viewed */}
          <div className={`card ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <Icon name="note" size={14} style={{ color: 'var(--accent)' }} />
              <span>Recently viewed</span>
            </div>
            <div className={styles.panelRows}>
              {recentLeaders.map((v, i) => (
                <LeaderRow
                  key={v.id} rank={i + 1} vehicle={v}
                  metricValue={new Date(v.viewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  onClick={() => navigate(`/vehicle/${v.id}`)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
