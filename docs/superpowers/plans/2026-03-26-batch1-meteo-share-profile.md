# Batch 1: Link Meteo, Condivisione URL, Profilo Interattivo — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weather link, URL-based itinerary sharing, and bidirectional interactive elevation profile to TrekTrak.

**Architecture:** Three independent features added incrementally. Feature 1 (meteo) is a pure utility + button. Feature 2 (share URL) adds lz-string serialization/deserialization with hash-based loading. Feature 3 (interactive profile) adds a shared `profileHover` state in Zustand with bidirectional communication between ElevationProfile (Recharts) and InteractiveMap (Leaflet).

**Tech Stack:** Next.js 15, TypeScript, Zustand, Recharts, React-Leaflet, lz-string (new dependency)

**Spec:** `docs/superpowers/specs/2026-03-26-batch1-meteo-share-profile.md`

---

## File Structure

### New files
- `src/lib/meteo.ts` — `buildMeteoUrl()` utility
- `src/lib/share-url.ts` — `encodeItinerary()`, `decodeItinerary()` utilities
- `src/__tests__/meteo.test.ts` — tests for meteo URL builder
- `src/__tests__/share-url.test.ts` — tests for URL sharing roundtrip

### Modified files
- `src/components/panel/ActionBar.tsx` — add Meteo + Copia link buttons
- `src/app/page.tsx` — add hash loading on mount
- `src/stores/itineraryStore.ts` — add `profileHover` state + actions
- `src/components/map/ElevationProfile.tsx` — add hover events + ReferenceLine
- `src/components/map/InteractiveMap.tsx` — add hover marker + polyline hover events
- `src/lib/calculations.ts` — add `distanceToPosition()`, `positionToDistance()`
- `src/__tests__/calculations.test.ts` — tests for new calculation functions
- `package.json` — add `lz-string` dependency

---

## Task 1: Link Meteo — Tests

**Files:**
- Create: `src/lib/meteo.ts`
- Create: `src/__tests__/meteo.test.ts`

- [ ] **Step 1: Create meteo.ts with empty export**

```typescript
// src/lib/meteo.ts
import type { Waypoint } from './types';

export function buildMeteoUrl(waypoints: Waypoint[]): string | null {
  return null;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// src/__tests__/meteo.test.ts
import { describe, expect, test } from '@jest/globals';
import { buildMeteoUrl } from '../lib/meteo';
import type { Waypoint } from '../lib/types';

function wp(lat: number | null, lon: number | null, order: number): Waypoint {
  return { id: `wp${order}`, name: `WP${order}`, lat, lon, altitude: null, order };
}

describe('buildMeteoUrl', () => {
  test('returns null with 0 waypoints', () => {
    expect(buildMeteoUrl([])).toBeNull();
  });

  test('returns null with 1 valid waypoint', () => {
    expect(buildMeteoUrl([wp(42.0, 14.0, 0)])).toBeNull();
  });

  test('returns null when less than 2 have valid coordinates', () => {
    expect(buildMeteoUrl([wp(42.0, 14.0, 0), wp(null, null, 1)])).toBeNull();
  });

  test('returns URL with centroid of 2 waypoints', () => {
    const url = buildMeteoUrl([wp(42.0, 14.0, 0), wp(44.0, 16.0, 1)]);
    expect(url).toContain('meteoblue.com');
    expect(url).toContain('43.0000');
    expect(url).toContain('15.0000');
  });

  test('returns URL with centroid of 3 waypoints, ignoring null coords', () => {
    const url = buildMeteoUrl([wp(42.0, 14.0, 0), wp(null, null, 1), wp(44.0, 16.0, 2)]);
    expect(url).toContain('43.0000');
    expect(url).toContain('15.0000');
  });

  test('URL format matches Meteoblue pattern', () => {
    const url = buildMeteoUrl([wp(46.5, 11.3, 0), wp(46.7, 11.5, 1)])!;
    expect(url).toMatch(/^https:\/\/www\.meteoblue\.com\/it\/tempo\/settimana\/\d+\.\d+N\d+\.\d+E$/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/__tests__/meteo.test.ts --no-cache`
Expected: 4 tests FAIL (all except "returns null with 0" which passes because the stub returns null)

---

## Task 2: Link Meteo — Implementation

**Files:**
- Modify: `src/lib/meteo.ts`
- Modify: `src/components/panel/ActionBar.tsx`

- [ ] **Step 1: Implement buildMeteoUrl**

```typescript
// src/lib/meteo.ts
import type { Waypoint } from './types';

export function buildMeteoUrl(waypoints: Waypoint[]): string | null {
  const valid = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  if (valid.length < 2) return null;

  const lat = valid.reduce((sum, wp) => sum + wp.lat!, 0) / valid.length;
  const lon = valid.reduce((sum, wp) => sum + wp.lon!, 0) / valid.length;

  return `https://www.meteoblue.com/it/tempo/settimana/${lat.toFixed(4)}N${lon.toFixed(4)}E`;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest src/__tests__/meteo.test.ts --no-cache`
Expected: 6 tests PASS

- [ ] **Step 3: Add Meteo button to ActionBar**

In `src/components/panel/ActionBar.tsx`, add import at top:

```typescript
import { buildMeteoUrl } from '@/lib/meteo';
```

Add the button after the GPX button (before the `{appMode === 'learn'` block), inside the return JSX:

```tsx
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
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```
feat: add Meteo button linking to Meteoblue weather forecast
```

---

## Task 3: URL Sharing — Install dependency + Tests

**Files:**
- Modify: `package.json` (install lz-string)
- Create: `src/lib/share-url.ts`
- Create: `src/__tests__/share-url.test.ts`

- [ ] **Step 1: Install lz-string**

Run: `npm install lz-string`
Run: `npm install -D @types/lz-string`

- [ ] **Step 2: Create share-url.ts with stubs**

```typescript
// src/lib/share-url.ts
import type { Waypoint, Leg } from './types';

export function encodeItinerary(
  name: string,
  waypoints: Waypoint[],
  legs: Leg[]
): string | null {
  return null;
}

export function decodeItinerary(
  hash: string
): { name: string; waypoints: Waypoint[]; legs: Leg[] } | null {
  return null;
}
```

- [ ] **Step 3: Write failing tests**

```typescript
// src/__tests__/share-url.test.ts
import { describe, expect, test } from '@jest/globals';
import { encodeItinerary, decodeItinerary } from '../lib/share-url';
import type { Waypoint, Leg } from '../lib/types';

function wp(id: string, name: string, lat: number | null, lon: number | null, alt: number | null, order: number): Waypoint {
  return { id, name, lat, lon, altitude: alt, order };
}

function leg(id: string, fromId: string, toId: string, dist: number | null, gain: number | null, loss: number | null, az: number | null): Leg {
  return { id, fromWaypointId: fromId, toWaypointId: toId, distance: dist, elevationGain: gain, elevationLoss: loss, azimuth: az };
}

const sampleWps: Waypoint[] = [
  wp('a', 'Partenza', 46.5, 11.3, 1200, 0),
  wp('b', 'Rifugio', 46.6, 11.4, 1800, 1),
  wp('c', 'Vetta', 46.7, 11.5, 2400, 2),
];

const sampleLegs: Leg[] = [
  leg('l1', 'a', 'b', 3.5, 600, 0, 45),
  leg('l2', 'b', 'c', 2.1, 600, 0, 90),
];

describe('encodeItinerary', () => {
  test('produces a string starting with #data= for valid input', () => {
    const result = encodeItinerary('Test', sampleWps, sampleLegs);
    expect(result).not.toBeNull();
    expect(result!).toMatch(/^#data=.+/);
  });

  test('returns null for >15 waypoints', () => {
    const manyWps = Array.from({ length: 16 }, (_, i) => wp(`w${i}`, `WP${i}`, 46 + i * 0.01, 11, null, i));
    const manyLegs = Array.from({ length: 15 }, (_, i) => leg(`l${i}`, `w${i}`, `w${i + 1}`, null, null, null, null));
    expect(encodeItinerary('Big', manyWps, manyLegs)).toBeNull();
  });
});

describe('decodeItinerary', () => {
  test('returns null for empty string', () => {
    expect(decodeItinerary('')).toBeNull();
  });

  test('returns null for invalid hash', () => {
    expect(decodeItinerary('#data=INVALID_GARBAGE')).toBeNull();
  });

  test('returns null for valid lz-string but bad JSON structure', () => {
    const LZString = require('lz-string');
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify({ foo: 'bar' }));
    expect(decodeItinerary(`#data=${compressed}`)).toBeNull();
  });
});

describe('roundtrip', () => {
  test('encode then decode preserves all fields', () => {
    const encoded = encodeItinerary('Giro Dolomiti', sampleWps, sampleLegs)!;
    const decoded = decodeItinerary(encoded)!;
    expect(decoded).not.toBeNull();
    expect(decoded.name).toBe('Giro Dolomiti');
    expect(decoded.waypoints).toHaveLength(3);
    expect(decoded.legs).toHaveLength(2);

    // Check waypoint fields
    expect(decoded.waypoints[0].name).toBe('Partenza');
    expect(decoded.waypoints[0].lat).toBe(46.5);
    expect(decoded.waypoints[0].lon).toBe(11.3);
    expect(decoded.waypoints[0].altitude).toBe(1200);

    // Check leg fields
    expect(decoded.legs[0].distance).toBe(3.5);
    expect(decoded.legs[0].elevationGain).toBe(600);
    expect(decoded.legs[0].azimuth).toBe(45);
  });

  test('preserves null fields correctly', () => {
    const wps = [wp('a', 'Start', 46.5, 11.3, null, 0), wp('b', 'End', null, null, null, 1)];
    const lgs = [leg('l1', 'a', 'b', null, null, null, null)];
    const encoded = encodeItinerary('Null Test', wps, lgs)!;
    const decoded = decodeItinerary(encoded)!;
    expect(decoded.waypoints[0].altitude).toBeNull();
    expect(decoded.waypoints[1].lat).toBeNull();
    expect(decoded.legs[0].distance).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest src/__tests__/share-url.test.ts --no-cache`
Expected: most tests FAIL

---

## Task 4: URL Sharing — Implementation

**Files:**
- Modify: `src/lib/share-url.ts`
- Modify: `src/components/panel/ActionBar.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implement encodeItinerary and decodeItinerary**

```typescript
// src/lib/share-url.ts
import LZString from 'lz-string';
import type { Waypoint, Leg } from './types';

const MAX_WAYPOINTS = 15;
const MAX_URL_LENGTH = 2000;

interface CompactItinerary {
  n: string; // name
  w: (string | number | null)[]; // flat: [name, lat, lon, alt, name, lat, lon, alt, ...]
  l: (number | null)[]; // flat: [dist, gain, loss, az, dist, gain, loss, az, ...]
}

export function encodeItinerary(
  name: string,
  waypoints: Waypoint[],
  legs: Leg[]
): string | null {
  if (waypoints.length > MAX_WAYPOINTS) return null;

  const compact: CompactItinerary = {
    n: name,
    w: waypoints.flatMap((wp) => [wp.name, wp.lat, wp.lon, wp.altitude]),
    l: legs.flatMap((lg) => [lg.distance, lg.elevationGain, lg.elevationLoss, lg.azimuth]),
  };

  const json = JSON.stringify(compact);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const hash = `#data=${compressed}`;

  if (hash.length > MAX_URL_LENGTH) return null;
  return hash;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function decodeItinerary(
  hash: string
): { name: string; waypoints: Waypoint[]; legs: Leg[] } | null {
  if (!hash.startsWith('#data=')) return null;
  const compressed = hash.slice(6);
  if (!compressed) return null;

  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;

    const data = JSON.parse(json) as CompactItinerary;
    if (typeof data.n !== 'string' || !Array.isArray(data.w) || !Array.isArray(data.l)) return null;
    if (data.w.length % 4 !== 0 || data.l.length % 4 !== 0) return null;

    const waypoints: Waypoint[] = [];
    for (let i = 0; i < data.w.length; i += 4) {
      const name = data.w[i];
      const lat = data.w[i + 1];
      const lon = data.w[i + 2];
      const alt = data.w[i + 3];
      if (typeof name !== 'string') return null;
      waypoints.push({
        id: generateId(),
        name,
        lat: typeof lat === 'number' ? lat : null,
        lon: typeof lon === 'number' ? lon : null,
        altitude: typeof alt === 'number' ? alt : null,
        order: waypoints.length,
      });
    }

    const legs: Leg[] = [];
    for (let i = 0; i < data.l.length; i += 4) {
      if (legs.length >= waypoints.length - 1) break;
      const fromWp = waypoints[legs.length];
      const toWp = waypoints[legs.length + 1];
      legs.push({
        id: generateId(),
        fromWaypointId: fromWp.id,
        toWaypointId: toWp.id,
        distance: typeof data.l[i] === 'number' ? data.l[i] : null,
        elevationGain: typeof data.l[i + 1] === 'number' ? data.l[i + 1] : null,
        elevationLoss: typeof data.l[i + 2] === 'number' ? data.l[i + 2] : null,
        azimuth: typeof data.l[i + 3] === 'number' ? data.l[i + 3] : null,
      });
    }

    return { name: data.n, waypoints, legs };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Run share-url tests**

Run: `npx jest src/__tests__/share-url.test.ts --no-cache`
Expected: all tests PASS

- [ ] **Step 3: Add "Copia link" button to ActionBar**

In `src/components/panel/ActionBar.tsx`, add imports:

```typescript
import { encodeItinerary } from '@/lib/share-url';
```

Add state inside the component (after existing state):

```typescript
const [linkCopied, setLinkCopied] = useState(false);
```

Add handler before the return:

```typescript
  const handleShareLink = () => {
    const hash = encodeItinerary(itineraryName, waypoints, legs);
    if (!hash) {
      alert('Itinerario troppo grande per la condivisione via link. Usa Export JSON.');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      alert('Impossibile copiare il link. Copia manualmente:\n' + url);
    });
  };
```

Add the button after the Meteo button (before `{appMode === 'learn'`):

```tsx
      <button
        onClick={handleShareLink}
        disabled={waypoints.length < 2}
        className="flex-1 py-2 bg-amber-500 text-black rounded font-bold text-xs hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {linkCopied ? 'Copiato!' : 'Copia link'}
      </button>
```

- [ ] **Step 4: Add hash loading to page.tsx**

In `src/app/page.tsx`, add import:

```typescript
import { decodeItinerary } from '@/lib/share-url';
```

Add a new `useEffect` after the existing settings hydration effect:

```typescript
  // Load itinerary from URL hash if present
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#data=')) return;
    const decoded = decodeItinerary(hash);
    if (decoded) {
      const store = useItineraryStore.getState();
      const id = Math.random().toString(36).substring(2, 11);
      store.loadItinerary(id, decoded.name, decoded.waypoints, decoded.legs);
    }
    // Clean hash from URL
    history.replaceState(null, '', window.location.pathname);
  }, []);
```

- [ ] **Step 5: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit`
Run: `npx jest --no-cache`
Expected: all pass

- [ ] **Step 6: Commit**

```
feat: add URL sharing with lz-string compression + Copia link button
```

---

## Task 5: Interactive Profile — Calculation functions (tests first)

**Files:**
- Modify: `src/lib/calculations.ts`
- Modify: `src/__tests__/calculations.test.ts`

- [ ] **Step 1: Write failing tests for distanceToPosition**

Add to `src/__tests__/calculations.test.ts`:

```typescript
import {
  // ... existing imports ...
  distanceToPosition,
  positionToDistance,
} from '../lib/calculations';
```

```typescript
describe('distanceToPosition', () => {
  const wps = [
    { id: 'a', name: 'A', lat: 46.0, lon: 11.0, altitude: null, order: 0 },
    { id: 'b', name: 'B', lat: 46.1, lon: 11.0, altitude: null, order: 1 },
    { id: 'c', name: 'C', lat: 46.1, lon: 11.1, altitude: null, order: 2 },
  ];
  const lgs = [
    { id: 'l1', fromWaypointId: 'a', toWaypointId: 'b', distance: 11.119, elevationGain: null, elevationLoss: null, azimuth: null },
    { id: 'l2', fromWaypointId: 'b', toWaypointId: 'c', distance: 7.762, elevationGain: null, elevationLoss: null, azimuth: null },
  ];

  test('returns first waypoint position at distance 0', () => {
    const pos = distanceToPosition(0, wps, lgs);
    expect(pos).not.toBeNull();
    expect(pos![0]).toBeCloseTo(46.0, 4);
    expect(pos![1]).toBeCloseTo(11.0, 4);
  });

  test('returns last waypoint position at total distance', () => {
    const total = 11.119 + 7.762;
    const pos = distanceToPosition(total, wps, lgs);
    expect(pos).not.toBeNull();
    expect(pos![0]).toBeCloseTo(46.1, 4);
    expect(pos![1]).toBeCloseTo(11.1, 4);
  });

  test('returns midpoint of first leg at half its distance', () => {
    const pos = distanceToPosition(11.119 / 2, wps, lgs);
    expect(pos).not.toBeNull();
    expect(pos![0]).toBeCloseTo(46.05, 2);
    expect(pos![1]).toBeCloseTo(11.0, 2);
  });

  test('returns null for negative distance', () => {
    expect(distanceToPosition(-1, wps, lgs)).toBeNull();
  });

  test('returns null for distance beyond total', () => {
    expect(distanceToPosition(100, wps, lgs)).toBeNull();
  });

  test('returns null for empty waypoints', () => {
    expect(distanceToPosition(0, [], [])).toBeNull();
  });
});

describe('positionToDistance', () => {
  const wps = [
    { id: 'a', name: 'A', lat: 46.0, lon: 11.0, altitude: null, order: 0 },
    { id: 'b', name: 'B', lat: 46.1, lon: 11.0, altitude: null, order: 1 },
  ];
  const lgs = [
    { id: 'l1', fromWaypointId: 'a', toWaypointId: 'b', distance: 11.119, elevationGain: null, elevationLoss: null, azimuth: null },
  ];

  test('returns 0 for position at first waypoint', () => {
    const d = positionToDistance(46.0, 11.0, wps, lgs);
    expect(d).not.toBeNull();
    expect(d!).toBeCloseTo(0, 1);
  });

  test('returns total distance for position at last waypoint', () => {
    const d = positionToDistance(46.1, 11.0, wps, lgs);
    expect(d).not.toBeNull();
    expect(d!).toBeCloseTo(11.119, 0);
  });

  test('returns approximately half distance for midpoint', () => {
    const d = positionToDistance(46.05, 11.0, wps, lgs);
    expect(d).not.toBeNull();
    expect(d!).toBeCloseTo(11.119 / 2, 0);
  });

  test('returns null for empty waypoints', () => {
    expect(positionToDistance(46.0, 11.0, [], [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/__tests__/calculations.test.ts --no-cache`
Expected: new tests FAIL (function not exported)

---

## Task 6: Interactive Profile — Calculation implementation

**Files:**
- Modify: `src/lib/calculations.ts`

- [ ] **Step 1: Implement distanceToPosition and positionToDistance**

Add to end of `src/lib/calculations.ts`:

```typescript
import type { Waypoint, Leg } from './types';

/**
 * Given a cumulative distance (km) along the itinerary, return the [lat, lon]
 * position by interpolating along the legs (straight-line between waypoints).
 */
export function distanceToPosition(
  distance: number,
  waypoints: Waypoint[],
  legs: Leg[]
): [number, number] | null {
  if (waypoints.length === 0 || distance < 0) return null;
  if (waypoints.length === 1) {
    if (distance === 0 && waypoints[0].lat != null && waypoints[0].lon != null) {
      return [waypoints[0].lat, waypoints[0].lon];
    }
    return null;
  }

  let cumulative = 0;
  for (const leg of legs) {
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);
    if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) continue;
    const legDist = leg.distance ?? 0;
    if (legDist <= 0) continue;

    if (distance <= cumulative + legDist + 0.0001) {
      const t = Math.max(0, Math.min(1, (distance - cumulative) / legDist));
      return [
        from.lat + t * (to.lat - from.lat),
        from.lon + t * (to.lon - from.lon),
      ];
    }
    cumulative += legDist;
  }
  return null;
}

/**
 * Given a [lat, lon] position, find the closest point on the itinerary path
 * and return its cumulative distance (km) from the start.
 */
export function positionToDistance(
  lat: number, lon: number,
  waypoints: Waypoint[],
  legs: Leg[]
): number | null {
  if (waypoints.length < 2 || legs.length === 0) return null;

  let bestDist = Infinity;
  let bestCumulative = 0;
  let cumulative = 0;

  for (const leg of legs) {
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);
    if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) continue;
    const legDist = leg.distance ?? 0;
    if (legDist <= 0) continue;

    // Project point onto the line segment from→to
    const dx = to.lat - from.lat;
    const dy = to.lon - from.lon;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((lat - from.lat) * dx + (lon - from.lon) * dy) / lenSq));
    }
    const projLat = from.lat + t * dx;
    const projLon = from.lon + t * dy;

    const dist = haversineDistance(lat, lon, projLat, projLon);
    if (dist < bestDist) {
      bestDist = dist;
      bestCumulative = cumulative + t * legDist;
    }
    cumulative += legDist;
  }

  return bestDist < Infinity ? bestCumulative : null;
}
```

Note: The `import type` for Waypoint and Leg must be added at the top of `calculations.ts`. The file already imports `DifficultyGrade` from `'./types'`, so change it to:

```typescript
import type { DifficultyGrade, Waypoint, Leg } from './types';
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest src/__tests__/calculations.test.ts --no-cache`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```
feat: add distanceToPosition and positionToDistance calculation functions
```

---

## Task 7: Interactive Profile — Zustand store for hover state

**Files:**
- Modify: `src/stores/itineraryStore.ts`

- [ ] **Step 1: Add profileHover state and actions to the store**

In `src/stores/itineraryStore.ts`, add to the `ItineraryState` interface:

```typescript
  profileHover: { distance: number; source: 'chart' | 'map' } | null;
  setProfileHover: (distance: number, source: 'chart' | 'map') => void;
  clearProfileHover: () => void;
```

Add to `initialState`:

```typescript
  profileHover: null as { distance: number; source: 'chart' | 'map' } | null,
```

Add to the store creation (inside the `create` callback, after `loadItinerary`):

```typescript
  setProfileHover: (distance, source) => set({ profileHover: { distance, source } }),
  clearProfileHover: () => set({ profileHover: null }),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```
feat: add profileHover state to Zustand store
```

---

## Task 8: Interactive Profile — ElevationProfile chart interaction

**Files:**
- Modify: `src/components/map/ElevationProfile.tsx`

- [ ] **Step 1: Add hover events and ReferenceLine to ElevationProfile**

In `src/components/map/ElevationProfile.tsx`, update imports:

```typescript
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
```

Add store selectors inside the component (after existing selectors):

```typescript
  const profileHover = useItineraryStore((s) => s.profileHover);
  const setProfileHover = useItineraryStore((s) => s.setProfileHover);
  const clearProfileHover = useItineraryStore((s) => s.clearProfileHover);
```

Add a throttle ref and handler before the return:

```typescript
  const lastHoverTime = useRef(0);

  const handleChartMouseMove = useCallback((state: { activePayload?: { payload?: { distance?: number } }[] }) => {
    const now = Date.now();
    if (now - lastHoverTime.current < 60) return;
    lastHoverTime.current = now;
    const dist = state?.activePayload?.[0]?.payload?.distance;
    if (dist != null) setProfileHover(dist, 'chart');
  }, [setProfileHover]);

  const handleChartMouseLeave = useCallback(() => {
    clearProfileHover();
  }, [clearProfileHover]);

  const handleChartClick = useCallback((state: { activePayload?: { payload?: { distance?: number } }[] }) => {
    const dist = state?.activePayload?.[0]?.payload?.distance;
    if (dist != null) setProfileHover(dist, 'chart');
  }, [setProfileHover]);
```

On the `<AreaChart>` element, add event handlers:

```tsx
  <AreaChart data={profileData} onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave} onClick={handleChartClick}>
```

After the `ReferenceDot` elements (before closing `</AreaChart>`), add the map-sourced reference line:

```tsx
          {profileHover && profileHover.source === 'map' && (
            <ReferenceLine
              x={profileHover.distance}
              stroke="#facc15"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          )}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```
feat: add hover/click events to elevation profile chart
```

---

## Task 9: Interactive Profile — Map hover marker + polyline events

**Files:**
- Modify: `src/components/map/InteractiveMap.tsx`

- [ ] **Step 1: Add profile hover marker component**

In `src/components/map/InteractiveMap.tsx`, add imports:

```typescript
import { distanceToPosition, positionToDistance } from '@/lib/calculations';
```

Add a new component before the `InteractiveMap` export:

```typescript
function ProfileHoverMarker() {
  const profileHover = useItineraryStore((s) => s.profileHover);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  if (!profileHover || profileHover.source !== 'chart') return null;

  const pos = distanceToPosition(profileHover.distance, waypoints, legs);
  if (!pos) return null;

  return (
    <Marker
      position={pos}
      icon={L.divIcon({
        className: '',
        html: '<div style="width:12px;height:12px;background:#facc15;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(250,204,21,0.6);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })}
      interactive={false}
    />
  );
}
```

- [ ] **Step 2: Add polyline hover events for map→chart**

Add a new component:

```typescript
function LegPolylineHoverEvents() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const setProfileHover = useItineraryStore((s) => s.setProfileHover);
  const clearProfileHover = useItineraryStore((s) => s.clearProfileHover);
  const lastHoverTime = useRef(0);

  const handleMouseMove = useCallback((e: L.LeafletMouseEvent) => {
    const now = Date.now();
    if (now - lastHoverTime.current < 60) return;
    lastHoverTime.current = now;
    const { lat, lng } = e.latlng;
    const dist = positionToDistance(lat, lng, waypoints, legs);
    if (dist != null) setProfileHover(dist, 'map');
  }, [waypoints, legs, setProfileHover]);

  const handleMouseOut = useCallback(() => {
    clearProfileHover();
  }, [clearProfileHover]);

  // Render invisible wide polylines for hover capture
  return (
    <>
      {legs.map((leg) => {
        const from = waypoints.find((w) => w.id === leg.fromWaypointId);
        const to = waypoints.find((w) => w.id === leg.toWaypointId);
        if (!from || !to || from.lat == null || from.lon == null || to.lat == null || to.lon == null) return null;

        const positions: [number, number][] = leg.routeGeometry && leg.routeGeometry.length >= 2
          ? leg.routeGeometry
          : [[from.lat, from.lon], [to.lat, to.lon]];

        return (
          <Polyline
            key={`hover-${leg.id}`}
            positions={positions}
            color="transparent"
            weight={20}
            eventHandlers={{
              mousemove: handleMouseMove,
              mouseout: handleMouseOut,
            }}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 3: Add both components to the MapContainer render**

Inside the `<MapContainer>` return, add after `<LegPolylines />`:

```tsx
      <LegPolylineHoverEvents />
      <ProfileHoverMarker />
```

- [ ] **Step 4: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit`
Run: `npx jest --no-cache`
Expected: all pass

- [ ] **Step 6: Commit**

```
feat: add bidirectional interactive elevation profile with map marker
```

---

## Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest --no-cache`
Expected: all tests pass (269 existing + new tests)

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run production build**

Run: `npx next build`
Expected: build succeeds

- [ ] **Step 4: Manual smoke test**

Verify in browser:
1. Meteo button appears with 2+ waypoints, opens Meteoblue in new tab
2. Copia link button copies URL, pasting it in new tab loads the itinerary
3. Hover on elevation profile shows yellow marker on map
4. Hover on route polyline shows yellow reference line on chart
