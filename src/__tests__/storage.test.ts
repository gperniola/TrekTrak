import { describe, expect, test, beforeEach } from '@jest/globals';
import {
  saveItinerary,
  loadItineraries,
  deleteItinerary,
  saveSettings,
  loadSettings,
  getStorageUsage,
  isStorageNearLimit,
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
    };
    saveSettings(custom);
    expect(loadSettings().tolerances.altitude).toBe(30);
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
