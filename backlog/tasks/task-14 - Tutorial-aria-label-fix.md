---
id: TASK-14
title: Aria-label del tutorial non deve menzionare "Learn"
status: To Do
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - a11y
  - tutorial
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Il dialog modale del tutorial ha `aria-label="Tutorial modalità Learn"` (`src/components/tutorial/LearnTutorial.tsx:225`), ma gli 8 step del tutorial coprono sia la modalità Learn sia la modalità Track, oltre a feature trasversali (waypoint, verifica, badge, quiz, salvataggio). Lo screen reader annuncia un'etichetta fuorviante.

## Origine

Deferred da live persona test, finding **R8-10**.

## Task

- [ ] Cambiare `aria-label` da "Tutorial modalità Learn" a "Tutorial introduttivo" o "Guida iniziale TrekTrak"
- [ ] Anche il filename `LearnTutorial.tsx` è fuorviante — considerare rinomina in `OnboardingTutorial.tsx` (richiede aggiornamento import in `app/page.tsx:10` e `localStorage.tutorialSeen` usage)
- [ ] Aggiornare commenti del file se citano "Learn tutorial"

## Acceptance criteria

- [ ] Aria-label aggiornato
- [ ] (Opzionale) Filename rinominato — può essere fatto separatamente

## Riferimenti

- `src/components/tutorial/LearnTutorial.tsx:225`
- `backlog/docs/persona-usability-tests.md` R8-10
<!-- SECTION:DESCRIPTION:END -->
