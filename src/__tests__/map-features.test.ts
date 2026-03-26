import { describe, expect, test, beforeEach } from '@jest/globals';
import {
  slopeColor,
  sampleInterval,
  buildGradientStops,
  smoothAltitudes,
  interpolatePoints,
  cumulativeElevation,
} from '../lib/calculations';
import {
  saveSettings,
  loadSettings,
} from '../lib/storage';
import type { AppSettings } from '../lib/types';
import { DEFAULT_MAP_DISPLAY, DEFAULT_TOLERANCES } from '../lib/types';

// --- Mock localStorage ---
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

beforeEach(() => {
  localStorageMock.clear();
});

// ============================================================
// COLORED PATH: slope color grouping for map polylines
// ============================================================
describe('colored path: slope grouping', () => {
  test('uniform slope produces a single color group', () => {
    // 10 points, all going uphill at ~25% slope = orange
    const data = Array.from({ length: 10 }, (_, i) => ({
      distance: i * 0.1,
      altitude: 500 + i * 25,
    }));
    const stops = buildGradientStops(data, 0.9);
    const colors = new Set(stops.map((s) => s.color));
    expect(colors.size).toBe(1);
    expect(colors.has('#fb923c')).toBe(true); // orange
  });

  test('flat then steep terrain produces two color groups', () => {
    const data = [
      { distance: 0, altitude: 500 },
      { distance: 0.5, altitude: 500 },    // flat = green
      { distance: 0.6, altitude: 500 },    // still flat
      { distance: 0.7, altitude: 540 },    // 40m/100m = 40% = red
      { distance: 0.8, altitude: 580 },    // still steep
    ];
    const stops = buildGradientStops(data, 0.8);
    const colors = new Set(stops.map((s) => s.color));
    expect(colors.has('#4ade80')).toBe(true); // green (flat)
    expect(colors.has('#ef4444')).toBe(true); // red (steep)
  });
});

// ============================================================
// SMOOTHING: DEM noise elimination
// ============================================================
describe('smoothAltitudes', () => {
  test('returns same length as input', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({
      distance: i * 0.1,
      altitude: 500 + i * 10,
    }));
    const smoothed = smoothAltitudes(data);
    expect(smoothed).toHaveLength(20);
  });

  test('preserves first and last values', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      distance: i * 0.1,
      altitude: 500 + i * 10 + (i % 2 === 0 ? 3 : -3),
    }));
    const smoothed = smoothAltitudes(data);
    expect(smoothed[0]).toBe(data[0].altitude);
    expect(smoothed[smoothed.length - 1]).toBe(data[data.length - 1].altitude);
  });

  test('reduces noise on uniform slope', () => {
    const noise = [0, 5, -3, 4, -2, 3, -4, 2, -5, 1];
    const data = noise.map((n, i) => ({
      distance: i * 0.1,
      altitude: 500 + i * 10 + n,
    }));
    const smoothed = smoothAltitudes(data);
    // Check that the smoothed middle values are closer to the true line
    for (let i = 2; i < 8; i++) {
      const trueAlt = 500 + i * 10;
      const rawError = Math.abs(data[i].altitude - trueAlt);
      const smoothedError = Math.abs(smoothed[i] - trueAlt);
      expect(smoothedError).toBeLessThanOrEqual(rawError + 1); // smoothed should be closer or equal
    }
  });

  test('handles 4 or fewer points without error', () => {
    const data = [
      { distance: 0, altitude: 500 },
      { distance: 1, altitude: 600 },
    ];
    const smoothed = smoothAltitudes(data);
    expect(smoothed).toEqual([500, 600]);
  });
});

// ============================================================
// SAMPLE INTERVAL AND MAX POINTS
// ============================================================
describe('sample interval and max points', () => {
  test('short legs (<=500m) use 20m interval', () => {
    expect(sampleInterval(100)).toBe(20);
    expect(sampleInterval(500)).toBe(20);
  });

  test('long legs (>500m) use 50m interval', () => {
    expect(sampleInterval(501)).toBe(50);
    expect(sampleInterval(5000)).toBe(50);
  });

  test('5km leg produces correct uncapped sample points', () => {
    const distM = 5000;
    const numPoints = Math.max(2, Math.ceil(distM / sampleInterval(distM)));
    // 5000m / 50m = 100 points — no longer capped at 95
    expect(numPoints).toBe(100);
    expect(numPoints).toBeGreaterThanOrEqual(2);
  });

  test('10km leg produces correct uncapped sample points', () => {
    const distM = 10000;
    const numPoints = Math.max(2, Math.ceil(distM / sampleInterval(distM)));
    // 10000m / 50m = 200 points — handled by multi-batch fetching
    expect(numPoints).toBe(200);
  });
});

// ============================================================
// MAP DISPLAY SETTINGS PERSISTENCE
// ============================================================
describe('mapDisplay settings persistence', () => {
  test('defaults to coloredPath=false', () => {
    const settings = loadSettings();
    expect(settings.mapDisplay.coloredPath).toBe(false);
  });

  test('saves and loads coloredPath=true', () => {
    const settings: AppSettings = {
      tolerances: { ...DEFAULT_TOLERANCES },
      mapDisplay: { coloredPath: true, trailRouting: false, sampleInterval: 50, baseMap: 'thunderforest-outdoors', showHikingTrails: false, showCoordinateGrid: false },
    };
    saveSettings(settings);
    const loaded = loadSettings();
    expect(loaded.mapDisplay.coloredPath).toBe(true);
  });

  test('old localStorage without mapDisplay returns defaults', () => {
    // Simulate old format: only tolerances, no mapDisplay
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: { altitude: 30, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
    }));
    const loaded = loadSettings();
    expect(loaded.mapDisplay.coloredPath).toBe(false); // default
    expect(loaded.tolerances.altitude).toBe(30); // preserved
  });

  test('corrupt mapDisplay value returns defaults', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
      mapDisplay: 'not-an-object',
    }));
    const loaded = loadSettings();
    expect(loaded.mapDisplay.coloredPath).toBe(false);
  });

  test('invalid field types in mapDisplay are filtered', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
      mapDisplay: { coloredPath: 'yes', extraField: 42 },
    }));
    const loaded = loadSettings();
    expect(loaded.mapDisplay.coloredPath).toBe(false); // "yes" is not boolean, falls back to default
    expect(loaded.mapDisplay).not.toHaveProperty('extraField');
  });

  test('corrupt JSON returns full defaults', () => {
    localStorage.setItem('trektrak_settings', '{broken json!!!');
    const loaded = loadSettings();
    expect(loaded.tolerances.altitude).toBe(DEFAULT_TOLERANCES.altitude);
    expect(loaded.mapDisplay.coloredPath).toBe(DEFAULT_MAP_DISPLAY.coloredPath);
  });

  test('toggle preserves tolerances', () => {
    const initial: AppSettings = {
      tolerances: { altitude: 30, coordinates: 0.002, distance: 15, azimuth: 10, elevationDelta: 20 },
      mapDisplay: { coloredPath: false, trailRouting: false, sampleInterval: 50, baseMap: 'thunderforest-outdoors', showHikingTrails: false, showCoordinateGrid: false },
    };
    saveSettings(initial);

    // Simulate toggle
    const toggled: AppSettings = {
      ...initial,
      mapDisplay: { ...initial.mapDisplay, coloredPath: true },
    };
    saveSettings(toggled);

    const loaded = loadSettings();
    expect(loaded.mapDisplay.coloredPath).toBe(true);
    expect(loaded.tolerances.altitude).toBe(30); // not overwritten
    expect(loaded.tolerances.distance).toBe(15);
  });
});

// ============================================================
// CUMULATIVE ELEVATION with profile sampling
// ============================================================
describe('cumulative elevation with sampled profile', () => {
  test('symmetric mountain: D+ equals D- when endpoints match', () => {
    // Simulate A(500m) → peak(600m) → B(500m) with 11 sample points
    const elevations = [500, 520, 540, 560, 580, 600, 580, 560, 540, 520, 500];
    const { gain, loss } = cumulativeElevation(elevations);
    expect(gain).toBe(100);
    expect(loss).toBe(100);
  });

  test('flat terrain returns D+=0 D-=0', () => {
    const elevations = [500, 500, 500, 500, 500];
    const { gain, loss } = cumulativeElevation(elevations);
    expect(gain).toBe(0);
    expect(loss).toBe(0);
  });

  test('noisy data still produces gain - loss = endpoint difference', () => {
    // Mathematical identity: gain - loss = last - first
    const elevations = [500, 510, 505, 520, 515, 530, 540, 535, 550, 560];
    const { gain, loss } = cumulativeElevation(elevations);
    expect(gain! - loss!).toBe(560 - 500); // = 60
  });
});

// ============================================================
// INTERPOLATE POINTS for leg sampling
// ============================================================
describe('interpolatePoints for leg sampling', () => {
  test('produces correct number of points', () => {
    const points = interpolatePoints(42.0, 14.0, 43.0, 15.0, 20);
    expect(points).toHaveLength(20);
  });

  test('first and last points are the leg endpoints', () => {
    const points = interpolatePoints(42.0, 14.0, 43.0, 15.0, 10);
    expect(points[0]).toEqual([42.0, 14.0]);
    expect(points[9]).toEqual([43.0, 15.0]);
  });

  test('points are evenly spaced', () => {
    const points = interpolatePoints(42.0, 14.0, 43.0, 15.0, 5);
    for (let i = 1; i < points.length; i++) {
      const dLat = points[i][0] - points[i - 1][0];
      expect(dLat).toBeCloseTo(0.25, 10);
    }
  });
});
