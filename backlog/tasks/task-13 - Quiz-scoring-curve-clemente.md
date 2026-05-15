---
id: TASK-13
title: Curva di scoring quiz più clemente per principianti
status: Done
assignee: []
created_date: '2026-05-15 18:30'
labels:
  - quiz
  - didactic
  - ux
  - polish-v0.6.2-deferred
dependencies: []
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/lib/quiz.ts:44-61` `calculateQuizScore` usa una curva di scoring lineare:

```typescript
return Math.max(0, Math.round(100 * (1 - delta / tolerance)));
```

**Problema (test live R8-09).** Per la Persona D principiante:

- Distanza reale 1.41 km, sua stima 2.00 km → delta 0.59 km
- Tolerance distanza = 20% del reale = 0.282
- delta/tolerance = 2.09 → score = `max(0, 100*(1-2.09))` = **0/100**

Un errore del 42% (che per un principiante è normale alla prima sessione) restituisce 0 punti. Scoraggiante. Inoltre il salto da "ok-ish" a "zero" è netto attorno al confine della tolerance.

## Origine

Deferred da live persona test, finding **R8-09**.

## Task

- [ ] Sostituire la curva lineare con una sub-lineare (es. radice quadrata):
  ```typescript
  return Math.max(0, Math.round(100 * (1 - Math.sqrt(delta / tolerance))));
  ```
  Con questa:
  - delta = 0 → 100/100
  - delta = 0.5 × tolerance → 29/100 (vs 50/100 lineare — premia di più la precisione)
  - delta = 1 × tolerance → 0/100 (uguale al lineare al confine)
  - **MA** un overshoot oltre la tolerance: lineare → 0 immediato; sqrt → ancora 0 immediato (cap a 0 con `Math.max`)
  
  Ah, la radice non aiuta nel caso 42% off. Serve invece estendere la tolerance.

- [ ] Approccio alternativo: definire **due soglie**:
  - `strictTolerance`: dentro questo → 100-50 punti (clemente)
  - `looseTolerance = 2 × strictTolerance`: tra strict e loose → 50-10 punti
  - oltre loose → score basato su `1 - sqrt(delta/loose)` capped al 10%
- [ ] Mostrare nel report (post-domanda) il livello: "Eccellente / Buono / Sufficiente / Da rivedere" oltre al numero, per ridurre il peso emotivo dello 0/100

## Acceptance criteria

- [ ] Una risposta a 42% di errore restituisce uno score > 0 (es. 15-25/100)
- [ ] Una risposta perfetta = 100/100 invariato
- [ ] Test esistenti in `src/__tests__/quiz.test.ts` aggiornati con i nuovi valori attesi
- [ ] La curva è documentata in commento nel codice

## Riferimenti

- `src/lib/quiz.ts:33-61` (TOLERANCES e calculateQuizScore)
- `backlog/docs/persona-usability-tests.md` R8-09 / Persona D
<!-- SECTION:DESCRIPTION:END -->
