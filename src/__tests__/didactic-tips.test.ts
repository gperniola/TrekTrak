import { describe, expect, test } from '@jest/globals';
import { getTip } from '../lib/didactic-tips';

describe('getTip', () => {
  test('returns null when delta is undefined', () => {
    expect(getTip('altitude', undefined, { strict: 20, loose: 40 })).toBeNull();
  });

  test('returns null when delta is within strict tolerance (valid)', () => {
    expect(getTip('altitude', 15, { strict: 20, loose: 40 })).toBeNull();
  });

  test('returns string for warning-level altitude delta', () => {
    const tip = getTip('altitude', 30, { strict: 20, loose: 40 });
    expect(tip).not.toBeNull();
    expect(typeof tip).toBe('string');
    expect(tip!.length).toBeGreaterThan(10);
  });

  test('returns different tip for small vs large altitude error', () => {
    const small = getTip('altitude', 30, { strict: 20, loose: 40 });
    const large = getTip('altitude', 200, { strict: 20, loose: 40 });
    expect(small).not.toEqual(large);
  });

  test('returns tip for distance warning', () => {
    const tip = getTip('distance', 0.5, { strict: 0.32, loose: 0.64 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for distance large error', () => {
    const tip = getTip('distance', 2.0, { strict: 0.32, loose: 0.64 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for azimuth error', () => {
    const tip = getTip('azimuth', 25, { strict: 5, loose: 10 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for elevationGain warning', () => {
    const tip = getTip('elevationGain', 80, { strict: 50, loose: 100 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for elevationLoss large error', () => {
    const tip = getTip('elevationLoss', 300, { strict: 50, loose: 100 });
    expect(tip).not.toBeNull();
  });

  test('elevation gain and loss have the same tips', () => {
    const gain = getTip('elevationGain', 80, { strict: 50, loose: 100 });
    const loss = getTip('elevationLoss', 80, { strict: 50, loose: 100 });
    expect(gain).toEqual(loss);
  });

  test('returns null for NaN delta', () => {
    expect(getTip('altitude', NaN, { strict: 20, loose: 40 })).toBeNull();
  });
});
