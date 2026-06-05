---
id: TASK-39
title: Studio e analisi approfondita usabilità mobile
status: To Do
assignee: []
created_date: '2026-06-05 18:00'
labels:
  - ux
  - mobile
  - usability
dependencies: []
priority: high
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Feedback utente durante il rilascio v0.9.0 (libreria condivisa cloud): su mobile l'app risulta **caotica e poco intuitiva**, con troppi pulsanti e menu di navigazione che competono per l'attenzione (top bar hamburger/ricerca/impostazioni, ModeSwitch Learn/Track, drawer a tutto schermo con MainViewSwitch Editor/Libreria + sotto-tab Modifica/Tabella + tool bussola/righello/quiz, ecc.). Un nuovo utente fatica a orientarsi.

Già applicata una micro-fix puntuale (apertura drawer su Libreria al primo login mobile per la scelta username, commit `6d19207`), ma serve uno **studio organico**, non altri cerotti.

## Task

- [ ] **Audit dello stato attuale**: mappare tutti i controlli/menu visibili su mobile e la loro gerarchia (top bar, ModeSwitch, drawer, tab annidate, tool, FAB mappa, banner anteprima libreria).
- [ ] **Identificare i punti di attrito** per i flussi chiave su mobile: primo accesso/onboarding, creazione itinerario, consultazione libreria + diario, switch Editor↔Libreria, uso dei tool.
- [ ] **Persona usability test mobile** (estendere `backlog/docs/persona-usability-tests.md` con sessioni mirate al touch/small-screen).
- [ ] **Proposte di ridisegno**: ridurre il carico cognitivo (es. bottom nav unica? raggruppare i tool? progressive disclosure? separare nettamente "naviga" da "modifica"?). Valutare pattern mobile-first.
- [ ] Tradurre le conclusioni in task atomici di implementazione.

## Acceptance criteria

- [ ] Documento di analisi in `backlog/docs/` con audit + attriti + raccomandazioni prioritizzate.
- [ ] Almeno 2-3 direzioni di ridisogno valutate con trade-off.
- [ ] Backlog di task implementativi derivati.

## Riferimenti

- `src/app/page.tsx` (layout mobile: top bar, drawer, ModeSwitch)
- `src/components/panel/LeftPanel.tsx`, `MainViewSwitch.tsx`, `ModeSwitch.tsx`
- `backlog/docs/persona-usability-tests.md`, `backlog/docs/ui-critical-analysis.md`
- Affine a [[task-38-tutorial-side-panel-layout]] (onboarding) e [[task-20-ui-cues-polish-bundle]]
<!-- SECTION:DESCRIPTION:END -->
