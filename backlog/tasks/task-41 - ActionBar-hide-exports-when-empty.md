---
id: TASK-41
title: ActionBar — nascondi/raggruppa gli export quando l'itinerario è vuoto
status: Done
assignee: []
created_date: '2026-06-05 18:30'
labels:
  - ux
  - usability
  - mobile-cleanup-A
dependencies: []
priority: high
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Audit usabilità mobile (TASK-39, §2.6). La `ActionBar` mostra **PDF Sintetico · PDF Roadbook · GPX · Copia link** sempre in evidenza, anche con **0 waypoint**, quando non producono nulla di utile → rumore e falsa affordance. Componente condiviso ⇒ riguarda anche desktop.

Parte del **riordino A**.

## Task

- [ ] Nascondere o **disabilitare con motivazione** gli export quando l'itinerario non è esportabile (es. < 2 waypoint / nessuna quota), coerentemente con la logica già usata altrove.
- [ ] Valutare il **raggruppamento** dei 4 export sotto un unico controllo "Esporta" (menu/sheet) per ridurre la densità.
- [ ] Mantenere accessibilità (stato disabled annunciato, focus order).

## Acceptance criteria

- [ ] Con itinerario vuoto gli export non invitano a un'azione inutile (nascosti o chiaramente disabilitati con tooltip).
- [ ] Con itinerario valido gli export funzionano come prima.
- [ ] Test aggiornati per `ActionBar`.

## Riferimenti
- `src/components/panel/ActionBar.tsx`
- `backlog/docs/mobile-usability-analysis.md` §2.6, §4 (A)
- Coordinare con [[task-42-separate-progresso-from-exports]] (stessa barra)
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
