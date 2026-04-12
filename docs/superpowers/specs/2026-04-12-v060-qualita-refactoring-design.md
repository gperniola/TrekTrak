# v0.6.0 "Qualita' e Refactoring" — Design Spec

**Data:** 2026-04-12
**Stato:** Approvato

## Obiettivo

Release focalizzata su qualita' del codice, manutenibilita' e modernizzazione della toolchain. Nessuna feature utente nuova — l'app si comporta identicamente alla v0.4.0.

## Ordine di esecuzione

1. Split InteractiveMap.tsx
2. UI Store Zustand (elimina prop drilling)
3. Smoke test componenti React
4. Migrazione PWA (next-pwa → @serwist/next)

---

## 1. Split InteractiveMap.tsx

**Stato attuale:** 704 righe, 15 responsabilita' in un unico file.

**Strategia:** Estrarre in 3 categorie: moduli lib (logica pura), sub-componenti React, e orchestratore residuo.

### 1A. Moduli lib (logica pura, nessun React)

| Nuovo file | Contenuto estratto | Righe stimate |
|---|---|---|
| `src/lib/auto-fill.ts` | `autoFillLegClassic()`, `autoFillLegGuided()`, `autoFillTrackData()`, `autoFillAllTrackData()`, `getCachedElevation()` | ~200 |
| `src/lib/map-icons.ts` | `greenIcon()` con cache DivIcon Leaflet | ~20 |

### 1B. Sub-componenti React (`src/components/map/`)

| Nuovo file | Contenuto estratto | Righe stimate |
|---|---|---|
| `ColoredLegSegments.tsx` | Rendering polyline colorate per pendenza con gradiente elevazione | ~80 |
| `LegPolylines.tsx` | Layer polyline principali con routing mode awareness + hover events | ~90 |
| `ProfileHoverMarker.tsx` | Marker sincronizzato con hover elevation chart | ~30 |
| `QuizBoundsSync.tsx` | Sync bounds mappa con quiz overlay via custom events | ~35 |
| `GeolocateOnMount.tsx` | Fly-to posizione utente al primo render | ~25 |
| `TrackModeAutoFill.tsx` | Effect che triggera auto-fill al cambio mode/routing | ~30 |
| `MapEvents.tsx` | Click handler per creazione waypoint da mappa | ~40 |

### 1C. InteractiveMap.tsx residuo

Diventa orchestratore snello (~150 righe): imports, `resolveBaseMap()`, TileLayer, CoordinateGrid, WaypointMarkers con drag-and-drop, e composizione dei sub-componenti.

**Risultato:** da 1 file x 704 righe → 10 file (2 lib + 7 componenti + 1 orchestratore), nessuno oltre 200 righe.

**Vincoli:**
- Zero cambi di comportamento — l'app deve funzionare identicamente
- I test esistenti (calculations, elevation-api, routing-api) devono restare verdi
- Le interfacce tra moduli devono essere tipizzate

---

## 2. UI Store Zustand

**Stato attuale:** 8 `useState` in `page.tsx` drillati fino a 4 livelli (page → LeftPanel → ModeSwitch, page → MapWrapper → InteractiveMap).

**Nuovo file:** `src/stores/uiStore.ts`

### Stato

| Proprieta' | Tipo | Default | Note |
|---|---|---|---|
| `compassActive` | boolean | false | Tool mutualmente esclusivi |
| `rulerActive` | boolean | false | Tool mutualmente esclusivi |
| `quizActive` | boolean | false | Tool mutualmente esclusivi |
| `progressOpen` | boolean | false | |
| `drawerOpen` | boolean | false | Mobile only |
| `searchOpen` | boolean | false | Mobile only |

### Azioni

| Azione | Logica |
|---|---|
| `toggleCompass()` | Attiva compass, disattiva ruler + quiz (mutua esclusione) |
| `toggleRuler()` | Attiva ruler, disattiva compass + quiz |
| `toggleQuiz()` | Attiva quiz, disattiva compass + ruler |
| `deactivateCompass()` | Solo disattiva compass |
| `deactivateRuler()` | Solo disattiva ruler |
| `openProgress()` | Chiude quiz, apre progress |
| `closeProgress()` | Chiude progress |
| `setDrawerOpen(open: boolean)` | Setter diretto |
| `setSearchOpen(open: boolean)` | Setter diretto |

La logica di mutua esclusione dei tool (oggi nei `useCallback` di page.tsx) migra dentro le azioni dello store.

### Cosa resta in page.tsx

Solo `showSettings` e `showMapSettings` — modali semplici senza drilling.

### Impatto sui componenti

| Componente | Prima | Dopo |
|---|---|---|
| `page.tsx` | 8 useState, 6 useCallback, drilling props | Rimuove tutto, ~100 righe piu' corto |
| `LeftPanel` | Riceve 7 prop tool | Nessuna prop tool, import `useUIStore` |
| `ModeSwitch` | Riceve 7 prop tool da LeftPanel | Import `useUIStore` diretto |
| `MapWrapper` | Riceve compass/ruler/search props | Import `useUIStore` diretto |
| `ActionBar` | `onOpenProgress` callback prop | `useUIStore((s) => s.openProgress)` |
| `QuizOverlay/QuizSummary` | `onOpenProgress` callback prop | `useUIStore` diretto |

---

## 3. Smoke Test Componenti React

**Setup:** Jest + React Testing Library (gia' installati: `@testing-library/jest-dom` 6.9.1, `@testing-library/react` 16.3.2).

**Strategia:** Smoke test = verifica mount, elementi chiave, interazione base. Niente mock complessi o copertura esaustiva.

### File test

| Nuovo file | Componente target | Cosa testa |
|---|---|---|
| `__tests__/components/InteractiveMap.test.tsx` | InteractiveMap (post-split) | Si monta senza crash, renderizza TileLayer e waypoint markers |
| `__tests__/components/ActionBar.test.tsx` | ActionBar | Bottoni visibili, "Verifica" solo in learn mode, "Progresso" presente |
| `__tests__/components/ProgressOverlay.test.tsx` | ProgressOverlay | Render stato vuoto, render con dati mock, click "Cancella storico" mostra conferma |
| `__tests__/components/QuizOverlay.test.tsx` | QuizOverlay + QuizSummary | Mostra loading, summary mostra score e link "Vedi report" |
| `__tests__/components/ValidationBadge.test.tsx` | ValidationBadge | Non renderizza se unverified, mostra badge per valid/warning/error, click apre popover con tip |
| `__tests__/components/LeftPanel.test.tsx` | LeftPanel + ModeSwitch | Renderizza tab edit/table, ModeSwitch mostra toggle tool dal uiStore |

### Mock necessari

| Mock | Motivo |
|---|---|
| `react-leaflet` / `leaflet` | Leaflet non funziona in jsdom — mock globale che renderizza div |
| `recharts` | ProgressOverlay usa LineChart — mock che renderizza div vuoto |
| `uiStore` / `itineraryStore` | Zustand funziona nativamente nei test, nessun mock. Reset state nel `beforeEach` |
| `localStorage` | Gia' disponibile via jsdom |

### Struttura directory

I test esistenti sono in `src/__tests__/` (flat, logica pura). I nuovi test React vanno in `src/__tests__/components/` per separazione.

---

## 4. Migrazione PWA: next-pwa → @serwist/next

**Motivazione:** `next-pwa` non e' piu' mantenuto (ultimo commit 2023). `@serwist/next` e' il successore attivo, API compatibile con Workbox 7.

### Comportamento da preservare (parita' funzionale)

- 5 regole CacheFirst per tile provider:
  - `tiles-osm`: `https://{s}.tile.openstreetmap.org/`
  - `tiles-opentopomap`: `https://{s}.tile.opentopomap.org/`
  - `tiles-thunderforest`: `https://tile.thunderforest.com/`
  - `tiles-cyclosm`: `https://{s}.tile-cyclosm.openstreetmap.fr/`
  - `tiles-waymarked`: `https://tile.waymarkedtrails.org/`
- Ogni regola: max 1000 entries, 30 giorni expiration
- PWA disabilitata in development
- Manifest e icone in `public/` invariati

### Modifiche file

| File | Azione |
|---|---|
| `package.json` | Rimuove `next-pwa`, aggiunge `@serwist/next` + `serwist` |
| `next.config.mjs` | `withPWA()` di next-pwa → `withSerwist()` di @serwist/next |
| `src/app/sw.ts` (nuovo) | Service worker esplicito con `defaultCache` + 5 regole tile custom |
| `public/sw.js` | Cancellato — generato dal build, non piu' versionato |
| `public/workbox-*.js` | Cancellato — idem |
| `tsconfig.json` | Aggiunge `WebWorker` a `compilerOptions.lib` se necessario |

### Differenza chiave API

`next-pwa` configurava il caching in `next.config.mjs` via `runtimeCaching`. `@serwist/next` richiede un file service worker esplicito (`sw.ts`) dove si registrano le route importando da `serwist`:

```ts
import { Serwist } from 'serwist';
const serwist = new Serwist({ /* precacheEntries, runtimeCaching */ });
serwist.addEventListeners();
```

Le regole CacheFirst + ExpirationPlugin restano semanticamente identiche.

### Verifica

- `npm run build` completa senza errori
- Il file `sw.js` generato nella build output contiene le 5 regole tile
- `manifest.json` e icone in `public/` restano invariati
- Nessuna regressione nel comportamento offline dei tile

---

## Fuori scope

- Nessuna feature utente nuova
- Nessun cambiamento di comportamento visibile
- Nessuna modifica a ARCHITECTURE.md (sara' aggiornato a fine implementazione)
- Import GPX, UTM grid, schede stampabili — rimangono post-v0.6.0
