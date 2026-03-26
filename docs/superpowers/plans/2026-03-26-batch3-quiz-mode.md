# Quiz Mode — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive quiz mode where users estimate altitude, distance, or azimuth for randomly generated map points, with scoring and session history.

**Architecture:** Pure quiz logic (point generation, scoring, history) in `src/lib/quiz.ts` with full TDD. UI in three components: `QuizOverlay` (session state machine), `QuizQuestion` (single question input+feedback), `QuizSummary` (results+history). Quiz markers rendered on the map via `QuizMarkers` component. State managed in `page.tsx` like compass/ruler, mutually exclusive with both.

**Tech Stack:** Next.js 15, TypeScript, React-Leaflet, Zustand (minimal — only for map bounds access), localStorage

**Spec:** `docs/superpowers/specs/2026-03-26-batch3-quiz-mode.md`

---

## File Structure

### New files
- `src/lib/quiz.ts` — pure logic: types, scoring, history, point generation
- `src/__tests__/quiz.test.ts` — tests for quiz logic
- `src/components/quiz/QuizOverlay.tsx` — session state machine + orchestration
- `src/components/quiz/QuizQuestion.tsx` — single question UI
- `src/components/quiz/QuizSummary.tsx` — results + history view
- `src/components/map/QuizMarkers.tsx` — map markers for quiz points

### Modified files
- `src/lib/storage.ts` — add `quizHistory` key to KEYS
- `src/app/page.tsx` — `quizActive` state, mutual exclusion, overlay rendering
- `src/components/panel/ModeSwitch.tsx` — quiz button
- `src/components/panel/LeftPanel.tsx` — forward quiz props
- `src/components/map/MapWrapper.tsx` — forward quiz props
- `src/components/map/InteractiveMap.tsx` — QuizMarkers + MapEvents suppression

---

## Task 1: Quiz logic — Types + Scoring (TDD)

**Files:**
- Create: `src/lib/quiz.ts`
- Create: `src/__tests__/quiz.test.ts`

- [ ] **Step 1: Create quiz.ts with types and stubs**

```typescript
// src/lib/quiz.ts

export type QuestionType = 'altitude' | 'distance' | 'azimuth';

export interface QuizPoint {
  lat: number;
  lon: number;
}

export interface QuizQuestion {
  type: QuestionType;
  pointA: QuizPoint;
  pointB?: QuizPoint; // only for distance/azimuth
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

const TOLERANCES: Record<QuestionType, number> = {
  altitude: 100,   // ±100m absolute
  distance: 20,    // ±20% relative
  azimuth: 30,     // ±30° absolute (circular)
};

export function azimuthDelta(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

export function calculateQuizScore(userValue: number, realValue: number, type: QuestionType): number {
  return 0;
}

export function generateRandomPoint(
  bounds: { north: number; south: number; east: number; west: number },
  margin: number
): QuizPoint {
  return { lat: 0, lon: 0 };
}

export function generateQuestionSet(
  bounds: { north: number; south: number; east: number; west: number }
): QuestionType[] {
  return [];
}

export function saveQuizSession(session: QuizSession): void {}

export function loadQuizHistory(): QuizSession[] {
  return [];
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// src/__tests__/quiz.test.ts
import { describe, expect, test, beforeEach } from '@jest/globals';
import { azimuthDelta, calculateQuizScore, generateRandomPoint, generateQuestionSet, saveQuizSession, loadQuizHistory } from '../lib/quiz';
import type { QuizSession } from '../lib/quiz';

describe('azimuthDelta', () => {
  test('same angle = 0', () => {
    expect(azimuthDelta(90, 90)).toBe(0);
  });

  test('simple difference', () => {
    expect(azimuthDelta(10, 40)).toBe(30);
  });

  test('wraps around 360', () => {
    expect(azimuthDelta(350, 10)).toBe(20);
  });

  test('wraps the other way', () => {
    expect(azimuthDelta(10, 350)).toBe(20);
  });

  test('opposite directions', () => {
    expect(azimuthDelta(0, 180)).toBe(180);
  });
});

describe('calculateQuizScore', () => {
  test('exact answer = 100 for altitude', () => {
    expect(calculateQuizScore(500, 500, 'altitude')).toBe(100);
  });

  test('half tolerance = 50 for altitude', () => {
    expect(calculateQuizScore(550, 500, 'altitude')).toBe(50);
  });

  test('at tolerance = 0 for altitude', () => {
    expect(calculateQuizScore(600, 500, 'altitude')).toBe(0);
  });

  test('beyond tolerance = 0 for altitude', () => {
    expect(calculateQuizScore(700, 500, 'altitude')).toBe(0);
  });

  test('exact answer = 100 for distance', () => {
    expect(calculateQuizScore(5, 5, 'distance')).toBe(100);
  });

  test('10% error on distance = 50', () => {
    expect(calculateQuizScore(5.5, 5, 'distance')).toBe(50);
  });

  test('20% error on distance = 0', () => {
    expect(calculateQuizScore(6, 5, 'distance')).toBe(0);
  });

  test('exact answer = 100 for azimuth', () => {
    expect(calculateQuizScore(45, 45, 'azimuth')).toBe(100);
  });

  test('15° error on azimuth = 50', () => {
    expect(calculateQuizScore(60, 45, 'azimuth')).toBe(50);
  });

  test('azimuth wraps correctly (350 vs 10 = 20° delta)', () => {
    // 20° / 30° tolerance = 33% error => score = 33
    expect(calculateQuizScore(350, 10, 'azimuth')).toBe(33);
  });
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

  test('generates 5 questions', () => {
    const types = generateQuestionSet(bounds);
    expect(types).toHaveLength(5);
  });

  test('includes at least 1 of each type', () => {
    const types = generateQuestionSet(bounds);
    expect(types.filter((t) => t === 'altitude').length).toBeGreaterThanOrEqual(1);
    expect(types.filter((t) => t === 'distance').length).toBeGreaterThanOrEqual(1);
    expect(types.filter((t) => t === 'azimuth').length).toBeGreaterThanOrEqual(1);
  });
});

describe('quiz history persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loadQuizHistory returns empty array when no data', () => {
    expect(loadQuizHistory()).toEqual([]);
  });

  test('saveQuizSession then loadQuizHistory roundtrip', () => {
    const session: QuizSession = {
      date: '2026-03-26T10:00:00Z',
      questions: [
        { type: 'altitude', score: 80, userValue: 520, realValue: 500 },
      ],
      average: 80,
    };
    saveQuizSession(session);
    const history = loadQuizHistory();
    expect(history).toHaveLength(1);
    expect(history[0].average).toBe(80);
  });

  test('keeps max 50 sessions (FIFO)', () => {
    for (let i = 0; i < 55; i++) {
      saveQuizSession({ date: `2026-01-${i}`, questions: [], average: i });
    }
    const history = loadQuizHistory();
    expect(history).toHaveLength(50);
    expect(history[0].average).toBe(5); // oldest kept = 5 (0-4 dropped)
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/__tests__/quiz.test.ts --no-cache`
Expected: azimuthDelta tests pass (already implemented), others FAIL

---

## Task 2: Quiz logic — Implementation

**Files:**
- Modify: `src/lib/quiz.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Implement all quiz functions**

Replace `src/lib/quiz.ts` with:

```typescript
// src/lib/quiz.ts

export type QuestionType = 'altitude' | 'distance' | 'azimuth';

export interface QuizPoint {
  lat: number;
  lon: number;
}

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

const QUIZ_HISTORY_KEY = 'trektrak_quiz_history';
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

export function generateQuestionSet(
  _bounds: { north: number; south: number; east: number; west: number }
): QuestionType[] {
  const types: QuestionType[] = ['altitude', 'distance', 'azimuth'];
  const set: QuestionType[] = [...types]; // 1 of each guaranteed
  // Fill remaining 2 randomly
  for (let i = 0; i < 2; i++) {
    set.push(types[Math.floor(Math.random() * types.length)]);
  }
  // Shuffle
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
    // Keep max 50 (FIFO)
    const trimmed = history.length > MAX_SESSIONS ? history.slice(history.length - MAX_SESSIONS) : history;
    localStorage.setItem(QUIZ_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // storage write failed
  }
}

export function loadQuizHistory(): QuizSession[] {
  try {
    const raw = localStorage.getItem(QUIZ_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Add quizHistory key to storage.ts KEYS**

In `src/lib/storage.ts`, add to the `KEYS` object:
```typescript
  quizHistory: 'trektrak_quiz_history',
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/__tests__/quiz.test.ts --no-cache`
Expected: all PASS

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`

---

## Task 3: Quiz wiring — page state + ModeSwitch + prop drilling

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/panel/ModeSwitch.tsx`
- Modify: `src/components/panel/LeftPanel.tsx`
- Modify: `src/components/map/MapWrapper.tsx`
- Modify: `src/components/map/InteractiveMap.tsx`

- [ ] **Step 1: Add quizActive state to page.tsx**

Add state after `rulerActive`:
```typescript
const [quizActive, setQuizActive] = useState(false);
```

Add toggle handler with triple mutual exclusion:
```typescript
const handleQuizToggle = useCallback(() => {
  setQuizActive((p) => {
    if (!p) {
      setCompassActive(false);
      setRulerActive(false);
    }
    return !p;
  });
}, []);
```

Update `handleCompassToggle` to also deactivate quiz:
```typescript
const handleCompassToggle = useCallback(() => {
  setCompassActive((p) => {
    if (!p) {
      setRulerActive(false);
      setQuizActive(false);
    }
    return !p;
  });
}, []);
```

Update `handleRulerToggle` to also deactivate quiz:
```typescript
const handleRulerToggle = useCallback(() => {
  setRulerActive((p) => {
    if (!p) {
      setCompassActive(false);
      setQuizActive(false);
    }
    return !p;
  });
}, []);
```

Pass `quizActive` and `onQuizToggle` to both `<LeftPanel>` instances and mobile `<ModeSwitch>`:
```tsx
<ModeSwitch compassActive={compassActive} onCompassToggle={handleCompassToggle} rulerActive={rulerActive} onRulerToggle={handleRulerToggle} quizActive={quizActive} onQuizToggle={handleQuizToggle} />
```

Pass `quizActive` to `<MapWrapper>`:
```tsx
<MapWrapper ... quizActive={quizActive} />
```

Render `QuizOverlay` when active (after the settings modals, before `<LearnTutorial />`):
```tsx
{quizActive && <QuizOverlay onClose={() => setQuizActive(false)} />}
```

Import QuizOverlay at the top:
```typescript
import { QuizOverlay } from '@/components/quiz/QuizOverlay';
```

- [ ] **Step 2: Update ModeSwitch**

Add `quizActive` and `onQuizToggle` to props:
```typescript
export function ModeSwitch({ compassActive, onCompassToggle, rulerActive, onRulerToggle, quizActive, onQuizToggle }: {
  compassActive?: boolean;
  onCompassToggle?: () => void;
  rulerActive?: boolean;
  onRulerToggle?: () => void;
  quizActive?: boolean;
  onQuizToggle?: () => void;
}) {
```

Update `handleToggle` to deactivate quiz too:
```typescript
if (quizActive && onQuizToggle) onQuizToggle();
```

Add quiz button after ruler button:
```tsx
{onQuizToggle && (
  <button
    onClick={onQuizToggle}
    className={`px-2 py-1.5 rounded text-sm font-bold transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
      quizActive
        ? 'bg-purple-500 text-white'
        : 'bg-gray-700 text-gray-400 hover:text-gray-300'
    }`}
    aria-label={quizActive ? 'Chiudi quiz' : 'Avvia quiz'}
    aria-pressed={quizActive}
    title="Quiz"
  >
    ?
  </button>
)}
```

Update `aria-selected` on Learn/Track to include `!quizActive`.

- [ ] **Step 3: Update LeftPanel to forward quiz props**

Add `quizActive` and `onQuizToggle` to props, forward to `<ModeSwitch>`.

- [ ] **Step 4: Update MapWrapper to forward quizActive**

Add `quizActive` to props, forward to `<InteractiveMap>`.

- [ ] **Step 5: Update InteractiveMap + MapEvents**

Add `quizActive` to props. Update `MapEvents`:
```typescript
function MapEvents({ compassActive, rulerActive, quizActive }: { compassActive?: boolean; rulerActive?: boolean; quizActive?: boolean }) {
```

Suppress waypoint click:
```typescript
if (compassActive || rulerActive || quizActive) return;
```

Pass in render:
```tsx
<MapEvents compassActive={compassActive} rulerActive={rulerActive} quizActive={quizActive} />
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Note: This will fail until QuizOverlay component exists. Create a minimal stub first:

```typescript
// src/components/quiz/QuizOverlay.tsx
'use client';
export function QuizOverlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center"><button onClick={onClose} className="text-white">Close</button></div>;
}
```

Run: `npx tsc --noEmit`
Expected: no errors

---

## Task 4: QuizQuestion component

**Files:**
- Create: `src/components/quiz/QuizQuestion.tsx`

- [ ] **Step 1: Create QuizQuestion component**

```typescript
// src/components/quiz/QuizQuestion.tsx
'use client';

import { useState } from 'react';
import type { QuizQuestion as QuizQuestionType, QuizAnswer, QuestionType } from '@/lib/quiz';
import { calculateQuizScore, azimuthDelta } from '@/lib/quiz';

const TYPE_LABELS: Record<QuestionType, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  azimuth: 'Azimuth',
};

export function QuizQuestionView({ question, questionNumber, onAnswer }: {
  question: QuizQuestionType;
  questionNumber: number;
  onAnswer: (answer: QuizAnswer) => void;
}) {
  const [input, setInput] = useState('');
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<QuizAnswer | null>(null);

  const handleSubmit = () => {
    const userValue = parseFloat(input);
    if (isNaN(userValue)) return;

    const score = calculateQuizScore(userValue, question.realValue, question.type);
    const answer: QuizAnswer = {
      type: question.type,
      score,
      userValue,
      realValue: question.realValue,
    };
    setResult(answer);
    setAnswered(true);
  };

  const handleNext = () => {
    if (result) onAnswer(result);
  };

  const delta = result
    ? question.type === 'azimuth'
      ? azimuthDelta(result.userValue, result.realValue)
      : Math.abs(result.userValue - result.realValue)
    : null;

  const scoreColor = result
    ? result.score >= 70 ? 'text-green-400'
      : result.score >= 40 ? 'text-amber-400'
        : 'text-red-400'
    : '';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Domanda {questionNumber}/5</span>
        <span className="text-xs font-bold text-purple-400">{TYPE_LABELS[question.type]}</span>
      </div>

      <p className="text-sm text-gray-200">{question.prompt}</p>

      {!answered ? (
        <div className="flex gap-2">
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder={question.unit}
            autoFocus
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!input}
            className="px-4 py-2 bg-purple-500 text-white rounded font-bold text-sm hover:bg-purple-400 disabled:opacity-50"
          >
            Conferma
          </button>
        </div>
      ) : result && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-gray-500 text-[10px]">Tua risposta</div>
              <div className="text-white font-bold text-sm">
                {result.userValue.toFixed(question.type === 'distance' ? 2 : 0)} {question.unit}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">Valore reale</div>
              <div className="text-green-400 font-bold text-sm">
                {result.realValue.toFixed(question.type === 'distance' ? 2 : 0)} {question.unit}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px]">Errore</div>
              <div className="text-amber-400 font-bold text-sm">
                {question.type === 'distance'
                  ? `${((delta! / result.realValue) * 100).toFixed(0)}%`
                  : `${delta!.toFixed(0)} ${question.unit}`}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className={`font-bold text-lg ${scoreColor}`}>
              {result.score}/100
            </span>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-gray-700 text-white rounded font-bold text-sm hover:bg-gray-600"
            >
              Prossima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

## Task 5: QuizSummary component

**Files:**
- Create: `src/components/quiz/QuizSummary.tsx`

- [ ] **Step 1: Create QuizSummary component**

```typescript
// src/components/quiz/QuizSummary.tsx
'use client';

import { useState } from 'react';
import type { QuizAnswer, QuizSession, QuestionType } from '@/lib/quiz';
import { loadQuizHistory } from '@/lib/quiz';

const TYPE_LABELS: Record<QuestionType, string> = {
  altitude: 'Altitudine',
  distance: 'Distanza',
  azimuth: 'Azimuth',
};

function averageByType(answers: QuizAnswer[], type: QuestionType): number | null {
  const filtered = answers.filter((a) => a.type === type);
  if (filtered.length === 0) return null;
  return Math.round(filtered.reduce((sum, a) => sum + a.score, 0) / filtered.length);
}

export function QuizSummary({ answers, average, onNewSession, onClose }: {
  answers: QuizAnswer[];
  average: number;
  onNewSession: () => void;
  onClose: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  const scoreColor = average >= 70 ? 'text-green-400' : average >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-gray-500 text-xs mb-1">Punteggio sessione</div>
        <div className={`text-4xl font-bold ${scoreColor}`}>{average}/100</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['altitude', 'distance', 'azimuth'] as QuestionType[]).map((type) => {
          const avg = averageByType(answers, type);
          return (
            <div key={type} className="text-center bg-gray-800 rounded p-2">
              <div className="text-gray-500 text-[10px]">{TYPE_LABELS[type]}</div>
              <div className={`font-bold text-sm ${avg != null && avg >= 70 ? 'text-green-400' : avg != null && avg >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                {avg != null ? `${avg}/100` : '-'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={onNewSession} className="flex-1 py-2 bg-purple-500 text-white rounded font-bold text-xs hover:bg-purple-400">
          Nuova sessione
        </button>
        <button onClick={() => setShowHistory((p) => !p)} className="flex-1 py-2 bg-gray-700 text-white rounded font-bold text-xs hover:bg-gray-600">
          {showHistory ? 'Nascondi storico' : 'Storico'}
        </button>
        <button onClick={onClose} className="flex-1 py-2 bg-gray-600 text-white rounded font-bold text-xs hover:bg-gray-500">
          Chiudi
        </button>
      </div>

      {showHistory && <HistoryView />}
    </div>
  );
}

function HistoryView() {
  const history = loadQuizHistory();
  const recent = history.slice(-10).reverse();

  if (recent.length === 0) {
    return <div className="text-gray-500 text-xs text-center py-2">Nessuno storico disponibile</div>;
  }

  // Calculate averages by type across recent sessions
  const allAnswers = recent.flatMap((s) => s.questions);
  const avgAlt = averageByType(allAnswers, 'altitude');
  const avgDist = averageByType(allAnswers, 'distance');
  const avgAz = averageByType(allAnswers, 'azimuth');

  return (
    <div className="space-y-2 border-t border-gray-700 pt-2">
      <div className="text-xs text-gray-400 font-medium">Ultime 10 sessioni — medie</div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div><span className="text-gray-500">Alt:</span> <span className="text-white">{avgAlt ?? '-'}</span></div>
        <div><span className="text-gray-500">Dist:</span> <span className="text-white">{avgDist ?? '-'}</span></div>
        <div><span className="text-gray-500">Az:</span> <span className="text-white">{avgAz ?? '-'}</span></div>
      </div>
      <div className="space-y-1 max-h-[120px] overflow-y-auto">
        {recent.map((s, i) => (
          <div key={i} className="flex justify-between text-xs text-gray-400">
            <span>{new Date(s.date).toLocaleDateString('it-IT')}</span>
            <span className="font-bold text-white">{s.average}/100</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

## Task 6: QuizMarkers component

**Files:**
- Create: `src/components/map/QuizMarkers.tsx`

- [ ] **Step 1: Create QuizMarkers component**

```typescript
// src/components/map/QuizMarkers.tsx
'use client';

import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { QuizPoint } from '@/lib/quiz';

const quizIconA = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#a855f7;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">?</div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const quizIconB = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#f97316;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">?</div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function QuizMarkers({ pointA, pointB }: {
  pointA: QuizPoint | null;
  pointB?: QuizPoint | null;
}) {
  return (
    <>
      {pointA && (
        <Marker position={[pointA.lat, pointA.lon]} icon={quizIconA} interactive={false} />
      )}
      {pointB && (
        <Marker position={[pointB.lat, pointB.lon]} icon={quizIconB} interactive={false} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

## Task 7: QuizOverlay — full implementation

**Files:**
- Replace: `src/components/quiz/QuizOverlay.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// src/components/quiz/QuizOverlay.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QuizQuestionView } from './QuizQuestion';
import { QuizSummary } from './QuizSummary';
import type { QuizQuestion, QuizAnswer, QuestionType, QuizPoint } from '@/lib/quiz';
import { generateRandomPoint, generateQuestionSet, calculateQuizScore, saveQuizSession } from '@/lib/quiz';
import { haversineDistance, forwardAzimuth } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';

type QuizPhase = 'loading' | 'question' | 'summary';

// Access map bounds via a global ref set by InteractiveMap
let mapBoundsRef: { north: number; south: number; east: number; west: number } | null = null;
export function setQuizMapBounds(bounds: typeof mapBoundsRef) { mapBoundsRef = bounds; }

async function buildQuestion(type: QuestionType): Promise<QuizQuestion | null> {
  const bounds = mapBoundsRef;
  if (!bounds) return null;

  const pointA = generateRandomPoint(bounds, 0.1);

  if (type === 'altitude') {
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = attempt === 0 ? pointA : generateRandomPoint(bounds, 0.1);
      const alt = await fetchElevation(p.lat, p.lon);
      if (alt != null) {
        return {
          type: 'altitude',
          pointA: p,
          realValue: Math.round(alt),
          unit: 'm',
          prompt: 'Stima l\'altitudine del punto indicato sulla mappa.',
        };
      }
    }
    return null;
  }

  // distance or azimuth — need two points with min 0.5km distance
  let pointB: QuizPoint;
  let dist: number;
  let attempts = 0;
  do {
    pointB = generateRandomPoint(bounds, 0.1);
    dist = haversineDistance(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
    attempts++;
  } while (dist < 0.5 && attempts < 10);

  if (dist < 0.5) return null;

  if (type === 'distance') {
    return {
      type: 'distance',
      pointA,
      pointB,
      realValue: Math.round(dist * 100) / 100,
      unit: 'km',
      prompt: 'Stima la distanza in linea d\'aria tra i due punti.',
    };
  }

  // azimuth
  const az = forwardAzimuth(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
  return {
    type: 'azimuth',
    pointA,
    pointB,
    realValue: Math.round(az * 10) / 10,
    unit: '°',
    prompt: 'Stima l\'azimuth (in gradi) dal punto A al punto B.',
  };
}

export function QuizOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<QuizPhase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [currentPoints, setCurrentPoints] = useState<{ a: QuizPoint | null; b: QuizPoint | null }>({ a: null, b: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const startSession = useCallback(async () => {
    setPhase('loading');
    setAnswers([]);
    setCurrentIdx(0);
    setCurrentPoints({ a: null, b: null });

    const bounds = mapBoundsRef;
    if (!bounds) {
      onClose();
      return;
    }

    const types = generateQuestionSet(bounds);
    const built: QuizQuestion[] = [];
    for (const type of types) {
      const q = await buildQuestion(type);
      if (!mountedRef.current) return;
      if (q) built.push(q);
    }

    if (built.length === 0) {
      alert('Impossibile generare domande. Prova a zoomare su un\'area diversa.');
      onClose();
      return;
    }

    setQuestions(built);
    setCurrentPoints({ a: built[0].pointA, b: built[0].pointB ?? null });
    setPhase('question');
  }, [onClose]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  const handleAnswer = useCallback((answer: QuizAnswer) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    const nextIdx = currentIdx + 1;
    if (nextIdx < questions.length) {
      setCurrentIdx(nextIdx);
      const next = questions[nextIdx];
      setCurrentPoints({ a: next.pointA, b: next.pointB ?? null });
    } else {
      const average = Math.round(newAnswers.reduce((sum, a) => sum + a.score, 0) / newAnswers.length);
      saveQuizSession({
        date: new Date().toISOString(),
        questions: newAnswers,
        average,
      });
      setCurrentPoints({ a: null, b: null });
      setPhase('summary');
    }
  }, [answers, currentIdx, questions]);

  const handleNewSession = useCallback(() => {
    startSession();
  }, [startSession]);

  // Expose current quiz points for map markers
  useEffect(() => {
    const event = new CustomEvent('quiz-points', { detail: currentPoints });
    window.dispatchEvent(event);
  }, [currentPoints]);

  const average = answers.length > 0
    ? Math.round(answers.reduce((sum, a) => sum + a.score, 0) / answers.length)
    : 0;

  return (
    <div className="fixed bottom-[100px] lg:bottom-[120px] left-1/2 -translate-x-1/2 z-[1200] bg-gray-900/95 border border-gray-700 rounded-xl w-[calc(100%-1rem)] max-w-sm p-4 shadow-2xl">
      {phase === 'loading' && (
        <div className="text-center text-gray-400 text-sm py-4">Generazione domande...</div>
      )}
      {phase === 'question' && questions[currentIdx] && (
        <QuizQuestionView
          question={questions[currentIdx]}
          questionNumber={currentIdx + 1}
          onAnswer={handleAnswer}
        />
      )}
      {phase === 'summary' && (
        <QuizSummary
          answers={answers}
          average={average}
          onNewSession={handleNewSession}
          onClose={onClose}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire QuizMarkers into InteractiveMap**

In `src/components/map/InteractiveMap.tsx`:

Add import:
```typescript
import { QuizMarkers } from './QuizMarkers';
import { setQuizMapBounds } from '@/components/quiz/QuizOverlay';
import type { QuizPoint } from '@/lib/quiz';
```

Add a component that syncs map bounds and listens for quiz points:
```typescript
function QuizBoundsSync({ quizActive }: { quizActive?: boolean }) {
  const map = useMap();
  const [quizPoints, setQuizPoints] = useState<{ a: QuizPoint | null; b: QuizPoint | null }>({ a: null, b: null });

  useEffect(() => {
    if (!quizActive) {
      setQuizMapBounds(null);
      setQuizPoints({ a: null, b: null });
      return;
    }
    const updateBounds = () => {
      const b = map.getBounds();
      setQuizMapBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    };
    updateBounds();
    map.on('moveend', updateBounds);

    const handlePoints = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setQuizPoints(detail);
    };
    window.addEventListener('quiz-points', handlePoints);

    return () => {
      map.off('moveend', updateBounds);
      window.removeEventListener('quiz-points', handlePoints);
      setQuizMapBounds(null);
    };
  }, [quizActive, map]);

  if (!quizActive) return null;
  return <QuizMarkers pointA={quizPoints.a} pointB={quizPoints.b} />;
}
```

Add `useState` import if not already present for the new component.

Add inside `<MapContainer>`, after `<RulerTool>`:
```tsx
<QuizBoundsSync quizActive={quizActive} />
```

- [ ] **Step 3: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit`
Run: `npx jest --no-cache`

---

## Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest --no-cache`
Expected: all tests pass

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run production build**

Run: `npx next build`
Expected: build succeeds

- [ ] **Step 4: Manual smoke test**

Verify in browser:
1. Quiz button appears in ModeSwitch (purple "?")
2. Clicking Quiz disables compass and ruler
3. Quiz generates questions with markers on the map
4. User can answer, sees score and correct value
5. After 5 questions, summary shows with category breakdown
6. History persists across sessions
7. "Nuova sessione" starts fresh
8. Map is still pannable/zoomable during quiz
9. Map click does NOT add waypoint during quiz
