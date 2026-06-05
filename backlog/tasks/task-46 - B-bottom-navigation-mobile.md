---
id: TASK-46
title: "[B] Bottom navigation mobile (shell)"
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
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Fase B di TASK-39. Cuore del ridisegno: sostituire su mobile (`<lg`) l'attuale **top-bar densa (2 righe) + hamburger + drawer a tutto schermo** con una **bottom navigation** a 3-4 voci (da TASK-45).

**Solo mobile**: gated sotto il breakpoint `lg`. Il **desktop conserva la sidebar fissa**, intatto.

## Task
- [ ] Introdurre la bottom nav (voci da TASK-45, es. Mappa · Editor · Libreria · Altro) come navigazione primaria `<lg`.
- [ ] Mappare ogni vista al contenuto esistente (mappa + profilo / `LeftPanel` editor / libreria / "altro").
- [ ] Rimuovere hamburger + drawer a tutto schermo + seconda riga top-bar; **deduplicare** la shell (il `ModeSwitch` non più montato in due punti, `⚙️` non più duplicato top-bar/drawer — attriti §2.3/§2.5 rinviati da A).
- [ ] Preservare flusso d'invito (`InviteModal`) e la fix v0.9.1 (atterraggio su Libreria al primo login).
- [ ] Touch target conformi (vedi TASK-44).

## Acceptance criteria
- [ ] Su mobile la navigazione primaria è la bottom nav; niente più hamburger/drawer denso.
- [ ] Desktop invariato (sidebar fissa).
- [ ] Nessuna duplicazione di tool/impostazioni nella shell.
- [ ] Test aggiornati; suite verde; build ok.

## Riferimenti
- `src/app/page.tsx` (layout, top bar, drawer)
- `src/components/panel/{LeftPanel,MainViewSwitch}.tsx`
- `backlog/docs/mobile-usability-analysis.md`, `mobile-shell-B-design.md` (TASK-45)
- Dipende da [[task-45-b-mobile-shell-design-definition]]; umbrella [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
