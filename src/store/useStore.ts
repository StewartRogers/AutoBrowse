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
  saveVehicle: (v: Vehicle) => sendJson(`/api/vehicles/${v.id}`, 'PUT', v, 'save vehicle'),
  createVehicle: (v: Vehicle) => sendJson('/api/vehicles', 'POST', v, 'create vehicle'),
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
  saveMatrix: (matrix: MatrixFactor[]) => sendJson('/api/matrix', 'PUT', matrix, 'save matrix'),
};

async function sendJson(url: string, method: 'POST' | 'PUT', body: unknown, action: string): Promise<void> {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await expectOk(r, action);
}

async function expectOk(response: Response, action: string): Promise<void> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Could not ${action} (${response.status}).`);
  }
}

function persistFailure(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Replaces vehicle `id` with `fn(vehicle)`; `updated` is undefined if no vehicle matched.
function patchVehicle(vehicles: Vehicle[], id: string, fn: (v: Vehicle) => Vehicle) {
  let updated: Vehicle | undefined;
  const next = vehicles.map(v => {
    if (v.id !== id) return v;
    updated = fn(v);
    return updated;
  });
  return { vehicles: next, updated };
}

// Fire-and-forget write-through: mutations are optimistic, so a failed API call
// only surfaces as a persistenceError banner (see AppShell).
function persist(request: Promise<void>, action: string): void {
  void request.catch(err => {
    console.error(`AutoBrowse: failed to ${action} —`, err);
    useStore.setState({ persistenceError: persistFailure(err) });
  });
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
    persist(api.createVehicle(nv), 'create vehicle');
    return nv.id;
  },

  updateVehicle(id, patch) {
    let updated: Vehicle | undefined;
    set(s => {
      const r = patchVehicle(s.vehicles, id, v => deepMerge(v, patch));
      updated = r.updated;
      return { vehicles: r.vehicles };
    });
    if (updated) persist(api.saveVehicle(updated), 'save vehicle');
  },

  replaceVehicle(id, full) {
    const v = { ...full, id };
    set(s => ({
      vehicles: s.vehicles.map(existing => existing.id === id ? v : existing),
    }));
    persist(api.saveVehicle(v), 'save vehicle');
  },

  removeVehicle(id) {
    set(s => ({
      vehicles: s.vehicles.filter(v => v.id !== id),
      compareIds: s.compareIds.filter(cid => cid !== id),
    }));
    persist(api.deleteVehicle(id), 'delete vehicle');
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
    if (copy) persist(api.createVehicle(copy), 'duplicate vehicle');
    return newId;
  },

  toggleArchive(id) {
    let updated: Vehicle | undefined;
    set(s => {
      const r = patchVehicle(s.vehicles, id, v => ({ ...v, archived: !v.archived }));
      updated = r.updated;
      const wasActive = s.vehicles.find(v => v.id === id)?.archived === false;
      return {
        vehicles: r.vehicles,
        compareIds: wasActive ? s.compareIds.filter(cid => cid !== id) : s.compareIds,
      };
    });
    if (updated) persist(api.saveVehicle(updated), 'save vehicle');
  },

  setExcluded(id, excluded, reason = '') {
    let updated: Vehicle | undefined;
    set(s => {
      const r = patchVehicle(s.vehicles, id, v => ({
        ...v,
        archived: excluded,
        excludeReason: excluded ? (reason || v.excludeReason || '') : '',
        excludedAt: excluded ? Date.now() : 0,
      }));
      updated = r.updated;
      return {
        vehicles: r.vehicles,
        compareIds: excluded ? s.compareIds.filter(cid => cid !== id) : s.compareIds,
      };
    });
    if (updated) persist(api.saveVehicle(updated), 'save vehicle');
  },

  touchViewed(id) {
    let updated: Vehicle | undefined;
    set(s => {
      const r = patchVehicle(s.vehicles, id, v => ({ ...v, viewedAt: Date.now() }));
      updated = r.updated;
      return { vehicles: r.vehicles };
    });
    if (updated) persist(api.saveVehicle(updated), 'save vehicle');
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
    persist(api.saveMatrix(matrix), 'save matrix');
  },

  clearPersistenceError() {
    set({ persistenceError: '' });
  },
}));
