# Elevation Profile Gradient + Mobile Drawer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color the elevation profile by slope steepness and convert the mobile sidebar to a full-screen drawer.

**Architecture:** Two independent features. Feature 1 adds `elevationProfile` data to legs, makes `autoFillLegClassic` store sampled altitude points with dynamic interval (20m for short legs, 100m for long), then renders gradient-colored chart via SVG `<linearGradient>`. Feature 2 wraps `LeftPanel` in a mobile drawer toggled by a hamburger button, using Tailwind responsive classes.

**Tech Stack:** Next.js 15, React, TypeScript, Recharts, Zustand, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-17-elevation-gradient-mobile-drawer.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `elevationProfile` field to `Leg` |
| Modify | `src/lib/calculations.ts` | Add `slopeColor` helper |
| Modify | `src/__tests__/calculations.test.ts` | Tests for `slopeColor` |
| Modify | `src/components/map/InteractiveMap.tsx` | Dynamic sample interval + store profile in leg |
| Modify | `src/components/map/ElevationProfile.tsx` | Gradient-colored chart |
| Modify | `src/stores/itineraryStore.ts` | Clear `elevationProfile` alongside `routeGeometry` |
| Modify | `src/lib/storage.ts` | Strip `elevationProfile` before save |
| Modify | `src/lib/export-json.ts` | Strip `elevationProfile` before export |
| Modify | `src/app/page.tsx` | Mobile drawer + hamburger button |
| Modify | `src/components/panel/LeftPanel.tsx` | Accept optional `className` prop |
| Modify | `src/components/settings/ToleranceSettings.tsx` | Bump z-index to 1200 |
| Modify | `src/components/panel/SavedItinerariesModal.tsx` | Bump z-index to 1200 |

---

## Task 1: Add `elevationProfile` to Leg type and `slopeColor` helper

**Files:**
- Modify: `src/lib/types.ts:23-40` (Leg interface)
- Modify: `src/lib/calculations.ts` (add slopeColor)
- Modify: `src/__tests__/calculations.test.ts` (tests for slopeColor)

- [ ] **Step 1: Add `elevationProfile` to `Leg` interface**

In `src/lib/types.ts`, add after the `routeGeometry` field (line 31):

```typescript
elevationProfile?: { distance: number; altitude: number }[];
```

- [ ] **Step 2: Write failing test for `slopeColor`**

In `src/__tests__/calculations.test.ts`, add import for `slopeColor` and new test block:

```typescript
import {
  // ...existing imports...
  slopeColor,
} from '../lib/calculations';

// ...after cumulativeElevation tests...

describe('slopeColor', () => {
  test('flat terrain returns green', () => {
    expect(slopeColor(0)).toBe('#4ade80');
    expect(slopeColor(5)).toBe('#4ade80');
    expect(slopeColor(9.9)).toBe('#4ade80');
  });

  test('moderate slope returns yellow', () => {
    expect(slopeColor(10)).toBe('#facc15');
    expect(slopeColor(15)).toBe('#facc15');
    expect(slopeColor(19.9)).toBe('#facc15');
  });

  test('steep slope returns orange', () => {
    expect(slopeColor(20)).toBe('#fb923c');
    expect(slopeColor(25)).toBe('#fb923c');
    expect(slopeColor(29.9)).toBe('#fb923c');
  });

  test('very steep slope returns red', () => {
    expect(slopeColor(30)).toBe('#ef4444');
    expect(slopeColor(50)).toBe('#ef4444');
    expect(slopeColor(100)).toBe('#ef4444');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/__tests__/calculations.test.ts --no-cache`
Expected: FAIL — `slopeColor` is not exported

- [ ] **Step 4: Implement `slopeColor`**

In `src/lib/calculations.ts`, add before `azimuthToCardinal`:

```typescript
const SLOPE_COLORS = [
  { threshold: 30, color: '#ef4444' },
  { threshold: 20, color: '#fb923c' },
  { threshold: 10, color: '#facc15' },
] as const;

export function slopeColor(slopePercent: number): string {
  for (const { threshold, color } of SLOPE_COLORS) {
    if (slopePercent >= threshold) return color;
  }
  return '#4ade80';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/calculations.test.ts --no-cache`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/calculations.ts src/__tests__/calculations.test.ts
git commit -m "feat: add elevationProfile to Leg type and slopeColor helper"
```

---

## Task 2: Dynamic sample interval + store profile data in legs

**Files:**
- Modify: `src/components/map/InteractiveMap.tsx:44-109`

- [ ] **Step 1: Update sample interval to be dynamic**

In `src/components/map/InteractiveMap.tsx`, replace the constants (lines 44-46):

```typescript
const SAMPLE_INTERVAL_M = 20;
// Max number of elevation sample points per leg. OpenTopoData supports max 100 per GET request.
const MAX_SAMPLE_POINTS = 50;
```

with:

```typescript
function sampleInterval(distanceM: number): number {
  return distanceM > 500 ? 100 : 20;
}
const MAX_SAMPLE_POINTS = 50;
```

- [ ] **Step 2: Update `autoFillLegClassic` to use dynamic interval and store profile**

In `autoFillLegClassic`, replace line 65:

```typescript
  const numPoints = Math.min(MAX_SAMPLE_POINTS, Math.max(2, Math.ceil(distanceM / SAMPLE_INTERVAL_M)));
```

with:

```typescript
  const numPoints = Math.min(MAX_SAMPLE_POINTS, Math.max(2, Math.ceil(distanceM / sampleInterval(distanceM))));
```

Then, before the `if (isStale()) return;` / `updateLeg(leg.id, legUpdate);` block at the end of the function (after the `cumulativeElevation` call), add code to build and store the elevation profile:

```typescript
  // Build elevation profile for chart rendering
  const profileData: { distance: number; altitude: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (elevations[i] != null) {
      const pointDist = (i / (points.length - 1)) * distanceKm;
      profileData.push({ distance: Math.round(pointDist * 1000) / 1000, altitude: elevations[i]! });
    }
  }
  if (profileData.length >= 2) {
    legUpdate.elevationProfile = profileData;
  }
```

- [ ] **Step 3: Verify by running existing tests**

Run: `npx jest --no-cache`
Expected: ALL PASS (no test should break — `elevationProfile` is optional on Leg)

- [ ] **Step 4: Commit**

```bash
git add src/components/map/InteractiveMap.tsx
git commit -m "feat: dynamic sample interval and store elevation profile in legs"
```

---

## Task 3: Clear `elevationProfile` alongside `routeGeometry` in store

**Files:**
- Modify: `src/stores/itineraryStore.ts`

The store clears `routeGeometry` in 4 places. Add `elevationProfile: undefined` next to each.

- [ ] **Step 1: In `setAppMode` (learn mode clear)**

Find where `routeGeometry` is set to `undefined` inside `setAppMode`. Add `elevationProfile: undefined` to the same spread.

- [ ] **Step 2: In `setTrackRouting` (classic routing clear)**

Find where `routeGeometry` is cleared inside `setTrackRouting`. Add `elevationProfile: undefined`.

- [ ] **Step 3: In `removeWaypoint` (stale route clear)**

Find where legs are mapped and `routeGeometry` is stripped in `removeWaypoint`. Add `elevationProfile: undefined`.

- [ ] **Step 4: In `reorderWaypoints` (reorder clear)**

Find where `routeGeometry` is stripped during reorder. Add `elevationProfile: undefined`.

- [ ] **Step 5: Run tests**

Run: `npx jest --no-cache`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/stores/itineraryStore.ts
git commit -m "fix: clear elevationProfile alongside routeGeometry in store"
```

---

## Task 4: Exclude `elevationProfile` from persistence and export

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/export-json.ts`

- [ ] **Step 1: Strip `elevationProfile` in `saveItinerary`**

In `src/lib/storage.ts`, in the `saveItinerary` function, strip `elevationProfile` before inserting into the array. Add after `const idx = ...`:

```typescript
const cleaned = {
  ...itinerary,
  legs: itinerary.legs.map(({ elevationProfile, ...leg }) => leg),
};
```

Then change `all[idx] = itinerary` to `all[idx] = cleaned` and `all.push(itinerary)` to `all.push(cleaned)`. The `JSON.stringify(all)` call stays unchanged.

- [ ] **Step 2: Strip `elevationProfile` in `exportItineraryJSON`**

In `src/lib/export-json.ts`, in `exportItineraryJSON`, strip before stringify:

```typescript
const cleaned = {
  ...itinerary,
  legs: itinerary.legs.map(({ elevationProfile, ...leg }) => leg),
};
```

Use `cleaned` in the stringify call.

- [ ] **Step 3: Run tests**

Run: `npx jest --no-cache`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts src/lib/export-json.ts
git commit -m "fix: exclude elevationProfile from localStorage and JSON export"
```

---

## Task 5: Rewrite `ElevationProfile` with slope gradient

**Files:**
- Modify: `src/components/map/ElevationProfile.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire content of `src/components/map/ElevationProfile.tsx` with:

```tsx
'use client';

import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { useItineraryStore } from '@/stores/itineraryStore';
import { slopeColor } from '@/lib/calculations';

interface ProfilePoint {
  distance: number;
  altitude: number;
  name?: string;
}

function buildGradientStops(data: ProfilePoint[], totalDistance: number) {
  if (data.length < 2 || totalDistance === 0) return [];

  const stops: { offset: string; color: string }[] = [];
  for (let i = 0; i < data.length - 1; i++) {
    const dx = data[i + 1].distance - data[i].distance;
    const dy = Math.abs(data[i + 1].altitude - data[i].altitude);
    const slope = dx > 0 ? (dy / (dx * 1000)) * 100 : 0;
    const color = slopeColor(slope);
    const offsetStart = data[i].distance / totalDistance;
    const offsetEnd = data[i + 1].distance / totalDistance;

    // Close previous segment and open new one
    stops.push({ offset: `${(offsetStart * 100).toFixed(2)}%`, color });
    stops.push({ offset: `${(offsetEnd * 100).toFixed(2)}%`, color });
  }
  return stops;
}

export function ElevationProfile() {
  const strokeGradientId = useId();
  const fillGradientId = useId();
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  // Try to build detailed profile from leg elevation data
  let profileData: ProfilePoint[] = [];
  let globalDist = 0;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (leg.elevationProfile && leg.elevationProfile.length >= 2) {
      for (let j = 0; j < leg.elevationProfile.length; j++) {
        // Skip first point of subsequent legs (same as last point of previous)
        if (i > 0 && j === 0) continue;
        const p = leg.elevationProfile[j];
        profileData.push({
          distance: parseFloat((globalDist + p.distance).toFixed(2)),
          altitude: p.altitude,
        });
      }
      globalDist += leg.distance ?? 0;
    } else if (leg.distance != null) {
      // Fallback: use waypoint altitudes only
      const fromWp = waypoints.find((w) => w.id === leg.fromWaypointId);
      const toWp = waypoints.find((w) => w.id === leg.toWaypointId);
      if (i === 0 && fromWp?.altitude != null) {
        profileData.push({ distance: parseFloat(globalDist.toFixed(2)), altitude: fromWp.altitude });
      }
      globalDist += leg.distance;
      if (toWp?.altitude != null) {
        profileData.push({ distance: parseFloat(globalDist.toFixed(2)), altitude: toWp.altitude });
      }
    }
  }

  // If no legs have profile data, fall back to waypoint-only data
  if (profileData.length < 2) {
    profileData = [];
    let cumulativeDist = 0;
    waypoints.forEach((wp, i) => {
      if (i > 0) {
        const prevWp = waypoints[i - 1];
        const leg = legs.find(
          (l) => l.fromWaypointId === prevWp.id && l.toWaypointId === wp.id
        );
        if (leg?.distance != null) cumulativeDist += leg.distance;
      }
      if (wp.altitude != null) {
        profileData.push({
          distance: parseFloat(cumulativeDist.toFixed(2)),
          altitude: wp.altitude,
        });
      }
    });
  }

  if (profileData.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        Aggiungi almeno 2 waypoint con quota per il profilo altimetrico
      </div>
    );
  }

  // Waypoint markers (only at actual waypoint positions)
  let wpCumulDist = 0;
  const waypointDots: { distance: number; altitude: number; name: string }[] = [];
  waypoints.forEach((wp, i) => {
    if (i > 0) {
      const prevWp = waypoints[i - 1];
      const leg = legs.find(
        (l) => l.fromWaypointId === prevWp.id && l.toWaypointId === wp.id
      );
      if (leg?.distance != null) wpCumulDist += leg.distance;
    }
    if (wp.altitude != null) {
      waypointDots.push({
        distance: parseFloat(wpCumulDist.toFixed(2)),
        altitude: wp.altitude,
        name: wp.name || `WP${i + 1}`,
      });
    }
  });

  const altitudes = profileData.map((d) => d.altitude);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const padding = Math.max(10, (maxAlt - minAlt) * 0.1);
  const yMin = Math.floor((minAlt - padding) / 10) * 10;
  const yMax = Math.ceil((maxAlt + padding) / 10) * 10;
  const totalDistance = profileData[profileData.length - 1].distance;

  const stops = buildGradientStops(profileData, totalDistance);
  const hasGradient = stops.length > 0;

  return (
    <div className="h-full p-2">
      <div className="text-xs text-gray-500 mb-1">Profilo altimetrico</div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={profileData}>
          <defs>
            {hasGradient ? (
              <>
                <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
                  {stops.map((s, i) => (
                    <stop key={`s-${i}`} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
                <linearGradient id={fillGradientId} x1="0" y1="0" x2="1" y2="0">
                  {stops.map((s, i) => (
                    <stop key={`f-${i}`} offset={s.offset} stopColor={s.color} stopOpacity={0.25} />
                  ))}
                </linearGradient>
              </>
            ) : (
              <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
              </linearGradient>
            )}
          </defs>
          <XAxis dataKey="distance" tick={{ fontSize: 10, fill: '#999' }} unit=" km" />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} unit="m" domain={[yMin, yMax]} />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #444', fontSize: 12 }}
            labelStyle={{ color: '#4ade80' }}
          />
          <Area
            type="monotone"
            dataKey="altitude"
            stroke={hasGradient ? `url(#${strokeGradientId})` : '#4ade80'}
            fill={`url(#${fillGradientId})`}
            strokeWidth={2}
          />
          {waypointDots.map((point, i) => (
            <ReferenceDot
              key={`ref-${i}`}
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

- [ ] **Step 2: Run all tests to verify nothing breaks**

Run: `npx jest --no-cache`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/map/ElevationProfile.tsx
git commit -m "feat: elevation profile with slope gradient coloring"
```

---

## Task 6: Mobile full-screen drawer

**Files:**
- Modify: `src/components/panel/LeftPanel.tsx:16` (accept className prop)
- Modify: `src/app/page.tsx` (drawer + hamburger)
- Modify: `src/components/settings/ToleranceSettings.tsx` (z-index bump)
- Modify: `src/components/panel/SavedItinerariesModal.tsx` (z-index bump)

- [ ] **Step 1: Update LeftPanel to accept className**

In `src/components/panel/LeftPanel.tsx`, change the component signature:

```tsx
export function LeftPanel({ className }: { className?: string }) {
```

Replace the root div className from:
```tsx
<div className="w-full h-[50vh] lg:h-full lg:w-[380px] flex flex-col bg-gray-900 border-r border-gray-700">
```
to:
```tsx
<div className={`${className ?? 'w-full h-[50vh] lg:h-full lg:w-[380px]'} flex flex-col bg-gray-900 border-r border-gray-700`}>
```

- [ ] **Step 2: Bump z-index on modals**

In `src/components/settings/ToleranceSettings.tsx`, change `z-[1001]` to `z-[1200]`.

In `src/components/panel/SavedItinerariesModal.tsx`, change `z-[1001]` to `z-[1200]`.

- [ ] **Step 3: Rewrite `page.tsx` with drawer**

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col lg:flex-row">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <LeftPanel />
      </div>

      {/* Right Panel: Map + Elevation Profile */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          <MapWrapper />

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden absolute top-3 left-3 z-[1000] bg-gray-800/90 px-2.5 py-1.5 rounded text-lg text-gray-300 hover:text-white"
            aria-label="Apri menu"
          >
            ☰
          </button>

          {/* Settings toggle — desktop only (on mobile it's inside the drawer) */}
          <button
            onClick={() => setShowSettings(true)}
            className="hidden lg:block absolute top-3 left-3 z-[1000] bg-gray-800/90 px-2 py-1 rounded text-xs text-gray-400 hover:text-white"
            aria-label="Apri impostazioni"
          >
            Impostazioni
          </button>
        </div>
        <div className="h-[120px] bg-gray-900 border-t border-gray-700">
          <ElevationProfile />
        </div>
      </div>

      {/* Mobile drawer — full screen overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[1100] bg-gray-950 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <span className="text-sm font-medium text-gray-300">Menu</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setDrawerOpen(false); setShowSettings(true); }}
                className="text-xs text-gray-400 hover:text-white"
              >
                Impostazioni
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Chiudi menu"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <LeftPanel className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && <ToleranceSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: Run all tests**

Run: `npx jest --no-cache`
Expected: ALL PASS

- [ ] **Step 5: Manual verification**

Start dev server: `npm run dev`
- Desktop (≥1024px): sidebar visible as before, no hamburger
- Mobile (<1024px): only map visible, hamburger in top-left, tap opens full-screen drawer with all panel content, ✕ closes it
- "Impostazioni" accessible from both desktop (map button) and mobile (drawer header)

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/panel/LeftPanel.tsx src/components/settings/ToleranceSettings.tsx src/components/panel/SavedItinerariesModal.tsx
git commit -m "feat: mobile full-screen drawer with hamburger menu"
```

---

## Task 7: Final integration test + push

- [ ] **Step 1: Run full test suite**

Run: `npx jest --no-cache`
Expected: ALL PASS, 0 failures

- [ ] **Step 2: Build check**

Run: `npx next build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Push**

```bash
git push
```
