import { describe, expect, test } from '@jest/globals';
import {
  computeSummaryCards,
  computeTrendData,
  computeCategoryStats,
  computeTrendDirection,
  staMigliorando,
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

/**
 * TASK-20 D. Il rinforzo positivo si appoggia a `recentDeltas`, che pero' arrotondava
 * ogni media di sessione all'intero — lo stesso difetto gia' corretto su `avgDelta`. Per
 * la categoria «distanza», misurata in km, significava che ogni errore sotto i 500 m
 * diventava 0: l'istogramma delle ultime sessioni era una fila di barre uguali e la
 * tendenza era illeggibile, qualunque fosse il miglioramento vero.
 */
describe('gli scarti per sessione non sono arrotondati', () => {
  const sessione = (data: string, delta: number): ValidationSession => ({
    date: data,
    itineraryName: 'x',
    results: [{ field: 'distance', status: 'warning', delta, tolerance: { strict: 0.1, loose: 0.3 } }],
  });

  test('un miglioramento sotto il chilometro resta visibile', () => {
    const storia = [sessione('2026-01-01', 0.8), sessione('2026-01-02', 0.4), sessione('2026-01-03', 0.2)];
    const deltas = computeCategoryStats(storia).distance.recentDeltas;
    expect(deltas).toEqual([0.8, 0.4, 0.2]);
    // prima dell'arrotondamento tolto sarebbero stati [1, 0, 0]
    expect(deltas.every((d) => Number.isInteger(d))).toBe(false);
  });
});

/**
 * «Stai migliorando» detto sul rumore e' una frase falsa: serve abbastanza storia e un
 * calo che si vede. E si dice solo il verso positivo — comunicare a qualcuno che sta
 * peggiorando, subito dopo che ha sbagliato un valore, non lo aiuta a leggere una carta.
 */
describe('staMigliorando', () => {
  test('con poche sessioni non si pronuncia', () => {
    expect(staMigliorando([10, 9, 8, 7, 6])).toBe(false);
    expect(staMigliorando([])).toBe(false);
  });

  test('un calo netto sulle ultime tre e un miglioramento', () => {
    expect(staMigliorando([10, 10, 10, 4, 3, 2])).toBe(true);
  });

  test('un calo minimo non basta', () => {
    // media prima 10, media dopo 9,5: sotto la soglia del quinto
    expect(staMigliorando([10, 10, 10, 9.5, 9.5, 9.5])).toBe(false);
  });

  test('se si peggiora non si dice niente', () => {
    expect(staMigliorando([2, 2, 2, 9, 9, 9])).toBe(false);
  });

  test('partendo da zero errori non si migliora', () => {
    expect(staMigliorando([0, 0, 0, 0, 0, 0])).toBe(false);
  });

  test('guarda le ultime sei, non tutta la storia', () => {
    // le prime tre sono pessime ma vecchie: contano le due terzine finali
    expect(staMigliorando([99, 99, 99, 5, 5, 5, 1, 1, 1])).toBe(true);
  });
});
