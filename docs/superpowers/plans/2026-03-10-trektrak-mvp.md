# TrekTrak MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of TrekTrak — a didactic web app for learning manual cartography through trekking itinerary creation, with manual data input and on-demand validation.

**Architecture:** Next.js 15 App Router with a single-page layout. Zustand store holds all itinerary state. Pure utility functions handle calculations (Munter, Haversine, azimuth, slope, difficulty). React-Leaflet renders the interactive map. Recharts renders the elevation profile. jsPDF generates PDF exports. All persistence via localStorage with schema versioning.

**Tech Stack:** Next.js 15, TypeScript, React-Leaflet, Zustand, Recharts, jsPDF, html2canvas, Tailwind CSS, @dnd-kit/core, @dnd-kit/sortable

**Spec:** `docs/superpowers/specs/2026-03-10-trektrak-design.md`

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout with Tailwind, metadata
│   ├── page.tsx                    # Main page — two-column layout
│   └── globals.css                 # Tailwind imports + custom styles
├── components/
│   ├── map/
│   │   ├── MapWrapper.tsx           # Dynamic import wrapper (no SSR)
│   │   ├── InteractiveMap.tsx      # Leaflet map with markers, route line
│   │   └── ElevationProfile.tsx    # Recharts area chart
│   ├── panel/
│   │   ├── LeftPanel.tsx           # Main left panel container
│   │   ├── ItineraryHeader.tsx     # Itinerary name + save/load buttons
│   │   ├── WaypointList.tsx        # Sortable waypoint list (@dnd-kit)
│   │   ├── WaypointCard.tsx        # Single waypoint with input fields
│   │   ├── LegCard.tsx             # Single leg with input fields + derived data
│   │   ├── ItineraryTable.tsx      # Read-only summary table of all legs
│   │   ├── SummaryBar.tsx          # Totals: distance, elevation, time, difficulty
│   │   ├── ActionBar.tsx           # PDF, GPX, Verify buttons
│   │   └── SavedItinerariesModal.tsx # List saved itineraries with load/delete
│   ├── settings/
│   │   └── ToleranceSettings.tsx   # Modal for tolerance configuration
│   ├── validation/
│   │   └── ValidationBadge.tsx     # Green/yellow/red indicator with tooltip
│   └── shared/
│       └── NumberInput.tsx         # Reusable number input with label + validation badge
├── stores/
│   └── itineraryStore.ts           # Zustand store: waypoints, legs, settings, CRUD
├── lib/
│   ├── types.ts                    # TypeScript interfaces (Waypoint, Leg, etc.)
│   ├── calculations.ts            # Munter, Haversine, azimuth, slope, difficulty
│   ├── validation.ts              # Validation logic + API calls
│   ├── elevation-api.ts           # OpenTopoData + Open-Elevation with fallback
│   ├── export-pdf.ts              # PDF generation (summary + roadbook)
│   ├── export-gpx.ts              # GPX 1.1 generation
│   ├── export-json.ts             # JSON import/export for backup
│   └── storage.ts                 # localStorage CRUD with schema versioning
└── __tests__/
    ├── calculations.test.ts        # Unit tests for all calculation functions
    ├── validation.test.ts          # Unit tests for validation logic
    ├── elevation-api.test.ts       # Unit tests for API client (mocked)
    ├── export-gpx.test.ts          # Unit tests for GPX generation
    ├── storage.test.ts             # Unit tests for localStorage operations
    └── itineraryStore.test.ts      # Unit tests for Zustand store
```

---

## Chunk 1: Project Setup + Data Types + Calculations

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js 15 project**

Run:
```bash
npx create-next-app@latest C:/Progettiscemi/TrekTrak --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

Select defaults when prompted. This creates the full scaffolding.

- [ ] **Step 2: Install core dependencies**

Run:
```bash
npm install --prefix C:/Progettiscemi/TrekTrak zustand recharts react-leaflet leaflet jspdf html2canvas @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
npm install --save-dev --prefix C:/Progettiscemi/TrekTrak @types/leaflet jest @jest/globals ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

- [ ] **Step 4: Configure Jest**

Create `C:/Progettiscemi/TrekTrak/jest.config.ts`:

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
};

export default config;
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, ensure `"scripts"` contains:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Verify project builds and tests run**

Run `npm run build --prefix C:/Progettiscemi/TrekTrak` — expected: successful build.
Run `npm test --prefix C:/Progettiscemi/TrekTrak -- --passWithNoTests` — expected: "No tests found" with exit 0.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "chore: scaffold Next.js 15 project with dependencies"
```

---

### Task 2: TypeScript Data Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create type definitions**

```typescript
// src/lib/types.ts

export type ValidationStatus = 'unverified' | 'valid' | 'warning' | 'error';

export interface ValidationResult {
  status: ValidationStatus;
  userValue: number;
  realValue?: number;
  delta?: number;
  tolerance: { strict: number; loose: number };
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  order: number;
  validationState?: {
    altitude?: ValidationResult;
  };
}

export interface Leg {
  id: string;
  fromWaypointId: string;
  toWaypointId: string;
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  azimuth: number | null;
  estimatedTime?: number;
  slope?: number;
  validationState?: {
    distance?: ValidationResult;
    elevationGain?: ValidationResult;
    elevationLoss?: ValidationResult;
    azimuth?: ValidationResult;
  };
}

export interface Itinerary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  waypoints: Waypoint[];
  legs: Leg[];
}

export interface ToleranceSettings {
  altitude: number;
  coordinates: number;
  distance: number;
  azimuth: number;
  elevationDelta: number;
}

export interface AppSettings {
  tolerances: ToleranceSettings;
}

export const DEFAULT_TOLERANCES: ToleranceSettings = {
  altitude: 20,
  coordinates: 0.001,
  distance: 10,
  azimuth: 5,
  elevationDelta: 15,
};

export type DifficultyGrade = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
```

- [ ] **Step 2: Commit**

```
git add src/lib/types.ts
git commit -m "feat: add TypeScript data model interfaces"
```

---

### Task 3: Calculation Functions (TDD)

**Files:**
- Create: `src/lib/calculations.ts`
- Create: `src/__tests__/calculations.test.ts`

- [ ] **Step 1: Write failing tests for Haversine distance**

Note: import only `haversineDistance` initially. Other imports will be added as functions are implemented.

```typescript
// src/__tests__/calculations.test.ts
import { describe, expect, test } from '@jest/globals';
import { haversineDistance } from '../lib/calculations';

describe('haversineDistance', () => {
  test('returns 0 for same point', () => {
    expect(haversineDistance(46.0, 11.0, 46.0, 11.0)).toBeCloseTo(0, 1);
  });

  test('calculates known distance (Trento to Bolzano ~55km)', () => {
    const dist = haversineDistance(46.0667, 11.1167, 46.4983, 11.3548);
    expect(dist).toBeGreaterThan(48);
    expect(dist).toBeLessThan(52);
  });

  test('calculates short distance (~1km)', () => {
    // approx 1 degree lat = 111km, so 0.009 degrees ~ 1km
    const dist = haversineDistance(46.0, 11.0, 46.009, 11.0);
    expect(dist).toBeGreaterThan(0.9);
    expect(dist).toBeLessThan(1.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=calculations`
Expected: FAIL — "Cannot find module '../lib/calculations'"

- [ ] **Step 3: Implement haversineDistance**

```typescript
// src/lib/calculations.ts

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
```

- [ ] **Step 4: Run test to verify haversine passes**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=calculations`
Expected: All 3 haversine tests PASS.

- [ ] **Step 5: Write failing tests for forwardAzimuth**

Add import at the top of `calculations.test.ts`: `import { forwardAzimuth } from '../lib/calculations';`

Add to `calculations.test.ts`:

```typescript
describe('forwardAzimuth', () => {
  test('due north is 0 degrees', () => {
    const az = forwardAzimuth(46.0, 11.0, 47.0, 11.0);
    expect(az).toBeCloseTo(0, 0);
  });

  test('due east is 90 degrees', () => {
    const az = forwardAzimuth(46.0, 11.0, 46.0, 12.0);
    expect(az).toBeCloseTo(90, 0);
  });

  test('due south is 180 degrees', () => {
    const az = forwardAzimuth(47.0, 11.0, 46.0, 11.0);
    expect(az).toBeCloseTo(180, 0);
  });

  test('due west is 270 degrees', () => {
    const az = forwardAzimuth(46.0, 12.0, 46.0, 11.0);
    expect(az).toBeCloseTo(270, 0);
  });

  test('same point returns 0', () => {
    expect(forwardAzimuth(46.0, 11.0, 46.0, 11.0)).toBe(0);
  });
});
```

- [ ] **Step 6: Implement forwardAzimuth**

Add to `calculations.ts`:

```typescript
export function forwardAzimuth(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const x = Math.sin(dLon) * Math.cos(lat2R);
  const y =
    Math.cos(lat1R) * Math.sin(lat2R) -
    Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  const bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
}
```

- [ ] **Step 7: Run tests — haversine + azimuth pass**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=calculations`

- [ ] **Step 8: Write failing tests for Munter time**

Add import at the top: `import { calculateMunterTime } from '../lib/calculations';`

Add to `calculations.test.ts`:

```typescript
describe('calculateMunterTime', () => {
  test('flat 4km = 60 minutes', () => {
    expect(calculateMunterTime(4, 0, 0)).toBe(60);
  });

  test('flat 8km = 120 minutes', () => {
    expect(calculateMunterTime(8, 0, 0)).toBe(120);
  });

  test('steep climb dominates: 1km, +400m', () => {
    // T_horiz = 1/4 * 60 = 15 min
    // T_vert = 400/400 * 60 = 60 min
    // total = max(60,15) + 0.5*min(60,15) = 60 + 7.5 = 67.5
    expect(calculateMunterTime(1, 400, 0)).toBeCloseTo(67.5, 1);
  });

  test('steep descent: 1km, -800m', () => {
    // T_horiz = 15 min, T_vert = 800/800 * 60 = 60 min
    // total = 60 + 7.5 = 67.5
    expect(calculateMunterTime(1, 0, 800)).toBeCloseTo(67.5, 1);
  });

  test('mixed elevation uses max of gain/loss vertical time', () => {
    // T_horiz = 2/4 * 60 = 30 min
    // T_vert_gain = 200/400 * 60 = 30 min
    // T_vert_loss = 100/800 * 60 = 7.5 min
    // T_vert = max(30, 7.5) = 30 min
    // total = max(30, 30) + 0.5 * min(30, 30) = 30 + 15 = 45
    expect(calculateMunterTime(2, 200, 100)).toBeCloseTo(45, 1);
  });

  test('returns 0 for zero distance and zero elevation', () => {
    expect(calculateMunterTime(0, 0, 0)).toBe(0);
  });
});
```

- [ ] **Step 9: Implement calculateMunterTime**

Add to `calculations.ts`:

```typescript
export function calculateMunterTime(
  distanceKm: number,
  elevationGainM: number,
  elevationLossM: number
): number {
  if (distanceKm === 0 && elevationGainM === 0 && elevationLossM === 0) return 0;
  const tHoriz = (distanceKm / 4) * 60;
  const tVertGain = (elevationGainM / 400) * 60;
  const tVertLoss = (elevationLossM / 800) * 60;
  const tVert = Math.max(tVertGain, tVertLoss);
  return Math.max(tHoriz, tVert) + 0.5 * Math.min(tHoriz, tVert);
}
```

- [ ] **Step 10: Run tests — all Munter tests pass**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=calculations`

- [ ] **Step 11: Write failing tests for slope and difficulty**

Add imports at the top: `import { calculateSlope, calculateDifficulty } from '../lib/calculations';`

Add to `calculations.test.ts`:

```typescript
describe('calculateSlope', () => {
  test('flat terrain = 0%', () => {
    expect(calculateSlope(1, 0, 0)).toBe(0);
  });

  test('100m gain over 1km = 10%', () => {
    expect(calculateSlope(1, 100, 0)).toBeCloseTo(10, 1);
  });

  test('uses net elevation (gain - loss)', () => {
    // net = 200 - 50 = 150m over 2km = 2000m -> 7.5%
    expect(calculateSlope(2, 200, 50)).toBeCloseTo(7.5, 1);
  });

  test('negative net elevation returns absolute value', () => {
    expect(calculateSlope(1, 0, 100)).toBeCloseTo(10, 1);
  });

  test('zero distance returns 0', () => {
    expect(calculateSlope(0, 100, 0)).toBe(0);
  });
});

describe('calculateDifficulty', () => {
  test('0% slope = T1', () => {
    expect(calculateDifficulty(0)).toBe('T1');
  });

  test('14% slope = T1', () => {
    expect(calculateDifficulty(14)).toBe('T1');
  });

  test('15% slope = T2', () => {
    expect(calculateDifficulty(15)).toBe('T2');
  });

  test('25% slope = T3', () => {
    expect(calculateDifficulty(25)).toBe('T3');
  });

  test('35% slope = T4', () => {
    expect(calculateDifficulty(35)).toBe('T4');
  });

  test('45% slope = T5', () => {
    expect(calculateDifficulty(45)).toBe('T5');
  });

  test('55% slope = T6', () => {
    expect(calculateDifficulty(55)).toBe('T6');
  });

  test('100% slope = T6', () => {
    expect(calculateDifficulty(100)).toBe('T6');
  });
});
```

- [ ] **Step 12: Implement slope and difficulty**

Add `import type { DifficultyGrade } from './types';` at the top of `calculations.ts`, then add:

export function calculateSlope(
  distanceKm: number,
  elevationGainM: number,
  elevationLossM: number
): number {
  if (distanceKm === 0) return 0;
  const netElevation = Math.abs(elevationGainM - elevationLossM);
  return (netElevation / (distanceKm * 1000)) * 100;
}

export function calculateDifficulty(maxSlopePercent: number): DifficultyGrade {
  if (maxSlopePercent >= 55) return 'T6';
  if (maxSlopePercent >= 45) return 'T5';
  if (maxSlopePercent >= 35) return 'T4';
  if (maxSlopePercent >= 25) return 'T3';
  if (maxSlopePercent >= 15) return 'T2';
  return 'T1';
}
```

- [ ] **Step 13: Run all tests — everything passes**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=calculations`
Expected: All tests PASS.

- [ ] **Step 14: Add azimuthToCardinal utility**

Add import at the top: `import { azimuthToCardinal } from '../lib/calculations';`

Add test:

```typescript
describe('azimuthToCardinal', () => {
  test('0 degrees = N', () => {
    expect(azimuthToCardinal(0)).toBe('N');
  });
  test('45 degrees = NE', () => {
    expect(azimuthToCardinal(45)).toBe('NE');
  });
  test('90 degrees = E', () => {
    expect(azimuthToCardinal(90)).toBe('E');
  });
  test('180 degrees = S', () => {
    expect(azimuthToCardinal(180)).toBe('S');
  });
  test('270 degrees = W', () => {
    expect(azimuthToCardinal(270)).toBe('W');
  });
  test('350 degrees = N', () => {
    expect(azimuthToCardinal(350)).toBe('N');
  });
});
```

Add implementation:

```typescript
export function azimuthToCardinal(azimuth: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(azimuth / 45) % 8;
  return directions[index];
}
```

- [ ] **Step 15: Run all tests — everything passes**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=calculations`

- [ ] **Step 16: Commit**

```
git add src/lib/calculations.ts src/__tests__/calculations.test.ts
git commit -m "feat: add calculation functions (Haversine, azimuth, Munter, slope, difficulty)"
```

---

## Chunk 2: Storage + Zustand Store + Elevation API

### Task 4: localStorage Storage Layer (TDD)

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/__tests__/storage.test.ts`

- [ ] **Step 1: Write failing tests for storage**

```typescript
// src/__tests__/storage.test.ts
import { describe, expect, test, beforeEach } from '@jest/globals';
import {
  saveItinerary,
  loadItineraries,
  deleteItinerary,
  saveSettings,
  loadSettings,
  getStorageUsage,
  SCHEMA_VERSION,
} from '../lib/storage';
import type { Itinerary, AppSettings } from '../lib/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const makeItinerary = (id: string, name: string): Itinerary => ({
  id,
  name,
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  waypoints: [],
  legs: [],
});

beforeEach(() => {
  localStorageMock.clear();
});

describe('saveItinerary and loadItineraries', () => {
  test('saves and loads an itinerary', () => {
    const it = makeItinerary('1', 'Test Route');
    saveItinerary(it);
    const loaded = loadItineraries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Test Route');
  });

  test('updates existing itinerary by id', () => {
    saveItinerary(makeItinerary('1', 'Original'));
    saveItinerary({ ...makeItinerary('1', 'Updated'), updatedAt: '2026-03-11T00:00:00Z' });
    const loaded = loadItineraries();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Updated');
  });

  test('saves multiple itineraries', () => {
    saveItinerary(makeItinerary('1', 'Route A'));
    saveItinerary(makeItinerary('2', 'Route B'));
    expect(loadItineraries()).toHaveLength(2);
  });
});

describe('deleteItinerary', () => {
  test('removes itinerary by id', () => {
    saveItinerary(makeItinerary('1', 'To Delete'));
    deleteItinerary('1');
    expect(loadItineraries()).toHaveLength(0);
  });

  test('no-op for non-existent id', () => {
    saveItinerary(makeItinerary('1', 'Keep'));
    deleteItinerary('999');
    expect(loadItineraries()).toHaveLength(1);
  });
});

describe('settings', () => {
  test('loads default settings when none saved', () => {
    const settings = loadSettings();
    expect(settings.tolerances.altitude).toBe(20);
    expect(settings.tolerances.azimuth).toBe(5);
  });

  test('saves and loads custom settings', () => {
    const custom: AppSettings = {
      tolerances: { altitude: 30, coordinates: 0.002, distance: 15, azimuth: 10, elevationDelta: 20 },
    };
    saveSettings(custom);
    expect(loadSettings().tolerances.altitude).toBe(30);
  });
});

describe('getStorageUsage', () => {
  test('returns bytes used', () => {
    saveItinerary(makeItinerary('1', 'Test'));
    const usage = getStorageUsage();
    expect(usage).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=storage`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement storage.ts**

```typescript
// src/lib/storage.ts
import type { Itinerary, AppSettings } from './types';
import { DEFAULT_TOLERANCES } from './types';

export const SCHEMA_VERSION = 1;

const KEYS = {
  itineraries: 'trektrak_itineraries',
  settings: 'trektrak_settings',
  learningHistory: 'trektrak_learning_history',
  schema: 'trektrak_schema_version',
} as const;

const STORAGE_WARNING_BYTES = 4 * 1024 * 1024; // 4MB

function initSchema(): void {
  const version = localStorage.getItem(KEYS.schema);
  if (!version) {
    localStorage.setItem(KEYS.schema, String(SCHEMA_VERSION));
  }
  // Future migrations would go here
}

export function loadItineraries(): Itinerary[] {
  initSchema();
  const raw = localStorage.getItem(KEYS.itineraries);
  if (!raw) return [];
  return JSON.parse(raw) as Itinerary[];
}

export function saveItinerary(itinerary: Itinerary): void {
  initSchema();
  const all = loadItineraries();
  const idx = all.findIndex((it) => it.id === itinerary.id);
  if (idx >= 0) {
    all[idx] = itinerary;
  } else {
    all.push(itinerary);
  }
  localStorage.setItem(KEYS.itineraries, JSON.stringify(all));
}

export function deleteItinerary(id: string): void {
  const all = loadItineraries().filter((it) => it.id !== id);
  localStorage.setItem(KEYS.itineraries, JSON.stringify(all));
}

export function loadSettings(): AppSettings {
  initSchema();
  const raw = localStorage.getItem(KEYS.settings);
  if (!raw) return { tolerances: { ...DEFAULT_TOLERANCES } };
  return JSON.parse(raw) as AppSettings;
}

export function saveSettings(settings: AppSettings): void {
  initSchema();
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function getStorageUsage(): number {
  let total = 0;
  for (const key of Object.values(KEYS)) {
    const value = localStorage.getItem(key);
    if (value) total += key.length + value.length;
  }
  return total * 2; // UTF-16 = 2 bytes per char
}

export function isStorageNearLimit(): boolean {
  return getStorageUsage() > STORAGE_WARNING_BYTES;
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=storage`

- [ ] **Step 5: Commit**

```
git add src/lib/storage.ts src/__tests__/storage.test.ts
git commit -m "feat: add localStorage storage layer with schema versioning"
```

---

### Task 5: Elevation API Client (TDD)

**Files:**
- Create: `src/lib/elevation-api.ts`
- Create: `src/__tests__/elevation-api.test.ts`

- [ ] **Step 1: Write failing tests with mocked fetch**

```typescript
// src/__tests__/elevation-api.test.ts
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { fetchElevation } from '../lib/elevation-api';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchElevation', () => {
  test('returns elevation from OpenTopoData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ elevation: 1450.2, location: { lat: 46.0, lng: 11.0 } }],
      }),
    } as Response);

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeCloseTo(1450.2, 1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('opentopodata');
  });

  test('falls back to Open-Elevation on primary failure', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ elevation: 1448.0, latitude: 46.0, longitude: 11.0 }],
        }),
      } as Response);

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeCloseTo(1448.0, 1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('returns null if both APIs fail', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=elevation-api`

- [ ] **Step 3: Implement elevation-api.ts**

```typescript
// src/lib/elevation-api.ts

const OPENTOPO_URL = 'https://api.opentopodata.org/v1/eudem25m';
const OPEN_ELEVATION_URL = 'https://api.open-elevation.com/api/v1/lookup';
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  // Try OpenTopoData first
  try {
    const response = await fetchWithTimeout(
      `${OPENTOPO_URL}?locations=${lat},${lon}`,
      TIMEOUT_MS
    );
    if (response.ok) {
      const data = await response.json();
      const elevation = data?.results?.[0]?.elevation;
      if (typeof elevation === 'number') return elevation;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: Open-Elevation
  try {
    const response = await fetchWithTimeout(
      `${OPEN_ELEVATION_URL}?locations=${lat},${lon}`,
      TIMEOUT_MS
    );
    if (response.ok) {
      const data = await response.json();
      const elevation = data?.results?.[0]?.elevation;
      if (typeof elevation === 'number') return elevation;
    }
  } catch {
    // Both failed
  }

  return null;
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=elevation-api`

- [ ] **Step 5: Commit**

```
git add src/lib/elevation-api.ts src/__tests__/elevation-api.test.ts
git commit -m "feat: add elevation API client with OpenTopoData + fallback"
```

---

### Task 6: Validation Logic (TDD)

**Files:**
- Create: `src/lib/validation.ts`
- Create: `src/__tests__/validation.test.ts`

- [ ] **Step 1: Write failing tests for validation**

```typescript
// src/__tests__/validation.test.ts
import { describe, expect, test } from '@jest/globals';
import { validateValue, determineStatus } from '../lib/validation';
import type { ValidationResult } from '../lib/types';

describe('determineStatus', () => {
  test('within strict tolerance = valid', () => {
    expect(determineStatus(100, 110, 20, 40)).toBe('valid');
  });

  test('within loose tolerance = warning', () => {
    expect(determineStatus(100, 130, 20, 40)).toBe('warning');
  });

  test('beyond loose tolerance = error', () => {
    expect(determineStatus(100, 150, 20, 40)).toBe('error');
  });

  test('exact match = valid', () => {
    expect(determineStatus(100, 100, 20, 40)).toBe('valid');
  });
});

describe('validateValue (absolute tolerance)', () => {
  test('altitude within strict tolerance', () => {
    const result = validateValue(1450, 1460, { strict: 20, loose: 40 });
    expect(result.status).toBe('valid');
    expect(result.delta).toBe(10);
  });

  test('altitude within loose tolerance', () => {
    const result = validateValue(1450, 1485, { strict: 20, loose: 40 });
    expect(result.status).toBe('warning');
  });

  test('altitude beyond loose tolerance', () => {
    const result = validateValue(1450, 1500, { strict: 20, loose: 40 });
    expect(result.status).toBe('error');
    expect(result.delta).toBe(50);
  });
});

describe('validateValue (percentage tolerance)', () => {
  test('distance 10% tolerance: 3.0 vs 3.2 = valid', () => {
    // delta = 0.2, strict = 10% of 3.2 = 0.32
    const result = validateValue(3.0, 3.2, { strict: 0.32, loose: 0.64 });
    expect(result.status).toBe('valid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=validation`

- [ ] **Step 3: Implement validation.ts**

```typescript
// src/lib/validation.ts
import type { ValidationResult, ValidationStatus } from './types';

export function determineStatus(
  userValue: number,
  realValue: number,
  strictTolerance: number,
  looseTolerance: number
): ValidationStatus {
  const delta = Math.abs(userValue - realValue);
  if (delta <= strictTolerance) return 'valid';
  if (delta <= looseTolerance) return 'warning';
  return 'error';
}

export function validateValue(
  userValue: number,
  realValue: number,
  tolerance: { strict: number; loose: number }
): ValidationResult {
  const delta = Math.abs(userValue - realValue);
  const status = determineStatus(userValue, realValue, tolerance.strict, tolerance.loose);
  return {
    status,
    userValue,
    realValue,
    delta,
    tolerance,
  };
}

export function percentageTolerance(
  referenceValue: number,
  percentStrict: number
): { strict: number; loose: number } {
  const strict = Math.abs(referenceValue) * (percentStrict / 100);
  return { strict, loose: strict * 2 };
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=validation`

- [ ] **Step 5: Commit**

```
git add src/lib/validation.ts src/__tests__/validation.test.ts
git commit -m "feat: add validation logic with strict/loose tolerance levels"
```

---

### Task 7: Zustand Store

**Files:**
- Create: `src/stores/itineraryStore.ts`
- Create: `src/__tests__/itineraryStore.test.ts`

- [ ] **Step 1: Write failing tests for the store**

```typescript
// src/__tests__/itineraryStore.test.ts
import { describe, expect, test, beforeEach } from '@jest/globals';
import { useItineraryStore } from '../stores/itineraryStore';

beforeEach(() => {
  useItineraryStore.setState({
    itineraryId: 'test-id',
    itineraryName: '',
    waypoints: [],
    legs: [],
    settings: { tolerances: { altitude: 20, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 } },
  });
});

describe('waypoint management', () => {
  test('adds a waypoint', () => {
    useItineraryStore.getState().addWaypoint();
    expect(useItineraryStore.getState().waypoints).toHaveLength(1);
    expect(useItineraryStore.getState().waypoints[0].order).toBe(0);
  });

  test('adds second waypoint and creates a leg', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    expect(useItineraryStore.getState().legs).toHaveLength(1);
  });

  test('removes a waypoint and its connected legs', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    // 3 waypoints, 2 legs
    const wpId = useItineraryStore.getState().waypoints[1].id;
    useItineraryStore.getState().removeWaypoint(wpId);
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    // removing middle WP: legs from/to it are removed, new leg created between remaining
    expect(useItineraryStore.getState().legs).toHaveLength(1);
  });

  test('updates waypoint fields', () => {
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, { name: 'Rifugio', altitude: 1450 });
    expect(useItineraryStore.getState().waypoints[0].name).toBe('Rifugio');
    expect(useItineraryStore.getState().waypoints[0].altitude).toBe(1450);
  });

  test('updates waypoint lat/lon from map click', () => {
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypointPosition(wpId, 46.0, 11.0);
    expect(useItineraryStore.getState().waypoints[0].lat).toBe(46.0);
    expect(useItineraryStore.getState().waypoints[0].lon).toBe(11.0);
    // altitude should remain null
    expect(useItineraryStore.getState().waypoints[0].altitude).toBeNull();
  });
});

describe('leg management', () => {
  test('updates leg fields', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, { distance: 3.2, azimuth: 245 });
    expect(useItineraryStore.getState().legs[0].distance).toBe(3.2);
    expect(useItineraryStore.getState().legs[0].azimuth).toBe(245);
  });

  test('auto-calculates estimated time when leg data is complete', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      distance: 4,
      elevationGain: 0,
      elevationLoss: 0,
    });
    expect(useItineraryStore.getState().legs[0].estimatedTime).toBe(60);
  });
});

describe('reorder waypoints', () => {
  test('reordering resets leg data', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, { distance: 5 });
    // Reorder: swap positions
    useItineraryStore.getState().reorderWaypoints([1, 0]);
    // Legs should be recreated with null data
    expect(useItineraryStore.getState().legs[0].distance).toBeNull();
  });
});

describe('itinerary name', () => {
  test('sets itinerary name', () => {
    useItineraryStore.getState().setItineraryName('Monte Rosa');
    expect(useItineraryStore.getState().itineraryName).toBe('Monte Rosa');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=itineraryStore`

- [ ] **Step 3: Implement the Zustand store**

```typescript
// src/stores/itineraryStore.ts
import { create } from 'zustand';
import type { Waypoint, Leg, AppSettings } from '../lib/types';
import { DEFAULT_TOLERANCES } from '../lib/types';
import { calculateMunterTime, calculateSlope } from '../lib/calculations';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyLeg(fromId: string, toId: string): Leg {
  return {
    id: generateId(),
    fromWaypointId: fromId,
    toWaypointId: toId,
    distance: null,
    elevationGain: null,
    elevationLoss: null,
    azimuth: null,
  };
}

function recalculateLeg(leg: Leg): Leg {
  const { distance, elevationGain, elevationLoss } = leg;
  if (distance != null && elevationGain != null && elevationLoss != null) {
    return {
      ...leg,
      estimatedTime: calculateMunterTime(distance, elevationGain, elevationLoss),
      slope: calculateSlope(distance, elevationGain, elevationLoss),
    };
  }
  return { ...leg, estimatedTime: undefined, slope: undefined };
}

interface ItineraryState {
  itineraryId: string;
  itineraryName: string;
  waypoints: Waypoint[];
  legs: Leg[];
  settings: AppSettings;

  setItineraryName: (name: string) => void;
  addWaypoint: () => void;
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, data: Partial<Waypoint>) => void;
  updateWaypointPosition: (id: string, lat: number, lon: number) => void;
  updateLeg: (id: string, data: Partial<Leg>) => void;
  reorderWaypoints: (newOrder: number[]) => void;
  updateSettings: (settings: AppSettings) => void;
  resetItinerary: () => void;
  loadItinerary: (id: string, name: string, waypoints: Waypoint[], legs: Leg[]) => void;
}

const initialState = {
  itineraryId: generateId(),
  itineraryName: '',
  waypoints: [] as Waypoint[],
  legs: [] as Leg[],
  settings: { tolerances: { ...DEFAULT_TOLERANCES } } as AppSettings,
};

export const useItineraryStore = create<ItineraryState>()((set, get) => ({
  ...initialState,

  setItineraryName: (name) => set({ itineraryName: name }),

  addWaypoint: () => {
    const { waypoints, legs } = get();
    const newWp: Waypoint = {
      id: generateId(),
      name: '',
      lat: null,
      lon: null,
      altitude: null,
      order: waypoints.length,
    };
    const newLegs = [...legs];
    if (waypoints.length > 0) {
      const lastWp = waypoints[waypoints.length - 1];
      newLegs.push(createEmptyLeg(lastWp.id, newWp.id));
    }
    set({ waypoints: [...waypoints, newWp], legs: newLegs });
  },

  removeWaypoint: (id) => {
    const { waypoints, legs } = get();
    const filtered = waypoints.filter((wp) => wp.id !== id);
    const reordered = filtered.map((wp, i) => ({ ...wp, order: i }));
    // Rebuild legs for new consecutive pairs
    const newLegs: Leg[] = [];
    for (let i = 0; i < reordered.length - 1; i++) {
      const existing = legs.find(
        (l) => l.fromWaypointId === reordered[i].id && l.toWaypointId === reordered[i + 1].id
      );
      newLegs.push(existing ?? createEmptyLeg(reordered[i].id, reordered[i + 1].id));
    }
    set({ waypoints: reordered, legs: newLegs });
  },

  updateWaypoint: (id, data) => {
    set({
      waypoints: get().waypoints.map((wp) =>
        wp.id === id ? { ...wp, ...data } : wp
      ),
    });
  },

  updateWaypointPosition: (id, lat, lon) => {
    set({
      waypoints: get().waypoints.map((wp) =>
        wp.id === id ? { ...wp, lat, lon } : wp
      ),
    });
  },

  updateLeg: (id, data) => {
    set({
      legs: get().legs.map((leg) => {
        if (leg.id !== id) return leg;
        const updated = { ...leg, ...data };
        return recalculateLeg(updated);
      }),
    });
  },

  reorderWaypoints: (newOrder) => {
    const { waypoints } = get();
    const reordered = newOrder.map((oldIdx, newIdx) => ({
      ...waypoints[oldIdx],
      order: newIdx,
    }));
    const newLegs: Leg[] = [];
    for (let i = 0; i < reordered.length - 1; i++) {
      newLegs.push(createEmptyLeg(reordered[i].id, reordered[i + 1].id));
    }
    set({ waypoints: reordered, legs: newLegs });
  },

  updateSettings: (settings) => set({ settings }),

  resetItinerary: () => set({ ...initialState, itineraryId: generateId() }),

  loadItinerary: (id, name, waypoints, legs) => set({
    itineraryId: id,
    itineraryName: name,
    waypoints,
    legs,
  }),
}));
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=itineraryStore`

- [ ] **Step 5: Commit**

```
git add src/stores/itineraryStore.ts src/__tests__/itineraryStore.test.ts
git commit -m "feat: add Zustand itinerary store with waypoint/leg CRUD"
```

---

## Chunk 3: Export Functions (GPX + PDF)

### Task 8: GPX Export (TDD)

**Files:**
- Create: `src/lib/export-gpx.ts`
- Create: `src/__tests__/export-gpx.test.ts`

- [ ] **Step 1: Write failing tests for GPX generation**

```typescript
// src/__tests__/export-gpx.test.ts
import { describe, expect, test } from '@jest/globals';
import { generateGPX } from '../lib/export-gpx';
import type { Waypoint } from '../lib/types';

const waypoints: Waypoint[] = [
  { id: '1', name: 'Rifugio', lat: 46.123, lon: 11.456, altitude: 1450, order: 0 },
  { id: '2', name: 'Passo', lat: 46.098, lon: 11.432, altitude: 1870, order: 1 },
];

describe('generateGPX', () => {
  test('generates valid GPX 1.1 XML', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
  });

  test('includes waypoints with wpt tags', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<wpt lat="46.123" lon="11.456">');
    expect(gpx).toContain('<name>Rifugio</name>');
    expect(gpx).toContain('<ele>1450</ele>');
  });

  test('includes track with trkseg', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<trk>');
    expect(gpx).toContain('<trkseg>');
    expect(gpx).toContain('<trkpt lat="46.123" lon="11.456">');
  });

  test('includes metadata with name', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<metadata>');
    expect(gpx).toContain('<name>Test Route</name>');
  });

  test('handles waypoints without altitude', () => {
    const wps: Waypoint[] = [
      { id: '1', name: 'A', lat: 46.0, lon: 11.0, altitude: null, order: 0 },
    ];
    const gpx = generateGPX('Test', wps);
    expect(gpx).not.toContain('<ele>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=export-gpx`

- [ ] **Step 3: Implement GPX generation**

```typescript
// src/lib/export-gpx.ts
import type { Waypoint } from './types';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateGPX(name: string, waypoints: Waypoint[]): string {
  const validWps = waypoints.filter((wp) => wp.lat != null && wp.lon != null);

  const wptElements = validWps
    .map((wp) => {
      const ele = wp.altitude != null ? `\n      <ele>${wp.altitude}</ele>` : '';
      return `    <wpt lat="${wp.lat}" lon="${wp.lon}">${ele}
      <name>${escapeXml(wp.name || `WP${wp.order + 1}`)}</name>
    </wpt>`;
    })
    .join('\n');

  const trkptElements = validWps
    .map((wp) => {
      const ele = wp.altitude != null ? `\n        <ele>${wp.altitude}</ele>` : '';
      return `      <trkpt lat="${wp.lat}" lon="${wp.lon}">${ele}
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="TrekTrak">
  <metadata>
    <name>${escapeXml(name || 'TrekTrak Route')}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wptElements}
  <trk>
    <name>${escapeXml(name || 'TrekTrak Route')}</name>
    <trkseg>
${trkptElements}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGPX(name: string, waypoints: Waypoint[]): void {
  const gpx = generateGPX(name, waypoints);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name || 'trektrak-route'}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak -- --testPathPattern=export-gpx`

- [ ] **Step 5: Commit**

```
git add src/lib/export-gpx.ts src/__tests__/export-gpx.test.ts
git commit -m "feat: add GPX 1.1 export with waypoints and track"
```

---

### Task 9: PDF Export

**Files:**
- Create: `src/lib/export-pdf.ts`

This task does NOT use TDD because PDF generation depends on DOM/canvas rendering which is impractical to unit test. We'll test manually.

- [ ] **Step 1: Create PDF export module**

```typescript
// src/lib/export-pdf.ts
import jsPDF from 'jspdf';
import type { Waypoint, Leg, DifficultyGrade } from './types';
import { azimuthToCardinal } from './calculations';

interface PdfData {
  name: string;
  waypoints: Waypoint[];
  legs: Leg[];
  totalDistance: number;
  totalElevGain: number;
  totalElevLoss: number;
  totalTime: number;
  difficulty: DifficultyGrade;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function generateSummaryPDF(data: PdfData): jsPDF {
  const doc = new jsPDF();
  const { name, waypoints, legs, totalDistance, totalElevGain, totalElevLoss, totalTime, difficulty } = data;

  // Title
  doc.setFontSize(20);
  doc.text(name || 'Itinerario TrekTrak', 14, 20);

  // Summary line
  doc.setFontSize(10);
  doc.text(
    `Distanza: ${totalDistance.toFixed(1)} km | Dislivello: +${totalElevGain}m / -${totalElevLoss}m | Tempo: ${formatTime(totalTime)} | Difficolta': ${difficulty}`,
    14, 30
  );

  // Table header
  let y = 45;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['#', 'Da', 'A', 'Dist (km)', 'D+ (m)', 'D- (m)', 'Azimuth', 'Tempo', 'Pend %'];
  const colX = [14, 22, 55, 88, 108, 128, 148, 168, 188];
  headers.forEach((h, i) => doc.text(h, colX[i], y));

  doc.setFont('helvetica', 'normal');
  y += 8;

  legs.forEach((leg, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);
    const row = [
      String(i + 1),
      from?.name || `WP${i + 1}`,
      to?.name || `WP${i + 2}`,
      leg.distance != null ? leg.distance.toFixed(1) : '-',
      leg.elevationGain != null ? String(leg.elevationGain) : '-',
      leg.elevationLoss != null ? String(leg.elevationLoss) : '-',
      leg.azimuth != null ? `${leg.azimuth}° ${azimuthToCardinal(leg.azimuth)}` : '-',
      leg.estimatedTime != null ? formatTime(leg.estimatedTime) : '-',
      leg.slope != null ? leg.slope.toFixed(1) : '-',
    ];
    row.forEach((cell, j) => doc.text(cell, colX[j], y));
    y += 6;
  });

  // Waypoint details
  y += 10;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Waypoint', 14, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  waypoints.forEach((wp) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(
      `${wp.order + 1}. ${wp.name || 'Senza nome'} — Lat: ${wp.lat ?? '-'}, Lon: ${wp.lon ?? '-'}, Alt: ${wp.altitude ?? '-'}m`,
      14, y
    );
    y += 6;
  });

  return doc;
}

export function generateRoadbookPDF(data: PdfData): jsPDF {
  const doc = generateSummaryPDF(data);
  const { waypoints, legs } = data;

  // Add detailed leg pages
  legs.forEach((leg, i) => {
    doc.addPage();
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);

    doc.setFontSize(14);
    doc.text(`Tratta ${i + 1}: ${from?.name || `WP${i + 1}`} → ${to?.name || `WP${i + 2}`}`, 14, 20);

    let y = 35;
    doc.setFontSize(11);
    const details = [
      `Distanza: ${leg.distance != null ? `${leg.distance.toFixed(1)} km` : '-'}`,
      `Dislivello: +${leg.elevationGain ?? '-'}m / -${leg.elevationLoss ?? '-'}m`,
      `Azimuth: ${leg.azimuth != null ? `${leg.azimuth}° ${azimuthToCardinal(leg.azimuth)}` : '-'}`,
      `Pendenza: ${leg.slope != null ? `${leg.slope.toFixed(1)}%` : '-'}`,
      `Tempo stimato: ${leg.estimatedTime != null ? formatTime(leg.estimatedTime) : '-'}`,
    ];

    // Azimuth change from previous leg
    if (i > 0 && legs[i - 1].azimuth != null && leg.azimuth != null) {
      let delta = leg.azimuth - legs[i - 1].azimuth;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const direction = delta > 0 ? 'destra' : 'sinistra';
      details.push(`Variazione azimuth: ${Math.abs(delta).toFixed(0)}° a ${direction}`);
    }

    details.forEach((d) => {
      doc.text(d, 14, y);
      y += 8;
    });

    // From/To coordinates
    y += 5;
    doc.setFontSize(9);
    doc.text(`Partenza: ${from?.name} (${from?.lat ?? '-'}, ${from?.lon ?? '-'}) alt. ${from?.altitude ?? '-'}m`, 14, y);
    y += 6;
    doc.text(`Arrivo: ${to?.name} (${to?.lat ?? '-'}, ${to?.lon ?? '-'}) alt. ${to?.altitude ?? '-'}m`, 14, y);
  });

  return doc;
}

export function downloadPDF(data: PdfData, format: 'summary' | 'roadbook'): void {
  const doc = format === 'summary'
    ? generateSummaryPDF(data)
    : generateRoadbookPDF(data);
  doc.save(`${data.name || 'trektrak-itinerario'}-${format}.pdf`);
}
```

- [ ] **Step 2: Commit**

```
git add src/lib/export-pdf.ts
git commit -m "feat: add PDF export (summary + roadbook formats)"
```

---

### Task 9b: JSON Import/Export for Backup

**Files:**
- Create: `src/lib/export-json.ts`

- [ ] **Step 1: Create JSON export/import module**

```typescript
// src/lib/export-json.ts
import type { Itinerary } from './types';

export function exportItineraryJSON(itinerary: Itinerary): void {
  const json = JSON.stringify(itinerary, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${itinerary.name || 'trektrak-itinerario'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importItineraryJSON(onLoad: (itinerary: Itinerary) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const itinerary = JSON.parse(ev.target?.result as string) as Itinerary;
        if (!itinerary.waypoints || !itinerary.legs) {
          alert('File JSON non valido: mancano waypoints o legs');
          return;
        }
        onLoad(itinerary);
      } catch {
        alert('Errore nel parsing del file JSON');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
```

- [ ] **Step 2: Commit**

```
git add src/lib/export-json.ts
git commit -m "feat: add JSON import/export for itinerary backup"
```

---

## Chunk 4: UI Components — Map + Left Panel

### Task 10: Shared Components

**Files:**
- Create: `src/components/shared/NumberInput.tsx`
- Create: `src/components/validation/ValidationBadge.tsx`

- [ ] **Step 1: Create ValidationBadge**

```tsx
// src/components/validation/ValidationBadge.tsx
'use client';

import type { ValidationResult } from '@/lib/types';

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

export function ValidationBadge({ result }: { result?: ValidationResult }) {
  if (!result || result.status === 'unverified') return null;

  const tooltip =
    result.realValue != null
      ? `Valore reale: ${result.realValue.toFixed(2)}, Delta: ${result.delta?.toFixed(2)}`
      : '';

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${STATUS_STYLES[result.status]}`}
      title={tooltip}
    >
      {STATUS_LABELS[result.status]}
    </span>
  );
}
```

- [ ] **Step 2: Create NumberInput**

```tsx
// src/components/shared/NumberInput.tsx
'use client';

import type { ValidationResult } from '@/lib/types';
import { ValidationBadge } from '@/components/validation/ValidationBadge';

interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  validation?: ValidationResult;
  placeholder?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  validation,
  placeholder,
}: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 uppercase flex items-center gap-1">
        {label}
        {unit && <span className="text-gray-500">({unit})</span>}
        <ValidationBadge result={validation} />
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/components/shared/NumberInput.tsx src/components/validation/ValidationBadge.tsx
git commit -m "feat: add NumberInput and ValidationBadge shared components"
```

---

### Task 11: WaypointCard + LegCard Components

**Files:**
- Create: `src/components/panel/WaypointCard.tsx`
- Create: `src/components/panel/LegCard.tsx`

- [ ] **Step 1: Create WaypointCard**

```tsx
// src/components/panel/WaypointCard.tsx
'use client';

import type { Waypoint } from '@/lib/types';
import { NumberInput } from '@/components/shared/NumberInput';
import { useItineraryStore } from '@/stores/itineraryStore';

export function WaypointCard({ waypoint, dragHandleProps }: { waypoint: Waypoint; dragHandleProps?: Record<string, unknown> }) {
  const updateWaypoint = useItineraryStore((s) => s.updateWaypoint);
  const removeWaypoint = useItineraryStore((s) => s.removeWaypoint);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-green-400 font-bold text-sm">
          {waypoint.order + 1}. {waypoint.name || 'Senza nome'}
        </span>
        <div className="flex gap-1 items-center">
          <span {...dragHandleProps} className="cursor-grab text-gray-600 hover:text-gray-400 text-xs px-1" title="Trascina per riordinare">
            ☰
          </span>
          <button
            onClick={() => removeWaypoint(waypoint.id)}
            className="text-gray-500 hover:text-red-400 text-xs px-1"
            title="Rimuovi"
          >
            ✗
          </button>
        </div>
      </div>
      <div className="mb-2">
        <input
          type="text"
          value={waypoint.name}
          onChange={(e) => updateWaypoint(waypoint.id, { name: e.target.value })}
          placeholder="Nome waypoint..."
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-green-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput
          label="Lat"
          value={waypoint.lat}
          onChange={(v) => updateWaypoint(waypoint.id, { lat: v })}
          step={0.001}
          placeholder="46.123"
        />
        <NumberInput
          label="Lon"
          value={waypoint.lon}
          onChange={(v) => updateWaypoint(waypoint.id, { lon: v })}
          step={0.001}
          placeholder="11.456"
        />
        <NumberInput
          label="Alt"
          unit="m"
          value={waypoint.altitude}
          onChange={(v) => updateWaypoint(waypoint.id, { altitude: v })}
          validation={waypoint.validationState?.altitude}
          placeholder="1450"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create LegCard**

```tsx
// src/components/panel/LegCard.tsx
'use client';

import type { Leg } from '@/lib/types';
import { NumberInput } from '@/components/shared/NumberInput';
import { useItineraryStore } from '@/stores/itineraryStore';
import { azimuthToCardinal } from '@/lib/calculations';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function LegCard({ leg }: { leg: Leg }) {
  const updateLeg = useItineraryStore((s) => s.updateLeg);

  return (
    <div className="bg-gray-900 border-l-2 border-green-400 rounded-r-md p-2 ml-3 text-xs">
      <div className="grid grid-cols-4 gap-2">
        <NumberInput
          label="Dist"
          unit="km"
          value={leg.distance}
          onChange={(v) => updateLeg(leg.id, { distance: v })}
          step={0.1}
          min={0}
          validation={leg.validationState?.distance}
          placeholder="3.2"
        />
        <NumberInput
          label="D+"
          unit="m"
          value={leg.elevationGain}
          onChange={(v) => updateLeg(leg.id, { elevationGain: v })}
          min={0}
          validation={leg.validationState?.elevationGain}
          placeholder="420"
        />
        <NumberInput
          label="D-"
          unit="m"
          value={leg.elevationLoss}
          onChange={(v) => updateLeg(leg.id, { elevationLoss: v })}
          min={0}
          validation={leg.validationState?.elevationLoss}
          placeholder="80"
        />
        <NumberInput
          label="Azimuth"
          unit="°"
          value={leg.azimuth}
          onChange={(v) => updateLeg(leg.id, { azimuth: v })}
          min={0}
          max={360}
          validation={leg.validationState?.azimuth}
          placeholder="245"
        />
      </div>
      {/* Derived data */}
      <div className="flex gap-3 mt-2 text-gray-400">
        {leg.estimatedTime != null && (
          <span>Tempo: {formatTime(leg.estimatedTime)}</span>
        )}
        {leg.slope != null && (
          <span>Pendenza: {leg.slope.toFixed(1)}%</span>
        )}
        {leg.azimuth != null && (
          <span>Dir: {azimuthToCardinal(leg.azimuth)}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/components/panel/WaypointCard.tsx src/components/panel/LegCard.tsx
git commit -m "feat: add WaypointCard and LegCard panel components"
```

---

### Task 12: WaypointList + LeftPanel + Header + Summary + Actions

**Files:**
- Create: `src/components/panel/WaypointList.tsx`
- Create: `src/components/panel/ItineraryHeader.tsx`
- Create: `src/components/panel/SummaryBar.tsx`
- Create: `src/components/panel/ActionBar.tsx`
- Create: `src/components/panel/LeftPanel.tsx`

- [ ] **Step 1: Create WaypointList**

```tsx
// src/components/panel/WaypointList.tsx
'use client';

import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useItineraryStore } from '@/stores/itineraryStore';
import { WaypointCard } from './WaypointCard';
import { LegCard } from './LegCard';
import type { Waypoint } from '@/lib/types';

function SortableWaypoint({ waypoint, legAfter }: { waypoint: Waypoint; legAfter?: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: waypoint.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      <WaypointCard waypoint={waypoint} dragHandleProps={{ ...attributes, ...listeners }} />
      {legAfter}
    </div>
  );
}

export function WaypointList() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const addWaypoint = useItineraryStore((s) => s.addWaypoint);
  const reorderWaypoints = useItineraryStore((s) => s.reorderWaypoints);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = waypoints.findIndex((wp) => wp.id === active.id);
    const newIndex = waypoints.findIndex((wp) => wp.id === over.id);
    const newOrder = waypoints.map((_, i) => i);
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, oldIndex);
    reorderWaypoints(newOrder);
  }, [waypoints, reorderWaypoints]);

  const wpIds = waypoints.map((wp) => wp.id);
  const maxWaypoints = 50;

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      <div className="text-xs uppercase text-gray-500 px-2">Waypoint</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={wpIds} strategy={verticalListSortingStrategy}>
          {waypoints.map((wp, i) => (
            <SortableWaypoint
              key={wp.id}
              waypoint={wp}
              legAfter={i < legs.length ? <LegCard leg={legs[i]} /> : undefined}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        onClick={() => {
          if (waypoints.length >= maxWaypoints) {
            alert(`Massimo ${maxWaypoints} waypoint per itinerario`);
            return;
          }
          addWaypoint();
        }}
        className="w-full border border-dashed border-gray-600 rounded-lg p-3 text-gray-500 hover:text-green-400 hover:border-green-400 transition text-sm"
      >
        + Aggiungi waypoint (o clicca sulla mappa)
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create ItineraryHeader**

```tsx
// src/components/panel/ItineraryHeader.tsx
'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveItinerary, loadItineraries, isStorageNearLimit } from '@/lib/storage';
import { SavedItinerariesModal } from './SavedItinerariesModal';
import { exportItineraryJSON, importItineraryJSON } from '@/lib/export-json';

export function ItineraryHeader() {
  const store = useItineraryStore();
  const { itineraryId, itineraryName, waypoints, legs, setItineraryName, loadItinerary, resetItinerary } = store;
  const [showSaved, setShowSaved] = useState(false);
  const [createdAt] = useState(() => new Date().toISOString());

  const handleSave = () => {
    const existing = loadItineraries().find((it) => it.id === itineraryId);
    saveItinerary({
      id: itineraryId,
      name: itineraryName,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt: new Date().toISOString(),
      waypoints,
      legs,
    });
    if (isStorageNearLimit()) {
      alert('Attenzione: lo spazio di archiviazione locale si sta esaurendo. Esporta i tuoi itinerari in JSON e cancella quelli vecchi.');
    }
  };

  const handleExportJSON = () => {
    exportItineraryJSON({ id: itineraryId, name: itineraryName, createdAt, updatedAt: new Date().toISOString(), waypoints, legs });
  };

  const handleImportJSON = () => {
    importItineraryJSON((itinerary) => {
      loadItinerary(itinerary.id, itinerary.name, itinerary.waypoints, itinerary.legs);
    });
  };

  return (
    <div className="border-b border-gray-700">
      <div className="p-3 flex items-center justify-between">
        <span className="text-lg font-bold text-green-400">&#9650; TrekTrak</span>
        <div className="flex gap-1">
          <button onClick={handleSave} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">
            Salva
          </button>
          <button onClick={() => setShowSaved(true)} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">
            Carica
          </button>
          <button onClick={resetItinerary} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600">
            Nuovo
          </button>
          <button onClick={handleExportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Esporta JSON">
            ↓
          </button>
          <button onClick={handleImportJSON} className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600" title="Importa JSON">
            ↑
          </button>
        </div>
      {showSaved && <SavedItinerariesModal onClose={() => setShowSaved(false)} />}
      </div>
      <div className="px-3 pb-3">
        <input
          type="text"
          value={itineraryName}
          onChange={(e) => setItineraryName(e.target.value)}
          placeholder="Nome itinerario..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create SummaryBar**

```tsx
// src/components/panel/SummaryBar.tsx
'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { calculateDifficulty } from '@/lib/calculations';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function SummaryBar() {
  const legs = useItineraryStore((s) => s.legs);

  const totalDistance = legs.reduce((sum, l) => sum + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((sum, l) => sum + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((sum, l) => sum + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((sum, l) => sum + (l.estimatedTime ?? 0), 0);
  const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));
  const difficulty = calculateDifficulty(maxSlope);

  return (
    <div className="border-t border-gray-700 p-3 bg-gray-900">
      <div className="flex justify-between text-xs mb-1">
        <span>{totalDistance.toFixed(1)} km</span>
        <span className="text-red-400">+{totalGain}m</span>
        <span className="text-blue-400">-{totalLoss}m</span>
        <span>{formatTime(totalTime)}</span>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Difficolta: {difficulty}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ActionBar**

```tsx
// src/components/panel/ActionBar.tsx
'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadPDF } from '@/lib/export-pdf';
import { downloadGPX } from '@/lib/export-gpx';
import { calculateDifficulty } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';
import { validateValue, percentageTolerance } from '@/lib/validation';
import { haversineDistance, forwardAzimuth } from '@/lib/calculations';

export function ActionBar() {
  const store = useItineraryStore();
  const { itineraryName, waypoints, legs, settings } = store;

  const totalDistance = legs.reduce((sum, l) => sum + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((sum, l) => sum + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((sum, l) => sum + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((sum, l) => sum + (l.estimatedTime ?? 0), 0);
  const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));

  const handlePDF = (format: 'summary' | 'roadbook') => {
    if (waypoints.length < 2) {
      alert('Aggiungi almeno 2 waypoint');
      return;
    }
    downloadPDF({
      name: itineraryName,
      waypoints,
      legs,
      totalDistance,
      totalElevGain: totalGain,
      totalElevLoss: totalLoss,
      totalTime,
      difficulty: calculateDifficulty(maxSlope),
    }, format);
  };

  const handleGPX = () => {
    if (waypoints.length < 2) {
      alert('Aggiungi almeno 2 waypoint');
      return;
    }
    downloadGPX(itineraryName, waypoints);
  };

  const handleVerify = async () => {
    const tol = settings.tolerances;
    let apiAvailable = true;

    // Validate waypoint altitudes
    for (const wp of waypoints) {
      if (wp.lat == null || wp.lon == null || wp.altitude == null) continue;
      const realAlt = await fetchElevation(wp.lat, wp.lon);
      if (realAlt == null) {
        apiAvailable = false;
        continue; // Non-blocking: skip this waypoint, continue with others
      }
      const result = validateValue(wp.altitude, realAlt, {
        strict: tol.altitude,
        loose: tol.altitude * 2,
      });
      store.updateWaypoint(wp.id, {
        validationState: { altitude: result },
      });
    }

    // Validate leg data
    for (const leg of legs) {
      const from = waypoints.find((w) => w.id === leg.fromWaypointId);
      const to = waypoints.find((w) => w.id === leg.toWaypointId);
      if (!from?.lat || !from?.lon || !to?.lat || !to?.lon) continue;

      const updates: Partial<typeof leg.validationState> = {};

      // Distance validation
      if (leg.distance != null) {
        const realDist = haversineDistance(from.lat, from.lon, to.lat, to.lon);
        updates.distance = validateValue(
          leg.distance,
          realDist,
          percentageTolerance(realDist, tol.distance)
        );
      }

      // Azimuth validation
      if (leg.azimuth != null) {
        const realAz = forwardAzimuth(from.lat, from.lon, to.lat, to.lon);
        updates.azimuth = validateValue(leg.azimuth, realAz, {
          strict: tol.azimuth,
          loose: tol.azimuth * 2,
        });
      }

      // Elevation gain/loss validation (requires API altitudes)
      const fromAlt = await fetchElevation(from.lat, from.lon);
      const toAlt = await fetchElevation(to.lat, to.lon);
      if (fromAlt != null && toAlt != null) {
        const realGain = Math.max(0, toAlt - fromAlt);
        const realLoss = Math.max(0, fromAlt - toAlt);
        if (leg.elevationGain != null) {
          updates.elevationGain = validateValue(
            leg.elevationGain,
            realGain,
            percentageTolerance(realGain || 1, tol.elevationDelta)
          );
        }
        if (leg.elevationLoss != null) {
          updates.elevationLoss = validateValue(
            leg.elevationLoss,
            realLoss,
            percentageTolerance(realLoss || 1, tol.elevationDelta)
          );
        }
      }

      store.updateLeg(leg.id, { validationState: { ...leg.validationState, ...updates } });
    }

    if (!apiAvailable) {
      alert('Alcuni dati non sono stati verificati: servizio altimetrico non disponibile. Distanza e azimuth sono stati comunque validati.');
    }
  };

  return (
    <div className="border-t border-gray-700 p-3 flex gap-2">
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
      <button
        onClick={handleVerify}
        className="flex-1 py-2 bg-purple-500 text-black rounded font-bold text-xs hover:bg-purple-400"
      >
        Verifica
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create SavedItinerariesModal**

```tsx
// src/components/panel/SavedItinerariesModal.tsx
'use client';

import { loadItineraries, deleteItinerary } from '@/lib/storage';
import { useItineraryStore } from '@/stores/itineraryStore';

export function SavedItinerariesModal({ onClose }: { onClose: () => void }) {
  const loadItinerary = useItineraryStore((s) => s.loadItinerary);
  const all = loadItineraries();

  const handleLoad = (it: typeof all[0]) => {
    loadItinerary(it.id, it.name, it.waypoints, it.legs);
    onClose();
  };

  const handleDelete = (id: string) => {
    if (confirm('Eliminare questo itinerario?')) {
      deleteItinerary(id);
      onClose(); // Re-open will refresh the list
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 max-h-[70vh] flex flex-col">
        <h3 className="text-lg font-bold text-green-400 mb-4">Itinerari salvati</h3>
        {all.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun itinerario salvato</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {all.map((it) => (
              <div key={it.id} className="bg-gray-900 rounded p-3 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{it.name || 'Senza nome'}</div>
                  <div className="text-xs text-gray-500">
                    {it.waypoints.length} waypoint | {new Date(it.updatedAt).toLocaleDateString('it-IT')}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleLoad(it)} className="px-2 py-1 bg-green-600 rounded text-xs hover:bg-green-500">
                    Carica
                  </button>
                  <button onClick={() => handleDelete(it.id)} className="px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-500">
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="mt-4 w-full py-2 bg-gray-700 rounded text-sm hover:bg-gray-600">
          Chiudi
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create ItineraryTable**

```tsx
// src/components/panel/ItineraryTable.tsx
'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { azimuthToCardinal, calculateDifficulty } from '@/lib/calculations';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function ItineraryTable() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  if (legs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Aggiungi almeno 2 waypoint per vedere la tabella
      </div>
    );
  }

  const totalDist = legs.reduce((s, l) => s + (l.distance ?? 0), 0);
  const totalGain = legs.reduce((s, l) => s + (l.elevationGain ?? 0), 0);
  const totalLoss = legs.reduce((s, l) => s + (l.elevationLoss ?? 0), 0);
  const totalTime = legs.reduce((s, l) => s + (l.estimatedTime ?? 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-gray-400 uppercase bg-gray-900">
          <tr>
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">Da</th>
            <th className="px-2 py-1">A</th>
            <th className="px-2 py-1">Dist</th>
            <th className="px-2 py-1">D+</th>
            <th className="px-2 py-1">D-</th>
            <th className="px-2 py-1">Az</th>
            <th className="px-2 py-1">Tempo</th>
            <th className="px-2 py-1">Pend</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => {
            const from = waypoints.find((w) => w.id === leg.fromWaypointId);
            const to = waypoints.find((w) => w.id === leg.toWaypointId);
            return (
              <tr key={leg.id} className="border-b border-gray-800">
                <td className="px-2 py-1">{i + 1}</td>
                <td className="px-2 py-1">{from?.name || `WP${i + 1}`}</td>
                <td className="px-2 py-1">{to?.name || `WP${i + 2}`}</td>
                <td className="px-2 py-1">{leg.distance?.toFixed(1) ?? '-'}</td>
                <td className="px-2 py-1 text-red-400">{leg.elevationGain ?? '-'}</td>
                <td className="px-2 py-1 text-blue-400">{leg.elevationLoss ?? '-'}</td>
                <td className="px-2 py-1">{leg.azimuth != null ? `${leg.azimuth}° ${azimuthToCardinal(leg.azimuth)}` : '-'}</td>
                <td className="px-2 py-1">{leg.estimatedTime != null ? formatTime(leg.estimatedTime) : '-'}</td>
                <td className="px-2 py-1">{leg.slope != null ? `${leg.slope.toFixed(1)}%` : '-'}</td>
              </tr>
            );
          })}
          <tr className="font-bold bg-gray-900">
            <td className="px-2 py-1" colSpan={3}>Totale</td>
            <td className="px-2 py-1">{totalDist.toFixed(1)}</td>
            <td className="px-2 py-1 text-red-400">{totalGain}</td>
            <td className="px-2 py-1 text-blue-400">{totalLoss}</td>
            <td className="px-2 py-1">-</td>
            <td className="px-2 py-1">{formatTime(totalTime)}</td>
            <td className="px-2 py-1">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Create LeftPanel**

```tsx
// src/components/panel/LeftPanel.tsx
'use client';

import { useState } from 'react';
import { ItineraryHeader } from './ItineraryHeader';
import { WaypointList } from './WaypointList';
import { ItineraryTable } from './ItineraryTable';
import { SummaryBar } from './SummaryBar';
import { ActionBar } from './ActionBar';

export function LeftPanel() {
  const [view, setView] = useState<'edit' | 'table'>('edit');

  return (
    <div className="w-full lg:w-[380px] flex flex-col bg-gray-900 border-r border-gray-700 h-full">
      <ItineraryHeader />
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setView('edit')}
          className={`flex-1 py-2 text-xs text-center ${view === 'edit' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
        >
          Modifica
        </button>
        <button
          onClick={() => setView('table')}
          className={`flex-1 py-2 text-xs text-center ${view === 'table' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
        >
          Tabella
        </button>
      </div>
      {view === 'edit' ? <WaypointList /> : <ItineraryTable />}
      <SummaryBar />
      <ActionBar />
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```
git add src/components/panel/
git commit -m "feat: add left panel components (header, waypoint list, table, summary, actions)"
```

---

### Task 13: Interactive Map Component

**Files:**
- Create: `src/components/map/MapWrapper.tsx`
- Create: `src/components/map/InteractiveMap.tsx`

- [ ] **Step 1: Create InteractiveMap (Leaflet + React-Leaflet)**

```tsx
// src/components/map/InteractiveMap.tsx
'use client';

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useCallback } from 'react';

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function greenIcon(label: number) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#4ade80;color:#000;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid #fff;">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapEvents() {
  const addWaypoint = useItineraryStore((s) => s.addWaypoint);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const updateWaypointPosition = useItineraryStore((s) => s.updateWaypointPosition);

  useMapEvents({
    click(e) {
      addWaypoint();
      // After adding, update the latest waypoint with clicked coordinates
      const state = useItineraryStore.getState();
      const lastWp = state.waypoints[state.waypoints.length - 1];
      if (lastWp) {
        updateWaypointPosition(lastWp.id, e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return null;
}

export function InteractiveMap() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const updateWaypointPosition = useItineraryStore((s) => s.updateWaypointPosition);

  const validWaypoints = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  const routePositions = validWaypoints.map((wp) => [wp.lat!, wp.lon!] as [number, number]);

  const handleDragEnd = useCallback(
    (wpId: string, e: L.DragEndEvent) => {
      const { lat, lng } = e.target.getLatLng();
      updateWaypointPosition(wpId, lat, lng);
    },
    [updateWaypointPosition]
  );

  return (
    <MapContainer
      center={[46.07, 11.12]}
      zoom={12}
      className="h-full w-full"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents />

      {validWaypoints.map((wp) => (
        <Marker
          key={wp.id}
          position={[wp.lat!, wp.lon!]}
          icon={greenIcon(wp.order + 1)}
          draggable
          eventHandlers={{
            dragend: (e) => handleDragEnd(wp.id, e),
          }}
        />
      ))}

      {routePositions.length >= 2 && (
        <Polyline positions={routePositions} color="#4ade80" weight={3} />
      )}
    </MapContainer>
  );
}
```

- [ ] **Step 2: Create MapContainer wrapper (dynamic import, no SSR)**

```tsx
// src/components/map/MapWrapper.tsx
'use client';

import dynamic from 'next/dynamic';

const InteractiveMap = dynamic(
  () => import('./InteractiveMap').then((m) => ({ default: m.InteractiveMap })),
  { ssr: false, loading: () => <div className="h-full w-full bg-gray-800 flex items-center justify-center text-gray-500">Caricamento mappa...</div> }
);

export function MapWrapper() {
  return <InteractiveMap />;
}
```

- [ ] **Step 3: Commit**

```
git add src/components/map/
git commit -m "feat: add interactive Leaflet map with markers and route line"
```

---

### Task 14: Elevation Profile Component

**Files:**
- Create: `src/components/map/ElevationProfile.tsx`

- [ ] **Step 1: Create ElevationProfile with Recharts**

```tsx
// src/components/map/ElevationProfile.tsx
'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';

export function ElevationProfile() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  if (waypoints.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Aggiungi almeno 2 waypoint per il profilo altimetrico
      </div>
    );
  }

  // Build cumulative distance / altitude data
  let cumulativeDist = 0;
  const data = waypoints.map((wp, i) => {
    if (i > 0 && legs[i - 1]?.distance != null) {
      cumulativeDist += legs[i - 1].distance!;
    }
    return {
      distance: parseFloat(cumulativeDist.toFixed(2)),
      altitude: wp.altitude ?? 0,
      name: wp.name || `WP${i + 1}`,
    };
  });

  return (
    <div className="h-full p-2">
      <div className="text-xs text-gray-500 mb-1">Profilo altimetrico</div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="altGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="distance" tick={{ fontSize: 10, fill: '#999' }} unit=" km" />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="m" />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #444', fontSize: 12 }}
            labelStyle={{ color: '#4ade80' }}
          />
          <Area
            type="monotone"
            dataKey="altitude"
            stroke="#4ade80"
            fill="url(#altGradient)"
            strokeWidth={2}
          />
          {data.map((point, i) => (
            <ReferenceDot
              key={i}
              x={point.distance}
              y={point.altitude}
              r={4}
              fill="#4ade80"
              stroke="#fff"
              strokeWidth={1}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/map/ElevationProfile.tsx
git commit -m "feat: add Recharts elevation profile component"
```

---

## Chunk 5: Main Page Layout + Settings + Polish

### Task 15: Tolerance Settings Modal

**Files:**
- Create: `src/components/settings/ToleranceSettings.tsx`

- [ ] **Step 1: Create settings modal**

```tsx
// src/components/settings/ToleranceSettings.tsx
'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveSettings } from '@/lib/storage';
import type { ToleranceSettings as TolSettings } from '@/lib/types';

export function ToleranceSettings({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useItineraryStore();
  const [tol, setTol] = useState<TolSettings>({ ...settings.tolerances });

  const handleSave = () => {
    const newSettings = { ...settings, tolerances: tol };
    updateSettings(newSettings);
    saveSettings(newSettings);
    onClose();
  };

  const fields: { key: keyof TolSettings; label: string; unit: string }[] = [
    { key: 'altitude', label: 'Altitudine', unit: 'm' },
    { key: 'coordinates', label: 'Coordinate', unit: 'gradi' },
    { key: 'distance', label: 'Distanza', unit: '%' },
    { key: 'azimuth', label: 'Azimuth', unit: '°' },
    { key: 'elevationDelta', label: 'Dislivello', unit: '%' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-80">
        <h3 className="text-lg font-bold text-green-400 mb-4">Tolleranze di validazione</h3>
        <p className="text-xs text-gray-400 mb-4">
          Soglia stretta = valore impostato. Soglia larga = 2x il valore.
        </p>
        <div className="space-y-3">
          {fields.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm text-gray-300">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={tol[key]}
                  onChange={(e) => setTol({ ...tol, [key]: Number(e.target.value) })}
                  className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white text-right"
                />
                <span className="text-xs text-gray-500 w-10">{unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600">
            Annulla
          </button>
          <button onClick={handleSave} className="flex-1 py-2 bg-green-500 text-black rounded text-sm font-bold hover:bg-green-400">
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/settings/ToleranceSettings.tsx
git commit -m "feat: add tolerance settings modal"
```

---

### Task 16: Main Page Layout

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update globals.css for dark theme**

Replace `src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #__next {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  @apply bg-gray-950 text-white;
}

/* Leaflet overrides */
.leaflet-container {
  background: #1a1a2e;
}
```

- [ ] **Step 2: Update layout.tsx**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrekTrak — Itinerari di Trekking',
  description: 'App didattica per la creazione di itinerari di trekking con cartografia manuale',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Update page.tsx with two-column layout**

Replace `src/app/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { LeftPanel } from '@/components/panel/LeftPanel';
import { MapWrapper } from '@/components/map/MapWrapper';
import { ElevationProfile } from '@/components/map/ElevationProfile';
import { ToleranceSettings } from '@/components/settings/ToleranceSettings';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen flex flex-col lg:flex-row">
      {/* Left Panel */}
      <LeftPanel />

      {/* Right Panel: Map + Elevation Profile */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          <MapWrapper />
          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-3 left-3 z-[1000] bg-gray-800/90 px-2 py-1 rounded text-xs text-gray-400 hover:text-white"
          >
            Impostazioni
          </button>
        </div>
        <div className="h-[120px] bg-gray-900 border-t border-gray-700">
          <ElevationProfile />
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && <ToleranceSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: Verify app builds**

Run: `npm run build --prefix C:/Progettiscemi/TrekTrak`
Expected: Build succeeds.

- [ ] **Step 5: Verify app runs in dev mode**

Run: `npm run dev --prefix C:/Progettiscemi/TrekTrak`
Expected: App loads at localhost:3000, two-column layout visible, map renders, can add waypoints by clicking.

- [ ] **Step 6: Commit**

```
git add src/app/
git commit -m "feat: add main two-column layout with map and elevation profile"
```

---

### Task 17: Final Integration Test

- [ ] **Step 1: Run all unit tests**

Run: `npm test --prefix C:/Progettiscemi/TrekTrak`
Expected: All tests pass.

- [ ] **Step 2: Manual smoke test checklist**

Open `http://localhost:3000` and verify:
1. Two-column layout renders (panel left, map right)
2. Click on map adds a waypoint with lat/lon auto-filled
3. Altitude field remains empty after map click
4. Add 3+ waypoints — legs appear with input fields
5. Fill in leg data — estimated time and slope auto-calculate
6. Summary bar shows totals and difficulty
7. "Verifica" button validates data (green/yellow/red badges appear)
8. PDF Summary downloads correctly
9. PDF Roadbook downloads with leg detail pages
10. GPX file downloads and contains valid XML
11. Save/Load works via localStorage
12. Settings modal opens and saves tolerance changes
13. Mobile view: resize browser to <768px — stacked layout
14. Elevation profile chart renders with waypoint data

- [ ] **Step 3: Commit any fixes found during smoke test**

- [ ] **Step 4: Final commit**

```
git add -A
git commit -m "feat: TrekTrak MVP complete — itinerary planner with validation"
```
