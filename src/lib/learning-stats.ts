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

    /*
     * Media NON arrotondata: l'unita' cambia da categoria a categoria, e arrotondando
     * qui la distanza (che e' in km) ogni errore sotto i 500 m diventava "Δ 0", cioe'
     * "perfetto". Un errore reale di 761 m si leggeva "Δ 1". L'arrotondamento giusto
     * lo decide chi stampa, che sa in che unita' sta scrivendo.
     */
    stats[cat].avgDelta = results.reduce((s, r) => s + r.delta, 0) / count;
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
    /*
     * NON arrotondati, per la stessa ragione di `avgDelta` qui sopra: l'unita' cambia da
     * categoria a categoria, e `Math.round` su una distanza in km faceva diventare 0 ogni
     * errore sotto i 500 m. Per la categoria «distanza» significava che l'istogramma delle
     * ultime sessioni era una fila di barre tutte uguali — il massimo era 1 per via della
     * guardia — qualunque fosse il miglioramento vero. L'arrotondamento lo decide chi
     * stampa, che sa in che unita' sta scrivendo.
     */
    const sessionAvgs = Array.from(bySession.values()).map((arr: number[]) => arr.reduce((s: number, v: number) => s + v, 0) / arr.length);
    stats[cat].recentDeltas = sessionAvgs.slice(-10);
  }

  return stats;
}

/**
 * Quante sessioni servono per dire «stai migliorando» senza inventare.
 *
 * `computeTrendDirection` ne chiede dieci, ma guarda TUTTE le categorie insieme; qui si
 * guarda un campo solo, dove le sessioni sono molte meno. Sei e' il minimo per avere due
 * terzine da confrontare.
 */
export const SESSIONI_MINIME_TENDENZA = 6;

/** Di quanto deve calare lo scarto perche' sia un miglioramento e non rumore. */
const CALO_SIGNIFICATIVO = 0.8;

/**
 * Se su questo tipo di errore si sta davvero migliorando.
 *
 * Torna **solo il verso positivo**: dire a qualcuno che sta peggiorando subito dopo che
 * ha sbagliato un valore non lo aiuta a leggere una carta. E la soglia c'e' perche' un
 * incoraggiamento dato sul rumore e' una frase falsa, cioe' la classe di difetto che
 * questo progetto ha corretto piu' volte.
 */
export function staMigliorando(scartiPerSessione: number[]): boolean {
  if (scartiPerSessione.length < SESSIONI_MINIME_TENDENZA) return false;
  const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const recenti = media(scartiPerSessione.slice(-3));
  const precedenti = media(scartiPerSessione.slice(-6, -3));
  if (precedenti <= 0) return false;   // non si migliora partendo da zero errori
  return recenti <= precedenti * CALO_SIGNIFICATIVO;
}

