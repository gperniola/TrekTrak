---
id: TASK-24
title: Stile "Stampa cartacea" per PDF Roadbook (B/N, plastica-friendly)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - pdf
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Persona C (esperta) C.7 + feature suggestion **B5** — il PDF Roadbook attuale è ottimizzato per visualizzazione digitale. Per uso reale "in zaino" servirebbe uno stile cartaceo minimal:

- B/N (stampabile su stampante laser senza colori)
- Font grande, leggibile sotto pioggia/luce solare
- Checkbox accanto a ogni waypoint per spunta manuale durante il cammino
- Formato A5 piegabile (o A4 portatile)

## Task

### Aggiungere variante "print" all'export PDF
- [ ] In `lib/export-pdf.ts` aggiungere `generatePrintRoadbookPDF(data)` (o parametro `style: 'digital' | 'print'`)
- [ ] Print style:
  - Tutto in nero/grigio (no colors)
  - Font 12pt minimo (vs 10pt attuale)
  - Margine grande per pinzatura/cartellina
  - Tabella con: # | Nome | Coord (concise) | Alt | Dist | D+/D- | ☐ Spuntato
  - Box istruzioni in cima: "Spunta ogni waypoint quando lo raggiungi"

### UI
- [ ] In `ActionBar.tsx` aggiungere terzo bottone "PDF Cartaceo" (o dropdown selettore "PDF: Sintetico / Roadbook / Cartaceo")
- [ ] Manteniamo i 2 esistenti per non rompere il workflow attuale

## Acceptance criteria

- [ ] Output PDF stampabile B/N con dimensioni leggibili
- [ ] Box checklist visibile e usabile
- [ ] Niente regressione sui 2 PDF esistenti

## Riferimenti

- `src/lib/export-pdf.ts`
- `backlog/docs/persona-usability-tests.md` C.7
- `backlog/docs/feature-suggestions.md` B5
<!-- SECTION:DESCRIPTION:END -->
