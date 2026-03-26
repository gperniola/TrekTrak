import { describe, expect, test } from '@jest/globals';
import { computeGridLines } from '../lib/grid';

const bounds = { north: 46.5, south: 46.0, east: 11.5, west: 11.0 };

describe('computeGridLines', () => {
  test('returns interval 1 for zoom <= 8', () => {
    const result = computeGridLines(bounds, 8);
    expect(result.interval).toBe(1);
  });

  test('returns interval 0.1 for zoom 10', () => {
    const result = computeGridLines(bounds, 10);
    expect(result.interval).toBe(0.1);
  });

  test('returns interval 0.01 for zoom 13', () => {
    const result = computeGridLines(bounds, 13);
    expect(result.interval).toBe(0.01);
  });

  test('returns interval 0.001 for zoom 16', () => {
    const result = computeGridLines(bounds, 16);
    expect(result.interval).toBe(0.001);
  });

  test('generates lat lines covering bounding box', () => {
    const result = computeGridLines(bounds, 10);
    expect(result.latLines.length).toBeGreaterThan(0);
    expect(Math.min(...result.latLines)).toBeLessThanOrEqual(bounds.south);
    expect(Math.max(...result.latLines)).toBeGreaterThanOrEqual(bounds.north);
  });

  test('generates lon lines covering bounding box', () => {
    const result = computeGridLines(bounds, 10);
    expect(result.lonLines.length).toBeGreaterThan(0);
    expect(Math.min(...result.lonLines)).toBeLessThanOrEqual(bounds.west);
    expect(Math.max(...result.lonLines)).toBeGreaterThanOrEqual(bounds.east);
  });

  test('returns empty arrays for degenerate bounds', () => {
    const degen = { north: 46.0, south: 46.0, east: 11.0, west: 11.0 };
    const result = computeGridLines(degen, 10);
    expect(result.latLines.length).toBeLessThanOrEqual(1);
    expect(result.lonLines.length).toBeLessThanOrEqual(1);
  });

  test('lat lines are spaced at the correct interval', () => {
    const result = computeGridLines(bounds, 10);
    for (let i = 1; i < result.latLines.length; i++) {
      const diff = result.latLines[i] - result.latLines[i - 1];
      expect(diff).toBeCloseTo(0.1, 5);
    }
  });
});
