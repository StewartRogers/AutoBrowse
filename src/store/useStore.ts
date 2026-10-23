// useStore.ts — Zustand store backed by the local Express/SQLite API.
// State is loaded from GET /api/vehicles on init() and written through to the
// API on every mutation via an ordered, debounced write queue (see below).
// localStorage is no longer used.

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

// ─── Write queue ─────────────────────────────────────────────────────────────
// Mutations are optimistic: local state changes immediately and the API write
// runs in the background; a failure only surfaces as a persistenceError banner
// (see AppShell).
//
// Every vehicle (and the matrix) has its own lane, and a lane runs one request
// at a time in the order they were made. Without this, every keystroke fired its
// own full-object PUT, and on a slow or serverless backend an earlier PUT could
// land last (saving stale data) or land after a DELETE (resurrecting the vehicle,
// since PUT is an upsert).
//
// Saves are debounced and coalesced: only the latest snapshot is sent once edits
// pause. Creates and deletes are queued immediately; a delete also drops any save
// still waiting for that vehicle.

const SAVE_DEBOUNCE_MS = 300;

type Job = { run: () => Promise<void>; action: string };

interface Lane {
  tail: Promise<void>;                         // settles once every queued request has
  pending: Job | null;                         // latest debounced save, not yet queued
  timer: ReturnType<typeof setTimeout> | null; // debounce timer for `pending`
}

const lanes = new Map<string, Lane>();

function getLane(key: string): Lane {
  let lane = lanes.get(key);
  if (!lane) {
    lane = { tail: Promise.resolve(), pending: null, timer: null };
    lanes.set(key, lane);
  }
  return lane;
}

function reportFailure(err: unknown, action: string): void {
  console.error(`AutoBrowse: failed to ${action} —`, err);
  useStore.setState({ persistenceError: persistFailure(err) });
}

// Starts `job` once every earlier request in the lane has settled.
function enqueue(key: string, job: Job): void {
  const lane = getLane(key);
  lane.tail = lane.tail.then(job.run).catch(err => reportFailure(err, job.action));
}

// Moves the lane's waiting save (if any) into the queue now.
function flushLane(key: string): void {
  const lane = lanes.get(key);
  if (!lane) return;
  if (lane.timer) clearTimeout(lane.timer);
  lane.timer = null;
  const job = lane.pending;
  lane.pending = null;
  if (job) enqueue(key, job);
}

function scheduleSave(key: string, job: Job): void {
  const lane = getLane(key);
  lane.pending = job; // a newer snapshot replaces the waiting one
  if (lane.timer) clearTimeout(lane.timer);
  lane.timer = setTimeout(() => flushLane(key), SAVE_DEBOUNCE_MS);
}

function dropPending(key: string): void {
  const lane = lanes.get(key);
  if (!lane) return;
  if (lane.timer) clearTimeout(lane.timer);
  lane.timer = null;
  lane.pending = null;
}

const vehicleKey = (id: string) => `vehicle:${id}`;
const MATRIX_KEY = 'matrix';

const queueCreate = (v: Vehicle, action = 'create vehicle') =>
  enqueue(vehicleKey(v.id), { run: () => api.createVehicle(v), action });
const queueSave = (v: Vehicle) =>
  scheduleSave(vehicleKey(v.id), { run: () => api.saveVehicle(v), action: 'save vehicle' });
const queueDelete = (id: string) => {
  dropPending(vehicleKey(id));
  enqueue(vehicleKey(id), { run: () => api.deleteVehicle(id), action: 'delete vehicle' });
};

// Sends every waiting save now and resolves once all queued writes have settled.
// Call before anything that ends the session (sign-out, reload).
export function flushPendingSaves(): Promise<void> {
  for (const key of lanes.keys()) flushLane(key);
  return Promise.all([...lanes.values()].map(lane => lane.tail)).then(() => undefined);
}

// Don't lose the last ~300ms of edits when the tab is hidden or closed.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flushPendingSaves(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPendingSaves();
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
    queueCreate(nv);
    return nv.id;
  },

  updateVehicle(id, patch) {
    let updated: Vehicle | undefined;
    set(s => {
      const r = patchVehicle(s.vehicles, id, v => deepMerge(v, patch));
      updated = r.updated;
      return { vehicles: r.vehicles };
    });
    if (updated) queueSave(updated);
  },

  replaceVehicle(id, full) {
    const v = { ...full, id };
    set(s => ({
      vehicles: s.vehicles.map(existing => existing.id === id ? v : existing),
    }));
    queueSave(v);
  },

  removeVehicle(id) {
    set(s => ({
      vehicles: s.vehicles.filter(v => v.id !== id),
      compareIds: s.compareIds.filter(cid => cid !== id),
    }));
    queueDelete(id);
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
    if (copy) queueCreate(copy, 'duplicate vehicle');
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
    if (updated) queueSave(updated);
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
    if (updated) queueSave(updated);
  },

  touchViewed(id) {
    let updated: Vehicle | undefined;
    set(s => {
      const r = patchVehicle(s.vehicles, id, v => ({ ...v, viewedAt: Date.now() }));
      updated = r.updated;
      return { vehicles: r.vehicles };
    });
    if (updated) queueSave(updated);
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
    scheduleSave(MATRIX_KEY, { run: () => api.saveMatrix(matrix), action: 'save matrix' });
  },

  clearPersistenceError() {
    set({ persistenceError: '' });
  },
}));
