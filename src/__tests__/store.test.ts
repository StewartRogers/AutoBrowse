import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStore, flushPendingSaves } from '../store/useStore';
import { blankVehicle, DEFAULT_MATRIX } from '../lib/data';

// ─── helpers ────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  vehicles: [],
  compareIds: [],
  hydrated: false,
  matrix: DEFAULT_MATRIX,
  loadError: '',
  persistenceError: '',
};

function mockFetch(handler?: (url: string) => unknown) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    const body = handler ? handler(url) : { ok: true };
    return { ok: true, json: async () => body };
  }));
}

beforeEach(() => {
  useStore.setState(INITIAL_STATE);
  mockFetch();
});

afterEach(async () => {
  // Drain queued/debounced writes so they can't hit the next test's fetch mock.
  vi.useRealTimers();
  await flushPendingSaves();
  vi.unstubAllGlobals();
});

// ─── addVehicle ──────────────────────────────────────────────────────────────

describe('addVehicle', () => {
  it('prepends a new vehicle and returns its id', () => {
    const id = useStore.getState().addVehicle({ make: 'Toyota', model: 'RAV4' });
    const { vehicles } = useStore.getState();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].id).toBe(id);
    expect(vehicles[0].make).toBe('Toyota');
  });

  it('defaults groupId to own id when not supplied', () => {
    const id = useStore.getState().addVehicle({});
    const v = useStore.getState().vehicles[0];
    expect(v.groupId).toBe(id);
  });

  it('preserves an explicit groupId', () => {
    useStore.getState().addVehicle({ groupId: 'shared-group' });
    expect(useStore.getState().vehicles[0].groupId).toBe('shared-group');
  });

  it('inserts at head when list is non-empty', () => {
    const id1 = useStore.getState().addVehicle({ make: 'A' });
    const id2 = useStore.getState().addVehicle({ make: 'B' });
    const { vehicles } = useStore.getState();
    expect(vehicles[0].id).toBe(id2);
    expect(vehicles[1].id).toBe(id1);
  });

  it('surfaces persistence errors from failed creates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: 'Database unavailable' }),
    }));
    useStore.getState().addVehicle({ make: 'Toyota' });
    await vi.waitFor(() => {
      expect(useStore.getState().persistenceError).toBe('Database unavailable');
    });
  });
});

// ─── updateVehicle ───────────────────────────────────────────────────────────

describe('updateVehicle', () => {
  it('applies patch to the matching vehicle', () => {
    const id = useStore.getState().addVehicle({ make: 'Toyota' });
    useStore.getState().updateVehicle(id, { make: 'Honda', year: 2025 });
    const v = useStore.getState().vehicles[0];
    expect(v.make).toBe('Honda');
    expect(v.year).toBe(2025);
  });

  it('leaves other vehicles unchanged', () => {
    const id1 = useStore.getState().addVehicle({ make: 'Toyota' });
    useStore.getState().addVehicle({ make: 'Honda' });
    useStore.getState().updateVehicle(id1, { make: 'Ford' });
    const honda = useStore.getState().vehicles.find(v => v.make === 'Honda');
    expect(honda?.make).toBe('Honda');
  });

  it('deep-merges nested objects', () => {
    const id = useStore.getState().addVehicle({});
    useStore.getState().updateVehicle(id, { pricing: { msrp: 50000 } as never });
    const v = useStore.getState().vehicles[0];
    expect(v.pricing.msrp).toBe(50000);
    // other pricing fields preserved from blankVehicle defaults
    expect(v.pricing.taxRate).toBe(13);
  });
});

// ─── removeVehicle ───────────────────────────────────────────────────────────

describe('removeVehicle', () => {
  it('removes the vehicle from the list', () => {
    const id = useStore.getState().addVehicle({});
    useStore.getState().removeVehicle(id);
    expect(useStore.getState().vehicles).toHaveLength(0);
  });

  it('also removes the vehicle from compareIds', () => {
    const id = useStore.getState().addVehicle({});
    useStore.setState({ compareIds: [id, 'other'] });
    useStore.getState().removeVehicle(id);
    expect(useStore.getState().compareIds).toEqual(['other']);
  });

  it('is a no-op for unknown ids', () => {
    useStore.getState().addVehicle({});
    useStore.getState().removeVehicle('nonexistent');
    expect(useStore.getState().vehicles).toHaveLength(1);
  });
});

// ─── duplicateVehicle ────────────────────────────────────────────────────────

describe('duplicateVehicle', () => {
  it('inserts the copy immediately after the original', () => {
    const id1 = useStore.getState().addVehicle({ make: 'A' });
    const id2 = useStore.getState().addVehicle({ make: 'B' }); // head: [B, A]
    const newId = useStore.getState().duplicateVehicle(id1); // copy of A → [B, A, copyA]
    const { vehicles } = useStore.getState();
    expect(vehicles).toHaveLength(3);
    const origIdx = vehicles.findIndex(v => v.id === id1);
    const copyIdx = vehicles.findIndex(v => v.id === newId);
    expect(copyIdx).toBe(origIdx + 1);
    void id2; // suppress unused warning
  });

  it('copy shares groupId with the original', () => {
    const id = useStore.getState().addVehicle({ make: 'Toyota' });
    const newId = useStore.getState().duplicateVehicle(id);
    const { vehicles } = useStore.getState();
    const orig = vehicles.find(v => v.id === id)!;
    const copy = vehicles.find(v => v.id === newId)!;
    expect(copy.groupId).toBe(orig.groupId);
  });

  it('copy has a different id to the original', () => {
    const id = useStore.getState().addVehicle({});
    const newId = useStore.getState().duplicateVehicle(id);
    expect(newId).not.toBe(id);
  });

  it('returns null for an unknown id', () => {
    const result = useStore.getState().duplicateVehicle('nonexistent');
    expect(result).toBeNull();
  });
});

// ─── toggleArchive ───────────────────────────────────────────────────────────

describe('toggleArchive', () => {
  it('flips the archived flag', () => {
    const id = useStore.getState().addVehicle({});
    expect(useStore.getState().vehicles[0].archived).toBe(false);
    useStore.getState().toggleArchive(id);
    expect(useStore.getState().vehicles[0].archived).toBe(true);
    useStore.getState().toggleArchive(id);
    expect(useStore.getState().vehicles[0].archived).toBe(false);
  });

  it('removes an active vehicle from compareIds when archiving', () => {
    const id = useStore.getState().addVehicle({});
    useStore.setState({ compareIds: [id, 'other'] });
    useStore.getState().toggleArchive(id); // archive (was active)
    expect(useStore.getState().compareIds).not.toContain(id);
    expect(useStore.getState().compareIds).toContain('other');
  });

  it('does not touch compareIds when un-archiving', () => {
    const id = useStore.getState().addVehicle({ archived: true } as never);
    useStore.setState({ compareIds: ['other'] });
    useStore.getState().toggleArchive(id); // un-archive
    expect(useStore.getState().compareIds).toEqual(['other']);
  });
});

// ─── setExcluded ─────────────────────────────────────────────────────────────

describe('setExcluded', () => {
  it('archives vehicle, sets reason and excludedAt when excluded=true', () => {
    const id = useStore.getState().addVehicle({});
    useStore.getState().setExcluded(id, true, 'Too expensive');
    const v = useStore.getState().vehicles[0];
    expect(v.archived).toBe(true);
    expect(v.excludeReason).toBe('Too expensive');
    expect(v.excludedAt).toBeGreaterThan(0);
  });

  it('clears archive, reason and excludedAt when excluded=false', () => {
    const id = useStore.getState().addVehicle({});
    useStore.getState().setExcluded(id, true, 'reason');
    useStore.getState().setExcluded(id, false);
    const v = useStore.getState().vehicles[0];
    expect(v.archived).toBe(false);
    expect(v.excludeReason).toBe('');
    expect(v.excludedAt).toBe(0);
  });

  it('removes vehicle from compareIds when excluding', () => {
    const id = useStore.getState().addVehicle({});
    useStore.setState({ compareIds: [id, 'other'] });
    useStore.getState().setExcluded(id, true);
    expect(useStore.getState().compareIds).not.toContain(id);
    expect(useStore.getState().compareIds).toContain('other');
  });
});

// ─── toggleCompare ───────────────────────────────────────────────────────────

describe('toggleCompare', () => {
  it('adds an id when not present', () => {
    useStore.setState({ compareIds: [] });
    useStore.getState().toggleCompare('v1');
    expect(useStore.getState().compareIds).toContain('v1');
  });

  it('removes an id when already present', () => {
    useStore.setState({ compareIds: ['v1', 'v2'] });
    useStore.getState().toggleCompare('v1');
    expect(useStore.getState().compareIds).not.toContain('v1');
    expect(useStore.getState().compareIds).toContain('v2');
  });
});

// ─── init ────────────────────────────────────────────────────────────────────

describe('init', () => {
  it('loads vehicles and matrix from API and marks hydrated', async () => {
    const vehicles = [{ ...blankVehicle(), id: 'v1', archived: false }];
    const matrix = [{ key: 'price', label: 'Price', weight: 10, dir: 'low' as const, metric: 'price' as never }];
    mockFetch((url: string) => {
      if (url.includes('/api/vehicles')) return { ok: true, vehicles };
      if (url.includes('/api/matrix'))  return { ok: true, matrix };
      return { ok: true };
    });
    await useStore.getState().init();
    const state = useStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.vehicles).toHaveLength(1);
    expect(state.vehicles[0].id).toBe('v1');
    expect(state.matrix).toEqual(matrix);
  });

  it('falls back to DEFAULT_MATRIX when API returns no matrix', async () => {
    mockFetch((url: string) => {
      if (url.includes('/api/vehicles')) return { ok: true, vehicles: [] };
      if (url.includes('/api/matrix'))  return { ok: false };
      return { ok: true };
    });
    await useStore.getState().init();
    expect(useStore.getState().matrix).toEqual(DEFAULT_MATRIX);
  });

  it('defaults compareIds to first 3 non-archived vehicles', async () => {
    const vehicles = Array.from({ length: 5 }, (_, i) => ({
      ...blankVehicle(), id: `v${i}`, archived: false,
    }));
    mockFetch((url: string) => {
      if (url.includes('/api/vehicles')) return { ok: true, vehicles };
      return { ok: false };
    });
    await useStore.getState().init();
    expect(useStore.getState().compareIds).toEqual(['v0', 'v1', 'v2']);
  });

  it('excludes archived vehicles from default compareIds', async () => {
    const vehicles = [
      { ...blankVehicle(), id: 'archived', archived: true },
      { ...blankVehicle(), id: 'active1', archived: false },
      { ...blankVehicle(), id: 'active2', archived: false },
    ];
    mockFetch((url: string) => {
      if (url.includes('/api/vehicles')) return { ok: true, vehicles };
      return { ok: false };
    });
    await useStore.getState().init();
    expect(useStore.getState().compareIds).not.toContain('archived');
    expect(useStore.getState().compareIds).toContain('active1');
    expect(useStore.getState().compareIds).toContain('active2');
  });

  it('sets loadError (not hydrated) when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    await useStore.getState().init();
    const state = useStore.getState();
    expect(state.hydrated).toBe(false);
    expect(state.loadError).toBe('Network error');
  });

  it('fails the whole load if only the matrix request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => (url.includes('/api/matrix')
      ? { ok: false, status: 500, json: async () => ({ ok: false, error: 'Internal server error.' }) }
      : { ok: true, json: async () => ({ ok: true, vehicles: [] }) })));
    await useStore.getState().init();
    expect(useStore.getState().hydrated).toBe(false);
    expect(useStore.getState().loadError).toBe('Internal server error.');
  });

  it('blocks writes after a failed load so defaults never overwrite saved data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    await useStore.getState().init();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useStore.getState().setMatrix([{ metric: 'price', weight: 100 }]);
    useStore.getState().addVehicle({ make: 'Toyota' });
    await flushPendingSaves();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears loadError after a successful load', async () => {
    useStore.setState({ loadError: 'earlier failure' });
    mockFetch((url: string) => (url.includes('/api/vehicles') ? { ok: true, vehicles: [] } : { ok: true, matrix: null }));
    await useStore.getState().init();
    expect(useStore.getState().loadError).toBe('');
    expect(useStore.getState().hydrated).toBe(true);
  });
});

// ─── write queue (ordering, debounce, delete) ────────────────────────────────

describe('write queue', () => {
  type Call = { url: string; method: string; body?: unknown; resolve: () => void };

  // fetch mock whose responses are released by hand, to simulate slow requests.
  function controlledFetch() {
    const calls: Call[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init?: RequestInit) =>
      new Promise(resolve => {
        calls.push({
          url,
          method: init?.method ?? 'GET',
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
          resolve: () => resolve({ ok: true, json: async () => ({ ok: true }) }),
        });
      })));
    return calls;
  }
  const tick = () => new Promise(r => setTimeout(r, 0));

  it('coalesces rapid edits into one PUT carrying the latest data', async () => {
    const id = useStore.getState().addVehicle({ notes: '' });
    await flushPendingSaves();
    vi.useFakeTimers();
    mockFetch();
    for (const notes of ['a', 'ab', 'abc']) useStore.getState().updateVehicle(id, { notes });
    expect(fetch).not.toHaveBeenCalled(); // still inside the debounce window
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await flushPendingSaves();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`/api/vehicles/${id}`);
    expect(JSON.parse(String(init?.body)).notes).toBe('abc');
  });

  it('waits for an in-flight save before sending the next one', async () => {
    const calls = controlledFetch();
    const id = useStore.getState().addVehicle({ notes: '' });
    await tick();
    calls[0].resolve(); // POST done
    useStore.getState().updateVehicle(id, { notes: 'first' });
    void flushPendingSaves();
    await tick();
    expect(calls).toHaveLength(2); // first PUT in flight
    useStore.getState().updateVehicle(id, { notes: 'second' });
    void flushPendingSaves();
    await tick();
    expect(calls).toHaveLength(2); // second PUT held back until the first settles
    calls[1].resolve();
    await tick();
    expect(calls).toHaveLength(3);
    expect((calls[2].body as { notes: string }).notes).toBe('second');
    calls[2].resolve();
  });

  it('a delete drops waiting saves and runs after the in-flight one (no resurrection)', async () => {
    const calls = controlledFetch();
    const id = useStore.getState().addVehicle({});
    await tick();
    calls[0].resolve();
    useStore.getState().updateVehicle(id, { notes: 'in flight' });
    void flushPendingSaves();
    await tick();
    useStore.getState().updateVehicle(id, { notes: 'still waiting' }); // debounced, never sent
    useStore.getState().removeVehicle(id);
    await tick();
    expect(calls.map(c => c.method)).toEqual(['POST', 'PUT']); // DELETE queued behind the PUT
    calls[1].resolve();
    await tick();
    expect(calls.map(c => c.method)).toEqual(['POST', 'PUT', 'DELETE']);
    calls[2].resolve();
    await flushPendingSaves();
    expect(calls).toHaveLength(3); // the waiting save was dropped
  });

  it('debounces matrix saves to the latest value', async () => {
    vi.useFakeTimers();
    mockFetch();
    useStore.getState().setMatrix([{ metric: 'price', weight: 10 }]);
    useStore.getState().setMatrix([{ metric: 'price', weight: 20 }]);
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await flushPendingSaves();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual([{ metric: 'price', weight: 20 }]);
  });
});
