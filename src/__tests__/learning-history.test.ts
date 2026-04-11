import { describe, expect, test, beforeEach } from '@jest/globals';
import { saveValidationSession, loadValidationHistory, clearValidationHistory } from '../lib/storage';
import type { ValidationSession } from '../lib/types';

beforeEach(() => { localStorage.clear(); });

const makeSession = (date: string, field: 'altitude' | 'distance' = 'altitude'): ValidationSession => ({
  date,
  itineraryName: 'Test',
  results: [{ field, status: 'warning', delta: 30, tolerance: { strict: 20, loose: 40 } }],
});

describe('saveValidationSession and loadValidationHistory', () => {
  test('returns empty array when no data', () => {
    expect(loadValidationHistory()).toEqual([]);
  });

  test('saves and loads a session', () => {
    saveValidationSession(makeSession('2026-04-11T10:00:00Z'));
    const history = loadValidationHistory();
    expect(history).toHaveLength(1);
    expect(history[0].itineraryName).toBe('Test');
  });

  test('appends multiple sessions', () => {
    saveValidationSession(makeSession('2026-04-11T10:00:00Z'));
    saveValidationSession(makeSession('2026-04-11T11:00:00Z'));
    expect(loadValidationHistory()).toHaveLength(2);
  });

  test('keeps max 100 sessions (FIFO)', () => {
    for (let i = 0; i < 105; i++) {
      saveValidationSession(makeSession(`2026-01-01T${String(i).padStart(2, '0')}:00:00Z`));
    }
    const history = loadValidationHistory();
    expect(history).toHaveLength(100);
    expect(history[0].date).toBe('2026-01-01T05:00:00Z');
  });
});

describe('clearValidationHistory', () => {
  test('clears all validation history', () => {
    saveValidationSession(makeSession('2026-04-11T10:00:00Z'));
    clearValidationHistory();
    expect(loadValidationHistory()).toEqual([]);
  });
});
