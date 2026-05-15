# v0.4.0 "Didattica Evoluta" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contextual didactic tips on validation badges, a learning progress overlay with charts, and UX polish (verification banner, badge animations, adaptive popover positioning, What's New).

**Architecture:** Extend `ValidationBadge` popover with adaptive tips from a new `didactic-tips.ts` module. Save validation sessions to localStorage and display combined stats (validations + quiz) in a new `ProgressOverlay` using Recharts. Polish via CSS animation keyframes, post-verify summary banner, and mobile-aware popover positioning.

**Tech Stack:** React 18, TypeScript, Zustand, Recharts (already in project), Tailwind CSS, localStorage.

---

### Task 1: Types and Didactic Tips Module

**Files:**
- Modify: `src/components/validation/ValidationBadge.tsx:6` (extend `ValidationFieldType`)
- Modify: `src/lib/types.ts` (add `ValidationSession`, `ValidationSessionResult`)
- Create: `src/lib/didactic-tips.ts`
- Create: `src/__tests__/didactic-tips.test.ts`

- [ ] **Step 1: Extend ValidationFieldType**

In `src/components/validation/ValidationBadge.tsx`, change line 6:

```typescript
export type ValidationFieldType = 'altitude' | 'distance' | 'azimuth' | 'elevation' | 'elevationGain' | 'elevationLoss';
```

In the `formatValue` and `formatDelta` functions, the `elevation`, `elevationGain`, and `elevationLoss` types all format the same way (meters), so no change is needed there — the existing `default` case already returns `${Math.round(value)} m`.

- [ ] **Step 2: Add new types to types.ts**

Append to `src/lib/types.ts`:

```typescript
export interface ValidationSessionResult {
  field: 'altitude' | 'distance' | 'elevationGain' | 'elevationLoss' | 'azimuth';
  status: 'valid' | 'warning' | 'error';
  delta: number;
  tolerance: { strict: number; loose: number };
}

export interface ValidationSession {
  date: string;
  itineraryName: string;
  results: ValidationSessionResult[];
}
```

- [ ] **Step 3: Update LegCard to pass specific field types**

In `src/components/panel/LegCard.tsx`, change the D+ and D- NumberInput props:

For D+ (elevationGain), change `validationFieldType="elevation"` to `validationFieldType="elevationGain"`:

```typescript
        <NumberInput
          label="D+"
          unit="m"
          value={leg.elevationGain}
          onChange={(v) => updateLeg(leg.id, { elevationGain: v })}
          min={0}
          validation={leg.validationState?.elevationGain}
          validationFieldType="elevationGain"
          placeholder=""
          readOnly={isTrack}
          highlight
          info="Dislivello positivo cumulativo (metri di salita)"
        />
```

For D- (elevationLoss), change `validationFieldType="elevation"` to `validationFieldType="elevationLoss"`:

```typescript
        <NumberInput
          label="D-"
          unit="m"
          value={leg.elevationLoss}
          onChange={(v) => updateLeg(leg.id, { elevationLoss: v })}
          min={0}
          validation={leg.validationState?.elevationLoss}
          validationFieldType="elevationLoss"
          placeholder=""
          readOnly={isTrack}
          highlight
          info="Dislivello negativo cumulativo (metri di discesa)"
        />
```

- [ ] **Step 4: Write failing tests for didactic-tips**

Create `src/__tests__/didactic-tips.test.ts`:

```typescript
import { describe, expect, test } from '@jest/globals';
import { getTip } from '../lib/didactic-tips';

describe('getTip', () => {
  test('returns null when delta is undefined', () => {
    expect(getTip('altitude', undefined, { strict: 20, loose: 40 })).toBeNull();
  });

  test('returns null when delta is within strict tolerance (valid)', () => {
    expect(getTip('altitude', 15, { strict: 20, loose: 40 })).toBeNull();
  });

  test('returns string for warning-level altitude delta', () => {
    const tip = getTip('altitude', 30, { strict: 20, loose: 40 });
    expect(tip).not.toBeNull();
    expect(typeof tip).toBe('string');
    expect(tip!.length).toBeGreaterThan(10);
  });

  test('returns different tip for small vs large altitude error', () => {
    const small = getTip('altitude', 30, { strict: 20, loose: 40 });
    const large = getTip('altitude', 200, { strict: 20, loose: 40 });
    expect(small).not.toEqual(large);
  });

  test('returns tip for distance warning', () => {
    const tip = getTip('distance', 0.5, { strict: 0.32, loose: 0.64 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for distance large error', () => {
    const tip = getTip('distance', 2.0, { strict: 0.32, loose: 0.64 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for azimuth error', () => {
    const tip = getTip('azimuth', 25, { strict: 5, loose: 10 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for elevationGain warning', () => {
    const tip = getTip('elevationGain', 80, { strict: 50, loose: 100 });
    expect(tip).not.toBeNull();
  });

  test('returns tip for elevationLoss large error', () => {
    const tip = getTip('elevationLoss', 300, { strict: 50, loose: 100 });
    expect(tip).not.toBeNull();
  });

  test('elevation gain and loss have the same tips', () => {
    const gain = getTip('elevationGain', 80, { strict: 50, loose: 100 });
    const loss = getTip('elevationLoss', 80, { strict: 50, loose: 100 });
    expect(gain).toEqual(loss);
  });

  test('returns null for NaN delta', () => {
    expect(getTip('altitude', NaN, { strict: 20, loose: 40 })).toBeNull();
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx jest src/__tests__/didactic-tips.test.ts --no-cache`
Expected: FAIL — module `../lib/didactic-tips` not found.

- [ ] **Step 6: Implement didactic-tips.ts**

Create `src/lib/didactic-tips.ts`:

```typescript
import type { ValidationFieldType } from '@/components/validation/ValidationBadge';

type TipField = 'altitude' | 'distance' | 'elevationGain' | 'elevationLoss' | 'azimuth';

type TipBand = 'small' | 'medium' | 'large';

const TIPS: Record<string, Record<TipBand, string>> = {
  altitude: {
    small: "Verifica quale curva di livello hai letto — l'equidistanza tra le curve potrebbe ingannarti.",
    medium: "Controlla di aver identificato la curva direttrice corretta (le linee più spesse, ogni 4-5 curve).",
    large: "Potresti aver letto il valore di una cima o valle adiacente. Riparti dalla curva direttrice più vicina e conta le curve intermedie.",
  },
  distance: {
    small: "Prova a verificare la scala della carta e il fattore di conversione che stai usando.",
    medium: "Stai usando la scala corretta? Ricorda: 1 cm sulla carta a scala 1:25000 = 250 m reali.",
    large: "Il percorso potrebbe seguire un sentiero curvo — la distanza reale lungo il tracciato è maggiore di quella in linea d'aria. Prova a misurare seguendo le curve.",
  },
  elevation: {
    small: "Attenzione ai piccoli saliscendi intermedi: ogni risalita va contata nel dislivello positivo, ogni discesa nel negativo.",
    medium: "Ricontrolla il profilo tra i due punti: potresti aver trascurato un cambio di pendenza intermedio.",
    large: "Il dislivello cumulativo è la somma di TUTTE le salite (o discese), non solo la differenza tra quota iniziale e finale.",
  },
  azimuth: {
    small: "Verifica la declinazione magnetica della zona — può introdurre uno scarto di qualche grado.",
    medium: "Controlla di misurare l'angolo dal Nord geografico (verso l'alto sulla carta), non dal bordo o da un riferimento arbitrario.",
    large: "Potresti aver invertito la direzione di lettura. L'azimut si misura dal punto di partenza verso il punto di arrivo, in senso orario dal Nord.",
  },
};

function getBand(delta: number, tolerance: { strict: number; loose: number }): TipBand {
  if (delta <= tolerance.loose) return 'small';
  if (delta <= tolerance.loose * 2) return 'medium';
  return 'large';
}

function tipKey(field: TipField): string {
  if (field === 'elevationGain' || field === 'elevationLoss') return 'elevation';
  return field;
}

export function getTip(
  field: ValidationFieldType,
  delta: number | undefined,
  tolerance: { strict: number; loose: number },
): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (delta <= tolerance.strict) return null;

  const key = tipKey(field as TipField);
  const tips = TIPS[key];
  if (!tips) return null;

  const band = getBand(delta, tolerance);
  return tips[band];
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/__tests__/didactic-tips.test.ts --no-cache`
Expected: All 11 tests PASS.

- [ ] **Step 8: Commit**

```
git add src/lib/didactic-tips.ts src/__tests__/didactic-tips.test.ts src/lib/types.ts src/components/validation/ValidationBadge.tsx src/components/panel/LegCard.tsx
git commit -m "feat: add didactic tips module and ValidationSession types"
```

---

### Task 2: Validation History Persistence

**Files:**
- Modify: `src/lib/storage.ts`
- Create: `src/__tests__/learning-history.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/learning-history.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/learning-history.test.ts --no-cache`
Expected: FAIL — functions not exported from storage.

- [ ] **Step 3: Implement storage functions**

In `src/lib/storage.ts`, add the import at the top:

```typescript
import type { Itinerary, AppSettings, ValidationSession } from './types';
```

Then append these functions at the bottom of the file:

```typescript
const MAX_VALIDATION_SESSIONS = 100;

export function loadValidationHistory(): ValidationSession[] {
  try {
    const raw = localStorage.getItem(KEYS.learningHistory);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveValidationSession(session: ValidationSession): void {
  try {
    const history = loadValidationHistory();
    history.push(session);
    const trimmed = history.length > MAX_VALIDATION_SESSIONS
      ? history.slice(history.length - MAX_VALIDATION_SESSIONS)
      : history;
    localStorage.setItem(KEYS.learningHistory, JSON.stringify(trimmed));
  } catch {
    // storage write failed
  }
}

export function clearValidationHistory(): void {
  try {
    localStorage.removeItem(KEYS.learningHistory);
  } catch {
    // storage unavailable
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/learning-history.test.ts --no-cache`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```
git add src/lib/storage.ts src/__tests__/learning-history.test.ts
git commit -m "feat: add validation history persistence to localStorage"
```

---

### Task 3: Learning Stats Module

**Files:**
- Create: `src/lib/learning-stats.ts`
- Create: `src/__tests__/learning-stats.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/learning-stats.test.ts`:

```typescript
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
    const recent = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 6}`, 80));
    const result = computeTrendDirection([], [...old, ...recent]);
    expect(result).toBe('up');
  });

  test('returns down when recent scores drop', () => {
    const old = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 1}`, 80));
    const recent = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 6}`, 50));
    const result = computeTrendDirection([], [...old, ...recent]);
    expect(result).toBe('down');
  });

  test('returns stable when change is small', () => {
    const old = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 1}`, 70));
    const recent = Array.from({ length: 5 }, (_, i) => makeQSession(`2026-04-0${i + 6}`, 73));
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/learning-stats.test.ts --no-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement learning-stats.ts**

Create `src/lib/learning-stats.ts`:

```typescript
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
  // Combine into normalized scores: verify → % valid, quiz → average/100 scaled to %
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

  // Quiz sessions: only include if no category filter, or filter matches a quiz type
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

    // Recent deltas: group by session date, take last 10 session averages
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/__tests__/learning-stats.test.ts --no-cache`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
git add src/lib/learning-stats.ts src/__tests__/learning-stats.test.ts
git commit -m "feat: add learning stats computation module"
```

---

### Task 4: ValidationBadge — Tips, Animation, Positioning

**Files:**
- Modify: `src/components/validation/ValidationBadge.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add badge-pop animation to globals.css**

In `src/app/globals.css`, append:

```css
@keyframes badge-pop {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.animate-badge-pop {
  animation: badge-pop 300ms ease-out;
}
```

- [ ] **Step 2: Rewrite ValidationBadge with tips, animation, and adaptive positioning**

Replace the entire content of `src/components/validation/ValidationBadge.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import type { ValidationResult } from '@/lib/types';
import { getTip } from '@/lib/didactic-tips';

export type ValidationFieldType = 'altitude' | 'distance' | 'azimuth' | 'elevation' | 'elevationGain' | 'elevationLoss';

const STATUS_STYLES = {
  unverified: 'bg-gray-600 text-gray-300',
  valid: 'bg-green-600 text-green-100',
  warning: 'bg-yellow-600 text-yellow-100',
  error: 'bg-red-600 text-red-100',
} as const;

const STATUS_LABELS = {
  unverified: '?',
  valid: '✓',
  warning: '~',
  error: '✗',
} as const;

function formatValue(value: number, fieldType?: ValidationFieldType): string {
  if (!Number.isFinite(value)) return '—';
  if (fieldType === 'azimuth') return `${value.toFixed(1)}°`;
  if (fieldType === 'distance') return `${value.toFixed(3)} km`;
  return `${Math.round(value)} m`;
}

function formatDelta(delta: number, fieldType?: ValidationFieldType): string {
  if (!Number.isFinite(delta)) return '—';
  if (fieldType === 'azimuth') return `${delta.toFixed(1)}°`;
  if (fieldType === 'distance') return `${(delta * 1000).toFixed(0)} m`;
  return `${delta.toFixed(0)} m`;
}

export function ValidationBadge({ result, fieldType }: { result?: ValidationResult; fieldType?: ValidationFieldType }) {
  const [open, setOpen] = useState(false);
  const [popoverBelow, setPopoverBelow] = useState(false);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevStatusRef = useRef<string | undefined>(undefined);
  const [animating, setAnimating] = useState(false);

  // Trigger pop animation when badge appears for the first time
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = result?.status;
    prevStatusRef.current = currentStatus;

    if (
      currentStatus &&
      currentStatus !== 'unverified' &&
      (!prevStatus || prevStatus === 'unverified')
    ) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [result?.status]);

  // Close on outside click/touch + Escape key
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!result || result.status === 'unverified') return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverBelow(rect.top < window.innerHeight * 0.25);
    }
    setOpen((p) => !p);
  };

  const tip = fieldType ? getTip(fieldType, result.delta, result.tolerance) : null;

  return (
    <span ref={popoverRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold cursor-pointer active:scale-110 transition-transform ${STATUS_STYLES[result.status]} ${animating ? 'animate-badge-pop' : ''} relative before:absolute before:inset-[-10px] before:content-['']`}
        aria-label={`Dettaglio validazione: ${result.status}`}
        aria-expanded={open}
      >
        {STATUS_LABELS[result.status]}
      </button>
      {open && result.realValue != null && (
        <div
          role="status"
          className={`absolute left-1/2 -translate-x-1/2 ${popoverBelow ? 'top-7' : 'bottom-7'} z-[1300] bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white shadow-lg max-w-[220px]`}
        >
          <div>Calcolato: <span className="font-bold text-green-400">{formatValue(result.realValue, fieldType)}</span></div>
          {result.delta != null && (
            <div className="text-gray-300 mt-0.5">Scarto: {formatDelta(result.delta, fieldType)}</div>
          )}
          {tip && (
            <div className="text-amber-300 text-[10px] italic mt-1.5 leading-tight border-t border-gray-700 pt-1.5">
              💡 {tip}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx next build --no-lint 2>&1 | head -20` (or `npx tsc --noEmit`)
Expected: No type errors.

- [ ] **Step 4: Commit**

```
git add src/components/validation/ValidationBadge.tsx src/app/globals.css
git commit -m "feat: didactic tips in validation popover, badge animation, adaptive positioning"
```

---

### Task 5: ActionBar — Verification Banner + Save Session

**Files:**
- Modify: `src/components/panel/ActionBar.tsx`

- [ ] **Step 1: Add imports and banner state**

At the top of `ActionBar.tsx`, add the import:

```typescript
import { saveValidationSession } from '@/lib/storage';
import type { ValidationSessionResult } from '@/lib/types';
```

Inside the `ActionBar` component, after the existing state declarations (after `const verifyGenerationRef = ...`), add:

```typescript
  const [verifyBanner, setVerifyBanner] = useState<{ valid: number; warning: number; error: number } | null>(null);
```

- [ ] **Step 2: Add session saving and banner logic at end of handleVerify**

In `handleVerify()`, just before the `finally` block (after the `if (!apiAvailable ...)` alert), add this code:

```typescript
      // --- Collect results and save validation session ---
      if (mountedRef.current && !isStale()) {
        const finalState = useItineraryStore.getState();
        const sessionResults: ValidationSessionResult[] = [];
        let validCount = 0;
        let warningCount = 0;
        let errorCount = 0;

        for (const wp of finalState.waypoints) {
          const altV = wp.validationState?.altitude;
          if (altV && altV.status !== 'unverified') {
            sessionResults.push({
              field: 'altitude',
              status: altV.status,
              delta: altV.delta ?? 0,
              tolerance: altV.tolerance,
            });
            if (altV.status === 'valid') validCount++;
            else if (altV.status === 'warning') warningCount++;
            else errorCount++;
          }
        }
        for (const leg of finalState.legs) {
          const fields = [
            { key: 'distance' as const, v: leg.validationState?.distance },
            { key: 'elevationGain' as const, v: leg.validationState?.elevationGain },
            { key: 'elevationLoss' as const, v: leg.validationState?.elevationLoss },
            { key: 'azimuth' as const, v: leg.validationState?.azimuth },
          ];
          for (const { key, v } of fields) {
            if (v && v.status !== 'unverified') {
              sessionResults.push({
                field: key,
                status: v.status,
                delta: v.delta ?? 0,
                tolerance: v.tolerance,
              });
              if (v.status === 'valid') validCount++;
              else if (v.status === 'warning') warningCount++;
              else errorCount++;
            }
          }
        }

        if (sessionResults.length > 0) {
          saveValidationSession({
            date: new Date().toISOString(),
            itineraryName: finalState.itineraryName,
            results: sessionResults,
          });
          setVerifyBanner({ valid: validCount, warning: warningCount, error: errorCount });
          setTimeout(() => { if (mountedRef.current) setVerifyBanner(null); }, 4000);
        }
      }
```

- [ ] **Step 3: Add Progress button and banner in the JSX**

Add the `onOpenProgress` prop to the ActionBar:

```typescript
export function ActionBar({ onOpenProgress }: { onOpenProgress?: () => void }) {
```

In the JSX return, replace the entire return block. Add the banner before the buttons div and the Progresso button at the end:

After the opening `<div className="border-t border-gray-700 p-3 flex flex-wrap gap-2">`, add the banner and progress button. The full return becomes:

```typescript
  return (
    <div className="border-t border-gray-700 p-3 space-y-2">
      {verifyBanner && (
        <div
          onClick={() => setVerifyBanner(null)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-center cursor-pointer transition-opacity duration-300"
        >
          Verifica completata:{' '}
          <span className="text-green-400 font-bold">{verifyBanner.valid} ✓</span>
          {' · '}
          <span className="text-yellow-400 font-bold">{verifyBanner.warning} ~</span>
          {' · '}
          <span className="text-red-400 font-bold">{verifyBanner.error} ✗</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handlePDF('summary')}
          className="flex-1 py-2 bg-green-500 text-black rounded font-bold text-xs hover:bg-green-400"
        >
          PDF Sintetico
        </button>
        <button
          onClick={() => handlePDF('roadbook')}
          className="flex-1 py-2 bg-green-600 text-black rounded font-bold text-xs hover:bg-green-500"
        >
          PDF Roadbook
        </button>
        <button
          onClick={handleGPX}
          className="flex-1 py-2 bg-blue-500 text-black rounded font-bold text-xs hover:bg-blue-400"
        >
          GPX
        </button>
        {(() => {
          const meteoUrl = buildMeteoUrl(waypoints);
          return meteoUrl ? (
            <button
              onClick={() => window.open(meteoUrl, '_blank')}
              className="flex-1 py-2 bg-cyan-600 text-black rounded font-bold text-xs hover:bg-cyan-500"
            >
              Meteo
            </button>
          ) : null;
        })()}
        <button
          onClick={handleShareLink}
          disabled={waypoints.length < 2}
          className="flex-1 py-2 bg-amber-500 text-black rounded font-bold text-xs hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {linkCopied ? 'Copiato!' : 'Copia link'}
        </button>
        {appMode === 'learn' && (
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex-1 py-2 bg-purple-500 text-black rounded font-bold text-xs hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? 'Verificando...' : 'Verifica'}
          </button>
        )}
        {onOpenProgress && (
          <button
            onClick={onOpenProgress}
            className="flex-1 py-2 bg-indigo-500 text-black rounded font-bold text-xs hover:bg-indigo-400"
          >
            📊 Progresso
          </button>
        )}
      </div>
    </div>
  );
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors (ActionBar callers don't pass `onOpenProgress` yet — that's fine, the prop is optional).

- [ ] **Step 5: Commit**

```
git add src/components/panel/ActionBar.tsx
git commit -m "feat: post-verify banner, save validation session, progress button"
```

---

### Task 6: ProgressOverlay Component

**Files:**
- Create: `src/components/panel/ProgressOverlay.tsx`

- [ ] **Step 1: Create ProgressOverlay**

Create `src/components/panel/ProgressOverlay.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { loadValidationHistory, clearValidationHistory, KEYS } from '@/lib/storage';
import { loadQuizHistory } from '@/lib/quiz';
import type { QuizSession } from '@/lib/quiz';
import type { ValidationSession } from '@/lib/types';
import {
  computeSummaryCards,
  computeTrendDirection,
  computeTrendData,
  computeCategoryStats,
  type CategoryField,
  type TrendDirection,
} from '@/lib/learning-stats';

const CATEGORY_LABELS: Record<CategoryField, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  elevationGain: 'D+',
  elevationLoss: 'D-',
  azimuth: 'Azimut',
};

const TREND_ICONS: Record<TrendDirection, string> = { up: '↑', down: '↓', stable: '→' };
const TREND_COLORS: Record<TrendDirection, string> = {
  up: 'text-green-400',
  down: 'text-red-400',
  stable: 'text-gray-400',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '—';
  }
}

export function ProgressOverlay({ onClose }: { onClose: () => void }) {
  const [validations, setValidations] = useState<ValidationSession[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryField | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValidations(loadValidationHistory());
    setQuizzes(loadQuizHistory());
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const summary = computeSummaryCards(validations, quizzes);
  const trend = computeTrendDirection(validations, quizzes);
  const trendData = computeTrendData(validations, quizzes, categoryFilter ?? undefined);
  const catStats = computeCategoryStats(validations);
  const hasData = validations.length + quizzes.length > 0;

  const handleReset = () => {
    clearValidationHistory();
    try { localStorage.removeItem(KEYS.quizHistory); } catch { /* */ }
    setValidations([]);
    setQuizzes([]);
    setConfirmReset(false);
  };

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report Progresso"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full p-5 shadow-2xl outline-none overflow-y-auto max-h-[calc(100vh-2rem)]"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-green-400">📊 Progresso</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Chiudi">✕</button>
        </div>

        {!hasData ? (
          <div className="text-gray-500 text-sm text-center py-8">
            Inizia a verificare i tuoi itinerari e completare quiz per vedere il tuo progresso qui.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Section 1: Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-500 text-[10px] uppercase">Verifiche</div>
                <div className="text-white font-bold text-lg">{summary.totalVerifications}</div>
                {summary.lastVerifyValidPercent != null && (
                  <div className="text-green-400 text-[10px]">Ultima: {summary.lastVerifyValidPercent}% ✓</div>
                )}
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-500 text-[10px] uppercase">Quiz</div>
                <div className="text-white font-bold text-lg">{summary.totalQuizzes}</div>
                {summary.lastQuizAverage != null && (
                  <div className="text-green-400 text-[10px]">Ultimo: {summary.lastQuizAverage}/100</div>
                )}
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-gray-500 text-[10px] uppercase">Trend</div>
                {trend ? (
                  <div className={`font-bold text-2xl ${TREND_COLORS[trend]}`}>{TREND_ICONS[trend]}</div>
                ) : (
                  <div className="text-gray-600 text-lg">—</div>
                )}
                {!trend && <div className="text-gray-600 text-[10px]">Min. 10 sessioni</div>}
              </div>
            </div>

            {/* Section 2: Trend Chart */}
            {trendData.length >= 3 && (
              <div>
                <div className="text-xs text-gray-400 font-medium mb-2">Andamento nel tempo</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} width={30} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
                      labelFormatter={formatDate}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line type="monotone" dataKey="verifyPercent" name="Verifiche %" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="quizScore" name="Quiz" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-1 mt-2">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`px-2 py-1 rounded text-[10px] ${!categoryFilter ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    Tutte
                  </button>
                  {(Object.keys(CATEGORY_LABELS) as CategoryField[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                      className={`px-2 py-1 rounded text-[10px] ${categoryFilter === cat ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Category Breakdown */}
            <div>
              <div className="text-xs text-gray-400 font-medium mb-2">Dettaglio per categoria</div>
              <div className="grid grid-cols-5 gap-1 text-center">
                {(Object.keys(CATEGORY_LABELS) as CategoryField[]).map((cat) => {
                  const s = catStats[cat];
                  return (
                    <div key={cat} className="bg-gray-800 rounded-lg p-2">
                      <div className="text-gray-500 text-[9px] uppercase font-medium">{CATEGORY_LABELS[cat]}</div>
                      {s.count === 0 ? (
                        <div className="text-gray-600 text-sm mt-1">—</div>
                      ) : (
                        <>
                          <div className="text-white text-xs font-bold mt-1">Δ {s.avgDelta}</div>
                          <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5">
                            {s.validPercent > 0 && <div className="bg-green-500" style={{ width: `${s.validPercent}%` }} />}
                            {s.warningPercent > 0 && <div className="bg-yellow-500" style={{ width: `${s.warningPercent}%` }} />}
                            {s.errorPercent > 0 && <div className="bg-red-500" style={{ width: `${s.errorPercent}%` }} />}
                          </div>
                          {s.recentDeltas.length >= 2 && (
                            <div className="flex items-end justify-center gap-px mt-1.5 h-[20px]">
                              {s.recentDeltas.map((d, i) => {
                                const max = Math.max(...s.recentDeltas, 1);
                                const h = Math.max(2, Math.round((d / max) * 20));
                                return <div key={i} className="w-1 bg-blue-400 rounded-sm" style={{ height: `${h}px` }} />;
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reset Button */}
            <div className="border-t border-gray-700 pt-3 text-center">
              {confirmReset ? (
                <div className="space-y-2">
                  <div className="text-sm text-gray-300">Sei sicuro? Questa azione è irreversibile.</div>
                  <div className="flex gap-2 justify-center">
                    <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-500">Cancella tutto</button>
                    <button onClick={() => setConfirmReset(false)} className="px-4 py-2 bg-gray-700 text-white rounded text-xs hover:bg-gray-600">Annulla</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmReset(true)} className="text-xs text-gray-500 hover:text-red-400">
                  Cancella storico
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/components/panel/ProgressOverlay.tsx
git commit -m "feat: add ProgressOverlay with trend chart and category breakdown"
```

---

### Task 7: Wiring — page.tsx, LeftPanel, QuizSummary

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/panel/LeftPanel.tsx`
- Modify: `src/components/quiz/QuizSummary.tsx`
- Modify: `src/components/quiz/QuizOverlay.tsx`

- [ ] **Step 1: Add progressOpen state to page.tsx**

In `src/app/page.tsx`, add the import:

```typescript
import { ProgressOverlay } from '@/components/panel/ProgressOverlay';
```

After the `quizActive` state declaration (line 25), add:

```typescript
  const [progressOpen, setProgressOpen] = useState(false);
```

Add the callback:

```typescript
  const handleOpenProgress = useCallback(() => {
    setQuizActive(false);
    setProgressOpen(true);
  }, []);
```

- [ ] **Step 2: Pass onOpenProgress through LeftPanel**

In `page.tsx`, every place `<LeftPanel` is rendered, add the `onOpenProgress` prop:

Desktop sidebar:

```typescript
<LeftPanel compassActive={compassActive} onCompassToggle={handleCompassToggle} rulerActive={rulerActive} onRulerToggle={handleRulerToggle} quizActive={quizActive} onQuizToggle={handleQuizToggle} onOpenProgress={handleOpenProgress} />
```

Mobile drawer:

```typescript
<LeftPanel className="w-full h-full" compassActive={compassActive} onCompassToggle={handleCompassToggle} rulerActive={rulerActive} onRulerToggle={handleRulerToggle} quizActive={quizActive} onQuizToggle={handleQuizToggle} onOpenProgress={handleOpenProgress} />
```

Add the overlay render right after the QuizOverlay:

```typescript
      {quizActive && <QuizOverlay onClose={() => setQuizActive(false)} onOpenProgress={handleOpenProgress} />}

      {progressOpen && <ProgressOverlay onClose={() => setProgressOpen(false)} />}
```

- [ ] **Step 3: Update LeftPanel to accept and forward onOpenProgress**

In `src/components/panel/LeftPanel.tsx`, change the props type and render:

```typescript
export function LeftPanel({ className, compassActive, onCompassToggle, rulerActive, onRulerToggle, quizActive, onQuizToggle, onOpenProgress }: {
  className?: string;
  compassActive?: boolean;
  onCompassToggle?: () => void;
  rulerActive?: boolean;
  onRulerToggle?: () => void;
  quizActive?: boolean;
  onQuizToggle?: () => void;
  onOpenProgress?: () => void;
}) {
```

And change the ActionBar render at the bottom of the component from `<ActionBar />` to:

```typescript
      <ActionBar onOpenProgress={onOpenProgress} />
```

- [ ] **Step 4: Update QuizOverlay to accept onOpenProgress**

In `src/components/quiz/QuizOverlay.tsx`, change the props:

```typescript
export function QuizOverlay({ onClose, onOpenProgress }: { onClose: () => void; onOpenProgress?: () => void }) {
```

Pass it to QuizSummary:

```typescript
        <QuizSummary
          answers={answers}
          average={average}
          onNewSession={startSession}
          onClose={onClose}
          onOpenProgress={onOpenProgress}
        />
```

- [ ] **Step 5: Add "Vedi report completo" link to QuizSummary**

In `src/components/quiz/QuizSummary.tsx`, add the prop:

```typescript
export function QuizSummary({ answers, average, onNewSession, onClose, onOpenProgress }: {
  answers: QuizAnswer[];
  average: number;
  onNewSession: () => void;
  onClose: () => void;
  onOpenProgress?: () => void;
}) {
```

After the `{showHistory && <HistoryView />}` line, add:

```typescript
      {onOpenProgress && (
        <button
          onClick={onOpenProgress}
          className="w-full text-blue-400 hover:text-blue-300 text-sm underline text-center mt-2"
        >
          Vedi report completo →
        </button>
      )}
```

- [ ] **Step 6: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```
git add src/app/page.tsx src/components/panel/LeftPanel.tsx src/components/quiz/QuizOverlay.tsx src/components/quiz/QuizSummary.tsx
git commit -m "feat: wire ProgressOverlay into page, LeftPanel, quiz flow"
```

---

### Task 8: What's New v0.4.0

**Files:**
- Modify: `src/components/tutorial/WhatsNew.tsx`

- [ ] **Step 1: Add v0.4.0 release to RELEASES array**

In `src/components/tutorial/WhatsNew.tsx`, add the new release at the TOP of the `RELEASES` array (before the `0.3.0` entry):

```typescript
  {
    version: '0.4.0',
    date: '2026-04-11',
    steps: [
      {
        title: 'Suggerimenti didattici',
        text: 'Dopo la verifica, clicca sui badge colorati (✓ ~ ✗) per ricevere consigli personalizzati su come migliorare. Il suggerimento si adatta all\'entità dell\'errore.',
        icon: '💡',
      },
      {
        title: 'Report Progresso',
        text: 'Traccia il tuo miglioramento nel tempo con il nuovo pannello Progresso (📊). Visualizza grafici di andamento, statistiche per categoria, e confronta verifiche e quiz.',
        icon: '📊',
      },
      {
        title: 'Feedback Verifica',
        text: 'Ora vedi subito un riepilogo dei risultati dopo ogni verifica: quanti campi corretti, approssimati, o errati. Il badge appare con un\'animazione per catturare l\'attenzione.',
        icon: '✅',
      },
    ],
  },
```

- [ ] **Step 2: Verify the component renders (build check)**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/components/tutorial/WhatsNew.tsx
git commit -m "feat: add What's New content for v0.4.0"
```

---

### Task 9: Version Bump and Full Verification

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version to 0.4.0**

In `package.json`, change the `"version"` field to `"0.4.0"`.

- [ ] **Step 2: Run full test suite**

Run: `npx jest --no-cache`
Expected: All tests pass (existing 325+ tests + new didactic-tips + learning-history + learning-stats tests).

- [ ] **Step 3: Run build**

Run: `npx next build`
Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```
git add package.json
git commit -m "chore: bump version to 0.4.0"
```
