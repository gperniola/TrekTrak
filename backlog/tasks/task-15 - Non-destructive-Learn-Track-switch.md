---
id: TASK-15
title: Switch Learn ↔ Track non-distruttivo (mantenere learnValues e trackValues paralleli)
status: Done
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - architecture
  - ux
  - didactic
  - polish-v0.6.2-deferred
  - cross-persona-top
dependencies: []
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Problema (cross-persona top-1).** Oggi lo switch fra Learn e Track (`stores/itineraryStore.ts:80-109`) **cancella i dati della modalità di partenza**:

- Learn → Track: cancella `validationState` di waypoint e leg
- Track → Learn: cancella `altitude`, `distance`, `elevationGain`, `elevationLoss`, `azimuth`, `routeGeometry`, `elevationProfile` (richiede pure un `confirm()` nativo)

Persone impattate:
- **Persona B (UX)**: rompe il flow "studio i dati Track → provo a riprodurli in Learn → confronto"
- **Persona D (principiante)**: la modalità più adatta a "imparare guardando l'esempio Track e provando in Learn" è impossibile senza perdere tutto
- **Persona A (programmer)**: discutibile design, store unico per due viste

## Proposta architetturale

Mantenere nello store DUE set di valori paralleli, uno per modalità:

```typescript
interface Leg {
  id: string;
  fromWaypointId: string;
  toWaypointId: string;
  // Valori in modalità Track (calcolati automaticamente)
  trackDistance: number | null;
  trackElevationGain: number | null;
  trackElevationLoss: number | null;
  trackAzimuth: number | null;
  trackRouteGeometry?: [number, number][];
  trackElevationProfile?: { ... }[];
  // Valori in modalità Learn (input manuale utente)
  learnDistance: number | null;
  learnElevationGain: number | null;
  learnElevationLoss: number | null;
  learnAzimuth: number | null;
  // Validazione (post-Verifica in Learn)
  validationState?: { ... };
}
```

Stesso pattern per Waypoint.altitude → trackAltitude + learnAltitude.

Le viste leggono `appMode === 'track' ? leg.trackDistance : leg.learnDistance`. Lo switch diventa solo una view-change, niente perdita di dati.

## Origine

Top-1 cross-persona dai test live + analisi critica. Cfr. `backlog/docs/persona-usability-tests.md` sezione "Top 5 azioni".

## Task

### Fase 1: Modello dati
- [ ] Aggiornare types in `src/lib/types.ts`: `Leg`, `Waypoint` con campi paralleli `track*`/`learn*`
- [ ] Migration script per dati salvati (vedi TASK-3): convertire vecchi `Leg` in `learnLeg` se i valori erano stati inseriti manualmente, in `trackLeg` se erano calcolati. Euristica: se `validationState` presente → erano learn input.
- [ ] Aggiornare `Itinerary` save/load JSON in `lib/storage.ts` e `lib/export-json.ts` (`validateItinerarySchema`)

### Fase 2: Store
- [ ] Rivedere `itineraryStore`:
  - `setAppMode` diventa solo `set({ appMode: mode })` — nessuna cancellazione
  - `updateLeg` aggiorna `track*` o `learn*` a seconda di `appMode`
  - Aggiungere selector helper `useCurrentLegValues(legId)` che restituisce i valori della modalità attiva
- [ ] Aggiornare `auto-fill.ts` per scrivere sempre nei campi `track*`

### Fase 3: UI
- [ ] `LegCard`, `WaypointCard`, `ElevationProfile`, `SummaryBar` leggono dai campi `track*`/`learn*` in base alla modalità
- [ ] `ModeSwitch.handleToggle` perde il `confirm()` (niente più distruzione → niente conferma)
- [ ] Tutorial step 3 aggiornato: "Learn e Track sono viste indipendenti. I tuoi dati sono salvati in entrambe."

### Fase 4: Test
- [ ] Aggiornare `itineraryStore.test.ts`
- [ ] Test E2E: input in Learn → switch a Track → tutti i valori Track ancora presenti → switch back → input Learn ancora presenti

## Acceptance criteria

- [ ] Nessuna perdita di dati su switch
- [ ] `confirm()` nativo rimosso da `ModeSwitch`
- [ ] Test verdi 437+/437+

## Riferimenti

- `src/stores/itineraryStore.ts:80-109` (setAppMode con cancellazioni)
- `src/components/panel/ModeSwitch.tsx:24-34` (confirm nativo)
- `backlog/docs/ui-critical-analysis.md` sez. 5 "Learn vs Track switch distruttivo"
- `backlog/docs/persona-usability-tests.md` Persona B B.3 + Persona D D.3
- Dipendenze: utile dopo [[task-3-migration-logic-storage-schema]]
<!-- SECTION:DESCRIPTION:END -->
