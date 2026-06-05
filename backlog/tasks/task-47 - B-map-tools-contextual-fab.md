---
id: TASK-47
title: "[B] Tool mappa in FAB contestuale"
status: To Do
assignee: []
created_date: '2026-06-05 19:45'
labels:
  - ux
  - mobile
  - mobile-redesign-B
dependencies:
  - TASK-45
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Fase B di TASK-39 (§2.3). Bussola / righello / quiz oggi vivono nella top-bar (sopra la mappa) **e** nel drawer (dove coprono la mappa). Spostarli in un **FAB espandibile sulla mappa** su mobile: i tool stanno con la mappa, dove servono.

## Task
- [ ] FAB sulla mappa (`<lg`) che espande i tre tool (bussola/righello/quiz) con **icona + etichetta** (riusa l'affordance di TASK-40) e stato attivo evidente.
- [ ] Rimuovere i tool dalla top-bar/drawer su mobile (eliminando il `ModeSwitch` duplicato in coordinamento con TASK-46).
- [ ] Mantenere la mutua esclusione tra tool (logica `uiStore` esistente).
- [ ] Touch target ≥44px (TASK-44).

## Acceptance criteria
- [ ] I tool sono accessibili dalla mappa via FAB, con etichette chiare e stato attivo.
- [ ] Nessuna duplicazione dei tool nella UI mobile.
- [ ] Desktop invariato.
- [ ] Test aggiornati; suite verde.

## Riferimenti
- `src/components/panel/ModeSwitch.tsx`, `src/components/map/*`, `src/stores/uiStore.ts`
- Dipende da [[task-45-b-mobile-shell-design-definition]]; coordinare con [[task-46-b-bottom-navigation-mobile]]
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
