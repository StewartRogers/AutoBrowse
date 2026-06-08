import { useState } from 'react';
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
  const { addVehicle, replaceVehicle } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSave = (v: Vehicle) => {
    if (editing) {
      replaceVehicle(editing.id, v);
    } else {
      addVehicle(v);
    }
    closeForm();
  };

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
