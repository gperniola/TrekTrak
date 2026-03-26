import { describe, expect, test } from '@jest/globals';
import {
  haversineDistance,
  forwardAzimuth,
  calculateMunterTime,
  calculateSlope,
  calculateDifficulty,
  azimuthToCardinal,
  interpolatePoints,
  cumulativeElevation,
  slopeColor,
  sampleInterval,
  buildGradientStops,
} from '../lib/calculations';

describe('haversineDistance', () => {
  test('returns 0 for same point', () => {
    expect(haversineDistance(46.0, 11.0, 46.0, 11.0)).toBeCloseTo(0, 1);
  });

  test('calculates known distance (Trento to Bolzano ~55km)', () => {
    const dist = haversineDistance(46.0667, 11.1167, 46.4983, 11.3548);
    expect(dist).toBeGreaterThan(48);
    expect(dist).toBeLessThan(52);
  });

  test('calculates short distance (~1km)', () => {
    const dist = haversineDistance(46.0, 11.0, 46.009, 11.0);
    expect(dist).toBeGreaterThan(0.9);
    expect(dist).toBeLessThan(1.1);
  });
});

describe('forwardAzimuth', () => {
  test('due north is 0 degrees', () => {
    const az = forwardAzimuth(46.0, 11.0, 47.0, 11.0);
    expect(az).toBeCloseTo(0, 0);
  });

  test('due east is 90 degrees', () => {
    const az = forwardAzimuth(46.0, 11.0, 46.0, 12.0);
    expect(az).toBeCloseTo(90, 0);
  });

  test('due south is 180 degrees', () => {
    const az = forwardAzimuth(47.0, 11.0, 46.0, 11.0);
    expect(az).toBeCloseTo(180, 0);
  });

  test('due west is 270 degrees', () => {
    const az = forwardAzimuth(46.0, 12.0, 46.0, 11.0);
    expect(az).toBeCloseTo(270, 0);
  });

  test('same point returns 0', () => {
    expect(forwardAzimuth(46.0, 11.0, 46.0, 11.0)).toBe(0);
  });
});

describe('calculateMunterTime', () => {
  test('flat 4km = 60 minutes', () => {
    expect(calculateMunterTime(4, 0, 0)).toBe(60);
  });

  test('flat 8km = 120 minutes', () => {
    expect(calculateMunterTime(8, 0, 0)).toBe(120);
  });

  test('steep climb dominates: 1km, +400m', () => {
    expect(calculateMunterTime(1, 400, 0)).toBeCloseTo(67.5, 1);
  });

  test('steep descent: 1km, -800m', () => {
    expect(calculateMunterTime(1, 0, 800)).toBeCloseTo(67.5, 1);
  });

  test('mixed elevation uses max of gain/loss vertical time', () => {
    expect(calculateMunterTime(2, 200, 100)).toBeCloseTo(45, 1);
  });

  test('returns 0 for zero distance and zero elevation', () => {
    expect(calculateMunterTime(0, 0, 0)).toBe(0);
  });
});

describe('calculateSlope', () => {
  test('flat terrain = 0%', () => {
    expect(calculateSlope(1, 0, 0)).toBe(0);
  });

  test('100m gain over 1km = 10%', () => {
    expect(calculateSlope(1, 100, 0)).toBeCloseTo(10, 1);
  });

  test('uses max of gain/loss for slope', () => {
    // 200m gain over 2km = 10%
    expect(calculateSlope(2, 200, 50)).toBeCloseTo(10, 1);
  });

  test('descent-only uses loss for slope', () => {
    expect(calculateSlope(1, 0, 100)).toBeCloseTo(10, 1);
  });

  test('zero distance returns 0', () => {
    expect(calculateSlope(0, 100, 0)).toBe(0);
  });
});

describe('calculateDifficulty', () => {
  test('0% slope = T1', () => {
    expect(calculateDifficulty(0)).toBe('T1');
  });

  test('14% slope = T1', () => {
    expect(calculateDifficulty(14)).toBe('T1');
  });

  test('15% slope = T2', () => {
    expect(calculateDifficulty(15)).toBe('T2');
  });

  test('25% slope = T3', () => {
    expect(calculateDifficulty(25)).toBe('T3');
  });

  test('35% slope = T4', () => {
    expect(calculateDifficulty(35)).toBe('T4');
  });

  test('45% slope = T5', () => {
    expect(calculateDifficulty(45)).toBe('T5');
  });

  test('55% slope = T6', () => {
    expect(calculateDifficulty(55)).toBe('T6');
  });

  test('100% slope = T6', () => {
    expect(calculateDifficulty(100)).toBe('T6');
  });
});

describe('azimuthToCardinal', () => {
  test('0 degrees = N', () => {
    expect(azimuthToCardinal(0)).toBe('N');
  });
  test('45 degrees = NE', () => {
    expect(azimuthToCardinal(45)).toBe('NE');
  });
  test('90 degrees = E', () => {
    expect(azimuthToCardinal(90)).toBe('E');
  });
  test('180 degrees = S', () => {
    expect(azimuthToCardinal(180)).toBe('S');
  });
  test('270 degrees = W', () => {
    expect(azimuthToCardinal(270)).toBe('W');
  });
  test('350 degrees = N', () => {
    expect(azimuthToCardinal(350)).toBe('N');
  });
});

describe('interpolatePoints', () => {
  test('returns start and end for count < 2', () => {
    const points = interpolatePoints(42.0, 14.0, 43.0, 15.0, 1);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual([42.0, 14.0]);
    expect(points[1]).toEqual([43.0, 15.0]);
  });

  test('returns exactly numPoints points', () => {
    const points = interpolatePoints(42.0, 14.0, 43.0, 15.0, 5);
    expect(points).toHaveLength(5);
  });

  test('first and last point match input coordinates', () => {
    const points = interpolatePoints(42.0, 14.0, 43.0, 15.0, 10);
    expect(points[0]).toEqual([42.0, 14.0]);
    expect(points[points.length - 1]).toEqual([43.0, 15.0]);
  });

  test('midpoint is correct for 3 points', () => {
    const points = interpolatePoints(40.0, 10.0, 42.0, 12.0, 3);
    expect(points[1][0]).toBeCloseTo(41.0, 5);
    expect(points[1][1]).toBeCloseTo(11.0, 5);
  });
});

describe('cumulativeElevation', () => {
  test('flat profile = 0 gain and 0 loss', () => {
    const { gain, loss } = cumulativeElevation([100, 100, 100, 100]);
    expect(gain).toBe(0);
    expect(loss).toBe(0);
  });

  test('monotonic ascent = only gain', () => {
    const { gain, loss } = cumulativeElevation([100, 150, 200, 250]);
    expect(gain).toBe(150);
    expect(loss).toBe(0);
  });

  test('monotonic descent = only loss', () => {
    const { gain, loss } = cumulativeElevation([250, 200, 150, 100]);
    expect(gain).toBe(0);
    expect(loss).toBe(150);
  });

  test('up-down profile accumulates both gain and loss', () => {
    // 100 → 300 (+200), 300 → 150 (-150), 150 → 200 (+50)
    const { gain, loss } = cumulativeElevation([100, 300, 150, 200]);
    expect(gain).toBe(250);
    expect(loss).toBe(150);
  });

  test('skips null values', () => {
    const { gain, loss } = cumulativeElevation([100, null, 200, null, 150]);
    expect(gain).toBe(100);
    expect(loss).toBe(50);
  });

  test('empty array returns null/null', () => {
    const { gain, loss } = cumulativeElevation([]);
    expect(gain).toBeNull();
    expect(loss).toBeNull();
  });

  test('single value returns null/null', () => {
    const { gain, loss } = cumulativeElevation([500]);
    expect(gain).toBeNull();
    expect(loss).toBeNull();
  });

  test('all nulls returns null/null', () => {
    const { gain, loss } = cumulativeElevation([null, null, null]);
    expect(gain).toBeNull();
    expect(loss).toBeNull();
  });
});

describe('slopeColor', () => {
  test('flat terrain returns green', () => {
    expect(slopeColor(0)).toBe('#4ade80');
    expect(slopeColor(5)).toBe('#4ade80');
    expect(slopeColor(9)).toBe('#4ade80');
  });

  test('moderate slope returns yellow (with 0.5% epsilon)', () => {
    expect(slopeColor(9.5)).toBe('#facc15');
    expect(slopeColor(10)).toBe('#facc15');
    expect(slopeColor(15)).toBe('#facc15');
    expect(slopeColor(19)).toBe('#facc15');
  });

  test('steep slope returns orange (with 0.5% epsilon)', () => {
    expect(slopeColor(19.5)).toBe('#fb923c');
    expect(slopeColor(20)).toBe('#fb923c');
    expect(slopeColor(25)).toBe('#fb923c');
    expect(slopeColor(29)).toBe('#fb923c');
  });

  test('very steep slope returns red (with 0.5% epsilon)', () => {
    expect(slopeColor(29.5)).toBe('#ef4444');
    expect(slopeColor(30)).toBe('#ef4444');
    expect(slopeColor(50)).toBe('#ef4444');
    expect(slopeColor(100)).toBe('#ef4444');
  });

  test('negative slope uses absolute value', () => {
    expect(slopeColor(-5)).toBe('#4ade80');
    expect(slopeColor(-15)).toBe('#facc15');
    expect(slopeColor(-25)).toBe('#fb923c');
    expect(slopeColor(-100)).toBe('#ef4444');
  });
});

describe('sampleInterval', () => {
  test('returns 20 for distances <= 500m', () => {
    expect(sampleInterval(0)).toBe(20);
    expect(sampleInterval(250)).toBe(20);
    expect(sampleInterval(500)).toBe(20);
  });

  test('returns 50 for distances > 500m', () => {
    expect(sampleInterval(501)).toBe(50);
    expect(sampleInterval(1000)).toBe(50);
    expect(sampleInterval(10000)).toBe(50);
  });

  test('uses userInterval when provided and positive', () => {
    expect(sampleInterval(5000, 100)).toBe(100);
    expect(sampleInterval(5000, 200)).toBe(200);
    expect(sampleInterval(100, 20)).toBe(20);
  });

  test('falls back to heuristic for invalid userInterval', () => {
    expect(sampleInterval(5000, 0)).toBe(50);
    expect(sampleInterval(5000, -10)).toBe(50);
    expect(sampleInterval(300, undefined)).toBe(20);
  });
});

describe('buildGradientStops', () => {
  test('returns empty array for fewer than 2 points', () => {
    expect(buildGradientStops([{ distance: 0, altitude: 100 }], 1)).toEqual([]);
    expect(buildGradientStops([], 1)).toEqual([]);
  });

  test('returns empty array when totalDistance is 0', () => {
    const data = [
      { distance: 0, altitude: 100 },
      { distance: 0, altitude: 200 },
    ];
    expect(buildGradientStops(data, 0)).toEqual([]);
  });

  test('flat terrain produces green stops', () => {
    const data = [
      { distance: 0, altitude: 1000 },
      { distance: 1, altitude: 1000 },
    ];
    const stops = buildGradientStops(data, 1);
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      expect(stop.color).toBe('#4ade80');
    }
  });

  test('steep ascent produces red stops', () => {
    // 500m gain over 1km = 50% slope => red
    const data = [
      { distance: 0, altitude: 1000 },
      { distance: 1, altitude: 1500 },
    ];
    const stops = buildGradientStops(data, 1);
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      expect(stop.color).toBe('#ef4444');
    }
  });

  test('color transitions produce stops with multiple colors', () => {
    const data = [
      { distance: 0, altitude: 1000 },
      { distance: 1, altitude: 1000 },   // flat = green
      { distance: 2, altitude: 1500 },   // 500m/1km = 50% = red
    ];
    const stops = buildGradientStops(data, 2);
    const colors = new Set(stops.map((s) => s.color));
    expect(colors.has('#4ade80')).toBe(true);
    expect(colors.has('#ef4444')).toBe(true);
  });

  test('adjacent same-color segments are deduplicated', () => {
    const data = [
      { distance: 0, altitude: 1000 },
      { distance: 1, altitude: 1000 },
      { distance: 2, altitude: 1000 },
    ];
    const stops = buildGradientStops(data, 2);
    // First segment: start + end = 2, second: only end = 1 (dedup)
    expect(stops).toHaveLength(3);
  });

  test('uniform slope produces consistent color across all segments', () => {
    // Simulate 10 points over 0.2km with uniform 5m/segment gain (~22.7% slope = orange)
    const numPoints = 10;
    const distanceKm = 0.2;
    const data = Array.from({ length: numPoints }, (_, i) => ({
      distance: Math.round((i / (numPoints - 1)) * distanceKm * 10000) / 10000,
      altitude: 500 + i * 5,
    }));
    const totalDistance = data[data.length - 1].distance;
    const stops = buildGradientStops(data, totalDistance);
    // All segments should be orange (#fb923c) — no yellow artifacts from rounding
    for (const stop of stops) {
      expect(stop.color).toBe('#fb923c');
    }
  });

  test('DEM noise on uniform slope does not produce wrong colors', () => {
    // 20 points over 2km, uniform 15% slope + ±4m noise
    // Without smoothing, noise pushes some segments to orange (20%+)
    // With smoothing, all should stay yellow (10-20%)
    const n = 20;
    const dKm = 2.0;
    const noise = [0, 3, -2, 4, -1, 2, -3, 1, -4, 2, 3, -2, 1, -3, 4, -1, 2, -2, 3, -1];
    const data = Array.from({ length: n }, (_, i) => ({
      distance: Math.round((i / (n - 1)) * dKm * 10000) / 10000,
      altitude: 500 + (0.15 * (i / (n - 1)) * dKm * 1000) + noise[i],
    }));
    const totalDistance = data[data.length - 1].distance;
    const stops = buildGradientStops(data, totalDistance);
    // After smoothing, should all be yellow (#facc15) — no orange artifacts
    for (const stop of stops) {
      expect(stop.color).toBe('#facc15');
    }
  });

  test('offsets are clamped to 0-100%', () => {
    const data = [
      { distance: 0, altitude: 1000 },
      { distance: 5, altitude: 1000 },
    ];
    const stops = buildGradientStops(data, 5);
    for (const stop of stops) {
      const pct = parseFloat(stop.offset);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });
});
