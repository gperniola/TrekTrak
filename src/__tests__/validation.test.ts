import { describe, expect, test } from '@jest/globals';
import { validateValue, determineStatus, percentageTolerance } from '../lib/validation';

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

describe('percentageTolerance', () => {
  test('calculates strict and loose from percentage', () => {
    const tol = percentageTolerance(100, 10);
    expect(tol.strict).toBe(10);
    expect(tol.loose).toBe(20);
  });
});
