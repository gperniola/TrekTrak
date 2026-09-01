---
id: TASK-38
title: Tutorial in side panel invece di modal centrale
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - ux
  - tutorial
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona B (UX) B.1 — il tutorial attuale (`LearnTutorial.tsx`) è un modal centrato che copre la mappa. L'utente legge "Clicca sulla mappa per aggiungere waypoint" senza vedere la mappa.

## Task

- [ ] Convertire il modal in un **side panel** (su desktop: pannello a destra 320px wide, sotto la search box; su mobile: bottom sheet con altezza ~30%)
- [ ] La mappa rimane visibile e interattiva durante il tutorial
- [ ] Il tutorial può "puntare" a elementi UI con un mini-arrow/highlight (es. step 2 "Clicca sulla mappa" evidenzia la mappa con border verde lampeggiante)
- [ ] Step 3 "Learn e Track" highlight del ModeSwitch

## Acceptance criteria

- [ ] Mappa visibile e interattiva durante tutorial
- [ ] Tutorial chiudibile in qualunque momento (X o ESC)
- [ ] Layout coerente fra desktop e mobile

## Riferimenti

- `src/components/tutorial/LearnTutorial.tsx`
- `backlog/docs/persona-usability-tests.md` B.1
- `backlog/docs/ui-critical-analysis.md` sez. 7 "Onboarding"

## Dipendenze

- Affine a [[task-16-tutorial-glossary-profile-choice]] (entrambe ridisegnano l'onboarding)
<!-- SECTION:DESCRIPTION:END -->

## Chiusura 2026-09-01 (v0.17.0)

Fatto. La guida era una modale col velo nero: al secondo passo diceva «tocca la mappa»
**coprendo la mappa**. Ora e' un pannello — a destra su schermo grande, foglio in basso su
telefono, con il trascinamento degli altri fogli — e la mappa dietro resta visibile e
utilizzabile. Via `aria-modal`, la trappola del fuoco e il blocco dello scorrimento: un
pannello che lascia usare l'app non deve trattenere il Tab.

In piu' di quanto chiedeva il piano: i passi **indicano** l'elemento di cui parlano
(`data-guida` + contorno verde), con `outline` e non `border` per non spostare il layout,
e fermo per chi ha chiesto meno movimento.

Verificato a schermo: 436 px di mappa liberi sopra il pannello, e **un clic sulla mappa
crea il waypoint mentre la guida e' aperta**.
