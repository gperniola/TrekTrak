---
id: TASK-43
title: Alleggerire il tutorial iniziale (8 passi → essenziale)
status: Done
assignee: []
created_date: '2026-06-05 18:30'
labels:
  - ux
  - onboarding
  - usability
  - mobile-cleanup-A
dependencies: []
priority: medium
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Audit usabilità mobile (TASK-39, §2.7). Il tutorial di prima visita (`LearnTutorial`) ha **8 passi** mostrati all'avvio + scelta profilo Learn/esperto: troppo testo prima di toccare l'app, specie su schermo piccolo.

Parte del **riordino A** (condiviso desktop+mobile).

## Task

- [ ] Ridurre a **3-4 passi essenziali** (cosa fa l'app, Learn vs Track, "clicca sulla mappa per iniziare"), spostando il resto in una guida ri-apribile (già esiste il reopen da Impostazioni, TASK-16).
- [ ] In alternativa/aggiunta: rendere la guida più "show, don't tell" (meno paragrafi).
- [ ] Mantenere "Salta" sempre visibile e lo stato "già visto" persistito.

## Acceptance criteria

- [ ] Tutorial iniziale ≤ 4 passi.
- [ ] Contenuti rimossi restano accessibili dalla guida ri-apribile.
- [ ] "Salta" e persistenza "visto" funzionanti; test aggiornati.

## Riferimenti
- `src/components/tutorial/LearnTutorial.tsx`
- `backlog/docs/mobile-usability-analysis.md` §2.7, §4 (A)
- Affine a [[task-16-tutorial-glossary-profile-choice]], [[task-38-tutorial-side-panel-layout]]
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
