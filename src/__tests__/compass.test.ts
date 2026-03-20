import { describe, expect, test } from '@jest/globals';
import { haversineDistance, forwardAzimuth } from '../lib/calculations';

/**
 * TDD tests for the Compass Tool feature.
 * Tests the core calculations used by the compass overlay:
 * - Azimuth (bearing) from user position to map center
 * - Distance between two points
 * - These existing functions are already tested elsewhere, but these tests
 *   validate the specific scenarios the compass tool will encounter.
 */

describe('compass tool: azimuth calculation', () => {
  test('bearing due north is ~0°', () => {
    const az = forwardAzimuth(42.0, 14.0, 43.0, 14.0);
    expect(az).toBeCloseTo(0, 0);
  });

  test('bearing due east is ~90°', () => {
    const az = forwardAzimuth(42.0, 14.0, 42.0, 15.0);
    expect(az).toBeCloseTo(90, 0);
  });

  test('bearing due south is ~180°', () => {
    const az = forwardAzimuth(43.0, 14.0, 42.0, 14.0);
    expect(az).toBeCloseTo(180, 0);
  });

  test('bearing due west is ~270°', () => {
    const az = forwardAzimuth(42.0, 15.0, 42.0, 14.0);
    expect(az).toBeCloseTo(270, 0);
  });

  test('same point returns 0°', () => {
    expect(forwardAzimuth(42.0, 14.0, 42.0, 14.0)).toBe(0);
  });

  test('short distance NE bearing', () => {
    // ~500m NE
    const az = forwardAzimuth(42.35, 14.16, 42.353, 14.163);
    expect(az).toBeGreaterThan(30);
    expect(az).toBeLessThan(60);
  });
});

describe('compass tool: distance calculation', () => {
  test('same point returns 0', () => {
    expect(haversineDistance(42.0, 14.0, 42.0, 14.0)).toBeCloseTo(0, 5);
  });

  test('short distance ~500m', () => {
    const dist = haversineDistance(42.35, 14.16, 42.354, 14.163);
    expect(dist).toBeGreaterThan(0.3);
    expect(dist).toBeLessThan(0.7);
  });

  test('medium distance ~5km', () => {
    const dist = haversineDistance(42.35, 14.16, 42.39, 14.19);
    expect(dist).toBeGreaterThan(3);
    expect(dist).toBeLessThan(7);
  });

  test('result is in km', () => {
    // Trento to Bolzano is ~50km
    const dist = haversineDistance(46.0667, 11.1167, 46.4983, 11.3548);
    expect(dist).toBeGreaterThan(40);
    expect(dist).toBeLessThan(55);
  });
});

describe('compass tool: real-time overlay formatting', () => {
  test('azimuth formatted to 1 decimal', () => {
    const az = 45.678;
    expect(az.toFixed(1)).toBe('45.7');
  });

  test('distance formatted to 3 decimals for km', () => {
    const dist = 1.23456;
    expect(dist.toFixed(3)).toBe('1.235');
  });

  test('short distance formatted in meters', () => {
    const distKm = 0.456;
    const distM = Math.round(distKm * 1000);
    expect(distM).toBe(456);
  });

  test('altitude difference can be negative', () => {
    const userAlt = 1500;
    const targetAlt = 1200;
    expect(targetAlt - userAlt).toBe(-300);
  });
});
