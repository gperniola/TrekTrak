---
id: TASK-3
title: Migration logic per SCHEMA_VERSION di localStorage
status: Done
assignee: []
created_date: '2026-05-15 17:30'
labels:
  - storage
  - tech-debt
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In `src/lib/storage.ts` esiste `SCHEMA_VERSION = 1` con `KEYS.schema = 'trektrak_schema_version'`, scritto in `initSchema()`, ma **non c'è alcuna logica di migrazione**: quando si bumpia la versione, i dati salvati con la versione precedente vengono letti con la nuova interpretazione → potenziale rottura.

## Origine

Deferred da campagna polish/v0.6.2, bug **R4-05**.

## Task

- [ ] Definire una funzione `runMigrations(fromVersion: number): void` chiamata da `initSchema()` quando rileva una versione minore di `SCHEMA_VERSION`
- [ ] Definire un pattern per le singole migrazioni: `migrations: Record<number, () => void>` dove la chiave è la versione di partenza
- [ ] Aggiornare `loadItineraries`, `loadSettings`, `loadValidationHistory`, `loadQuizHistory` per usare il sistema versioning-aware
- [ ] Testare con un fixture di localStorage v1 + bump a v2

## Note

Per uso personale corrente non è urgente: i validatori profondi (R1-04, R4-01) già scartano dati malformati. Diventa necessario il giorno in cui si cambia la shape di una struttura persistita.

## Riferimenti

- `src/lib/storage.ts`
- `backlog/docs/polish-v0.6.2-bug-log.md` row R4-05
<!-- SECTION:DESCRIPTION:END -->
