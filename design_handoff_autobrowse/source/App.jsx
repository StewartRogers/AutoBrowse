// App.jsx — shell, navigation, routing, tweaks
const { useState: useS, useEffect: useE } = React;

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'garage', label: 'Garage', icon: 'garage' },
  { key: 'compare', label: 'Compare', icon: 'compare' },
  { key: 'matrix', label: 'Decision Matrix', icon: 'matrix' },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#b4552d",
  "headingFont": "Newsreader",
  "density": "regular"
}/*EDITMODE-END*/;

function App() {
  const store = useStore();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [route, setRoute] = useS('dashboard');
  const [vehicleId, setVehicleId] = useS(null);
  const [compareIds, setCompareIds] = useS(() => store.vehicles.filter(v => !v.archived).slice(0, 3).map(v => v.id));
  const [formOpen, setFormOpen] = useS(false);
  const [editing, setEditing] = useS(null);
  const [excludeTarget, setExcludeTarget] = useS(null);

  // keep compareIds valid
  useE(() => {
    setCompareIds(ids => ids.filter(id => store.vehicles.some(v => v.id === id)));
  }, [store.vehicles.length]);

  // apply tweaks to CSS vars
  useE(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    // derive soft/tint from accent
    root.style.setProperty('--serif', t.headingFont === 'Newsreader' ? "'Newsreader', Georgia, serif" : (t.headingFont === 'sans' ? "'Hanken Grotesk', sans-serif" : "'IBM Plex Mono', monospace"));
  }, [t.accent, t.headingFont]);

  const pad = t.density === 'compact' ? 24 : t.density === 'comfy' ? 48 : 36;

  const openVehicle = (id, edit) => {
    store.touchViewed(id);
    if (edit) { setEditing(store.vehicles.find(v => v.id === id)); setFormOpen(true); }
    setVehicleId(id); setRoute('detail');
    window.scrollTo(0, 0);
  };
  const go = (r) => { setRoute(r); setVehicleId(null); window.scrollTo(0, 0); };

  const toggleCompare = (id) => setCompareIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  const openExclude = (id) => setExcludeTarget(store.vehicles.find(v => v.id === id));
  const confirmExclude = (reason) => {
    if (!excludeTarget) return;
    store.setExcluded(excludeTarget.id, true, reason);
    setCompareIds(ids => ids.filter(x => x !== excludeTarget.id));
    setExcludeTarget(null);
  };
  const restoreVehicle = (id) => store.setExcluded(id, false);

  const saveForm = (v) => {
    if (editing) store.replaceVehicle(editing.id, v);
    else { const id = store.addVehicle(v); }
    setFormOpen(false); setEditing(null);
  };

  const current = store.vehicles.find(v => v.id === vehicleId);

  let view;
  if (route === 'dashboard') view = <Dashboard store={store} matrix={store.matrix} onOpen={openVehicle} onGo={go} compareIds={compareIds} />;
  else if (route === 'garage') view = <Garage store={store} onOpen={openVehicle} compareIds={compareIds} onToggleCompare={toggleCompare} onAdd={() => { setEditing(null); setFormOpen(true); }} onExclude={openExclude} onRestore={restoreVehicle} />;
  else if (route === 'compare') view = <Compare store={store} compareIds={compareIds} setCompareIds={setCompareIds} onOpen={openVehicle} />;
  else if (route === 'matrix') view = <Matrix store={store} matrix={store.matrix} setMatrix={store.setMatrix} onOpen={openVehicle} />;
  else if (route === 'detail' && current) view = <VehicleDetail v={current} store={store} onBack={() => go('garage')} onEdit={() => { setEditing(current); setFormOpen(true); }} onExclude={openExclude} onRestore={restoreVehicle} />;
  else view = <Dashboard store={store} matrix={store.matrix} onOpen={openVehicle} onGo={go} compareIds={compareIds} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 246, flexShrink: 0, borderRight: '1px solid var(--line)', background: 'var(--card)', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '26px 22px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Icon name="car" size={20} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, lineHeight: 1 }}>AutoBrowse</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '.03em', marginTop: 2 }}>shopping workbook</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: '4px 14px', flex: 1 }}>
          {NAV.map(n => {
            const on = route === n.key || (route === 'detail' && n.key === 'garage');
            const count = n.key === 'compare' ? compareIds.length : null;
            return (
              <button key={n.key} onClick={() => go(n.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', textAlign: 'left',
                  background: on ? 'var(--accent-tint)' : 'transparent', color: on ? 'var(--accent)' : 'var(--ink-soft)',
                  padding: '10px 13px', borderRadius: 9, fontSize: 14.5, fontWeight: on ? 600 : 500, cursor: 'pointer', marginBottom: 3, transition: 'all .14s' }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--paper-2)'; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                <Icon name={n.icon} size={18} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {count != null && count > 0 && <span className="num" style={{ fontSize: 11, fontWeight: 600, background: on ? 'var(--accent)' : 'var(--neutral)', color: '#fff', borderRadius: 100, padding: '1px 7px' }}>{count}</span>}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
          <button className="btn primary" onClick={() => { setEditing(null); setFormOpen(true); }} style={{ width: '100%', justifyContent: 'center' }}>
            <Icon name="plus" size={16} /> Add vehicle
          </button>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 14, lineHeight: 1.5, textAlign: 'center' }}>
            {store.vehicles.filter(v => !v.archived).length} active · saved on this device
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, padding: `34px ${pad}px ${pad + 24}px`, maxWidth: 1320, margin: '0 auto', width: '100%' }}>
        {view}
      </main>

      <VehicleForm open={formOpen} initial={editing} onSave={saveForm} onClose={() => { setFormOpen(false); setEditing(null); }} />
      <ExcludeModal vehicle={excludeTarget} onConfirm={confirmExclude} onClose={() => setExcludeTarget(null)} />

      {/* Tweaks */}
      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent} options={['#b4552d', '#4f7a52', '#3f6f8f', '#7a5aa8', '#a9492f', '#2e2620']} onChange={v => setTweak('accent', v)} />
        <TweakSection label="Typography" />
        <TweakRadio label="Headings" value={t.headingFont} options={[{ value: 'Newsreader', label: 'Serif' }, { value: 'sans', label: 'Sans' }, { value: 'mono', label: 'Mono' }]} onChange={v => setTweak('headingFont', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={v => setTweak('density', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
