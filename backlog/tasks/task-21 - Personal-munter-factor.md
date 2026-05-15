---
id: TASK-21
title: Fattore personale Munter (passo dell'utente)
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - calculations
  - settings
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona C (esperta) C.5 — il calcolo Munter (`calculateMunterTime` in `lib/calculations.ts:38-52`) usa la formula standard (4 km/h orizzontale, 400m D+/h, 800m D-/h). Per un escursionista esperto è sotto, per un principiante con zaino può essere sopra.

## Task

### Modello
- [ ] Estendere `ToleranceSettings` o creare un nuovo `interface PaceSettings { factor: number }` in `types.ts`
- [ ] Range tipico: 0.7 (più veloce di Munter) → 1.5 (più lento). Default 1.0
- [ ] Persistito in localStorage tramite `loadSettings`/`saveSettings`

### Logica
- [ ] In `calculateMunterTime` accettare un parametro opzionale `factor: number = 1`
- [ ] Tutti i caller (in `recalculateLeg` dentro `itineraryStore`) leggono `settings.pace.factor` dal store e lo passano
- [ ] Test in `calculations.test.ts` per factor=1.2 → tempo +20%, factor=0.8 → tempo -20%

### UI
- [ ] In `ToleranceSettings` (o nuovo "Impostazioni passo") aggiungere uno slider 0.7-1.5 con preset:
  - 0.85 "Atleta / corridore"
  - 1.00 "Standard Munter"
  - 1.20 "Con zaino pesante"
  - 1.40 "Inizia escursionismo"
- [ ] Live update del tempo stimato nel pannello quando si cambia

## Acceptance criteria

- [ ] Cambio factor aggiorna `leg.estimatedTime` in tempo reale
- [ ] Persistenza fra refresh
- [ ] Test verdi

## Riferimenti

- `src/lib/calculations.ts:38-52`
- `src/lib/types.ts` (ToleranceSettings)
- `backlog/docs/persona-usability-tests.md` C.5
- `backlog/docs/feature-suggestions.md` (Munter personale)
<!-- SECTION:DESCRIPTION:END -->
