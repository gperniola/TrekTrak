# Batch 2: Griglia Coordinate + Strumento Righello — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a decimal-degree coordinate grid overlay and a two-point ruler measurement tool to the TrekTrak map.

**Architecture:** Two independent features. The coordinate grid is a pure calculation function + React-Leaflet overlay component. The ruler tool is a self-contained map component with local state, reusing existing calculation functions (haversineDistance, forwardAzimuth, azimuthToCardinal, fetchElevation).

**Tech Stack:** Next.js 15, TypeScript, React-Leaflet, Leaflet, Zustand (settings only)

**Spec:** `docs/superpowers/specs/2026-03-26-batch2-grid-ruler.md`

---

## File Structure

### New files
- `src/lib/grid.ts` — `computeGridLines()` pure function
- `src/components/map/CoordinateGrid.tsx` — grid overlay component
- `src/components/map/RulerTool.tsx` — ruler measurement component
- `src/__tests__/grid.test.ts` — tests for grid calculation

### Modified files
- `src/lib/types.ts` — add `showCoordinateGrid` to `MapDisplaySettings`
- `src/lib/storage.ts` — handle new boolean field in deserialization (automatic via existing logic)
- `src/components/settings/MapSettings.tsx` — add grid toggle
- `src/components/map/InteractiveMap.tsx` — add `CoordinateGrid` + `RulerTool`, propagate `rulerActive` to `MapEvents`
- `src/app/page.tsx` — add `rulerActive` state, mutual exclusion with compass
- `src/components/panel/ModeSwitch.tsx` — add ruler button
- `src/components/map/MapWrapper.tsx` — propagate `rulerActive` prop
- `src/__tests__/itineraryStore.test.ts` — add `showCoordinateGrid` to fixture
- `src/__tests__/map-features.test.ts` — add `showCoordinateGrid` to fixtures
- `src/__tests__/storage.test.ts` — add `showCoordinateGrid` to fixture

---

## Task 1: Grid calculation — Tests + Implementation

**Files:**
- Create: `src/lib/grid.ts`
- Create: `src/__tests__/grid.test.ts`

- [ ] **Step 1: Create grid.ts with stub**

```typescript
// src/lib/grid.ts
export interface GridLines {
  latLines: number[];
  lonLines: number[];
  interval: number;
}

export function computeGridLines(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): GridLines {
  return { latLines: [], lonLines: [], interval: 1 };
}
```

- [ ] **Step 2: Write tests**

```typescript
// src/__tests__/grid.test.ts
import { describe, expect, test } from '@jest/globals';
import { computeGridLines } from '../lib/grid';

const bounds = { north: 46.5, south: 46.0, east: 11.5, west: 11.0 };

describe('computeGridLines', () => {
  test('returns interval 1 for zoom <= 8', () => {
    const result = computeGridLines(bounds, 8);
    expect(result.interval).toBe(1);
  });

  test('returns interval 0.1 for zoom 10', () => {
    const result = computeGridLines(bounds, 10);
    expect(result.interval).toBe(0.1);
  });

  test('returns interval 0.01 for zoom 13', () => {
    const result = computeGridLines(bounds, 13);
    expect(result.interval).toBe(0.01);
  });

  test('returns interval 0.001 for zoom 16', () => {
    const result = computeGridLines(bounds, 16);
    expect(result.interval).toBe(0.001);
  });

  test('generates lat lines covering bounding box', () => {
    const result = computeGridLines(bounds, 10);
    expect(result.latLines.length).toBeGreaterThan(0);
    expect(Math.min(...result.latLines)).toBeLessThanOrEqual(bounds.south);
    expect(Math.max(...result.latLines)).toBeGreaterThanOrEqual(bounds.north);
  });

  test('generates lon lines covering bounding box', () => {
    const result = computeGridLines(bounds, 10);
    expect(result.lonLines.length).toBeGreaterThan(0);
    expect(Math.min(...result.lonLines)).toBeLessThanOrEqual(bounds.west);
    expect(Math.max(...result.lonLines)).toBeGreaterThanOrEqual(bounds.east);
  });

  test('returns empty arrays for degenerate bounds', () => {
    const degen = { north: 46.0, south: 46.0, east: 11.0, west: 11.0 };
    const result = computeGridLines(degen, 10);
    expect(result.latLines.length).toBeLessThanOrEqual(1);
    expect(result.lonLines.length).toBeLessThanOrEqual(1);
  });

  test('lat lines are spaced at the correct interval', () => {
    const result = computeGridLines(bounds, 10);
    for (let i = 1; i < result.latLines.length; i++) {
      const diff = result.latLines[i] - result.latLines[i - 1];
      expect(diff).toBeCloseTo(0.1, 5);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/__tests__/grid.test.ts --no-cache`
Expected: most FAIL

- [ ] **Step 4: Implement computeGridLines**

```typescript
// src/lib/grid.ts
export interface GridLines {
  latLines: number[];
  lonLines: number[];
  interval: number;
}

function zoomToInterval(zoom: number): number {
  if (zoom <= 8) return 1;
  if (zoom <= 11) return 0.1;
  if (zoom <= 14) return 0.01;
  return 0.001;
}

export function computeGridLines(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): GridLines {
  const interval = zoomToInterval(zoom);

  const latStart = Math.floor(bounds.south / interval) * interval;
  const latEnd = Math.ceil(bounds.north / interval) * interval;
  const lonStart = Math.floor(bounds.west / interval) * interval;
  const lonEnd = Math.ceil(bounds.east / interval) * interval;

  const latLines: number[] = [];
  for (let v = latStart; v <= latEnd + interval / 2; v += interval) {
    latLines.push(Math.round(v / interval) * interval);
  }

  const lonLines: number[] = [];
  for (let v = lonStart; v <= lonEnd + interval / 2; v += interval) {
    lonLines.push(Math.round(v / interval) * interval);
  }

  return { latLines, lonLines, interval };
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/__tests__/grid.test.ts --no-cache`
Expected: all PASS

- [ ] **Step 6: Verify TypeScript**

Run: `npx tsc --noEmit`

---

## Task 2: Types + Settings for coordinate grid

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/components/settings/MapSettings.tsx`
- Modify: `src/__tests__/itineraryStore.test.ts`
- Modify: `src/__tests__/map-features.test.ts`
- Modify: `src/__tests__/storage.test.ts`

- [ ] **Step 1: Add showCoordinateGrid to MapDisplaySettings**

In `src/lib/types.ts`, add to the `MapDisplaySettings` interface:
```typescript
  showCoordinateGrid: boolean;
```

Add to `DEFAULT_MAP_DISPLAY`:
```typescript
  showCoordinateGrid: false,
```

- [ ] **Step 2: Update test fixtures**

In `src/__tests__/itineraryStore.test.ts`, add `showCoordinateGrid: false` to the mapDisplay fixture.

In `src/__tests__/map-features.test.ts`, add `showCoordinateGrid: false` to both mapDisplay fixtures.

In `src/__tests__/storage.test.ts`, add `showCoordinateGrid: false` to the mapDisplay fixture.

- [ ] **Step 3: Add toggle to MapSettings**

In `src/components/settings/MapSettings.tsx`, add a new toggle section after the hiking trails overlay toggle and before the trail routing toggle:

```tsx
        {/* Coordinate grid toggle */}
        <div className="flex items-center justify-between py-3 border-t border-gray-700">
          <div>
            <div className="text-sm text-gray-300">Griglia coordinate</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              Overlay con griglia in gradi decimali (WGS84)
            </div>
          </div>
          <ToggleSwitch
            checked={settings.mapDisplay.showCoordinateGrid}
            onChange={() => toggleSetting('showCoordinateGrid')}
            label="Griglia coordinate"
          />
        </div>
```

Update the `toggleSetting` function type to include the new key:
```typescript
const toggleSetting = (key: 'coloredPath' | 'trailRouting' | 'showHikingTrails' | 'showCoordinateGrid') => {
```

- [ ] **Step 4: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit`
Run: `npx jest --no-cache`

---

## Task 3: CoordinateGrid component

**Files:**
- Create: `src/components/map/CoordinateGrid.tsx`
- Modify: `src/components/map/InteractiveMap.tsx`

- [ ] **Step 1: Create CoordinateGrid component**

```typescript
// src/components/map/CoordinateGrid.tsx
'use client';

import { useState, useEffect } from 'react';
import { useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { computeGridLines } from '@/lib/grid';

export function CoordinateGrid() {
  const map = useMap();
  const [grid, setGrid] = useState<ReturnType<typeof computeGridLines> | null>(null);

  const updateGrid = () => {
    const b = map.getBounds();
    const lines = computeGridLines(
      { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
      map.getZoom()
    );
    setGrid(lines);
  };

  useEffect(() => {
    updateGrid();
  }, [map]);

  useMapEvents({
    moveend: updateGrid,
    zoomend: updateGrid,
  });

  if (!grid) return null;

  const { latLines, lonLines, interval } = grid;
  const b = map.getBounds();
  const decimals = interval >= 1 ? 0 : interval >= 0.1 ? 1 : interval >= 0.01 ? 2 : 3;

  return (
    <>
      {/* Horizontal lines (latitude) */}
      {latLines.map((lat) => (
        <Polyline
          key={`lat-${lat}`}
          positions={[[lat, b.getWest() - 1], [lat, b.getEast() + 1]]}
          color="#9ca3af"
          weight={1}
          opacity={0.3}
          interactive={false}
        />
      ))}
      {/* Vertical lines (longitude) */}
      {lonLines.map((lon) => (
        <Polyline
          key={`lon-${lon}`}
          positions={[[b.getSouth() - 1, lon], [b.getNorth() + 1, lon]]}
          color="#9ca3af"
          weight={1}
          opacity={0.3}
          interactive={false}
        />
      ))}
      {/* Labels on left edge for lat */}
      {latLines.map((lat) => {
        const point = map.latLngToContainerPoint([lat, b.getWest()]);
        if (point.y < 10 || point.y > map.getSize().y - 10) return null;
        return (
          <LatLonLabel key={`lbl-lat-${lat}`} lat={lat} lon={b.getWest()} text={`${lat.toFixed(decimals)}°`} position="left" map={map} />
        );
      })}
      {/* Labels on bottom edge for lon */}
      {lonLines.map((lon) => {
        const point = map.latLngToContainerPoint([b.getSouth(), lon]);
        if (point.x < 10 || point.x > map.getSize().x - 10) return null;
        return (
          <LatLonLabel key={`lbl-lon-${lon}`} lat={b.getSouth()} lon={lon} text={`${lon.toFixed(decimals)}°`} position="bottom" map={map} />
        );
      })}
    </>
  );
}

function LatLonLabel({ lat, lon, text, position, map }: {
  lat: number; lon: number; text: string; position: 'left' | 'bottom'; map: L.Map;
}) {
  const [marker, setMarker] = useState<L.Marker | null>(null);

  useEffect(() => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="font-size:9px;color:#9ca3af;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #000,0 0 3px #000;">${text}</div>`,
      iconSize: [60, 14],
      iconAnchor: position === 'left' ? [0, 7] : [30, 0],
    });
    const m = L.marker([lat, lon], { icon, interactive: false, pane: 'overlayPane' }).addTo(map);
    setMarker(m);
    return () => { m.remove(); };
  }, [lat, lon, text, position, map]);

  return null;
}
```

- [ ] **Step 2: Add CoordinateGrid to InteractiveMap**

In `src/components/map/InteractiveMap.tsx`, add import:
```typescript
import { CoordinateGrid } from './CoordinateGrid';
```

Add store selector inside `InteractiveMap` (after `showHikingTrails`):
```typescript
  const showCoordinateGrid = useItineraryStore((s) => s.settings.mapDisplay.showCoordinateGrid);
```

Add the component inside `<MapContainer>`, after the hiking trails TileLayer:
```tsx
      {showCoordinateGrid && <CoordinateGrid />}
```

- [ ] **Step 3: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit`
Run: `npx jest --no-cache`

---

## Task 4: Ruler tool — page state + ModeSwitch button

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/panel/ModeSwitch.tsx`
- Modify: `src/components/map/MapWrapper.tsx`
- Modify: `src/components/map/InteractiveMap.tsx`

- [ ] **Step 1: Add rulerActive state to page.tsx**

In `src/app/page.tsx`, add state after `compassActive`:
```typescript
  const [rulerActive, setRulerActive] = useState(false);
```

Add toggle handlers with mutual exclusion:
```typescript
  const handleRulerToggle = useCallback(() => {
    setRulerActive((p) => {
      if (!p) setCompassActive(false); // deactivate compass when activating ruler
      return !p;
    });
  }, []);
  const handleRulerDeactivate = useCallback(() => setRulerActive(false), []);
```

Update `handleCompassToggle` to deactivate ruler:
```typescript
  const handleCompassToggle = useCallback(() => {
    setCompassActive((p) => {
      if (!p) setRulerActive(false); // deactivate ruler when activating compass
      return !p;
    });
  }, []);
```

Pass `rulerActive` and handlers to LeftPanel's ModeSwitch, MapWrapper, and the mobile ModeSwitch. In all places where `<ModeSwitch>` is rendered, add:
```tsx
<ModeSwitch compassActive={compassActive} onCompassToggle={handleCompassToggle} rulerActive={rulerActive} onRulerToggle={handleRulerToggle} />
```

Pass to `<MapWrapper>`:
```tsx
<MapWrapper mobileSearchOpen={searchOpen} compassActive={compassActive} onCompassDeactivate={handleCompassDeactivate} rulerActive={rulerActive} onRulerDeactivate={handleRulerDeactivate} />
```

- [ ] **Step 2: Update ModeSwitch to include ruler button**

In `src/components/panel/ModeSwitch.tsx`, update props:
```typescript
export function ModeSwitch({ compassActive, onCompassToggle, rulerActive, onRulerToggle }: {
  compassActive?: boolean;
  onCompassToggle?: () => void;
  rulerActive?: boolean;
  onRulerToggle?: () => void;
}) {
```

Update `handleToggle` to also deactivate ruler:
```typescript
  const handleToggle = (mode: AppMode) => {
    if (compassActive && onCompassToggle) onCompassToggle();
    if (rulerActive && onRulerToggle) onRulerToggle();
    if (mode === appMode) return;
    // ... rest unchanged
```

Add ruler button after compass button (inside the `{onCompassToggle && (` check, or as a separate block):
```tsx
      {onRulerToggle && (
        <button
          onClick={onRulerToggle}
          className={`px-2 py-1.5 rounded text-sm font-bold transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
            rulerActive
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:text-gray-300'
          }`}
          aria-label={rulerActive ? 'Disattiva righello' : 'Attiva righello'}
          aria-pressed={rulerActive}
          title="Righello"
        >
          ↕
        </button>
      )}
```

- [ ] **Step 3: Update MapWrapper to pass rulerActive**

Read `src/components/map/MapWrapper.tsx` and add `rulerActive` and `onRulerDeactivate` to props, passing them through to `InteractiveMap`.

- [ ] **Step 4: Update InteractiveMap props and MapEvents**

In `src/components/map/InteractiveMap.tsx`, update `InteractiveMap` props:
```typescript
export function InteractiveMap({ mobileSearchOpen, compassActive, onCompassDeactivate, rulerActive, onRulerDeactivate }: {
  mobileSearchOpen?: boolean;
  compassActive?: boolean;
  onCompassDeactivate?: () => void;
  rulerActive?: boolean;
  onRulerDeactivate?: () => void;
}) {
```

Update `<MapEvents>` to suppress waypoint click when ruler is active:
```tsx
<MapEvents compassActive={compassActive} rulerActive={rulerActive} />
```

Update `MapEvents` component:
```typescript
function MapEvents({ compassActive, rulerActive }: { compassActive?: boolean; rulerActive?: boolean }) {
  // ...
  useMapEvents({
    click(e) {
      if (compassActive || rulerActive) return; // Suppress waypoint placement
      // ... rest unchanged
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

## Task 5: RulerTool component

**Files:**
- Create: `src/components/map/RulerTool.tsx`
- Modify: `src/components/map/InteractiveMap.tsx`

- [ ] **Step 1: Create RulerTool component**

```typescript
// src/components/map/RulerTool.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMap, useMapEvents, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { haversineDistance, forwardAzimuth, azimuthToCardinal } from '@/lib/calculations';
import { fetchElevation } from '@/lib/elevation-api';

interface RulerPoint {
  lat: number;
  lon: number;
  alt: number | null;
}

const markerA = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#4ade80;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#000;font-weight:bold;">A</div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const markerB = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:2px solid #fff;font-size:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">B</div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function RulerTool({ active, onDeactivate }: { active: boolean; onDeactivate: () => void }) {
  const map = useMap();
  const [pointA, setPointA] = useState<RulerPoint | null>(null);
  const [pointB, setPointB] = useState<RulerPoint | null>(null);
  const [clickCount, setClickCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset when deactivated
  useEffect(() => {
    if (!active) {
      setPointA(null);
      setPointB(null);
      setClickCount(0);
    }
  }, [active]);

  // Escape key deactivates
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDeactivate();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, onDeactivate]);

  const handleClick = useCallback(async (e: L.LeafletMouseEvent) => {
    if (!active) return;
    const { lat, lng } = e.latlng;

    if (clickCount === 0) {
      // First click: set point A
      setPointA({ lat, lon: lng, alt: null });
      setPointB(null);
      setClickCount(1);
      const alt = await fetchElevation(lat, lng);
      if (mountedRef.current) setPointA((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
    } else if (clickCount === 1) {
      // Second click: set point B
      setPointB({ lat, lon: lng, alt: null });
      setClickCount(2);
      const alt = await fetchElevation(lat, lng);
      if (mountedRef.current) setPointB((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
    } else {
      // Third click: reset
      setPointA({ lat, lon: lng, alt: null });
      setPointB(null);
      setClickCount(1);
      const alt = await fetchElevation(lat, lng);
      if (mountedRef.current) setPointA((prev) => prev ? { ...prev, alt: alt != null ? Math.round(alt) : null } : null);
    }
  }, [active, clickCount]);

  useMapEvents({
    click: handleClick,
  });

  if (!active) return null;

  const distance = pointA && pointB ? haversineDistance(pointA.lat, pointA.lon, pointB.lat, pointB.lon) : null;
  const azimuth = pointA && pointB && distance != null && distance > 0.01
    ? forwardAzimuth(pointA.lat, pointA.lon, pointB.lat, pointB.lon)
    : null;
  const altDiff = pointA?.alt != null && pointB?.alt != null ? pointB.alt - pointA.alt : null;

  const distDisplay = distance != null
    ? (distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(2)} km`)
    : null;

  return (
    <>
      {pointA && (
        <Marker position={[pointA.lat, pointA.lon]} icon={markerA} interactive={false} />
      )}
      {pointB && (
        <Marker position={[pointB.lat, pointB.lon]} icon={markerB} interactive={false} />
      )}
      {pointA && pointB && (
        <Polyline
          positions={[[pointA.lat, pointA.lon], [pointB.lat, pointB.lon]]}
          color="#60a5fa"
          weight={2}
          dashArray="6 4"
        />
      )}
      {pointA && pointB && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 flex gap-4 items-center text-sm max-w-[calc(100%-1rem)]">
          <div className="text-center">
            <div className="text-blue-400 font-bold text-base">{distDisplay ?? '--'}</div>
            <div className="text-gray-500 text-[10px]">Distanza</div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <div className="text-blue-400 font-bold text-base">
              {azimuth != null ? `${azimuth.toFixed(1)}° ${azimuthToCardinal(azimuth)}` : '--'}
            </div>
            <div className="text-gray-500 text-[10px]">Azimuth</div>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <div className={`font-bold text-base ${altDiff != null ? (altDiff >= 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-500'}`}>
              {altDiff != null ? `${altDiff >= 0 ? '+' : ''}${altDiff} m` : '...'}
            </div>
            <div className="text-gray-500 text-[10px]">Δ Quota</div>
          </div>
        </div>
      )}
      {pointA && !pointB && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/90 rounded-lg px-4 py-2 text-sm text-gray-300">
          Clicca il secondo punto
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add RulerTool to InteractiveMap**

In `src/components/map/InteractiveMap.tsx`, add import:
```typescript
import { RulerTool } from './RulerTool';
```

Add inside `<MapContainer>`, after `<CompassOverlay>`:
```tsx
      <RulerTool active={!!rulerActive} onDeactivate={onRulerDeactivate ?? (() => {})} />
```

- [ ] **Step 3: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit`
Run: `npx jest --no-cache`

---

## Task 6: Final verification

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
1. Impostazioni Mappa → Griglia coordinate toggle shows/hides grid
2. Grid lines update on zoom/pan with adaptive interval
3. Grid labels show on edges
4. Ruler button in ModeSwitch toggles blue highlight
5. Ruler: first click shows A marker + "Clicca il secondo punto"
6. Ruler: second click shows B marker, line, and results overlay
7. Ruler: third click resets to new A
8. Ruler: Escape deactivates
9. Ruler + Compass are mutually exclusive
10. Ruler active = map click does NOT add waypoint
