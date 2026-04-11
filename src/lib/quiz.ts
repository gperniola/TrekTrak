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
  return Math.max(0, Math.round(100 * (1 - delta / tolerance)));
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

export function loadQuizHistory(): QuizSession[] {
  try {
    const raw = localStorage.getItem(KEYS.quizHistory);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch { return []; }
}

export function clearQuizHistory(): void {
  try {
    localStorage.removeItem(KEYS.quizHistory);
  } catch {
    // storage unavailable
  }
}
