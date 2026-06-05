---
id: TASK-44
title: Touch target ≥44px sui controlli in-pannello (parte di B)
status: To Do
assignee: []
created_date: '2026-06-05 19:30'
labels:
  - ux
  - mobile
  - usability
  - accessibility
  - mobile-redesign-B
dependencies: []
priority: high
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Origine.** Audit usabilità mobile (TASK-39, `backlog/docs/mobile-usability-analysis.md` §7), misure reali su prod v0.9.2 (390×844).

La **chrome di navigazione** è a norma (menu/ricerca/impostazioni/chiusura drawer = 44×44). I **controlli in-pannello** invece stanno quasi tutti sotto la soglia comodità:

| Controllo | px | |
|---|---|---|
| Tool mappa | ~47×40 | ⚠️ |
| Tab Learn/Track | 103×28 | ❌ |
| Sotto-tab Modifica/Tabella | 195×34 | ❌ |
| Export / Progresso | ×32 | ❌ |
| Salva/Carica/Nuovo | ~50×24 | ❌ |
| ✎/✕ completamento | ~16-20 ravvicinati | ❌❌ |
| Scarponi difficoltà ×5 | ~24, gap-1 | ❌ |
| Drag handle ⠿, ↓↑ | ~16-32 | ❌ |

Riferimento: **≥44×44 px** (Apple HIG, WCAG 2.5.5 AAA); 24×24 minimo assoluto (WCAG 2.5.8 AA).

**Nota di scoping:** **B** ristruttura comunque la shell e il pannello mobile, quindi lo standard touch-target va applicato **dentro B** (non come patch isolata che verrebbe rifatta). Eccezione: i target **piccoli e densi e rischiosi** (✎/✕ eliminazione completamento) potrebbero meritare un fix anticipato se B slitta.

## Task

- [ ] Definire una convenzione: **min 44×44 px** per i controlli interattivi, **spaziatura ≥8px** tra target adiacenti (utility/classe condivisa).
- [ ] Applicarla nel ridisegno mobile B a: tab/sotto-tab, export, Salva/Carica/Nuovo, ✎/✕ completamento, scarponi difficoltà, handle riordino, import/export ↓↑.
- [ ] Verificare che il desktop resti invariato (lo standard non deve gonfiare la sidebar desktop oltre il necessario).

## Acceptance criteria

- [ ] I controlli interattivi mobile sono ≥44×44 (o ≥24×24 con spaziatura adeguata dove 44 è impossibile, documentando il perché).
- [ ] Nessuna coppia di azioni distruttive/ravvicinate (es. ✎/✕) a rischio mis-tap.
- [ ] Audit di verifica (misure) ripetuto dopo l'implementazione.

## Riferimenti
- `backlog/docs/mobile-usability-analysis.md` §6, §7
- `src/components/panel/{ModeSwitch,LeftPanel,ActionBar,ItineraryHeader,RouteList,RouteDetailCard,CompletionList,CompletionForm,DifficultyRating}.tsx`
- Umbrella: [[task-39-mobile-usability-deep-dive]]
<!-- SECTION:DESCRIPTION:END -->
