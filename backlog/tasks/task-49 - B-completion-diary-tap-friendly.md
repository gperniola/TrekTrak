---
id: TASK-49
title: "[B] Diario completamenti tap-friendly su mobile"
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
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Fase B di TASK-39 (§6 attrito 🔴#2, §7). Il diario uscite su mobile ha controlli minuscoli e densi: **✎/✕ ~16-20px adiacenti** (rischio cancellazione accidentale), **scarponi difficoltà ~24px**, e il `CompletionForm` mette data + ore + minuti su una riga con input `w-16` stretti.

## Task
- [ ] Ingrandire e distanziare **✎ (modifica) / ✕ (elimina)** del completamento (≥44px, ≥8px tra loro); valutare conferma/undo per l'eliminazione.
- [ ] Ingrandire i **scarponi difficoltà** (target tap ≥44px) in modalità editabile.
- [ ] `CompletionForm`: layout più verticale/respirante su mobile (data, durata, difficoltà, meteo, note); input numerici ore/minuti più comodi.
- [ ] Coerente con lo standard touch-target (TASK-44).

## Acceptance criteria
- [ ] Nessun target del diario sotto 44px o a rischio mis-tap; eliminazione non innescabile per errore.
- [ ] Form completamento comodo da compilare con il pollice.
- [ ] Test aggiornati; suite verde.

## Riferimenti
- `src/components/panel/{CompletionList,CompletionForm,DifficultyRating}.tsx`
- `backlog/docs/mobile-usability-analysis.md` §6, §7
- Dipende da [[task-45-b-mobile-shell-design-definition]]; correlato a [[task-44-touch-target-sizes-mobile]]
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
