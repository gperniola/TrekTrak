---
id: TASK-20
title: Bundle UI cues — Progresso disabled, T1-T6 tooltip, maxZoom badge, positive feedback
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - ux
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bundle di piccoli "UI cues" emersi dai persona test. Ognuno isolato è banale, insieme fanno una release coerente.

## Sotto-task

### A. "Progresso" disabled finché non ci sono dati (B.7)
- [x] In `panel/ActionBar.tsx` il bottone `📊 Progresso` apre `ProgressOverlay`. Oggi è sempre attivo, l'overlay aperto a freddo mostra empty state
- [x] Disabilitare il bottone se `loadValidationHistory().length === 0 && loadQuizHistory().length === 0`
- [x] Tooltip sul disabled: "Completa una verifica o un quiz per vedere il tuo progresso"

### B. Tooltip scala SAC sulla "Difficoltà: T1" (B.6)
- [x] In `panel/SummaryBar.tsx:25-27`, rendere "Difficoltà: T1" un bottone/span con `title=` o popover dettagliato:
  - T1 — Sentiero ben segnato, camminata semplice
  - T2 — Sentiero di montagna con tratti meno definiti
  - T3 — Sentiero alpino impegnativo, possibili passaggi esposti
  - T4 — Sentiero alpino, capacità di lettura del terreno richiesta
  - T5 — Alpinismo facile, passaggi tecnici
  - T6 — Alpinismo difficile
- [x] Versione concisa nel tooltip; link al glossario (TASK-16) — **risolto diversamente**,
      vedi la riconciliazione in fondo: il riquadro mostra gia' tutti e sei i gradi, quindi
      il link non serve; e' stata tolta la doppia fonte

### C. Banner "zoom oltre dettaglio nativo" (C.2)
- [ ] In `InteractiveMap.tsx` o in un nuovo `MaxZoomHint.tsx`: ascolta `zoomend` event di Leaflet
- [ ] Se `map.getZoom() > baseMap.maxNativeZoom`, mostra un piccolo banner discreto sopra la mappa: "Zoom oltre il dettaglio nativo della mappa ({baseMap.label} max {maxNativeZoom})"
- [ ] Banner dismissibile, ricompare cambiando mappa

### D. Positive reinforcement nelle verifiche (D.5)
- [x] In `ActionBar.tsx` verify-flow, dopo aver calcolato il count valid/warning/error confrontare con l'ultima `ValidationSession` salvata
- [x] Se `validPercent` è migliorato rispetto all'ultima sessione, aggiungere al banner di Verifica un "📈 +N% rispetto alla precedente"
- [ ] Anche nei tip didattici dei badge: "Stai migliorando su questo tipo di errore!" se la storia mostra un trend positivo (logic già in `learning-stats.computeTrendDirection`)

## Acceptance criteria

- [ ] Tutti e 4 i sotto-task verificabili manualmente sul dev server
- [ ] Niente regressione su 437 test

## Riferimenti

- `backlog/docs/persona-usability-tests.md` B.6, B.7, C.2, D.5
- Glossario in [[task-16-tutorial-glossary-profile-choice]] (T1-T6 può linkare là)
- Toast in [[task-5-in-app-modal-and-toast]] (per banner zoom)

## Stato audit 2026-08-25

A, B (popover SAC in `SummaryBar.tsx`, senza link al glossario) e D (banner "+N%" in `ActionBar.tsx:301-320`) risultano già implementati e sono stati spuntati retroattivamente. **Resta da fare: C (banner "zoom oltre dettaglio nativo"), il tip trend positivo di D, e il link B→glossario (dipende da [[task-16-tutorial-glossary-profile-choice]]).**
<!-- SECTION:DESCRIPTION:END -->

## Riconciliazione 2026-09-01

**B e' chiuso, ma non col link previsto.** Quando questo punto e' stato scritto il
glossario non esisteva e il riquadro della difficolta' mostrava una riga sola. Oggi
`SacBadge` elenca gia' **tutti e sei i gradi** ed evidenzia quello corrente: mandare a
un'altra schermata per leggere le stesse sei righe sarebbe un passo in piu' per la stessa
informazione.

Il problema vero, comparso solo ieri con la v0.15.3, era un altro: la voce `scala-sac` del
glossario e l'elenco dentro `SummaryBar.tsx` erano **due fonti della stessa cosa**. Ora
l'elenco breve sta in `lib/glossario.ts` come `LIVELLI_SAC`, il componente lo importa, e
un test verifica che le due forme coprano gli stessi sei gradi.

**Resta aperto:**
- **C**, il banner «zoom oltre il dettaglio nativo» — mai iniziato;
- l'ultimo punto di **D**, il suggerimento «stai migliorando su questo tipo di errore»
  (`computeTrendDirection` esiste gia' e non e' usata per questo).

I criteri di accettazione restano non spuntati perche' C manca.

## Chiusura 2026-09-01 (v0.16.0)

C e D fatti. Il banner dello zoom nomina la mappa e il suo limite, si chiude e ricompare
cambiando mappa. Il rinforzo positivo compare nel popover del badge quando lo storico lo
dice davvero: sei sessioni su quel campo e un calo di almeno un quinto fra le ultime tre
e le tre precedenti — un incoraggiamento dato sul rumore sarebbe una frase falsa. Si dice
**solo il verso positivo**.

Strada facendo e' saltato fuori che `recentDeltas` arrotondava le medie di sessione
all'intero: per la distanza, in km, l'istogramma del Progresso era piatto qualunque fosse
il miglioramento. Corretto.
