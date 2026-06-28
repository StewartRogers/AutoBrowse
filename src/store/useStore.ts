// useStore.ts — Zustand store backed by the local Express/SQLite API.
// State is loaded from GET /api/vehicles on init() and written through
// to the API on every mutation. localStorage is no longer used.

import { create } from 'zustand';
import {
  type Vehicle, type MatrixFactor,
  blankVehicle, deepMerge, uid, migratePricing,
  DEFAULT_MATRIX,
} from '../lib/data';

// ─── API helpers ─────────────────────────────────────────────────────────────

const api = {
  async getVehicles(): Promise<Vehicle[]> {
    const r = await fetch('/api/vehicles');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `Failed to load vehicles (${r.status}).`);
    if (!j.ok) return [];
    // Upgrade any legacy pricing blobs (manual sellingPrice, numeric fees) to the
    // current shape on load, so the rest of the app can trust the Pricing type.
    return (j.vehicles as Vehicle[]).map(v => ({ ...v, pricing: migratePricing(v.pricing) }));
  },
  async saveVehicle(v: Vehicle) {
    const r = await fetch(`/api/vehicles/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    });
    await expectOk(r, 'save vehicle');
  },
  async createVehicle(v: Vehicle) {
    const r = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    });
    await expectOk(r, 'create vehicle');
  },
  async deleteVehicle(id: string) {
    const r = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
    await expectOk(r, 'delete vehicle');
  },
  async getMatrix(): Promise<MatrixFactor[] | null> {
    const r = await fetch('/api/matrix');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `Failed to load matrix (${r.status}).`);
    return j.ok && j.matrix ? j.matrix : null;
  },
  async saveMatrix(matrix: MatrixFactor[]) {
    const r = await fetch('/api/matrix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(matrix),
    });
    await expectOk(r, 'save matrix');
  },
};

async function expectOk(response: Response, action: string): Promise<void> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Could not ${action} (${response.status}).`);
  }
}

function persistFailure(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ─── Store interface ─────────────────────────────────────────────────────────

export interface AppState {
  vehicles: Vehicle[];
  matrix: MatrixFactor[];
  compareIds: string[];
  hydrated: boolean;
  persistenceError: string;

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
  clearPersistenceError: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()((set) => ({
  vehicles: [],
  matrix: DEFAULT_MATRIX,
  compareIds: [],
  hydrated: false,
  persistenceError: '',

  async init() {
    try {
      const [vehicles, matrix] = await Promise.all([
        api.getVehicles(),
        api.getMatrix(),
      ]);

      const finalMatrix = matrix ?? DEFAULT_MATRIX;
      const defaultCompare = vehicles
        .filter(v => !v.archived)
        .slice(0, 3)
        .map(v => v.id);

      set({
        vehicles,
        matrix: finalMatrix,
        compareIds: defaultCompare,
        hydrated: true,
      });
    } catch (err) {
      console.error('AutoBrowse: failed to load from API —', err);
      // Still mark hydrated so the app renders; will be empty
      set({ hydrated: true, persistenceError: persistFailure(err) });
    }
  },

  addVehicle(partial = {}) {
    const id = uid();
    const nv: Vehicle = {
      ...blankVehicle(),
      ...partial,
      id,
      groupId: (partial as Partial<Vehicle>).groupId ?? id,
      createdAt: Date.now(),
      viewedAt: Date.now(),
    };
    set(s => ({ vehicles: [nv, ...s.vehicles] }));
    void api.createVehicle(nv).catch(err => {
      console.error('AutoBrowse: failed to create vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
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
    if (updated) void api.saveVehicle(updated).catch(err => {
      console.error('AutoBrowse: failed to save vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
  },

  replaceVehicle(id, full) {
    const v = { ...full, id };
    set(s => ({
      vehicles: s.vehicles.map(existing => existing.id === id ? v : existing),
    }));
    void api.saveVehicle(v).catch(err => {
      console.error('AutoBrowse: failed to save vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
  },

  removeVehicle(id) {
    set(s => ({
      vehicles: s.vehicles.filter(v => v.id !== id),
      compareIds: s.compareIds.filter(cid => cid !== id),
    }));
    void api.deleteVehicle(id).catch(err => {
      console.error('AutoBrowse: failed to delete vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
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
      // Preserve groupId so this copy is linked to the original car
      copy.groupId = v.groupId || v.id;
      copy.trim = copy.trim || '';
      copy.createdAt = Date.now();
      const idx = s.vehicles.findIndex(x => x.id === id);
      const arr = [...s.vehicles];
      arr.splice(idx + 1, 0, copy);
      return { ...s, vehicles: arr };
    });
    if (copy) void api.createVehicle(copy).catch(err => {
      console.error('AutoBrowse: failed to duplicate vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
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
    if (updated) void api.saveVehicle(updated).catch(err => {
      console.error('AutoBrowse: failed to save vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
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
    if (updated) void api.saveVehicle(updated).catch(err => {
      console.error('AutoBrowse: failed to save vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
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
    if (updated) void api.saveVehicle(updated).catch(err => {
      console.error('AutoBrowse: failed to save vehicle —', err);
      set({ persistenceError: persistFailure(err) });
    });
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
    void api.saveMatrix(matrix).catch(err => {
      console.error('AutoBrowse: failed to save matrix —', err);
      set({ persistenceError: persistFailure(err) });
    });
  },

  clearPersistenceError() {
    set({ persistenceError: '' });
  },

}));
