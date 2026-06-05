---
id: TASK-45
title: "[B] Definizione design della shell mobile (bottom nav)"
status: Done
assignee: []
created_date: '2026-06-05 19:45'
labels:
  - ux
  - mobile
  - mobile-redesign-B
  - design
dependencies: []
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Fase B di TASK-39 (`backlog/docs/mobile-usability-analysis.md`). Prima di implementare conviene fissare il design della nuova shell mobile (de-risk), perché definisce tutti i task successivi (46-49).

Spike di design: produrre un breve documento di decisione (in `backlog/docs/`) con wireframe testuali, **senza scrivere codice di produzione**.

## Domande di design da sciogliere

- [ ] **Voci della bottom nav** (<lg): proposta `Mappa · Editor · Libreria · Altro` — confermare/ridefinire.
- [ ] **Learn/Track**: è una *modalità*, non una destinazione. Dove vive? (es. toggle compatto nell'header della vista Editor, o segmented in cima alla Mappa). Decidere.
- [ ] **Tool mappa** (bussola/righello/quiz): FAB espandibile sulla mappa (TASK-47) — confermare interazione e posizione.
- [ ] **"Altro"**: cosa contiene (Impostazioni, Mappa, Progresso, account/UserHeader)? Evitare di ricreare un menu-discarica.
- [ ] **Relazione con desktop**: la shell B è solo `<lg`; il desktop tiene la sidebar. Definire il punto di switch nel layout di `page.tsx`.
- [ ] **Transizione**: come si rimuovono hamburger + top-bar densa + drawer a tutto schermo senza rompere il flusso d'invito (`InviteModal`) e l'onboarding.

## Acceptance criteria
- [ ] Documento `backlog/docs/mobile-shell-B-design.md` con: mappa delle viste, posizione di ogni controllo oggi disperso, wireframe testuali, decisioni sulle domande sopra.
- [ ] Task 46-49 aggiornati/raffinati in base alle decisioni.

## Riferimenti
- `backlog/docs/mobile-usability-analysis.md` §3 (dir. B), §6, §7
- `src/app/page.tsx`, `src/components/panel/{LeftPanel,MainViewSwitch,ModeSwitch}.tsx`
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
