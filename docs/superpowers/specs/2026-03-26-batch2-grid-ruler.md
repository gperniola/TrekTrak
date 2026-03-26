# Batch 2 — Griglia Coordinate + Strumento Righello

## Feature 1: Griglia Coordinate (gradi decimali)

### Scopo
Overlay trasparente sulla mappa che mostra una griglia di linee a intervalli regolari di latitudine e longitudine, con etichette sui bordi.

### Comportamento
- Linee orizzontali (lat) e verticali (lon) semitrasparenti nel viewport
- Intervallo adattivo in base al livello di zoom:
  - Zoom ≤ 8: 1°
  - Zoom 9-11: 0.1°
  - Zoom 12-14: 0.01°
  - Zoom 15+: 0.001°
- Etichette sui bordi con valori in gradi decimali (es. "46.050°")
- Toggle on/off nelle Impostazioni Mappa
- Disattivato di default
- Si aggiorna automaticamente su pan/zoom

### Implementazione
- Nuovo componente `src/components/map/CoordinateGrid.tsx`
  - Usa `useMap()` + `useMapEvents` per reagire a zoom/move
  - Calcola le linee visibili nel viewport corrente
  - Renderizza `<Polyline>` grigie semitrasparenti (weight 1, opacity 0.3)
  - Etichette come DivIcon posizionati sui bordi del viewport
- Nuovo campo `showCoordinateGrid: boolean` in `MapDisplaySettings` (default: false)
- Toggle in `MapSettings.tsx` (stile coerente con gli altri toggle)
- Reso condizionale in `InteractiveMap.tsx`

### Funzione pura per il calcolo della griglia
In `src/lib/grid.ts`:
```typescript
computeGridLines(
  bounds: { north: number; south: number; east: number; west: number },
  zoom: number
): { lat: number[]; lon: number[]; interval: number }
```
- Input: bounding box del viewport + livello di zoom
- Output: array di valori lat e lon per le linee + intervallo usato
- Logica: arrotonda i bound al multiplo dell'intervallo, genera valori

### Test
- `computeGridLines` ritorna intervallo 1° per zoom 8
- `computeGridLines` ritorna intervallo 0.01° per zoom 13
- `computeGridLines` genera linee che coprono il bounding box
- `computeGridLines` non genera linee fuori dal bounding box
- Nessuna linea generata per bounding box degenere (width/height 0)

---

## Feature 2: Strumento Righello

### Scopo
Pulsante toggle che attiva una modalità di misura sulla mappa. L'utente clicca su due punti e vede distanza, azimuth e differenza di quota.

### Comportamento
- Pulsante nella ModeSwitch bar (accanto al compass)
- Quando attivo, il click sulla mappa posiziona i punti di misura (non aggiunge waypoint)
- Primo click: posiziona punto A (marker verde)
- Secondo click: posiziona punto B (marker rosso), mostra overlay risultati:
  - Distanza (haversineDistance, formato: m se < 1km, altrimenti km con 2 decimali)
  - Azimuth (gradi con 1 decimale + cardinale)
  - Δ Quota (dal DEM via fetchElevation, "..." durante fetch)
  - Linea tratteggiata gialla tra A e B
- Terzo click: resetta, pulisce tutto, ricomincia da punto A
- Esc o toggle off: disattiva e pulisce
- Mutualmente esclusivo col compass: attivare righello disattiva compass e viceversa

### Implementazione
- Nuovo componente `src/components/map/RulerTool.tsx`
  - Props: `active: boolean`, `onDeactivate: () => void`
  - Stato locale: `pointA`, `pointB`, `altA`, `altB` (no Zustand — stato transiente)
  - Usa `useMapEvents({ click })` per catturare i click
  - Usa `fetchElevation` per le quote
  - Renderizza marker, linea e overlay risultati
  - Overlay in basso al centro (stile coerente col compass): distanza, azimuth, Δ quota
- Stato `rulerActive` in `page.tsx` (come `compassActive`)
- Mutua esclusione: `handleRulerToggle` disattiva compass, `handleCompassToggle` disattiva ruler
- Propagare `rulerActive` a `MapEvents` per sopprimere waypoint click
- Propagare `rulerActive` a `InteractiveMap` e `ModeSwitch`

### Test
- Nessun test unitario specifico per RulerTool (componente UI con stato locale e Leaflet)
- Le funzioni di calcolo usate (haversineDistance, forwardAzimuth, azimuthToCardinal) sono già testate
- `computeGridLines` ha test unitari propri

---

## Aggiornamenti a file esistenti

### `src/lib/types.ts`
- Aggiungere `showCoordinateGrid: boolean` a `MapDisplaySettings`
- Aggiornare `DEFAULT_MAP_DISPLAY` con `showCoordinateGrid: false`

### `src/lib/storage.ts`
- Aggiornare deserializzazione per gestire il nuovo campo boolean

### `src/components/settings/MapSettings.tsx`
- Aggiungere toggle "Griglia coordinate"

### `src/components/map/InteractiveMap.tsx`
- Aggiungere `<CoordinateGrid />` condizionale
- Propagare `rulerActive` a `<MapEvents>`

### `src/app/page.tsx`
- Aggiungere stato `rulerActive` + handler toggle
- Mutua esclusione con compass

### `src/components/panel/ModeSwitch.tsx`
- Aggiungere pulsante righello accanto al compass

### Test fixtures
- Aggiornare `showCoordinateGrid` nei fixture di itineraryStore, map-features, storage test
