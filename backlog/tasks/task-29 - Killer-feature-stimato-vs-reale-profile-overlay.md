---
id: TASK-29
title: ⭐ Profilo altimetrico "stimato vs reale" sovrapposto post-Verifica
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - didactic
  - killer-feature
  - polish-v0.6.2-deferred
dependencies: []
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Killer feature didattica** (proposta A1 in feature-suggestions, top didactic value).

Oggi in modalità Learn, dopo che l'utente ha inserito le sue stime di altitudine/D+/D-, il grafico altimetrico mostra solo i suoi waypoint con quote (linea spezzata "piatta", marcata "stimato"). La Verifica restituisce solo numeri (delta, %).

**Proposta:** dopo la Verifica, sovrapporre al grafico "piatto" (basato sulle quote-endpoint dell'utente) il **profilo reale dettagliato** campionato ogni 20-50m. L'utente *vede* dove ha sottostimato.

Trasforma la verifica da "X errori, ~ vicini, ✓" a un'esperienza visiva. È il punto di contatto con la mission "didattica visiva".

## Mockup concettuale

```
┌────────────────────────────────────────────────┐
│ Profilo altimetrico (stimato vs reale)         │
├────────────────────────────────────────────────┤
│       ▲                                        │
│      ╱ ╲      ←  Profilo reale (campionato)    │
│     ╱   ╲╱╲                                    │
│ ─────────── ←  Profilo stimato (tuoi waypoint) │
│                                                │
│ Tappa 1: hai sottostimato di +47m D+           │
└────────────────────────────────────────────────┘
```

## Origine

Feature suggestion **A1**. Cfr. `backlog/docs/feature-suggestions.md` A1, `backlog/docs/persona-usability-tests.md` sez. "Top 5 azioni post-test live".

## Task

### Dati
- [ ] In `ActionBar.handleVerify`, oltre a calcolare i delta, salvare nella validation session il profilo reale campionato per ogni leg
- [ ] Estendere `ValidationSession` (o nuovo `RealProfile`) con `realProfile: { distance: number; altitude: number }[]`

### Grafico
- [ ] In `ElevationProfile.tsx`, quando `appMode === 'learn'` E è disponibile un profilo reale dall'ultima Verifica:
  - Renderizzare DUE Area Recharts sovrapposte: una con `userProfile` (linea spezzata), una con `realProfile` (linea curva dettagliata)
  - Stili distinti: `realProfile` linea solida + area trasparente, `userProfile` linea tratteggiata
  - Annotazioni: nei punti dove `|userAlt - realAlt| > tolerance.altitude` mostrare un'icona warning con il delta

### Animation
- [ ] Animazione di "transizione" dal solo userProfile al doppio quando l'utente clicca Verifica (~1s easing)

## Acceptance criteria

- [ ] Dopo Verifica in Learn, il grafico mostra entrambi i profili in modo distinguibile
- [ ] Toggle "mostra solo il mio profilo" per chi vuole confrontare numericamente prima del visual
- [ ] Funziona anche con itinerari di 10+ waypoint senza lag

## Riferimenti

- `src/components/map/ElevationProfile.tsx`
- `src/components/panel/ActionBar.tsx` (handleVerify)
- `src/lib/types.ts` (ValidationSession)
- `backlog/docs/feature-suggestions.md` A1
<!-- SECTION:DESCRIPTION:END -->
