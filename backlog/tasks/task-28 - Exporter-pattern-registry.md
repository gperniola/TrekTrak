---
id: TASK-28
title: Pattern Exporter (registry per formati di esportazione)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - architecture
  - tech-debt
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona A (programmatrice) A.5 — oggi ogni formato di esportazione è hand-written (`export-json.ts`, `export-gpx.ts`, `export-pdf.ts`). Aggiungere KML/CSV/TCX/FIT è copy-paste e drift.

## Task

### Interface
- [ ] Definire in `lib/exporters/types.ts`:
  ```typescript
  export interface Exporter {
    id: string;           // 'json' | 'gpx' | 'kml' | ...
    label: string;        // "Esporta JSON"
    extension: string;    // 'json'
    mime: string;         // 'application/json'
    serialize(itinerary: Itinerary, options?: Record<string, unknown>): Blob | Promise<Blob>;
  }
  ```

### Refactor esistenti
- [ ] Convertire `export-json.ts` → `JsonExporter` che implementa `Exporter`
- [ ] Convertire `export-gpx.ts` → `GpxExporter`
- [ ] PDF è speciale (variabile, ha varianti summary/roadbook/print) — wrapper più complesso, per ora lasciarlo fuori

### Registry
- [ ] `lib/exporters/registry.ts` con array di `Exporter` registrati
- [ ] Helper `downloadAs(exporter, itinerary)` che gestisce il `<a download>` boilerplate (oggi duplicato)

### Aggiungere KML come prova
- [ ] `KmlExporter` che produce `<kml>` con waypoint come `<Placemark>` e linee come `<LineString>`
- [ ] Visibile in Google Earth

### UI
- [ ] `ActionBar.tsx` itera sul registry per generare i bottoni Esporta
- [ ] (Opzionale) Dropdown "Esporta come..." invece di N bottoni

## Acceptance criteria

- [ ] Aggiungere un nuovo formato è < 30 minuti
- [ ] Test esistenti per JSON/GPX continuano a passare
- [ ] KML aperto in Google Earth mostra waypoint + linee

## Riferimenti

- `src/lib/export-json.ts`, `src/lib/export-gpx.ts`
- `backlog/docs/persona-usability-tests.md` A.5
<!-- SECTION:DESCRIPTION:END -->
