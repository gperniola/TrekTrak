---
id: TASK-16
title: Tutorial — glossario didattico e scelta del profilo all'onboarding
status: Done
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
- [x] Aggiungere uno step iniziale al tutorial: card "Che livello sei?" con 2 opzioni
  - **"Sto imparando"** → setta `appMode = 'learn'` di default, abilita glossario contestuale
  - **"Sono un esperto"** → setta `appMode = 'track'` di default
- [x] Salvare la scelta in localStorage (`trektrak_user_level`) e usare per defaults futuri
- [x] Mostrabile da Impostazioni per cambiare in seguito — assolto dalla v0.15.0: la
  stessa risposta decide ora il **profilo d'uso**, e l'interruttore sta come prima voce
  del menu «Altro» e in cima al pannello su schermo grande

### B. Glossario contestuale — fatto il 2026-09-01
- [x] Popover condiviso in `src/components/shared/TermineGlossario.tsx` (nomi italiani come
  il resto dei moduli recenti), che esporta anche `ContenutoGlossario` per mostrare una
  definizione dentro un altro riquadro
- [x] Catalogo in `src/lib/glossario.ts`, **13 voci**: azimut, declinazione magnetica, D+,
  D−, linea d'aria, percorso su sentiero, quota, curve di livello, pendenza, WGS84, gradi
  decimali, scala SAC (T1–T6), Munter
- [x] I sette ⓘ dei campi vengono dal glossario: `NumberInput` ha `termine` al posto di
  `info`, e il popover che aveva dentro (stato, clic fuori, Escape) e' diventato il
  componente condiviso
- [x] Il suggerimento dopo la verifica offre i termini che nomina, dichiarati in
  `TERMINI_TIP` e non cercati dentro le frasi; la definizione si apre **dentro lo stesso
  riquadro**, perche' un popover dentro un popover si posiziona rispetto al pulsantino e
  coprirebbe il suggerimento che deve spiegare

Due scelte da ricordare. Le definizioni descrivono **quello che l'app fa davvero**: la
voce su Munter cita 4 km/h, 400 m/h e 800 m/h, e un test le riprova su
`calculateMunterTime` — se un giorno si cambiassero le velocita', il glossario direbbe il
falso proprio a chi lo sta usando per imparare. Stessa cosa per la conversione dei gradi
decimali, verificata con l'aritmetica.

Difetto trovato solo guardando lo schermo: passando l'etichetta del campo al pulsante, i
nomi accessibili diventavano «Che cos'e': Lat», «Che cos'e': D+» — l'abbreviazione, non
piu' informativa del vecchio «Info: Lat» che dovevano sostituire. Ora nominano il termine.

### C. Riapertura tutorial
- [x] In `ToleranceSettings` (o nuovo "Aiuto") aggiungere bottone "Rivedi tutorial"
- [x] Click → reset `localStorage.tutorialSeen` + reload del componente (implementato come "Rivedi tutorial al prossimo avvio")

### D. Tutorial più contestuale
- [ ] Mostrare il tutorial in popover laterale invece che modal centrale, così la mappa resta visibile (vedi `ui-critical-analysis.md` 7.1)

## Acceptance criteria

- [x] All'onboarding viene chiesto il livello, e setta default coerente
- [x] Cliccando ⓘ su un campo si vede la definizione (glossario)
- [x] Esiste un bottone "Rivedi tutorial" raggiungibile post-onboarding

## Stato audit 2026-08-25

A (tranne cambio livello da Impostazioni) e C risultano già implementati nel codice (`LearnTutorial.tsx`, `ToleranceSettings.tsx`) e sono stati spuntati retroattivamente. **Resta da fare: B (glossario contestuale — `src/lib/glossary.ts` non esiste) e D (tutorial in popover laterale, coincide con [[task-38-tutorial-side-panel-layout]]).**

## Chiusura 2026-09-01

B fatto (vedi sopra), e A si e' chiuso da se' con la v0.15.0. **D non e' un residuo di
questo task ma un task suo**: il tutorial in pannello laterale e'
[[task-38-tutorial-side-panel-layout]], e tenere task-16 aperto per qualcosa che vive
altrove significa avere due elenchi della stessa cosa. Chiuso.

## Riferimenti

- `src/components/tutorial/LearnTutorial.tsx`
- `src/components/shared/NumberInput.tsx:68-84` (ⓘ button esistente)
- `src/lib/didactic-tips.ts` (tip esistenti)
- `backlog/docs/persona-usability-tests.md` Persona D D.1/D.3 + sez. "Top 5 azioni" #4
<!-- SECTION:DESCRIPTION:END -->
