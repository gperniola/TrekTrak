# Libreria condivisa — Fase 5 (Geometria sentiero) — Implementation Plan

> Esecuzione inline guidata + test dove sensato. Steps con checkbox.

**STATO: ✅ COMPLETATA (2026-06-05)** — geometria preservata al salvataggio; anteprima libreria mostra il sentiero reale **colorato per pendenza** (ColoredLegSegments) + **profilo altimetrico** (PreviewElevationProfile); ricarica nell'editor fedele (fix S1 in TrackModeAutoFill geometry-aware). 523 test verdi, build ok.

**Goal:** Preservare il tracciato reale del percorso. Oggi al salvataggio si eliminano `routeGeometry`/`elevationProfile` dei leg → in libreria il percorso appare in linea d'aria anche se tracciato su sentiero. Dopo: il salvataggio conserva la geometria; l'anteprima e la ricarica nell'editor mostrano il sentiero reale (o la linea d'aria se così era stato tracciato).

**Architecture:** Il salvataggio cloud usa un leg-prep che mantiene `routeGeometry` + `elevationProfile` (rimuove solo i derivati ricalcolabili: validationState/estimatedTime/slope). `dataPayload` (sync) li persiste nel JSONB. `PreviewRouteLayer` disegna la polilinea per-leg dalla `routeGeometry` quando presente (fallback retta tra waypoint). La ricarica nell'editor passa i leg con geometria → mappa e profilo altimetrico la rendono (loadItinerary già preserva i campi leg). Trade-off: righe più grandi nel DB (accettabile per gruppo familiare).

**Tech Stack:** React/TS, react-leaflet, Supabase JSONB, Jest.

---

## Task 1: Salvataggio cloud preserva la geometria

**Files:** Modify `src/components/panel/ItineraryHeader.tsx`; Test: extend `src/__tests__/sync.test.ts`

- [ ] **Step 1: Test sync round-trip** — verifica che `routeGeometry`/`elevationProfile` nel `data.legs` sopravvivano a `fetchRoutes` (contratto dati):
```ts
test('preserva routeGeometry/elevationProfile dei leg', async () => {
  tables['routes'] = [{ id: 'r1', sort_index: 0, updated_at: 'x', created_at: 'x', created_by: 'm1',
    data: { name: 'X', waypoints: [], legs: [{ id: 'l1', fromWaypointId: 'a', toWaypointId: 'b', distance: 2, elevationGain: 100, elevationLoss: 0, azimuth: 0, routeGeometry: [[45,9],[45.1,9.1]], elevationProfile: [{ distance: 0, altitude: 100 }] }] } }];
  tables['completions'] = []; tables['members'] = [];
  const routes = await fetchRoutes();
  expect(routes[0].legs[0].routeGeometry).toEqual([[45, 9], [45.1, 9.1]]);
  expect(routes[0].legs[0].elevationProfile).toHaveLength(1);
});
```
(Passa già se `fetchRoutes` mappa `legs` verbatim — è una pin del contratto.)

- [ ] **Step 2:** In `ItineraryHeader.tsx`, aggiungi accanto a `slimLeg` un `cloudLeg` che **mantiene** geometria/profilo:
```ts
  // Per il cloud manteniamo routeGeometry + elevationProfile (fedeltà del tracciato);
  // rimuoviamo solo i derivati ricalcolabili a load (validationState/estimatedTime/slope).
  const cloudLeg = (leg: Leg) => {
    const { validationState, estimatedTime, slope, ...rest } = leg;
    void validationState; void estimatedTime; void slope;
    return rest;
  };
```
In `persist`, usa `legs: legs.map(cloudLeg)` (al posto di `slimLeg`). **Lascia `handleExportJSON` con `slimLeg`** (l'export resta leggero).

- [ ] **Step 3:** `npm test -- sync` PASS; `npx tsc --noEmit` clean; full suite green.

- [ ] **Step 4: Commit**
```bash
git add src/components/panel/ItineraryHeader.tsx src/__tests__/sync.test.ts
git commit -m "feat(library): preserve trail routeGeometry/elevationProfile on cloud save (phase 5)"
```
End con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 2: Anteprima disegna il tracciato reale

**Files:** Modify `src/components/map/PreviewRouteLayer.tsx`, `src/__tests__/components/__mocks__/react-leaflet.tsx`; Create `src/__tests__/components/PreviewRouteLayer.test.tsx`

- [ ] **Step 1:** Aggiungi `fitBounds: jest.fn()` alla `useMap` del mock react-leaflet (serve a PreviewRouteLayer; innocuo per gli altri test).

- [ ] **Step 2: Test** `PreviewRouteLayer.test.tsx`:
```tsx
import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { PreviewRouteLayer } from '@/components/map/PreviewRouteLayer';
import type { Itinerary } from '@/lib/types';

const wp = (id: string, lat: number, lon: number) => ({ id, name: id, lat, lon, altitude: null, order: 0 });

test('disegna una polilinea per ogni leg con routeGeometry', () => {
  const route = {
    id: 'r1', name: 'X', createdAt: 'x', updatedAt: 'x',
    waypoints: [wp('a', 45, 9), wp('b', 45.1, 9.1), wp('c', 45.2, 9.2)],
    legs: [
      { id: 'l1', fromWaypointId: 'a', toWaypointId: 'b', distance: 1, elevationGain: 0, elevationLoss: 0, azimuth: 0, routeGeometry: [[45, 9], [45.05, 9.05], [45.1, 9.1]] },
      { id: 'l2', fromWaypointId: 'b', toWaypointId: 'c', distance: 1, elevationGain: 0, elevationLoss: 0, azimuth: 0 }, // niente geometria → retta
    ],
  } as unknown as Itinerary;
  render(<PreviewRouteLayer route={route} />);
  expect(screen.getAllByTestId('polyline')).toHaveLength(2); // una per leg
  expect(screen.getAllByTestId('marker')).toHaveLength(3);    // un marker per waypoint
});
```

- [ ] **Step 3:** Riscrivi `PreviewRouteLayer.tsx` per disegnare i segmenti per-leg:
```tsx
'use client';

import { useEffect } from 'react';
import { Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Itinerary } from '@/lib/types';

function numberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#16a34a;color:#000;border-radius:9999px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #052e16">${n}</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

export function PreviewRouteLayer({ route }: { route: Itinerary }) {
  const map = useMap();
  const wpById = new Map(route.waypoints.map((w) => [w.id, w]));
  const markers = route.waypoints
    .filter((w) => w.lat != null && w.lon != null)
    .map((w) => [w.lat as number, w.lon as number] as [number, number]);

  // Un segmento per leg: routeGeometry se presente (sentiero reale), altrimenti retta tra i due waypoint.
  const segments: [number, number][][] = [];
  for (const leg of route.legs) {
    if (leg.routeGeometry && leg.routeGeometry.length >= 2) {
      segments.push(leg.routeGeometry);
    } else {
      const from = wpById.get(leg.fromWaypointId);
      const to = wpById.get(leg.toWaypointId);
      if (from?.lat != null && from?.lon != null && to?.lat != null && to?.lon != null) {
        segments.push([[from.lat, from.lon], [to.lat, to.lon]]);
      }
    }
  }
  const allPts = segments.flat().concat(markers);

  useEffect(() => {
    if (allPts.length === 0) return;
    if (allPts.length === 1) { map.setView(allPts[0], 14); return; }
    map.fitBounds(L.latLngBounds(allPts), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);

  if (markers.length === 0 && segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline key={i} positions={seg} pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.85 }} />
      ))}
      {markers.map((p, i) => <Marker key={`m${i}`} position={p} icon={numberedIcon(i + 1)} interactive={false} />)}
    </>
  );
}
```

- [ ] **Step 4:** `npm test -- PreviewRouteLayer` PASS; full suite green; `npx tsc --noEmit` clean; `npm run build` ok.

- [ ] **Step 5: Commit**
```bash
git add src/components/map/PreviewRouteLayer.tsx src/__tests__/components/__mocks__/react-leaflet.tsx src/__tests__/components/PreviewRouteLayer.test.tsx
git commit -m "feat(library): preview renders real trail geometry per leg (phase 5)"
```

---

## Task 3: Verifica e2e

- [ ] In Track con trail routing attivo, traccia un percorso su sentiero (la mappa mostra il sentiero curvo), **Salva** in libreria.
- [ ] In **Libreria** seleziona il percorso → l'anteprima mostra il **sentiero reale** (curvo), non la linea d'aria.
- [ ] **Carica nell'editor** → mappa mostra il sentiero + profilo altimetrico popolato.
- [ ] Un percorso tracciato in **linea d'aria** resta retto (fallback).
- [ ] Nota: i percorsi salvati **prima** della Fase 5 restano in linea d'aria (non hanno la geometria salvata); ri-salvarli dall'editor li aggiorna.

---

## Self-Review (esito)
**Copertura:** salvataggio preserva geometria → Task 1; anteprima/ricarica rendono il tracciato → Task 2; verifica → Task 3. ✔
**Note:** righe DB più grandi (routeGeometry può avere molti punti) — accettabile per gruppo familiare. JSON export resta slim. `loadItinerary` già preserva i campi leg → editor mostra sentiero + profilo senza altre modifiche.
