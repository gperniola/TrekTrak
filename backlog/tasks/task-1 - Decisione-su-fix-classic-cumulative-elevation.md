---
id: TASK-1
title: Decisione su fix/classic-cumulative-elevation
status: Done
assignee: []
created_date: '2026-05-15 14:45'
updated_date: '2026-05-15 15:30'
labels:
  - decision
  - elevation
  - tech-debt
dependencies: []
priority: medium
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Contesto

Esiste un branch locale `fix/classic-cumulative-elevation` (HEAD `71ee28e`, commit del 17 marzo 2026) che introduce un calcolo D+/D- cumulativo accurato per le tappe in modalità classic. L'idea: invece di calcolare D+/D- come semplice differenza (altitudine_arrivo - altitudine_partenza), campionare il profilo altimetrico ogni ~20m lungo la geodetica della tappa via batch elevation API, poi sommare separatamente i guadagni e le perdite. Più aderente alla realtà del terreno.

**Modifiche introdotte dal branch:**

- `src/lib/calculations.ts`: helpers `interpolatePoints`, `cumulativeElevation`
- `src/lib/elevation-api.ts`: `fetchElevationProfile` batch + fallback
- `src/components/map/InteractiveMap.tsx`: integrazione del calcolo cumulativo
- Test in `src/__tests__/calculations.test.ts` e `src/__tests__/elevation-api.test.ts`

## Problema

Il branch è basato su uno stato del progetto pre-refactor v0.6.0. Diff vs `develop`: 21080 deletions / 854 insertions su 120 file. Il file `InteractiveMap.tsx` è stato splittato in sub-componenti (`ColoredLegSegments.tsx`, `LegPolylines.tsx`, `TrackModeAutoFill.tsx`, ecc.) e gran parte del codice non esiste più nella forma in cui era a marzo. Cherry-pick e merge porteranno a conflitti pervasivi.

## Decisione richiesta

Una di:

1. **Reimplementare sopra develop** — porta solo le funzioni `interpolatePoints` + `cumulativeElevation` in `src/lib/calculations.ts` e `fetchElevationProfile` in `src/lib/elevation-api.ts`, poi cabla nel calcolo D+/D- della modalità classic dentro l'attuale architettura split. Cancellare il branch.
2. **Scartare** — la feature non è prioritaria, il fix originale è obsoleto. Cancellare il branch.
3. **Archiviare per riferimento** — niente merge, niente cancellazione, lasciare il branch come documento storico.

## Acceptance criteria

- [x] Verificato se il calcolo D+/D- attuale per le tappe classic ha problemi reali (es. tappe lunghe con dislivelli intermedi non catturati)
- [x] Scelta una delle tre opzioni con motivazione
- [x] Se opzione 1: implementato + test verdi + nuova task per il rilascio
- [x] Se opzione 2 o 3: branch chiuso/archiviato

## Riferimenti

- Commit: `71ee28e`
- File toccati: `src/lib/calculations.ts`, `src/lib/elevation-api.ts`, `src/components/map/InteractiveMap.tsx` (ora splittato), `src/__tests__/calculations.test.ts`, `src/__tests__/elevation-api.test.ts`
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Decisione: opzione 2 — scartare.** Il branch è obsoleto, il fix è già implementato in develop in altra forma.

**Verifica effettuata.** In develop il calcolo D+/D- in track mode è già cumulativo, mai endpoint-to-endpoint:

- `src/lib/calculations.ts` contiene già `interpolatePoints` (riga 84), `cumulativeElevation` (riga 105) e `sampleInterval` (riga 144).
- `src/lib/elevation-api.ts` contiene già `fetchElevationProfile` con batching (riga 36, BATCH_SIZE 95) e proxy server-side `/api/elevation`.
- `src/lib/auto-fill.ts:21-102` (`autoFillLegClassic`) per la modalità classic (no trail routing):
  1. Calcola `numPoints = ceil(distanceM / sampleInterval)` — default 20m sotto i 500m, 50m sopra, override via `settings.mapDisplay.sampleInterval`
  2. `interpolatePoints` distribuisce N punti equidistanti tra A e B
  3. `fetchElevationProfile` recupera la quota di ogni sample (con cache + multi-batch)
  4. `cumulativeElevation` somma i guadagni e le perdite tra coppie consecutive
- `auto-fill.ts:104-148` (`autoFillLegGuided`) per la modalità con trail routing usa `route.ascent`/`route.descent` da ORS, cumulativi per costruzione sul sentiero reale.
- `learn` mode: l'utente inserisce manualmente, l'app valida — nessun calcolo automatico.

**Azione:** branch locale `fix/classic-cumulative-elevation` cancellato. Nessun branch remoto associato.
<!-- SECTION:FINAL_SUMMARY:END -->
