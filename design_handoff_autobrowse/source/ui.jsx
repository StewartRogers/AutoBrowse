// ui.jsx — shared UI primitives
const fmtMoney = (n, dp = 0) => {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
const fmtNum = (n, unit) => {
  if (n == null || n === '' || isNaN(n)) return '—';
  const s = Number(n).toLocaleString('en-US');
  return unit ? `${s}\u2009${unit}` : s;
};

function PowertrainBadge({ type, size }) {
  const pt = POWERTRAINS[type] || POWERTRAINS.gas;
  return (
    <span className="chip" style={{ background: pt.tint, color: pt.color, fontSize: size === 'sm' ? 10 : 11.5 }}>
      <span style={{ width: 6, height: 6, borderRadius: 10, background: pt.color, display: 'inline-block' }}></span>
      {pt.label}
    </span>
  );
}

// Score bar 0..10
function ScoreBar({ value, max = 10, color = 'var(--accent)', showVal = true, width }) {
  const pct = Math.max(0, Math.min(1, (value || 0) / max)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: width || 'auto' }}>
      <div style={{ flex: 1, height: 6, background: 'var(--line-soft)', borderRadius: 10, overflow: 'hidden', minWidth: 44 }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 10, transition: 'width .4s cubic-bezier(.2,.7,.2,1)' }}></div>
      </div>
      {showVal && <span className="num" style={{ fontSize: 12.5, color: 'var(--ink-soft)', minWidth: 28, textAlign: 'right' }}>{value ? value.toFixed(value % 1 ? 1 : 0) : '—'}</span>}
    </div>
  );
}

// editable 1..10 rating dots
function RatingDots({ value, onChange, color = 'var(--accent)' }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 3 }} onMouseLeave={() => setHover(0)}>
      {Array.from({ length: 10 }).map((_, i) => {
        const n = i + 1;
        const on = (hover || value || 0) >= n;
        return (
          <button key={n} onMouseEnter={() => setHover(n)} onClick={() => onChange(n === value ? 0 : n)}
            title={n + '/10'}
            style={{ width: 17, height: 17, borderRadius: 5, border: 'none', padding: 0, cursor: 'pointer',
              background: on ? color : 'var(--line-soft)', transition: 'background .12s, transform .1s',
              transform: hover === n ? 'scale(1.18)' : 'none' }} />
        );
      })}
      <span className="num" style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginLeft: 8, alignSelf: 'center', minWidth: 30 }}>
        {value ? value + '/10' : '—'}
      </span>
    </div>
  );
}

function Field({ label, children, hint, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : 'auto' }}>
      {label && <label className="field-label">{label}</label>}
      {children}
      {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return <input className="inp" type={type} value={value ?? ''} placeholder={placeholder}
    onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />;
}

// number input with optional prefix/suffix
function NumInput({ value, onChange, prefix, suffix, step = 1, placeholder }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {prefix && <span style={{ position: 'absolute', left: 11, color: 'var(--ink-faint)', fontSize: 14, pointerEvents: 'none' }} className="num">{prefix}</span>}
      <input className="inp num" type="number" step={step} value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        style={{ paddingLeft: prefix ? 22 : 11, paddingRight: suffix ? 42 : 11 }} />
      {suffix && <span style={{ position: 'absolute', right: 11, color: 'var(--ink-faint)', fontSize: 12.5, pointerEvents: 'none' }}>{suffix}</span>}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select className="inp" value={value} onChange={e => onChange(e.target.value)}
        style={{ appearance: 'none', paddingRight: 30, cursor: 'pointer' }}>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="12" height="12" viewBox="0 0 12 12" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-faint)' }}>
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Segmented control
function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--paper-2)', borderRadius: var_rsm(), padding: 3, border: '1px solid var(--line)', gap: 2 }}>
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const on = val === value;
        return (
          <button key={val} onClick={() => onChange(val)}
            style={{ border: 'none', background: on ? 'var(--card)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-soft)',
              padding: '6px 13px', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: on ? '0 1px 2px rgba(46,38,32,.10)' : 'none', transition: 'all .14s' }}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}
function var_rsm() { return '7px'; }

function Stat({ label, value, sub, accent }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 5 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 500, color: accent || 'var(--ink)', lineHeight: 1.05, fontFamily: 'var(--mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Modal({ open, onClose, children, width = 720, title, footer }) {
  useEffect(() => {
    if (!open) return;
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = ''; };
  }, [open]);
  if (!open) return null;
  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(46,38,32,.34)',
      backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px', overflowY: 'auto' }}>
      <div onMouseDown={e => e.stopPropagation()} className="fade-in" style={{ background: 'var(--paper)', borderRadius: 'var(--r-lg)',
        width: '100%', maxWidth: width, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
        {title && (
          <div style={{ padding: '20px 26px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)' }}>
            <h3 style={{ fontSize: 21 }}>{title}</h3>
            <button className="btn ghost sm" onClick={onClose} style={{ fontSize: 18, padding: '2px 9px' }}>×</button>
          </div>
        )}
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ padding: '16px 26px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'var(--card)' }}>{footer}</div>}
      </div>
    </div>
  );
}

function Icon({ name, size = 18, stroke = 1.6 }) {
  const p = {
    dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
    garage: 'M3 21V8l9-5 9 5v13M7 21v-6h10v6M7 11h10',
    compare: 'M9 3v18M4 7h5M4 12h5M4 17h5M15 3v18M20 8h-5M20 13h-5',
    matrix: 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16',
    rank: 'M4 18h4V8H4zM10 18h4V4h-4zM16 18h4v-7h-4z',
    plus: 'M12 5v14M5 12h14',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    trash: 'M5 7h14M9 7V4h6v3M6 7l1 13h10l1-13',
    copy: 'M8 8h11v11H8zM5 16V5h11',
    archive: 'M3 7h18v4H3zM5 11v9h14v-9M9 15h6',
    car: 'M5 11l2-5h10l2 5M3 16h18v-3l-1-2H4l-1 2zM6 16v2M18 16v2M7 13h2M15 13h2',
    star: 'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6L12 16.8 6.6 19.6l1.2-6L3.3 9.4l6.1-.8z',
    link: 'M9 15l6-6M10 6l1-1a4 4 0 016 6l-1 1M14 18l-1 1a4 4 0 01-6-6l1-1',
    check: 'M5 12l5 5L20 6',
    x: 'M6 6l12 12M18 6L6 18',
    chevron: 'M9 6l6 6-6 6',
    gauge: 'M12 13l4-4M5 18a8 8 0 1114 0',
    note: 'M5 4h11l3 3v13H5zM15 4v4h4M8 12h8M8 16h6',
    money: 'M12 3v18M8 7h6a2.5 2.5 0 010 5H9a2.5 2.5 0 000 5h7',
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={p} />
    </svg>
  );
}

function EmptyState({ icon, title, body, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '72px 24px', color: 'var(--ink-soft)' }}>
      <div style={{ color: 'var(--neutral)', display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Icon name={icon || 'car'} size={42} stroke={1.3} /></div>
      <h3 style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>{title}</h3>
      {body && <p style={{ maxWidth: 360, margin: '0 auto 20px', lineHeight: 1.55, fontSize: 14.5 }}>{body}</p>}
      {action}
    </div>
  );
}

// section heading inside detail/forms
function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>{children}</div>
      {right}
    </div>
  );
}

function vehicleName(v, withYear = true) {
  const parts = [withYear ? v.year : null, v.make, v.model].filter(Boolean);
  return parts.join(' ');
}

// photo placeholder (striped) — used where a real photo would go
function PhotoSlot({ height = 150, label = 'vehicle photo', accent }) {
  return (
    <div style={{ height, borderRadius: 'var(--r)', position: 'relative', overflow: 'hidden',
      background: `repeating-linear-gradient(135deg, var(--paper-2), var(--paper-2) 11px, var(--card) 11px, var(--card) 22px)`,
      border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="num" style={{ fontSize: 11, color: 'var(--ink-faint)', background: 'var(--paper)', padding: '4px 9px', borderRadius: 100, border: '1px solid var(--line)' }}>{label}</span>
      {accent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent }}></div>}
    </div>
  );
}

Object.assign(window, {
  fmtMoney, fmtNum, PowertrainBadge, ScoreBar, RatingDots, Field, TextInput, NumInput, Select,
  Segmented, Stat, Modal, Icon, EmptyState, SectionLabel, vehicleName, PhotoSlot,
});
