---
id: TASK-16
title: Tutorial — glossario didattico e scelta del profilo all'onboarding
status: To Do
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - tutorial
  - didactic
  - ux
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Dal persona test (Persona D principiante), emerge che il tutorial assume troppa conoscenza:

- "azimuth", "dislivello positivo/negativo", "T1" (scala SAC), "WGS84" — termini specifici mai definiti
- Non c'è una via per riaprire il tutorial dopo la prima volta (è gated da `localStorage.tutorialSeen`)
- Il default Track contraddice la mission "impara cartografia manuale"

## Origine

Top-4 cross-persona. Cfr. `backlog/docs/persona-usability-tests.md` sezione "Top 5 azioni" + Persona D D.1/D.3.

## Task

### A. Scelta del profilo all'onboarding
- [ ] Aggiungere uno step iniziale al tutorial: card "Che livello sei?" con 2 opzioni
  - **"Sto imparando"** → setta `appMode = 'learn'` di default, abilita glossario contestuale
  - **"Sono un esperto"** → setta `appMode = 'track'` di default
- [ ] Salvare la scelta in localStorage (`trektrak_user_level`) e usare per defaults futuri
- [ ] Mostrabile da Impostazioni per cambiare in seguito

### B. Glossario contestuale
- [ ] Creare `src/components/shared/Glossary.tsx` con popover che mostra definizione di un termine
- [ ] Catalogare termini chiave in `src/lib/glossary.ts`:
  - Azimuth, Dislivello positivo (D+), Dislivello negativo (D-)
  - WGS84, gradi decimali
  - Scala SAC T1-T6
  - Pendenza %, Munter, Trail routing
- [ ] Linkare i pulsanti `ⓘ` esistenti in `NumberInput` al glossario (oggi mostrano frasi statiche)
- [ ] Nei tip del badge di validazione (`didactic-tips.ts`) linkare al termine: "Verifica la **declinazione magnetica** della zona" → click su "declinazione" apre glossario

### C. Riapertura tutorial
- [ ] In `ToleranceSettings` (o nuovo "Aiuto") aggiungere bottone "Rivedi tutorial"
- [ ] Click → reset `localStorage.tutorialSeen` + reload del componente

### D. Tutorial più contestuale
- [ ] Mostrare il tutorial in popover laterale invece che modal centrale, così la mappa resta visibile (vedi `ui-critical-analysis.md` 7.1)

## Acceptance criteria

- [ ] All'onboarding viene chiesto il livello, e setta default coerente
- [ ] Cliccando ⓘ su un campo si vede la definizione (glossario)
- [ ] Esiste un bottone "Rivedi tutorial" raggiungibile post-onboarding

## Riferimenti

- `src/components/tutorial/LearnTutorial.tsx`
- `src/components/shared/NumberInput.tsx:68-84` (ⓘ button esistente)
- `src/lib/didactic-tips.ts` (tip esistenti)
- `backlog/docs/persona-usability-tests.md` Persona D D.1/D.3 + sez. "Top 5 azioni" #4
<!-- SECTION:DESCRIPTION:END -->
