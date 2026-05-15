---
id: TASK-5
title: Sostituire alert() / confirm() native con modal e toast in-app
status: To Do
assignee: []
created_date: '2026-05-15 17:30'
labels:
  - ux
  - mobile
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
L'app usa `alert()` e `confirm()` nativi del browser in diversi punti:

- `panel/ActionBar.tsx:45` — `alert('Aggiungi almeno 2 waypoint')`
- `panel/ActionBar.tsx:64` — `alert('Servono almeno 2 waypoint con coordinate valide per il GPX')`
- `panel/ActionBar.tsx:323` — `alert('Impossibile copiare il link. Copia manualmente: ...')`
- `panel/SavedItinerariesModal.tsx:21` — `confirm('Caricare questo itinerario? ...')`
- `panel/SavedItinerariesModal.tsx:27` — `confirm('Eliminare questo itinerario?')`
- `panel/WaypointList.tsx:91` — `alert('Massimo N waypoint per itinerario')`
- `panel/ModeSwitch.tsx:31` — `confirm('Passare a Learn cancellerà tutti i dati ... Continuare?')`
- `quiz/QuizOverlay.tsx:116` — `alert("Impossibile generare domande. ...")`
- `lib/export-json.ts:75/80` — `alert(...)` per errori import

**Problemi.**
- Stile estraneo all'UI dark dell'app
- Bloccanti per il main thread (poor mobile UX)
- Localizzazione/styling fuori controllo
- Non screen-reader friendly nello stile nativo

## Origine

Deferred da campagna polish/v0.6.2, bug **R7-03**.

## Task

### Componente `Modal`
- [ ] Creare `src/components/shared/Modal.tsx`: dialog stilizzato (sfondo scuro, bordo verde, focus trap, ESC chiude, click-outside chiude)
- [ ] Variants: `info`, `confirm` (con bottoni "Conferma"/"Annulla"), `error`
- [ ] Tipo: `interface ModalProps { title?: string; message: string; variant: ...; onConfirm?: () => void; onCancel?: () => void }`

### Componente `Toast`
- [ ] Creare `src/components/shared/Toast.tsx`: notifica non-bloccante in basso, auto-dismiss dopo 3s, role="status", aria-live="polite"
- [ ] Variants: `success`, `info`, `warning`, `error`
- [ ] Hook `useToast()` per dispatching da qualsiasi componente

### Migrazione chiamate
- [ ] Sostituire ogni `alert()` con `useToast()` (informazione non-bloccante) o `<Modal variant="error">` (errore con azione richiesta)
- [ ] Sostituire ogni `confirm()` con `<Modal variant="confirm">` con callback `onConfirm`/`onCancel`
- [ ] Test: workflow di tutte le ex-conferme nativo funziona uguale (es. Carica itinerario → modal di conferma → carica)

## Riferimenti

- `backlog/docs/polish-v0.6.2-bug-log.md` row R7-03
- `backlog/docs/feature-suggestions.md` proposte D1 e D2
<!-- SECTION:DESCRIPTION:END -->
