---
id: TASK-59
title: Suggerimento 3 — tramonto e crepuscolo sul percorso
status: Done
assignee: []
created_date: '2026-08-27 16:30'
labels:
  - safety
  - didattica
dependencies: []
priority: medium
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ora del tramonto e del crepuscolo civile, calcolata **in locale** (nessuna fonte
esterna, nessuna rete), incrociata con la stima Munter: dice se si arriva al buio.

Costo quasi nullo, valore alto per il trekking: essere colti dal buio e' uno dei modi
piu' comuni in cui una gita facile diventa un problema.
<!-- SECTION:DESCRIPTION:END -->

## Esito (2026-08-27)

Fatto: `lib/sun.ts` (algoritmo NOAA, nessuna rete, nessuna chiave), mostrato nel
pannello del meteo del percorso insieme a un avviso quando l'orario di arrivo stimato
cade **dopo il tramonto**.

Validato su effemeridi pubblicate: Roma al solstizio d'estate (alba 05:35, tramonto
20:49) e d'inverno (07:34 / 16:41), con tolleranza di 3 minuti. `null` dove il fenomeno
non avviene (sole di mezzanotte a Capo Nord): un orario inventato sarebbe peggio di un
"non lo so".
