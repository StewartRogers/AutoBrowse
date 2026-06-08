// Compare.jsx — HERO side-by-side comparison + ranking
function buildRows(section, vehicles) {
  const rows = [];
  const push = (label, fn, better, fmt) => rows.push({ label, better, cells: vehicles.map(v => fn(v)), fmt });

  if (section === 'specs') {
    SPEC_FIELDS.forEach(f => {
      const anyEv = vehicles.some(v => v.powertrain === 'ev');
      const allEv = vehicles.every(v => v.powertrain === 'ev');
      if (f.evOnly && !anyEv) return;
      if (f.evHide && allEv) return;
      push(f.label, v => {
        const raw = v.specs[f.key];
        if (f.kind === 'text') return { raw: null, display: raw || '—' };
        return { raw: typeof raw === 'number' ? raw : null, display: raw != null && raw !== '' ? fmtNum(raw, f.unit) : '—' };
      }, f.better, null);
    });
  }
  if (section === 'ratings') {
    RATING_CATS.forEach(c => push(c.label, v => ({ raw: v.ratings[c.key] || 0, display: v.ratings[c.key] ? v.ratings[c.key] + '/10' : '—', bar: v.ratings[c.key] || 0 }), 'high'));
    push('Overall average', v => ({ raw: avgRating(v), display: avgRating(v) ? avgRating(v).toFixed(1) + '/10' : '—', bar: avgRating(v) }), 'high');
  }
  if (section === 'testdrive') {
    TESTDRIVE_CATS.forEach(c => push(c.label, v => ({ raw: v.testDrive[c.key] || 0, display: v.testDrive[c.key] ? v.testDrive[c.key] + '/10' : '—', bar: v.testDrive[c.key] || 0 }), 'high'));
  }
  if (section === 'pricing') {
    push('MSRP', v => ({ raw: v.pricing.msrp, display: fmtMoney(v.pricing.msrp) }), 'low');
    push('Selling price', v => ({ raw: v.pricing.sellingPrice, display: fmtMoney(v.pricing.sellingPrice) }), 'low');
    push('Incentives', v => ({ raw: v.pricing.incentives, display: fmtMoney(v.pricing.incentives) }), 'high');
    push('Out-the-door', v => ({ raw: outTheDoor(v.pricing), display: fmtMoney(outTheDoor(v.pricing)) }), 'low');
  }
  if (section === 'finance') {
    push('Down payment', v => ({ raw: v.finance.downPayment, display: fmtMoney(v.finance.downPayment) }), null);
    push('APR', v => ({ raw: v.finance.apr, display: v.finance.apr + '%' }), 'low');
    push('Term', v => ({ raw: v.finance.termMonths, display: v.finance.termMonths + ' mo' }), null);
    push('Monthly payment', v => ({ raw: financeCalc(v).monthly, display: fmtMoney(financeCalc(v).monthly) }), 'low');
    push('Total interest', v => ({ raw: financeCalc(v).totalInterest, display: fmtMoney(financeCalc(v).totalInterest) }), 'low');
    push('Total loan cost', v => ({ raw: financeCalc(v).totalPaid, display: fmtMoney(financeCalc(v).totalPaid) }), 'low');
  }
  if (section === 'lease') {
    push('Term', v => ({ raw: v.lease.termMonths, display: v.lease.termMonths + ' mo' }), null);
    push('Monthly lease', v => ({ raw: leaseCalc(v).monthly, display: fmtMoney(leaseCalc(v).monthly) }), 'low');
    push('Drive-off', v => ({ raw: v.lease.downPayment, display: fmtMoney(v.lease.downPayment) }), 'low');
    push('Total lease cost', v => ({ raw: leaseCalc(v).totalLease, display: fmtMoney(leaseCalc(v).totalLease) }), 'low');
    push('Buyout', v => ({ raw: leaseCalc(v).buyout, display: fmtMoney(leaseCalc(v).buyout) }), null);
  }
  if (section === 'ownership') {
    push('Annual mileage', v => ({ raw: v.ownership.annualMiles, display: fmtNum(v.ownership.annualMiles, 'mi') }), null);
    push('Energy / fuel per yr', v => ({ raw: energyCostPerYear(v), display: fmtMoney(energyCostPerYear(v)) }), 'low');
    push('Insurance / yr', v => ({ raw: v.ownership.insuranceYr, display: fmtMoney(v.ownership.insuranceYr) }), 'low');
    push('Maintenance / yr', v => ({ raw: v.ownership.maintenanceYr, display: fmtMoney(v.ownership.maintenanceYr) }), 'low');
    push('3-year cost', v => ({ raw: ownershipCalc(v).y3, display: fmtMoney(ownershipCalc(v).y3) }), 'low');
    push('5-year cost', v => ({ raw: ownershipCalc(v).y5, display: fmtMoney(ownershipCalc(v).y5) }), 'low');
  }
  // mark best cell per row
  rows.forEach(r => {
    if (!r.better) return;
    const nums = r.cells.map(c => c.raw).filter(x => typeof x === 'number');
    if (nums.length < 2) return;
    const best = r.better === 'high' ? Math.max(...nums) : Math.min(...nums);
    if (r.better === 'high' && best === 0) return;
    r.cells.forEach(c => { if (typeof c.raw === 'number' && c.raw === best) c.best = true; });
  });
  return rows;
}

const COMPARE_SECTIONS = [
  { key: 'specs', label: 'Specifications' },
  { key: 'ratings', label: 'Your Ratings' },
  { key: 'testdrive', label: 'Test Drive' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'finance', label: 'Finance' },
  { key: 'lease', label: 'Lease' },
  { key: 'ownership', label: 'Cost to Own' },
];

const RANK_OPTIONS = [
  { value: 'none', label: 'As selected' },
  { value: 'price', label: 'Lowest price', fn: v => v.pricing.sellingPrice || v.pricing.msrp, dir: 1 },
  { value: 'payment', label: 'Lowest payment', fn: v => financeCalc(v).monthly, dir: 1 },
  { value: 'lease', label: 'Lowest lease', fn: v => leaseCalc(v).monthly, dir: 1 },
  { value: 'own', label: 'Lowest 5-yr cost', fn: v => ownershipCalc(v).y5, dir: 1 },
  { value: 'economy', label: 'Best economy', fn: v => v.powertrain === 'ev' ? (v.specs.mpge || 0) : (v.specs.mpgCombined || 0) * 3, dir: -1 },
  { value: 'rating', label: 'Highest rating', fn: v => avgRating(v), dir: -1 },
  { value: 'power', label: 'Most power', fn: v => v.specs.horsepower || 0, dir: -1 },
];

function Compare({ store, compareIds, setCompareIds, onOpen }) {
  const [rank, setRank] = useState('none');
  const [sections, setSections] = useState(['specs', 'ratings', 'pricing', 'finance', 'ownership']);
  const [pickerOpen, setPickerOpen] = useState(false);

  const all = store.vehicles.filter(v => !v.archived);
  let cols = compareIds.map(id => store.vehicles.find(v => v.id === id)).filter(v => v && !v.archived);

  if (rank !== 'none') {
    const opt = RANK_OPTIONS.find(o => o.value === rank);
    cols = cols.slice().sort((a, b) => (opt.fn(a) - opt.fn(b)) * opt.dir);
  }

  const toggleSection = k => setSections(s => s.includes(k) ? s.filter(x => x !== k) : [...COMPARE_SECTIONS.map(c => c.key).filter(c => s.includes(c) || c === k)]);
  const removeCol = id => setCompareIds(compareIds.filter(x => x !== id));

  const colW = 'minmax(168px, 1fr)';
  const gridCols = `220px repeat(${cols.length}, ${colW})`;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 30 }}>Compare</h1>
          <p style={{ color: 'var(--ink-soft)', marginTop: 5, fontSize: 14.5 }}>Side-by-side across {cols.length} vehicle{cols.length !== 1 ? 's' : ''}. Best value in each row is marked.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="field-label" style={{ margin: 0 }}>Rank by</span>
          <div style={{ width: 180 }}><Select value={rank} onChange={setRank} options={RANK_OPTIONS} /></div>
          <button className="btn primary" onClick={() => setPickerOpen(true)}><Icon name="plus" size={15} /> Vehicles</button>
        </div>
      </div>

      {/* section toggles */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {COMPARE_SECTIONS.map(s => {
          const on = sections.includes(s.key);
          return (
            <button key={s.key} onClick={() => toggleSection(s.key)}
              style={{ border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent-tint)' : 'var(--card)',
                color: on ? 'var(--accent)' : 'var(--ink-soft)', padding: '6px 13px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', whiteSpace: 'nowrap' }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {cols.length === 0 ? (
        <EmptyState icon="compare" title="No vehicles selected" body="Pick the cars you want to put head-to-head."
          action={<button className="btn primary" onClick={() => setPickerOpen(true)}><Icon name="plus" size={15} /> Choose vehicles</button>} />
      ) : (
        <div className="card scroll-x" style={{ boxShadow: 'var(--shadow)', overflow: 'auto' }}>
          <div style={{ minWidth: 220 + cols.length * 180 }}>
            {/* header row */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, position: 'sticky', top: 0, zIndex: 5 }}>
              <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line-soft)' }}></div>
              {cols.map(v => (
                <div key={v.id} style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line-soft)', padding: '16px 16px 14px', position: 'relative' }}>
                  <button className="btn ghost sm" onClick={() => removeCol(v.id)} style={{ position: 'absolute', top: 8, right: 8, padding: '2px 6px' }}><Icon name="x" size={13} /></button>
                  <div style={{ height: 5, borderRadius: 4, background: v.accent, width: 38, marginBottom: 11 }}></div>
                  <PowertrainBadge type={v.powertrain} size="sm" />
                  <h3 onClick={() => onOpen(v.id)} style={{ fontSize: 17, marginTop: 9, cursor: 'pointer', lineHeight: 1.15 }}>{vehicleName(v)}</h3>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.trim}</div>
                  <div className="num" style={{ fontSize: 19, color: v.accent, marginTop: 10, fontWeight: 500 }}>{fmtMoney(v.pricing.sellingPrice || v.pricing.msrp)}</div>
                </div>
              ))}
            </div>

            {COMPARE_SECTIONS.filter(s => sections.includes(s.key)).map(sec => {
              const rows = buildRows(sec.key, cols);
              if (!rows.length) return null;
              return (
                <div key={sec.key}>
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                    <div style={{ gridColumn: '1 / -1', padding: '13px 18px 9px', background: 'var(--paper-2)', borderBottom: '1px solid var(--line)', borderTop: '1px solid var(--line)' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>{sec.label}</span>
                    </div>
                  </div>
                  {rows.map((r, ri) => (
                    <div key={ri} style={{ display: 'grid', gridTemplateColumns: gridCols, background: ri % 2 ? 'transparent' : 'rgba(244,238,227,.4)' }}>
                      <div style={{ padding: '11px 18px', fontSize: 13.5, color: 'var(--ink-soft)', borderRight: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center' }}>{r.label}</div>
                      {r.cells.map((c, ci) => (
                        <div key={ci} style={{ padding: '10px 16px', borderRight: '1px solid var(--line-soft)', position: 'relative',
                          background: c.best ? 'var(--accent-tint)' : 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span className="num" style={{ fontSize: 14, fontWeight: c.best ? 600 : 500, color: c.best ? 'var(--accent)' : 'var(--ink)' }}>{c.display}</span>
                            {c.best && <span title="Best in row" style={{ color: 'var(--accent)', display: 'flex' }}><Icon name="check" size={13} stroke={2.4} /></span>}
                          </div>
                          {typeof c.bar === 'number' && c.bar > 0 && <ScoreBar value={c.bar} color={cols[ci].accent} showVal={false} width="100%" />}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ComparePicker open={pickerOpen} onClose={() => setPickerOpen(false)} all={all} compareIds={compareIds} setCompareIds={setCompareIds} />
    </div>
  );
}

function ComparePicker({ open, onClose, all, compareIds, setCompareIds }) {
  const toggle = id => setCompareIds(compareIds.includes(id) ? compareIds.filter(x => x !== id) : [...compareIds, id]);
  return (
    <Modal open={open} onClose={onClose} title="Choose vehicles to compare" width={620}
      footer={<button className="btn primary" onClick={onClose}>Done · {compareIds.length} selected</button>}>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {all.map(v => {
          const on = compareIds.includes(v.id);
          return (
            <button key={v.id} onClick={() => toggle(v.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px', borderRadius: 'var(--r)', cursor: 'pointer', textAlign: 'left',
                border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent-tint)' : 'var(--card)', transition: 'all .14s' }}>
              <div style={{ width: 7, height: 34, borderRadius: 4, background: v.accent }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{vehicleName(v)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{v.trim} · {fmtMoney(v.pricing.sellingPrice || v.pricing.msrp)}</div>
              </div>
              <PowertrainBadge type={v.powertrain} size="sm" />
              <div style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--line)'), background: on ? 'var(--accent)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on && <Icon name="check" size={15} stroke={2.4} />}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

Object.assign(window, { Compare });
