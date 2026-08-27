import { describe, expect, test, beforeEach } from '@jest/globals';
import {
  saveItinerary,
  loadItineraries,
  deleteItinerary,
  saveSettings,
  loadSettings,
  getStorageUsage,
  isStorageNearLimit,
  updateSavedItinerary, reorderSavedItineraries,
  addCompletion, updateCompletion, deleteCompletion, getKnownPeople,
} from '../lib/storage';
import type { Itinerary, AppSettings } from '../lib/types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const makeItinerary = (id: string, name: string): Itinerary => ({
  id,
  name,
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  waypoints: [],
  legs: [],
});

beforeEach(() => {
  localStorageMock.clear();
});

describe('saveItinerary and loadItineraries', () => {
  test('saves and loads an itinerary', () => {
    const it = makeItinerary('1', 'Test Route');
    saveItinerary(it);
    const loaded = loadItineraries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Test Route');
  });

  test('updates existing itinerary by id', () => {
    saveItinerary(makeItinerary('1', 'Original'));
    saveItinerary({ ...makeItinerary('1', 'Updated'), updatedAt: '2026-03-11T00:00:00Z' });
    const loaded = loadItineraries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Updated');
  });

  test('saves multiple itineraries', () => {
    saveItinerary(makeItinerary('1', 'Route A'));
    saveItinerary(makeItinerary('2', 'Route B'));
    expect(loadItineraries()).toHaveLength(2);
  });

  test('strips elevationProfile from legs when saving', () => {
    const it: Itinerary = {
      ...makeItinerary('1', 'Profile Test'),
      legs: [{
        id: 'leg1',
        fromWaypointId: 'wp1',
        toWaypointId: 'wp2',
        distance: 2,
        elevationGain: 100,
        elevationLoss: 0,
        azimuth: 45,
        elevationProfile: [
          { distance: 0, altitude: 1000 },
          { distance: 2, altitude: 1100 },
        ],
      }],
    };
    saveItinerary(it);
    const loaded = loadItineraries();
    expect(loaded[0].legs[0]).not.toHaveProperty('elevationProfile');
    expect(loaded[0].legs[0].distance).toBe(2);
  });
});

describe('deleteItinerary', () => {
  test('removes itinerary by id', () => {
    saveItinerary(makeItinerary('1', 'To Delete'));
    deleteItinerary('1');
    expect(loadItineraries()).toHaveLength(0);
  });

  test('no-op for non-existent id', () => {
    saveItinerary(makeItinerary('1', 'Keep'));
    deleteItinerary('999');
    expect(loadItineraries()).toHaveLength(1);
  });
});

describe('settings', () => {
  test('loads default settings when none saved', () => {
    const settings = loadSettings();
    expect(settings.tolerances.altitude).toBe(50);
    expect(settings.tolerances.azimuth).toBe(5);
  });

  test('saves and loads custom settings', () => {
    const custom: AppSettings = {
      tolerances: { altitude: 30, coordinates: 0.002, distance: 15, azimuth: 10, elevationDelta: 20 },
      mapDisplay: { coloredPath: true, trailRouting: true, sampleInterval: 50, baseMap: 'thunderforest-outdoors', showHikingTrails: false, showCoordinateGrid: false, emergencyLayers: [] },
    };
    saveSettings(custom);
    expect(loadSettings().tolerances.altitude).toBe(30);
    expect(loadSettings().mapDisplay.coloredPath).toBe(true);
    expect(loadSettings().mapDisplay.trailRouting).toBe(true);
  });
});

describe('getStorageUsage', () => {
  test('returns bytes used', () => {
    saveItinerary(makeItinerary('1', 'Test'));
    const usage = getStorageUsage();
    expect(usage).toBeGreaterThan(0);
  });
});

describe('isStorageNearLimit', () => {
  test('returns false when storage is small', () => {
    saveItinerary(makeItinerary('1', 'Small'));
    expect(isStorageNearLimit()).toBe(false);
  });
});

describe('saveItinerary quota exceeded', () => {
  test('throws user-friendly error when localStorage is full', () => {
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = () => { throw new DOMException('quota exceeded'); };
    try {
      expect(() => saveItinerary(makeItinerary('1', 'Big'))).toThrow('Spazio di archiviazione esaurito');
    } finally {
      localStorageMock.setItem = originalSetItem;
    }
  });
});

describe('schema v3 migration and validation', () => {
  test('loadItineraries keeps old itineraries lacking new fields', () => {
    localStorage.setItem('trektrak_schema_version', '2');
    localStorage.setItem('trektrak_itineraries', JSON.stringify([
      { id: '1', name: 'Old', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [] },
    ]));
    const loaded = loadItineraries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].completions ?? []).toEqual([]);
  });

  test('migration v2->v3 backfills notes, completions, sortIndex, metrics', () => {
    localStorage.setItem('trektrak_schema_version', '2');
    localStorage.setItem('trektrak_itineraries', JSON.stringify([
      { id: 'a', name: 'A', createdAt: 'x', updatedAt: 'x',
        waypoints: [{ id: 'w1', name: 'w1', lat: 45, lon: 9, altitude: 100, order: 0 }],
        legs: [] },
    ]));
    loadItineraries();
    const raw = JSON.parse(localStorage.getItem('trektrak_itineraries')!);
    expect(raw[0].notes).toBe('');
    expect(raw[0].completions).toEqual([]);
    expect(raw[0].sortIndex).toBe(0);
    expect(raw[0].metrics.minAltitude).toBe(100);
    expect(localStorage.getItem('trektrak_schema_version')).toBe('3');
  });

  test('migration v2->v3 is idempotent (preserves edited fields on re-load)', () => {
    localStorage.setItem('trektrak_schema_version', '2');
    localStorage.setItem('trektrak_itineraries', JSON.stringify([
      { id: 'a', name: 'A', createdAt: 'x', updatedAt: 'x',
        waypoints: [{ id: 'w1', name: 'w1', lat: 45, lon: 9, altitude: 100, order: 0 }],
        legs: [] },
    ]));
    loadItineraries(); // runs migration once
    // Simulate user edits after migration
    updateSavedItinerary('a', { notes: 'edited', sortIndex: 7 });
    addCompletion('a', { personName: 'Gio', date: '2026-01-01', notes: '' });
    // A second load must NOT re-run the migration or clobber the edited fields
    const reloaded = loadItineraries();
    expect(reloaded[0].notes).toBe('edited');
    expect(reloaded[0].sortIndex).toBe(7);
    expect(reloaded[0].completions).toHaveLength(1);
    expect(localStorage.getItem('trektrak_schema_version')).toBe('3');
  });

  test('filters malformed completions on load', () => {
    localStorage.setItem('trektrak_schema_version', '3');
    localStorage.setItem('trektrak_itineraries', JSON.stringify([
      { id: '1', name: 'X', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [],
        completions: [
          { id: 'c1', personName: 'Gio', date: '2026-01-01', notes: 'ok' },
          { id: 'c2', date: '2026-01-02' },
          'garbage',
        ] },
    ]));
    const loaded = loadItineraries();
    expect(loaded[0].completions).toHaveLength(1);
    expect(loaded[0].completions![0].id).toBe('c1');
  });
});

describe('library helpers', () => {
  test('updateSavedItinerary patches notes', () => {
    saveItinerary(makeItinerary('1', 'A'));
    updateSavedItinerary('1', { notes: 'bella gita' });
    expect(loadItineraries()[0].notes).toBe('bella gita');
  });

  test('reorderSavedItineraries rewrites sortIndex', () => {
    saveItinerary({ ...makeItinerary('1', 'A'), sortIndex: 0 });
    saveItinerary({ ...makeItinerary('2', 'B'), sortIndex: 1 });
    reorderSavedItineraries(['2', '1']);
    const byId = Object.fromEntries(loadItineraries().map((r) => [r.id, r.sortIndex]));
    expect(byId['2']).toBe(0);
    expect(byId['1']).toBe(1);
  });

  test('addCompletion / updateCompletion / deleteCompletion', () => {
    saveItinerary(makeItinerary('1', 'A'));
    addCompletion('1', { personName: 'Gio', date: '2026-01-01', durationMinutes: 120, notes: '' });
    let c = loadItineraries()[0].completions!;
    expect(c).toHaveLength(1);
    const cid = c[0].id;
    updateCompletion('1', cid, { notes: 'fango' });
    expect(loadItineraries()[0].completions![0].notes).toBe('fango');
    deleteCompletion('1', cid);
    expect(loadItineraries()[0].completions).toHaveLength(0);
  });

  test('getKnownPeople dedupes case-insensitively and trims', () => {
    saveItinerary(makeItinerary('1', 'A'));
    addCompletion('1', { personName: ' Gio ', date: '2026-01-01', notes: '' });
    addCompletion('1', { personName: 'gio', date: '2026-01-02', notes: '' });
    addCompletion('1', { personName: 'Anna', date: '2026-01-03', notes: '' });
    const people = getKnownPeople();
    expect(people).toContain('Gio');
    expect(people).toContain('Anna');
    expect(people.filter((p) => p.toLowerCase() === 'gio')).toHaveLength(1);
  });
});

describe('loadSettings — emergencyLayers', () => {
  test('default [] quando assente (settings legacy)', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { coloredPath: false },
    }));
    expect(loadSettings().mapDisplay.emergencyLayers).toEqual([]);
    expect(loadSettings().mapDisplay.coloredPath).toBe(false);
  });

  test('id validi preservati, id sconosciuti scartati', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { emergencyLayers: ['fires-fwi', 'gone-layer', 'dpc-alerts'] },
    }));
    expect(loadSettings().mapDisplay.emergencyLayers).toEqual(['fires-fwi', 'dpc-alerts']);
  });

  test('valore non-array ignorato → default []', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { emergencyLayers: 'fires-fwi' },
    }));
    expect(loadSettings().mapDisplay.emergencyLayers).toEqual([]);
  });
});
