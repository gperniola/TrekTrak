---
id: TASK-48
title: "[B] Libreria mobile: lista ↔ dettaglio come viste separate"
status: Done
assignee: []
created_date: '2026-06-05 19:45'
labels:
  - ux
  - mobile
  - mobile-redesign-B
dependencies:
  - TASK-45
priority: high
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Fase B di TASK-39 (§6, attrito 🔴#1). Oggi su mobile: selezionare una riga **chiude il drawer** (per mostrare l'anteprima mappa) e la `RouteDetailCard` è appesa **sotto** la lista → per i dettagli si deve riaprire dal banner "Apri libreria". Flusso lista→dettaglio confuso; la scheda è anche lunghissima (titolo + 8 tile + note + diario + 5 bottoni).

Ristrutturare la libreria mobile come **due viste navigabili**: **Lista** ↔ **Dettaglio**, con "indietro" esplicito.

## Task
- [ ] Su mobile, il dettaglio percorso diventa una **vista a sé** (push) con header + back, non un blocco appeso sotto la lista.
- [ ] Chiarire il rapporto con l'**anteprima sulla mappa**: selezione → anteprima mappa + accesso diretto al dettaglio (senza il giro "chiudi drawer → banner → riapri").
- [ ] Valutare di compattare le 8 tile metriche (es. 2 righe sintetiche) e rendere il diario una sezione chiara.
- [ ] Desktop invariato (lista + dettaglio affiancati come ora).

## Acceptance criteria
- [ ] Su mobile si naviga lista→dettaglio→back in modo lineare, senza riaperture del drawer.
- [ ] L'anteprima mappa resta accessibile senza perdere il dettaglio.
- [ ] Test aggiornati; suite verde.

## Riferimenti
- `src/components/panel/{RouteLibrary,RouteList,RouteDetailCard}.tsx`, `src/app/page.tsx` (effetto "select chiude drawer")
- `backlog/docs/mobile-usability-analysis.md` §6
- Dipende da [[task-45-b-mobile-shell-design-definition]]; umbrella [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
