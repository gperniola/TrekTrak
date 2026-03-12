import { describe, expect, test } from '@jest/globals';
import { validateValue, validateAzimuth, determineStatus, percentageTolerance } from '../lib/validation';

describe('determineStatus', () => {
  test('within strict tolerance = valid', () => {
    expect(determineStatus(100, 110, 20, 40)).toBe('valid');
  });

  test('within loose tolerance = warning', () => {
    expect(determineStatus(100, 130, 20, 40)).toBe('warning');
  });

  test('beyond loose tolerance = error', () => {
    expect(determineStatus(100, 150, 20, 40)).toBe('error');
  });

  test('exact match = valid', () => {
    expect(determineStatus(100, 100, 20, 40)).toBe('valid');
  });
});

describe('validateValue (absolute tolerance)', () => {
  test('altitude within strict tolerance', () => {
    const result = validateValue(1450, 1460, { strict: 20, loose: 40 });
    expect(result.status).toBe('valid');
    expect(result.delta).toBe(10);
  });

  test('altitude within loose tolerance', () => {
    const result = validateValue(1450, 1485, { strict: 20, loose: 40 });
    expect(result.status).toBe('warning');
  });

  test('altitude beyond loose tolerance', () => {
    const result = validateValue(1450, 1500, { strict: 20, loose: 40 });
    expect(result.status).toBe('error');
    expect(result.delta).toBe(50);
  });
});

describe('validateValue (percentage tolerance)', () => {
  test('distance 10% tolerance: 3.0 vs 3.2 = valid', () => {
    const result = validateValue(3.0, 3.2, { strict: 0.32, loose: 0.64 });
    expect(result.status).toBe('valid');
  });
});

describe('validateAzimuth (circular wraparound)', () => {
  test('5 vs 355 = delta 10 (wraparound)', () => {
    const result = validateAzimuth(5, 355, { strict: 15, loose: 30 });
    expect(result.status).toBe('valid');
    expect(result.delta).toBe(10);
  });

  test('355 vs 5 = delta 10 (wraparound)', () => {
    const result = validateAzimuth(355, 5, { strict: 15, loose: 30 });
    expect(result.status).toBe('valid');
    expect(result.delta).toBe(10);
  });

  test('0 vs 180 = delta 180 (max separation)', () => {
    const result = validateAzimuth(0, 180, { strict: 5, loose: 10 });
    expect(result.status).toBe('error');
    expect(result.delta).toBe(180);
  });

  test('same value = valid', () => {
    const result = validateAzimuth(90, 90, { strict: 5, loose: 10 });
    expect(result.status).toBe('valid');
    expect(result.delta).toBe(0);
  });

  test('within loose but not strict = warning', () => {
    const result = validateAzimuth(10, 355, { strict: 5, loose: 20 });
    expect(result.status).toBe('warning');
    expect(result.delta).toBe(15);
  });
});

describe('percentageTolerance', () => {
  test('calculates strict and loose from percentage', () => {
    const tol = percentageTolerance(100, 10);
    expect(tol.strict).toBe(10);
    expect(tol.loose).toBe(20);
  });

  test('zero reference returns zero tolerances', () => {
    const tol = percentageTolerance(0, 10);
    expect(tol.strict).toBe(0);
    expect(tol.loose).toBe(0);
  });

  test('small reference returns proportionally small tolerances', () => {
    const tol = percentageTolerance(1, 10);
    expect(tol.strict).toBeCloseTo(0.1, 5);
    expect(tol.loose).toBeCloseTo(0.2, 5);
  });
});
