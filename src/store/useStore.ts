// useStore.ts — Zustand store backed by the local Express/SQLite API.
// State is loaded from GET /api/vehicles on init() and written through
// to the API on every mutation. localStorage is no longer used.

import { create } from 'zustand';
import {
  type Vehicle, type MatrixFactor,
  blankVehicle, deepMerge, uid,
  SEED_VEHICLES, DEFAULT_MATRIX,
} from '../lib/data';

// ─── API helpers ─────────────────────────────────────────────────────────────

const api = {
  async getVehicles(): Promise<Vehicle[]> {
    const r = await fetch('/api/vehicles');
    const j = await r.json();
    return j.ok ? j.vehicles : [];
  },
  saveVehicle(v: Vehicle) {
    fetch(`/api/vehicles/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    }).catch(console.error);
  },
  createVehicle(v: Vehicle) {
    fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    }).catch(console.error);
  },
  deleteVehicle(id: string) {
    fetch(`/api/vehicles/${id}`, { method: 'DELETE' }).catch(console.error);
  },
  async getMatrix(): Promise<MatrixFactor[] | null> {
    const r = await fetch('/api/matrix');
    const j = await r.json();
    return j.ok && j.matrix ? j.matrix : null;
  },
  saveMatrix(matrix: MatrixFactor[]) {
    fetch('/api/matrix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(matrix),
    }).catch(console.error);
  },
};

// ─── Store interface ─────────────────────────────────────────────────────────

export interface AppState {
  vehicles: Vehicle[];
  matrix: MatrixFactor[];
  compareIds: string[];
  hydrated: boolean;

  // Lifecycle
  init: () => Promise<void>;

  // Vehicle actions
  addVehicle: (partial?: Partial<Vehicle>) => string;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  replaceVehicle: (id: string, full: Vehicle) => void;
  removeVehicle: (id: string) => void;
  duplicateVehicle: (id: string) => string | null;
  toggleArchive: (id: string) => void;
  setExcluded: (id: string, excluded: boolean, reason?: string) => void;
  touchViewed: (id: string) => void;

  // Compare actions
  setCompareIds: (ids: string[]) => void;
  toggleCompare: (id: string) => void;

  // Matrix actions
  setMatrix: (matrix: MatrixFactor[]) => void;

  // Reset
  resetAll: () => Promise<void>;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()((set, get) => ({
  vehicles: [],
  matrix: DEFAULT_MATRIX,
  compareIds: [],
  hydrated: false,

  // Load vehicles and matrix from SQLite via the Express API.
  // If the DB is empty (first run), seed with demo vehicles.
  async init() {
    try {
      const [vehicles, matrix] = await Promise.all([
        api.getVehicles(),
        api.getMatrix(),
      ]);

      let finalVehicles = vehicles;

      if (finalVehicles.length === 0) {
        // First run — seed the DB
        finalVehicles = SEED_VEHICLES();
        await Promise.all(
          finalVehicles.map(v =>
            fetch('/api/vehicles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(v),
            })
          )
        );
      }

      const finalMatrix = matrix ?? DEFAULT_MATRIX;
      const defaultCompare = finalVehicles
        .filter(v => !v.archived)
        .slice(0, 3)
        .map(v => v.id);

      set({
        vehicles: finalVehicles,
        matrix: finalMatrix,
        compareIds: defaultCompare,
        hydrated: true,
      });
    } catch (err) {
      console.error('AutoBrowse: failed to load from API —', err);
      // Still mark hydrated so the app renders; will be empty
      set({ hydrated: true });
    }
  },

  addVehicle(partial = {}) {
    const nv: Vehicle = {
      ...blankVehicle(),
      ...partial,
      id: uid(),
      createdAt: Date.now(),
      viewedAt: Date.now(),
    };
    set(s => ({ vehicles: [nv, ...s.vehicles] }));
    api.createVehicle(nv);
    return nv.id;
  },

  updateVehicle(id, patch) {
    let updated: Vehicle | undefined;
    set(s => {
      const vehicles = s.vehicles.map(v => {
        if (v.id !== id) return v;
        updated = deepMerge(v, patch);
        return updated;
      });
      return { vehicles };
    });
    if (updated) api.saveVehicle(updated);
  },

  replaceVehicle(id, full) {
    const v = { ...full, id };
    set(s => ({
      vehicles: s.vehicles.map(existing => existing.id === id ? v : existing),
    }));
    api.saveVehicle(v);
  },

  removeVehicle(id) {
    set(s => ({
      vehicles: s.vehicles.filter(v => v.id !== id),
      compareIds: s.compareIds.filter(cid => cid !== id),
    }));
    api.deleteVehicle(id);
  },

  duplicateVehicle(id) {
    let newId: string | null = null;
    let copy: Vehicle | undefined;
    set(s => {
      const v = s.vehicles.find(x => x.id === id);
      if (!v) return s;
      copy = JSON.parse(JSON.stringify(v)) as Vehicle;
      copy.id = uid();
      newId = copy.id;
      copy.trim = (copy.trim || '') + ' (scenario)';
      copy.createdAt = Date.now();
      const idx = s.vehicles.findIndex(x => x.id === id);
      const arr = [...s.vehicles];
      arr.splice(idx + 1, 0, copy);
      return { ...s, vehicles: arr };
    });
    if (copy) api.createVehicle(copy);
    return newId;
  },

  toggleArchive(id) {
    let updated: Vehicle | undefined;
    set(s => {
      const vehicles = s.vehicles.map(v => {
        if (v.id !== id) return v;
        updated = { ...v, archived: !v.archived };
        return updated;
      });
      const wasActive = s.vehicles.find(v => v.id === id)?.archived === false;
      return {
        vehicles,
        compareIds: wasActive ? s.compareIds.filter(cid => cid !== id) : s.compareIds,
      };
    });
    if (updated) api.saveVehicle(updated);
  },

  setExcluded(id, excluded, reason = '') {
    let updated: Vehicle | undefined;
    set(s => {
      const vehicles = s.vehicles.map(v => {
        if (v.id !== id) return v;
        updated = {
          ...v,
          archived: excluded,
          excludeReason: excluded ? (reason || v.excludeReason || '') : '',
          excludedAt: excluded ? Date.now() : 0,
        };
        return updated;
      });
      return {
        vehicles,
        compareIds: excluded ? s.compareIds.filter(cid => cid !== id) : s.compareIds,
      };
    });
    if (updated) api.saveVehicle(updated);
  },

  touchViewed(id) {
    let updated: Vehicle | undefined;
    set(s => {
      const vehicles = s.vehicles.map(v => {
        if (v.id !== id) return v;
        updated = { ...v, viewedAt: Date.now() };
        return updated;
      });
      return { vehicles };
    });
    if (updated) api.saveVehicle(updated);
  },

  setCompareIds(ids) {
    set({ compareIds: ids });
  },

  toggleCompare(id) {
    set(s => ({
      compareIds: s.compareIds.includes(id)
        ? s.compareIds.filter(cid => cid !== id)
        : [...s.compareIds, id],
    }));
  },

  setMatrix(matrix) {
    set({ matrix });
    api.saveMatrix(matrix);
  },

  async resetAll() {
    // Delete everything from the DB then reseed
    const current = get().vehicles;
    await Promise.all(current.map(v => fetch(`/api/vehicles/${v.id}`, { method: 'DELETE' })));
    const fresh = SEED_VEHICLES();
    await Promise.all(
      fresh.map(v =>
        fetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(v),
        })
      )
    );
    const defaultCompare = fresh.filter(v => !v.archived).slice(0, 3).map(v => v.id);
    set({ vehicles: fresh, matrix: DEFAULT_MATRIX, compareIds: defaultCompare });
    api.saveMatrix(DEFAULT_MATRIX);
  },
}));
