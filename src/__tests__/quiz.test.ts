import { describe, expect, test, beforeEach } from '@jest/globals';
import { azimuthDelta, calculateQuizScore, generateRandomPoint, generateQuestionSet, saveQuizSession, loadQuizHistory } from '../lib/quiz';
import type { QuizSession } from '../lib/quiz';

describe('azimuthDelta', () => {
  test('same angle = 0', () => { expect(azimuthDelta(90, 90)).toBe(0); });
  test('simple difference', () => { expect(azimuthDelta(10, 40)).toBe(30); });
  test('wraps around 360', () => { expect(azimuthDelta(350, 10)).toBe(20); });
  test('wraps the other way', () => { expect(azimuthDelta(10, 350)).toBe(20); });
  test('opposite directions', () => { expect(azimuthDelta(0, 180)).toBe(180); });
});

describe('calculateQuizScore', () => {
  test('exact answer = 100 for altitude', () => { expect(calculateQuizScore(500, 500, 'altitude')).toBe(100); });
  test('half tolerance = 50 for altitude', () => { expect(calculateQuizScore(550, 500, 'altitude')).toBe(50); });
  test('at tolerance = 0 for altitude', () => { expect(calculateQuizScore(600, 500, 'altitude')).toBe(0); });
  test('beyond tolerance = 0 for altitude', () => { expect(calculateQuizScore(700, 500, 'altitude')).toBe(0); });
  test('exact answer = 100 for distance', () => { expect(calculateQuizScore(5, 5, 'distance')).toBe(100); });
  test('10% error on distance = 50', () => { expect(calculateQuizScore(5.5, 5, 'distance')).toBe(50); });
  test('20% error on distance = 0', () => { expect(calculateQuizScore(6, 5, 'distance')).toBe(0); });
  test('exact answer = 100 for azimuth', () => { expect(calculateQuizScore(45, 45, 'azimuth')).toBe(100); });
  test('15° error on azimuth = 50', () => { expect(calculateQuizScore(60, 45, 'azimuth')).toBe(50); });
  test('azimuth wraps correctly (350 vs 10 = 20° delta)', () => { expect(calculateQuizScore(350, 10, 'azimuth')).toBe(33); });
});

describe('generateRandomPoint', () => {
  const bounds = { north: 46.5, south: 46.0, east: 11.5, west: 11.0 };
  test('generates point within bounds with margin', () => {
    const point = generateRandomPoint(bounds, 0.1);
    expect(point.lat).toBeGreaterThanOrEqual(46.0 + 0.05);
    expect(point.lat).toBeLessThanOrEqual(46.5 - 0.05);
    expect(point.lon).toBeGreaterThanOrEqual(11.0 + 0.05);
    expect(point.lon).toBeLessThanOrEqual(11.5 - 0.05);
  });
});

describe('generateQuestionSet', () => {
  const bounds = { north: 46.5, south: 46.0, east: 11.5, west: 11.0 };
  test('generates 5 questions', () => { expect(generateQuestionSet(bounds)).toHaveLength(5); });
  test('includes at least 1 of each type', () => {
    const types = generateQuestionSet(bounds);
    expect(types.filter((t) => t === 'altitude').length).toBeGreaterThanOrEqual(1);
    expect(types.filter((t) => t === 'distance').length).toBeGreaterThanOrEqual(1);
    expect(types.filter((t) => t === 'azimuth').length).toBeGreaterThanOrEqual(1);
  });
});

describe('quiz history persistence', () => {
  beforeEach(() => { localStorage.clear(); });
  test('loadQuizHistory returns empty array when no data', () => { expect(loadQuizHistory()).toEqual([]); });
  test('saveQuizSession then loadQuizHistory roundtrip', () => {
    const session: QuizSession = { date: '2026-03-26T10:00:00Z', questions: [{ type: 'altitude', score: 80, userValue: 520, realValue: 500 }], average: 80 };
    saveQuizSession(session);
    const history = loadQuizHistory();
    expect(history).toHaveLength(1);
    expect(history[0].average).toBe(80);
  });
  test('keeps max 50 sessions (FIFO)', () => {
    for (let i = 0; i < 55; i++) { saveQuizSession({ date: `2026-01-${i}`, questions: [], average: i }); }
    const history = loadQuizHistory();
    expect(history).toHaveLength(50);
    expect(history[0].average).toBe(5);
  });
});
