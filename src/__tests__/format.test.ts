import { describe, expect, test } from '@jest/globals';
import { formatTime, sanitizeFilename } from '../lib/format';

describe('formatTime', () => {
  test('0 minutes = 0h 0m', () => {
    expect(formatTime(0)).toBe('0h 0m');
  });

  test('60 minutes = 1h 0m', () => {
    expect(formatTime(60)).toBe('1h 0m');
  });

  test('90 minutes = 1h 30m', () => {
    expect(formatTime(90)).toBe('1h 30m');
  });

  test('150 minutes = 2h 30m', () => {
    expect(formatTime(150)).toBe('2h 30m');
  });

  test('rounds fractional minutes', () => {
    expect(formatTime(90.7)).toBe('1h 31m');
    expect(formatTime(90.3)).toBe('1h 30m');
  });

  test('negative input returns 0h 0m', () => {
    expect(formatTime(-10)).toBe('0h 0m');
  });

  test('NaN returns 0h 0m', () => {
    expect(formatTime(NaN)).toBe('0h 0m');
  });

  test('Infinity returns 0h 0m', () => {
    expect(formatTime(Infinity)).toBe('0h 0m');
  });
});

describe('sanitizeFilename', () => {
  test('preserves normal filename', () => {
    expect(sanitizeFilename('monte-rosa')).toBe('monte-rosa');
  });

  test('replaces invalid characters', () => {
    expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('file_________name');
  });

  test('strips trailing dots', () => {
    expect(sanitizeFilename('test...')).toBe('test');
  });

  test('truncates to 100 characters', () => {
    const long = 'a'.repeat(150);
    expect(sanitizeFilename(long)).toHaveLength(100);
  });

  test('returns trektrak for empty string', () => {
    expect(sanitizeFilename('')).toBe('trektrak');
  });

  test('returns trektrak when all chars are invalid + trailing dots', () => {
    expect(sanitizeFilename('...')).toBe('trektrak');
  });
});
