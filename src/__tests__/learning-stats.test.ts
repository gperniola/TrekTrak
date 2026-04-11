import { describe, expect, test } from '@jest/globals';
import {
  computeSummaryCards,
  computeTrendData,
  computeCategoryStats,
  computeTrendDirection,
} from '../lib/learning-stats';
import type { ValidationSession } from '../lib/types';
import type { QuizSession } from '../lib/quiz';

const makeVSession = (
  date: string,
  results: { field: 'altitude' | 'distance' | 'elevationGain' | 'elevationLoss' | 'azimuth'; status: 'valid' | 'warning' | 'error'; delta: number }[]
): ValidationSession => ({
  date,
  itineraryName: 'Test',
  results: results.map((r) => ({ ...r, tolerance: { strict: 20, loose: 40 } })),
});

const makeQSession = (date: string, average: number): QuizSession => ({
  date,
  questions: [{ type: 'altitude', score: average, userValue: 500, realValue: 500 }],
  average,
});

describe('computeSummaryCards', () => {
  test('returns zeroes with no data', () => {
    const result = computeSummaryCards([], []);
    expect(result.totalVerifications).toBe(0);
    expect(result.totalQuizzes).toBe(0);
    expect(result.lastVerifyValidPercent).toBeNull();
    expect(result.lastQuizAverage).toBeNull();
  });

  test('computes last verify valid percent', () => {
    const sessions = [
      makeVSession('2026-04-10', [
        { field: 'altitude', status: 'valid', delta: 5 },
        { field: 'distance', status: 'error', delta: 50 },
      ]),
    ];
    const result = computeSummaryCards(sessions, []);
    expect(result.totalVerifications).toBe(1);
    expect(result.lastVerifyValidPercent).toBe(50);
  });

  test('computes last quiz average', () => {
    const quizzes = [makeQSession('2026-04-10', 75)];
    const result = computeSummaryCards([], quizzes);
    expect(result.totalQuizzes).toBe(1);
    expect(result.lastQuizAverage).toBe(75);
  });
});

describe('computeTrendDirection', () => {
  test('returns null with insufficient data', () => {
    expect(computeTrendDirection([], [])).toBeNull();
  });

  test('returns up when recent scores improve', () => {
    const old = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 1}`, 50));
    const recent = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 6}T00:00:00Z`, 80));
    const result = computeTrendDirection([], [...old, ...recent]);
    expect(result).toBe('up');
  });

  test('returns down when recent scores drop', () => {
    const old = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 1}`, 80));
    const recent = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 6}T00:00:00Z`, 50));
    const result = computeTrendDirection([], [...old, ...recent]);
    expect(result).toBe('down');
  });

  test('returns stable when change is small', () => {
    const old = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 1}`, 70));
    const recent = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 6}T00:00:00Z`, 73));
    const result = computeTrendDirection([], [...old, ...recent]);
    expect(result).toBe('stable');
  });
});

describe('computeTrendData', () => {
  test('returns empty with no data', () => {
    const result = computeTrendData([], []);
    expect(result).toEqual([]);
  });

  test('creates data points from validation sessions', () => {
    const sessions = [
      makeVSession('2026-04-10T10:00:00Z', [
        { field: 'altitude', status: 'valid', delta: 5 },
        { field: 'distance', status: 'error', delta: 50 },
      ]),
    ];
    const result = computeTrendData(sessions, []);
    expect(result).toHaveLength(1);
    expect(result[0].verifyPercent).toBe(50);
    expect(result[0].quizScore).toBeNull();
  });

  test('creates data points from quiz sessions', () => {
    const quizzes = [makeQSession('2026-04-10T10:00:00Z', 80)];
    const result = computeTrendData([], quizzes);
    expect(result).toHaveLength(1);
    expect(result[0].quizScore).toBe(80);
    expect(result[0].verifyPercent).toBeNull();
  });

  test('merges and sorts by date', () => {
    const v = [makeVSession('2026-04-11T10:00:00Z', [{ field: 'altitude', status: 'valid', delta: 5 }])];
    const q = [makeQSession('2026-04-10T10:00:00Z', 80)];
    const result = computeTrendData(v, q);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-04-10T10:00:00Z');
    expect(result[1].date).toBe('2026-04-11T10:00:00Z');
  });

  test('filters by category', () => {
    const sessions = [
      makeVSession('2026-04-10T10:00:00Z', [
        { field: 'altitude', status: 'valid', delta: 5 },
        { field: 'distance', status: 'error', delta: 50 },
      ]),
    ];
    const result = computeTrendData(sessions, [], 'altitude');
    expect(result).toHaveLength(1);
    expect(result[0].verifyPercent).toBe(100);
  });
});

describe('computeCategoryStats', () => {
  test('returns stats for each category', () => {
    const sessions = [
      makeVSession('2026-04-10', [
        { field: 'altitude', status: 'valid', delta: 10 },
        { field: 'altitude', status: 'error', delta: 80 },
        { field: 'distance', status: 'warning', delta: 0.5 },
      ]),
    ];
    const result = computeCategoryStats(sessions);
    expect(result.altitude.avgDelta).toBe(45);
    expect(result.altitude.validPercent).toBe(50);
    expect(result.altitude.errorPercent).toBe(50);
    expect(result.distance.warningPercent).toBe(100);
  });

  test('returns empty stats when no data', () => {
    const result = computeCategoryStats([]);
    expect(result.altitude.count).toBe(0);
  });
});
