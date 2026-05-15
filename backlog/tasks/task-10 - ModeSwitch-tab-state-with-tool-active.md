---
id: TASK-10
title: Tab Learn/Track devono restare selezionati anche con tool/quiz attivo
status: Done
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - a11y
  - ux
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In `src/components/panel/ModeSwitch.tsx` il tab Learn/Track è marcato selezionato solo quando NESSUN tool è attivo:

```typescript
aria-selected={!isTrack && !compassActive && !rulerActive && !quizActive}
// e
aria-selected={isTrack && !compassActive && !rulerActive && !quizActive}
```

**Problema (R8-05).** Quando l'utente attiva bussola/righello/quiz, entrambi i tab risultano:
- `aria-selected=false` → screen reader: "tablist with no tab selected"
- visivamente non evidenziati → bg-gray-700 entrambi → ambiguo "in che modalità sono?"

L'app rimane in Learn o Track sotto il tool. Lo stato non cambia. Quindi anche l'aria-selected non dovrebbe cambiare.

## Origine

Deferred da live persona test, finding **R8-05**.

## Task

- [ ] Rimuovere la dipendenza da `compassActive`/`rulerActive`/`quizActive` dal calcolo `aria-selected`. Usare solo `isTrack`:
  ```typescript
  aria-selected={!isTrack}  // per Learn
  aria-selected={isTrack}   // per Track
  ```
- [ ] Stesso per le classi CSS: mantenere `bg-purple-600`/`bg-green-600` quando il tab è selezionato, indipendentemente da tool attivi
- [ ] (Opzionale) Aggiungere indicatore visivo distinto per "tool overlay attivo" (es. pulsante tool che resta colorato come oggi, più una bordura sottile attorno al toolbar)

## Acceptance criteria

- [ ] Attivare la bussola lascia il tab Track evidenziato
- [ ] Screen reader leggendo il tablist annuncia "Track, selected"
- [ ] Visivo: tab Learn/Track mantengono il colore di sfondo della modalità corrente

## Riferimenti

- `src/components/panel/ModeSwitch.tsx:79,91`
- `backlog/docs/persona-usability-tests.md` R8-05
<!-- SECTION:DESCRIPTION:END -->
