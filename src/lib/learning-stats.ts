import type { ValidationSession, ValidationSessionResult } from './types';
import type { QuizSession, QuestionType } from './quiz';

export type CategoryField = ValidationSessionResult['field'];
export type TrendDirection = 'up' | 'down' | 'stable';

export interface SummaryCards {
  totalVerifications: number;
  totalQuizzes: number;
  lastVerifyValidPercent: number | null;
  lastQuizAverage: number | null;
}

export interface TrendDataPoint {
  date: string;
  verifyPercent: number | null;
  quizScore: number | null;
}

export interface CategoryStat {
  count: number;
  avgDelta: number;
  validPercent: number;
  warningPercent: number;
  errorPercent: number;
  recentDeltas: number[];
}

const ALL_CATEGORIES: CategoryField[] = ['altitude', 'distance', 'elevationGain', 'elevationLoss', 'azimuth'];

const QUIZ_CATEGORY_MAP: Record<QuestionType, CategoryField> = {
  altitude: 'altitude',
  distance: 'distance',
  azimuth: 'azimuth',
};

function validPercent(results: Pick<ValidationSessionResult, 'status'>[]): number {
  if (results.length === 0) return 0;
  const valid = results.filter((r) => r.status === 'valid').length;
  return Math.round((valid / results.length) * 100);
}

export function computeSummaryCards(
  validations: ValidationSession[],
  quizzes: QuizSession[],
): SummaryCards {
  const lastV = validations.length > 0 ? validations[validations.length - 1] : null;
  const lastQ = quizzes.length > 0 ? quizzes[quizzes.length - 1] : null;

  return {
    totalVerifications: validations.length,
    totalQuizzes: quizzes.length,
    lastVerifyValidPercent: lastV ? validPercent(lastV.results) : null,
    lastQuizAverage: lastQ ? lastQ.average : null,
  };
}

export function computeTrendDirection(
  validations: ValidationSession[],
  quizzes: QuizSession[],
): TrendDirection | null {
  const scores: { date: string; score: number }[] = [];
  for (const v of validations) {
    scores.push({ date: v.date, score: validPercent(v.results) });
  }
  for (const q of quizzes) {
    scores.push({ date: q.date, score: q.average });
  }
  scores.sort((a, b) => a.date.localeCompare(b.date));

  if (scores.length < 10) return null;

  const recent5 = scores.slice(-5);
  const prev5 = scores.slice(-10, -5);
  const avgRecent = recent5.reduce((s, x) => s + x.score, 0) / 5;
  const avgPrev = prev5.reduce((s, x) => s + x.score, 0) / 5;
  const diff = avgRecent - avgPrev;

  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

export function computeTrendData(
  validations: ValidationSession[],
  quizzes: QuizSession[],
  categoryFilter?: CategoryField,
): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];

  for (const v of validations) {
    const filtered = categoryFilter
      ? v.results.filter((r) => r.field === categoryFilter)
      : v.results;
    if (categoryFilter && filtered.length === 0) continue;
    points.push({
      date: v.date,
      verifyPercent: validPercent(filtered),
      quizScore: null,
    });
  }

  const quizField = categoryFilter
    ? Object.entries(QUIZ_CATEGORY_MAP).find(([, v]) => v === categoryFilter)?.[0] as QuestionType | undefined
    : undefined;
  const includeQuiz = !categoryFilter || quizField != null;

  if (includeQuiz) {
    for (const q of quizzes) {
      const filtered = categoryFilter && quizField
        ? q.questions.filter((a) => a.type === quizField)
        : q.questions;
      if (filtered.length === 0) continue;
      const avg = Math.round(filtered.reduce((s, a) => s + a.score, 0) / filtered.length);
      points.push({
        date: q.date,
        verifyPercent: null,
        quizScore: avg,
      });
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

export function computeCategoryStats(
  validations: ValidationSession[],
): Record<CategoryField, CategoryStat> {
  const stats = {} as Record<CategoryField, CategoryStat>;
  for (const cat of ALL_CATEGORIES) {
    stats[cat] = { count: 0, avgDelta: 0, validPercent: 0, warningPercent: 0, errorPercent: 0, recentDeltas: [] };
  }

  const allResults: Record<CategoryField, ValidationSessionResult[]> = {} as Record<CategoryField, ValidationSessionResult[]>;
  for (const cat of ALL_CATEGORIES) allResults[cat] = [];

  for (const session of validations) {
    for (const r of session.results) {
      allResults[r.field]?.push(r);
    }
  }

  for (const cat of ALL_CATEGORIES) {
    const results = allResults[cat];
    const count = results.length;
    stats[cat].count = count;
    if (count === 0) continue;

    stats[cat].avgDelta = Math.round(results.reduce((s, r) => s + r.delta, 0) / count);
    stats[cat].validPercent = Math.round((results.filter((r) => r.status === 'valid').length / count) * 100);
    stats[cat].warningPercent = Math.round((results.filter((r) => r.status === 'warning').length / count) * 100);
    stats[cat].errorPercent = Math.round((results.filter((r) => r.status === 'error').length / count) * 100);

    const bySession = new Map<string, number[]>();
    for (const session of validations) {
      const matching = session.results.filter((r) => r.field === cat);
      if (matching.length > 0) {
        const avg = matching.reduce((s, r) => s + r.delta, 0) / matching.length;
        bySession.set(session.date, [...(bySession.get(session.date) ?? []), avg]);
      }
    }
    const sessionAvgs = [...bySession.values()].map((arr) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length));
    stats[cat].recentDeltas = sessionAvgs.slice(-10);
  }

  return stats;
}
