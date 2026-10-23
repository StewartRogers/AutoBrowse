import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useStore } from './store/useStore';
import AppShell from './layouts/AppShell';
import Dashboard from './pages/Dashboard';
import Garage from './pages/Garage';
import VehicleDetail from './pages/VehicleDetail';
import Compare from './pages/Compare';
import Matrix from './pages/Matrix';
import VehicleForm from './features/VehicleForm';
import type { Vehicle } from './lib/data';

export default function App() {
  const replaceVehicle = useStore(s => s.replaceVehicle);
  const init = useStore(s => s.init);
  const hydrated = useStore(s => s.hydrated);
  const loadError = useStore(s => s.loadError);

  useEffect(() => { init(); }, [init]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  // Edit mode only — add mode creates the vehicle itself and never calls onSave.
  const handleSave = (v: Vehicle) => {
    if (editing) replaceVehicle(editing.id, v);
    closeForm();
  };

  const centered = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: 'var(--ink-soft)', fontFamily: 'var(--sans)', padding: '0 16px', textAlign: 'center' } as const;

  // A failed load must not fall through to the app: it would show an empty garage
  // and default matrix, and the first edit would save those over the real data.
  // Reload (not just init()) so an expired session goes back through AuthGate.
  if (loadError) {
    return (
      <div style={centered}>
        <div style={{ fontSize: 28 }}>🚗</div>
        <div style={{ fontSize: 16, color: 'var(--ink)' }}>Couldn't load your garage</div>
        <div style={{ fontSize: 13, maxWidth: 420 }}>{loadError}</div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div style={centered}>
        <div style={{ fontSize: 28 }}>🚗</div>
        <div style={{ fontSize: 14 }}>Loading garage…</div>
      </div>
    );
  }

  return (
    <>
      <AppShell onAddVehicle={openAdd}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/garage" element={<Garage onAddVehicle={openAdd} onEditVehicle={openEdit} />} />
          <Route path="/vehicle/:id" element={<VehicleDetail onEdit={openEdit} />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/matrix" element={<Matrix />} />
        </Routes>
      </AppShell>

      {formOpen && (
        <VehicleForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}
    </>
  );
}
