// useStore.ts — Zustand store replacing the prototype's useStore React hook
// Mirrors the entire app state to localStorage['autobrowse_v1'] on every change.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Vehicle, MatrixFactor,
  blankVehicle, deepMerge, uid,
  SEED_VEHICLES, DEFAULT_MATRIX,
} from '../lib/data';

export interface AppState {
  vehicles: Vehicle[];
  matrix: MatrixFactor[];
  compareIds: string[];

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
  resetAll: () => void;
}

const STORE_KEY = 'autobrowse_v1';

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      vehicles: SEED_VEHICLES(),
      matrix: DEFAULT_MATRIX,
      compareIds: [],

      addVehicle(partial = {}) {
        const nv: Vehicle = {
          ...blankVehicle(),
          ...partial,
          id: uid(),
          createdAt: Date.now(),
          viewedAt: Date.now(),
        };
        set(s => ({ vehicles: [nv, ...s.vehicles] }));
        return nv.id;
      },

      updateVehicle(id, patch) {
        set(s => ({
          vehicles: s.vehicles.map(v =>
            v.id === id ? deepMerge(v, patch) : v
          ),
        }));
      },

      replaceVehicle(id, full) {
        set(s => ({
          vehicles: s.vehicles.map(v => (v.id === id ? { ...full, id } : v)),
        }));
      },

      removeVehicle(id) {
        set(s => ({
          vehicles: s.vehicles.filter(v => v.id !== id),
          compareIds: s.compareIds.filter(cid => cid !== id),
        }));
      },

      duplicateVehicle(id) {
        let newId: string | null = null;
        set(s => {
          const v = s.vehicles.find(x => x.id === id);
          if (!v) return s;
          const copy: Vehicle = JSON.parse(JSON.stringify(v));
          copy.id = uid();
          newId = copy.id;
          copy.trim = (copy.trim || '') + ' (scenario)';
          copy.createdAt = Date.now();
          const idx = s.vehicles.findIndex(x => x.id === id);
          const arr = [...s.vehicles];
          arr.splice(idx + 1, 0, copy);
          return { ...s, vehicles: arr };
        });
        return newId;
      },

      toggleArchive(id) {
        set(s => ({
          vehicles: s.vehicles.map(v =>
            v.id === id ? { ...v, archived: !v.archived } : v
          ),
          compareIds: s.vehicles.find(v => v.id === id)?.archived === false
            ? s.compareIds.filter(cid => cid !== id)
            : s.compareIds,
        }));
      },

      setExcluded(id, excluded, reason = '') {
        set(s => ({
          vehicles: s.vehicles.map(v =>
            v.id === id
              ? {
                  ...v,
                  archived: excluded,
                  excludeReason: excluded ? (reason || v.excludeReason || '') : '',
                  excludedAt: excluded ? Date.now() : 0,
                }
              : v
          ),
          compareIds: excluded ? s.compareIds.filter(cid => cid !== id) : s.compareIds,
        }));
      },

      touchViewed(id) {
        set(s => ({
          vehicles: s.vehicles.map(v =>
            v.id === id ? { ...v, viewedAt: Date.now() } : v
          ),
        }));
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
      },

      resetAll() {
        set({ vehicles: SEED_VEHICLES(), matrix: DEFAULT_MATRIX, compareIds: [] });
      },
    }),
    {
      name: STORE_KEY,
      // seed compareIds with first 3 active vehicles after hydration
      onRehydrateStorage: () => (state) => {
        if (state && state.compareIds.length === 0) {
          const firstThree = state.vehicles
            .filter(v => !v.archived)
            .slice(0, 3)
            .map(v => v.id);
          state.compareIds = firstThree;
        }
      },
    }
  )
);
