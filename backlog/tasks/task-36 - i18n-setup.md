---
id: TASK-36
title: Setup i18n (estrarre stringhe italiane → JSON per supportare EN/ES/DE/...)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - i18n
  - polish-v0.6.2-deferred
  - large
dependencies: []
priority: low
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Feature** (suggestion **D3**) — l'app oggi è hardcoded in italiano. Internationalizzando si apre a community EN/ES/DE/FR.

## Considerazione

Memoria utente: "Personal use context". L'i18n potrebbe essere overkill se l'app rimane personale. **Discutere prima di implementare** se il piano è pubblicare.

## Task (se confermato)

### Library
- [ ] Scegliere fra `next-intl`, `next-i18next`, o `lingui`. Default suggerito: `next-intl` (più moderno per App Router)

### Estrazione stringhe
- [ ] Creare `messages/it.json` con tutte le stringhe italiane
- [ ] Naming hierarchy: `tutorial.welcome.title`, `actionbar.button.verifica`, ecc.
- [ ] Sostituire ogni hardcoded string in componenti con `t('namespace.key')`

### Lingue aggiuntive
- [ ] `messages/en.json` come prima traduzione (può partire con AI/manual)
- [ ] Documentare il workflow di traduzione per contributori (`docs/i18n.md`)

### Locale switching
- [ ] Selettore lingua in `ToleranceSettings`
- [ ] Persist in localStorage
- [ ] Detect browser language al primo load

### Date / Number formatting
- [ ] Usare `Intl.DateTimeFormat` / `Intl.NumberFormat` reattivi al locale
- [ ] Distanze potrebbero essere imperial vs metric per EN-US (km vs miles, m vs ft)

## Acceptance criteria

- [ ] Cambio locale aggiorna tutta la UI senza reload
- [ ] Numero traduzioni mancanti = 0 in IT
- [ ] Build size aumento ≤ 50kB con 2 lingue

## Riferimenti

- `backlog/docs/feature-suggestions.md` D3
- next-intl docs: https://next-intl-docs.vercel.app/
<!-- SECTION:DESCRIPTION:END -->

## Analisi 2026-09-01 — misurato, e rimandato

Il task e' stato **misurato prima di toccare codice**, e l'analisi sta in
`backlog/decisions/2026-09-01-i18n-non-adesso.md`. In sintesi: 252 stringhe brevi di
interfaccia (etichette, `aria-label`, messaggi) e **2.756 stringhe lunghe**, cioe' prosa,
concentrate in sei moduli — guida, novita', glossario, legende dei layer, quiz,
suggerimenti didattici. Cento file contengono testo italiano.

La raccomandazione e' **non farlo adesso**, per quattro ragioni misurabili: il testo di
quest'app e' la funzione e non l'etichetta; l'estrazione contraddice `lib/formato.ts`,
scritto a mano proprio per non dipendere dai dati di lingua; il criterio «imperiale vs
metrico» cambierebbe cosa l'app insegna; e non esiste un utente non italofono ne' un
canale da cui possa arrivare.

**La decisione resta aperta**: la pagina dice anche come si farebbe, se servisse, e in che
ordine. Il task non e' chiuso perche' non e' stato deciso di rinunciarci — e' stato deciso
di non farlo alla cieca.

