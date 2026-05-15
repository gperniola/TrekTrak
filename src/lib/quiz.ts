import { KEYS } from './storage';
import type { HikingPOI } from './overpass-api';

export type QuestionType = 'altitude' | 'distance' | 'azimuth';

export interface QuizPoint { lat: number; lon: number; }

export interface QuizQuestion {
  type: QuestionType;
  pointA: QuizPoint;
  pointB?: QuizPoint;
  realValue: number;
  unit: string;
  prompt: string;
}

export interface QuizAnswer {
  type: QuestionType;
  score: number;
  userValue: number;
  realValue: number;
}

export interface QuizSession {
  date: string;
  questions: QuizAnswer[];
  average: number;
}


const MAX_SESSIONS = 50;

const TOLERANCES: Record<QuestionType, number> = {
  altitude: 100,
  distance: 20,
  azimuth: 30,
};

export function azimuthDelta(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

/**
 * Score curve (piecewise linear, more lenient than pure linear):
 *
 *   ratio = delta / tolerance
 *   ratio = 0      → 100  (perfect)
 *   ratio = 0.5    → 75
 *   ratio = 1.0    → 50   (exactly at tolerance — still passing)
 *   ratio = 2.0    → 10   (would have been 0 with linear; now keeps a hint of credit)
 *   ratio = 4.0    → 0    (clearly wrong)
 *
 * Rationale: a beginner whose stima is 42% off (Persona D test case) was getting 0/100
 * with the linear curve. The clement curve gives ~6/100 in the same spot, which is
 * still low but not punishingly absolute. Encourages continued play.
 */
export function calculateQuizScore(userValue: number, realValue: number, type: QuestionType): number {
  let delta: number;
  let tolerance: number;

  if (type === 'azimuth') {
    delta = azimuthDelta(userValue, realValue);
    tolerance = TOLERANCES.azimuth;
  } else if (type === 'distance') {
    delta = Math.abs(userValue - realValue);
    tolerance = (TOLERANCES.distance / 100) * Math.abs(realValue);
  } else {
    delta = Math.abs(userValue - realValue);
    tolerance = TOLERANCES.altitude;
  }

  if (tolerance <= 0) return delta === 0 ? 100 : 0;
  const ratio = delta / tolerance;
  if (ratio <= 1) return Math.round(100 - 50 * ratio);       // 100 → 50
  if (ratio <= 2) return Math.round(50 - 40 * (ratio - 1));  // 50 → 10
  if (ratio <= 4) return Math.round(10 - 5 * (ratio - 2));   // 10 → 0
  return 0;
}

export function generateRandomPoint(
  bounds: { north: number; south: number; east: number; west: number },
  margin: number
): QuizPoint {
  const latRange = bounds.north - bounds.south;
  const lonRange = bounds.east - bounds.west;
  const mLat = latRange * margin;
  const mLon = lonRange * margin;
  const lat = bounds.south + mLat + Math.random() * (latRange - 2 * mLat);
  const lon = bounds.west + mLon + Math.random() * (lonRange - 2 * mLon);
  return { lat, lon };
}

export function pickQuizPoint(
  bounds: { north: number; south: number; east: number; west: number },
  pois: HikingPOI[]
): QuizPoint | null {
  const inBounds = pois.filter(
    (p) => p.lat >= bounds.south && p.lat <= bounds.north &&
           p.lon >= bounds.west && p.lon <= bounds.east
  );
  if (inBounds.length === 0) return null;
  const pick = inBounds[Math.floor(Math.random() * inBounds.length)];
  return { lat: pick.lat, lon: pick.lon };
}

export function generateQuestionSet(
  _bounds: { north: number; south: number; east: number; west: number }
): QuestionType[] {
  const types: QuestionType[] = ['altitude', 'distance', 'azimuth'];
  const set: QuestionType[] = [...types];
  for (let i = 0; i < 2; i++) {
    set.push(types[Math.floor(Math.random() * types.length)]);
  }
  for (let i = set.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [set[i], set[j]] = [set[j], set[i]];
  }
  return set;
}

export function saveQuizSession(session: QuizSession): void {
  try {
    const history = loadQuizHistory();
    history.push(session);
    const trimmed = history.length > MAX_SESSIONS ? history.slice(history.length - MAX_SESSIONS) : history;
    localStorage.setItem(KEYS.quizHistory, JSON.stringify(trimmed));
  } catch { /* storage write failed */ }
}

const VALID_QUIZ_TYPES = new Set<QuestionType>(['altitude', 'distance', 'azimuth']);

function isValidQuizAnswer(item: unknown): item is QuizAnswer {
  if (item == null || typeof item !== 'object') return false;
  const a = item as Record<string, unknown>;
  return (
    VALID_QUIZ_TYPES.has(a.type as QuestionType) &&
    typeof a.score === 'number' && Number.isFinite(a.score) &&
    typeof a.userValue === 'number' && Number.isFinite(a.userValue) &&
    typeof a.realValue === 'number' && Number.isFinite(a.realValue)
  );
}

function isValidQuizSession(item: unknown): item is QuizSession {
  if (item == null || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;
  if (typeof s.date !== 'string') return false;
  if (typeof s.average !== 'number' || !Number.isFinite(s.average)) return false;
  if (!Array.isArray(s.questions)) return false;
  return s.questions.every(isValidQuizAnswer);
}

export function loadQuizHistory(): QuizSession[] {
  try {
    const raw = localStorage.getItem(KEYS.quizHistory);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidQuizSession);
  } catch { return []; }
}

export function clearQuizHistory(): void {
  try {
    localStorage.removeItem(KEYS.quizHistory);
  } catch {
    // storage unavailable
  }
}
