# Quiz POI + Waypoint Auto-naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place quiz points on real hiking POIs/trails via Overpass API, and auto-name waypoints via Nominatim reverse geocoding.

**Architecture:** Two independent features sharing no state. Feature 1 adds `overpass-api.ts` and modifies quiz point selection. Feature 2 adds `reverse-geocoding-api.ts` and hooks into the map click handler. Both degrade gracefully when APIs are unavailable.

**Tech Stack:** Overpass API (OSM), Nominatim reverse geocoding, existing fetch patterns from `geocoding-api.ts` and `elevation-api.ts`.

---

### File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/overpass-api.ts` | Fetch hiking POIs from Overpass API with caching |
| Create | `src/lib/reverse-geocoding-api.ts` | Reverse geocode lat/lon to short hiking-friendly name |
| Create | `src/__tests__/overpass-api.test.ts` | Tests for Overpass query building, response parsing, caching |
| Create | `src/__tests__/reverse-geocoding-api.test.ts` | Tests for name extraction, abbreviation, truncation |
| Modify | `src/lib/quiz.ts` | Add `pickQuizPoint` function |
| Modify | `src/__tests__/quiz.test.ts` | Tests for `pickQuizPoint` |
| Modify | `src/components/quiz/QuizOverlay.tsx` | Use POI-based point selection with fallback |
| Modify | `src/components/map/InteractiveMap.tsx` | Call reverse geocode after waypoint creation |

---

### Task 1: Overpass API module

**Files:**
- Create: `src/lib/overpass-api.ts`
- Create: `src/__tests__/overpass-api.test.ts`

- [ ] **Step 1: Write tests for Overpass query building and response parsing**

In `src/__tests__/overpass-api.test.ts`:

```typescript
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { fetchHikingPOIs, buildOverpassQuery, parseOverpassResponse } from '@/lib/overpass-api';
import type { HikingPOI } from '@/lib/overpass-api';

describe('buildOverpassQuery', () => {
  test('builds query with bbox', () => {
    const q = buildOverpassQuery({ south: 42.0, west: 13.0, north: 42.5, east: 13.5 });
    expect(q).toContain('[out:json]');
    expect(q).toContain('42,13,42.5,13.5');
    expect(q).toContain('natural=peak');
    expect(q).toContain('tourism=alpine_hut');
    expect(q).toContain('sac_scale');
  });
});

describe('parseOverpassResponse', () => {
  test('extracts nodes with name and type', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 42.1, lon: 13.2, tags: { name: 'Monte Amaro', natural: 'peak' } },
        { type: 'node', id: 2, lat: 42.2, lon: 13.3, tags: { name: 'Rifugio Pomilio', tourism: 'alpine_hut' } },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(2);
    expect(pois[0]).toEqual({ lat: 42.1, lon: 13.2, name: 'Monte Amaro', type: 'peak' });
    expect(pois[1]).toEqual({ lat: 42.2, lon: 13.3, name: 'Rifugio Pomilio', type: 'alpine_hut' });
  });

  test('handles nodes without name', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 42.1, lon: 13.2, tags: { natural: 'spring' } },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBeUndefined();
    expect(pois[0].type).toBe('spring');
  });

  test('handles empty response', () => {
    expect(parseOverpassResponse({ elements: [] })).toEqual([]);
    expect(parseOverpassResponse({})).toEqual([]);
    expect(parseOverpassResponse(null)).toEqual([]);
  });

  test('skips elements without lat/lon', () => {
    const data = {
      elements: [
        { type: 'way', id: 1, tags: { highway: 'path' } },
        { type: 'node', id: 2, lat: 42.1, lon: 13.2, tags: { natural: 'peak' } },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
  });

  test('resolves type from multiple tag keys', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 42.1, lon: 13.2, tags: { natural: 'saddle', name: 'Passo X' } },
        { type: 'node', id: 2, lat: 42.2, lon: 13.3, tags: { mountain_pass: 'yes', name: 'Valico Y' } },
        { type: 'node', id: 3, lat: 42.3, lon: 13.4, tags: { tourism: 'wilderness_hut', name: 'Bivacco Z' } },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois[0].type).toBe('saddle');
    expect(pois[1].type).toBe('mountain_pass');
    expect(pois[2].type).toBe('wilderness_hut');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest overpass-api --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement overpass-api.ts**

Create `src/lib/overpass-api.ts`:

```typescript
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT_MS = 8000;

export interface HikingPOI {
  lat: number;
  lon: number;
  name?: string;
  type: string;
}

type Bounds = { north: number; south: number; east: number; west: number };

export function buildOverpassQuery(bounds: Bounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:8];(
    node["natural"="peak"](${bbox});
    node["natural"="saddle"](${bbox});
    node["mountain_pass"="yes"](${bbox});
    node["natural"="spring"](${bbox});
    node["tourism"="alpine_hut"](${bbox});
    node["tourism"="wilderness_hut"](${bbox});
    way["highway"~"path|footway"]["sac_scale"](${bbox});
  );out center 200;`;
}

const TYPE_KEYS = ['natural', 'tourism', 'mountain_pass'] as const;

export function parseOverpassResponse(data: unknown): HikingPOI[] {
  if (!data || typeof data !== 'object') return [];
  const elements = (data as { elements?: unknown[] }).elements;
  if (!Array.isArray(elements)) return [];

  const pois: HikingPOI[] = [];
  for (const el of elements) {
    const e = el as Record<string, unknown>;
    // For ways with center, use center coords
    let lat = e.lat as number | undefined;
    let lon = e.lon as number | undefined;
    if (lat == null && e.center) {
      const c = e.center as { lat?: number; lon?: number };
      lat = c.lat;
      lon = c.lon;
    }
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;

    const tags = (e.tags ?? {}) as Record<string, string>;
    let type = '';
    for (const key of TYPE_KEYS) {
      if (tags[key] && tags[key] !== 'yes') { type = tags[key]; break; }
      if (tags[key] === 'yes') { type = key; break; }
    }
    // Fallback for trail nodes: use sac_scale presence
    if (!type && tags.sac_scale) type = 'trail_node';
    if (!type) continue;

    pois.push({ lat, lon, name: tags.name || undefined, type });
  }
  return pois;
}

// Simple bounds-based cache (rounded to 0.01°)
const cache = new Map<string, { pois: HikingPOI[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(bounds: Bounds): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(bounds.south)},${r(bounds.west)},${r(bounds.north)},${r(bounds.east)}`;
}

export async function fetchHikingPOIs(bounds: Bounds): Promise<HikingPOI[]> {
  const key = cacheKey(bounds);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.pois;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const query = buildOverpassQuery(bounds);
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = await response.json();
    const pois = parseOverpassResponse(data);
    cache.set(key, { pois, timestamp: Date.now() });
    return pois;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest overpass-api --no-coverage`
Expected: all PASS

- [ ] **Step 5: Commit**

```
git add src/lib/overpass-api.ts src/__tests__/overpass-api.test.ts
git commit -m "feat: add Overpass API module for hiking POIs"
```

---

### Task 2: Integrate POI selection into quiz

**Files:**
- Modify: `src/lib/quiz.ts`
- Modify: `src/__tests__/quiz.test.ts`
- Modify: `src/components/quiz/QuizOverlay.tsx`

- [ ] **Step 1: Write test for pickQuizPoint**

Add to `src/__tests__/quiz.test.ts`:

```typescript
import { pickQuizPoint } from '@/lib/quiz';
import type { HikingPOI } from '@/lib/overpass-api';

describe('pickQuizPoint', () => {
  const bounds = { north: 42.5, south: 42.0, east: 13.5, west: 13.0 };

  test('returns a POI from the list when available', () => {
    const pois: HikingPOI[] = [
      { lat: 42.1, lon: 13.2, name: 'Peak', type: 'peak' },
      { lat: 42.3, lon: 13.4, name: 'Hut', type: 'alpine_hut' },
    ];
    const point = pickQuizPoint(bounds, pois);
    expect(point).not.toBeNull();
    const matches = pois.some((p) => p.lat === point!.lat && p.lon === point!.lon);
    expect(matches).toBe(true);
  });

  test('filters POIs outside bounds', () => {
    const pois: HikingPOI[] = [
      { lat: 99.0, lon: 99.0, type: 'peak' },
    ];
    const point = pickQuizPoint(bounds, pois);
    expect(point).toBeNull();
  });

  test('returns null for empty POI list', () => {
    expect(pickQuizPoint(bounds, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest quiz.test --no-coverage`
Expected: FAIL — pickQuizPoint not exported

- [ ] **Step 3: Add pickQuizPoint to quiz.ts**

Add to `src/lib/quiz.ts` after the existing imports:

```typescript
import type { HikingPOI } from './overpass-api';
```

Add before `generateQuestionSet`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest quiz.test --no-coverage`
Expected: all PASS

- [ ] **Step 5: Update QuizOverlay to use POI-based selection**

In `src/components/quiz/QuizOverlay.tsx`, add import:

```typescript
import { fetchHikingPOIs } from '@/lib/overpass-api';
import { generateRandomPoint, generateQuestionSet, saveQuizSession, pickQuizPoint } from '@/lib/quiz';
```

Replace the `buildQuestion` function entirely:

```typescript
async function buildQuestion(type: QuestionType, pois: HikingPOI[]): Promise<QuizQuestion | null> {
  const bounds = mapBoundsRef;
  if (!bounds) return null;

  const getPoint = (): QuizPoint => pickQuizPoint(bounds, pois) ?? generateRandomPoint(bounds, 0.1);

  if (type === 'altitude') {
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = getPoint();
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
  const pointA = getPoint();
  let pointB: QuizPoint;
  let dist: number;
  let attempts = 0;
  do {
    pointB = getPoint();
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

  const az = forwardAzimuth(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
  return {
    type: 'azimuth',
    pointA,
    pointB,
    realValue: Math.round(az * 10) / 10,
    unit: '°',
    prompt: 'Stima l\'azimuth (in gradi) dal punto viola al punto arancione.',
  };
}
```

In the `startSession` callback, fetch POIs before building questions. Replace:

```typescript
    const types = generateQuestionSet(bounds);
    const built: QuizQuestion[] = [];
    for (const type of types) {
      const q = await buildQuestion(type);
```

With:

```typescript
    const pois = await fetchHikingPOIs(bounds);
    const types = generateQuestionSet(bounds);
    const built: QuizQuestion[] = [];
    for (const type of types) {
      const q = await buildQuestion(type, pois);
```

Also add `HikingPOI` type import:

```typescript
import type { HikingPOI } from '@/lib/overpass-api';
```

- [ ] **Step 6: Run full test suite**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 7: Commit**

```
git add src/lib/quiz.ts src/__tests__/quiz.test.ts src/components/quiz/QuizOverlay.tsx
git commit -m "feat: quiz uses Overpass POIs instead of random points"
```

---

### Task 3: Reverse geocoding module

**Files:**
- Create: `src/lib/reverse-geocoding-api.ts`
- Create: `src/__tests__/reverse-geocoding-api.test.ts`

- [ ] **Step 1: Write tests for name extraction and formatting**

Create `src/__tests__/reverse-geocoding-api.test.ts`:

```typescript
import { describe, test, expect } from '@jest/globals';
import { extractHikingName } from '@/lib/reverse-geocoding-api';

describe('extractHikingName', () => {
  test('extracts peak name', () => {
    const data = {
      name: 'Monte Amaro',
      address: { peak: 'Monte Amaro', county: 'Chieti' },
      type: 'peak',
    };
    expect(extractHikingName(data)).toBe('M.te Amaro');
  });

  test('extracts alpine hut', () => {
    const data = {
      name: 'Rifugio Franchetti',
      address: { alpine_hut: 'Rifugio Franchetti' },
      type: 'alpine_hut',
    };
    expect(extractHikingName(data)).toBe('Rif. Franchetti');
  });

  test('extracts saddle', () => {
    const data = {
      name: 'Sella di Corno Grande',
      address: { saddle: 'Sella di Corno Grande' },
      type: 'saddle',
    };
    expect(extractHikingName(data)).toBe('Sella di Corno Grande');
  });

  test('abbreviates Monte', () => {
    expect(extractHikingName({ name: 'Monte Rotondo', type: 'peak', address: {} })).toBe('M.te Rotondo');
  });

  test('abbreviates Rifugio', () => {
    expect(extractHikingName({ name: 'Rifugio Garibaldi', type: 'alpine_hut', address: {} })).toBe('Rif. Garibaldi');
  });

  test('abbreviates Sentiero', () => {
    expect(extractHikingName({ name: 'Sentiero dei Fiori', type: 'path', address: {} })).toBe('Sent. dei Fiori');
  });

  test('truncates to 30 chars', () => {
    const data = { name: 'Rifugio Alpino Grandissimo della Valle Incantata del Nord', type: 'alpine_hut', address: {} };
    const result = extractHikingName(data);
    expect(result!.length).toBeLessThanOrEqual(30);
  });

  test('returns null for empty/missing data', () => {
    expect(extractHikingName(null)).toBeNull();
    expect(extractHikingName({})).toBeNull();
    expect(extractHikingName({ address: {} })).toBeNull();
  });

  test('uses address hiking-priority fields', () => {
    const data = {
      address: {
        tourism: 'Bivacco Pelino',
        village: 'Pietracamela',
        county: 'Teramo',
      },
      type: 'wilderness_hut',
    };
    expect(extractHikingName(data)).toBe('Bivacco Pelino');
  });

  test('falls back to village/hamlet from address', () => {
    const data = {
      address: { hamlet: 'Fonte Cerreto', county: 'L\'Aquila' },
      type: 'residential',
    };
    expect(extractHikingName(data)).toBe('Fonte Cerreto');
  });

  test('returns null for generic results without useful name', () => {
    const data = {
      address: { country: 'Italia', state: 'Abruzzo' },
      type: 'administrative',
    };
    expect(extractHikingName(data)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest reverse-geocoding --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement reverse-geocoding-api.ts**

Create `src/lib/reverse-geocoding-api.ts`:

```typescript
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 5000;
const MAX_NAME_LENGTH = 30;

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bRifugio\b/gi, 'Rif.'],
  [/\bMonte\b/gi, 'M.te'],
  [/\bSentiero\b/gi, 'Sent.'],
  [/\bBivacco\b/gi, 'Biv.'],
  [/\bMalga\b/gi, 'Mlg.'],
];

function abbreviate(name: string): string {
  let result = name;
  for (const [pattern, replacement] of ABBREVIATIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function truncate(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.substring(0, MAX_NAME_LENGTH - 1).trimEnd() + '…';
}

// Priority order for address fields (hiking-relevant first)
const HIKING_ADDRESS_KEYS = [
  'peak', 'alpine_hut', 'wilderness_hut', 'saddle', 'mountain_pass',
  'tourism', 'natural',
  'hamlet', 'village', 'town', 'suburb', 'neighbourhood',
] as const;

export function extractHikingName(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // Try top-level name first (most specific)
  const topName = typeof d.name === 'string' && d.name.trim() ? d.name.trim() : null;

  // Try address fields in priority order
  const address = (d.address ?? {}) as Record<string, string>;
  let addrName: string | null = null;
  for (const key of HIKING_ADDRESS_KEYS) {
    const val = address[key];
    if (typeof val === 'string' && val.trim()) {
      addrName = val.trim();
      break;
    }
  }

  const raw = topName ?? addrName;
  if (!raw) return null;

  return truncate(abbreviate(raw));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      zoom: '18',
      addressdetails: '1',
    });

    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'it,en',
        'User-Agent': 'TrekTrak/1.0 (didactic cartography app)',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return extractHikingName(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest reverse-geocoding --no-coverage`
Expected: all PASS

- [ ] **Step 5: Commit**

```
git add src/lib/reverse-geocoding-api.ts src/__tests__/reverse-geocoding-api.test.ts
git commit -m "feat: add reverse geocoding module with hiking name extraction"
```

---

### Task 4: Integrate auto-naming into map click

**Files:**
- Modify: `src/components/map/InteractiveMap.tsx`

- [ ] **Step 1: Add reverse geocode import**

At the top of `src/components/map/InteractiveMap.tsx`, add:

```typescript
import { reverseGeocode } from '@/lib/reverse-geocoding-api';
```

- [ ] **Step 2: Update MapEvents click handler**

Replace the `click(e)` handler body inside `MapEvents` with:

```typescript
    click(e) {
      if (compassActive || rulerActive || quizActive) return;
      const btn = (e.originalEvent as MouseEvent).button;
      if (btn != null && btn !== 0) return;
      if (useItineraryStore.getState().waypoints.length >= 50) return;
      addWaypointAtPosition(e.latlng.lat, e.latlng.lng);

      const newState = useItineraryStore.getState();
      const newWp = newState.waypoints[newState.waypoints.length - 1];
      if (!newWp) return;

      if (newState.appMode === 'track') {
        autoFillTrackData(newWp.id);
      }

      // Auto-name: fetch reverse geocode, apply only if name still default
      const wpId = newWp.id;
      const defaultName = newWp.name;
      reverseGeocode(e.latlng.lat, e.latlng.lng).then((name) => {
        if (!name) return;
        const current = useItineraryStore.getState().waypoints.find((w) => w.id === wpId);
        if (current && current.name === defaultName) {
          useItineraryStore.getState().updateWaypoint(wpId, { name });
        }
      });
    },
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run full test suite**

Run: `npx jest --no-coverage`
Expected: all PASS

- [ ] **Step 5: Commit**

```
git add src/components/map/InteractiveMap.tsx
git commit -m "feat: auto-name waypoints via reverse geocoding on map click"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full build**

Run: `npx next build`
Expected: build succeeds with no errors

- [ ] **Step 2: Full test suite**

Run: `npx jest`
Expected: all tests pass

- [ ] **Step 3: Commit spec and plan**

```
git add docs/superpowers/specs/2026-03-27-quiz-poi-autonaming-design.md docs/superpowers/plans/2026-03-27-quiz-poi-autonaming.md
git commit -m "docs: add spec and plan for quiz POI + waypoint auto-naming"
```
