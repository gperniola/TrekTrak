---
id: TASK-22
title: Cloud sync v1 (opzionale, multi-device)
status: Done
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - cloud
  - polish-v0.6.2-deferred
  - large
dependencies: []
priority: medium
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
> **Superato dalla v0.9.0 "Libreria condivisa cloud" (2026-06-05).** Quella release ha
> consegnato esattamente questo: libreria su Supabase con accesso a invito, magic-link,
> membri e ruoli con RLS, e sincronizzazione multi-device. Chiuso senza lavoro aggiuntivo.

**Origine.** Persona C (esperta) C.6 + Persona D (principiante) D.6 — entrambe trovano frustrante che gli itinerari salvati siano **solo su un device**. PC a casa, telefono in escursione → dati separati.

## Costo

**L** (2-3 settimane minime, infrastruttura + auth + UI). Da pesare bene rispetto al valore. Per uso personale (memoria utente: "Personal use context") potrebbe essere overkill. Alternativa breve: TASK-22-lite.

## TASK-22-lite (alternativa S)

Senza backend: una "esportazione veloce" via QR code o link condivisibile semi-permanente.

- [ ] Bottone "Sincronizza" in `SavedItinerariesModal` → mostra un QR code con il `#data=` share URL (già esistente)
- [ ] Sull'altro device, scannerizzare il QR → apre l'app con quel link → load automatico
- [ ] **Limite:** funziona per UN itinerario alla volta, non sincronizza progressivamente, no validazioni/quiz history

Questa è 1 giorno di lavoro e copre il 70% del problema.

## TASK-22-full (alternativa L)

Backend con auth + storage.

### Scelte tecnologiche da decidere
- [ ] Auth provider: Firebase Auth, Supabase, o magic link via email?
- [ ] Storage: Firestore, Supabase Postgres, o object store + JSON files?
- [ ] Modello dati: stessa shape di `Itinerary` + `userId`, oppure schema più ricco?

### Funzionalità
- [ ] Login/Signup opt-in dalla UI (Impostazioni → Account)
- [ ] On save, in parallelo a `localStorage.setItem`, scrive su cloud
- [ ] On boot, se logged-in, fetch cloud e merge con local (conflict resolution: last-write-wins basato su `updatedAt`)
- [ ] Sync incrementale di `validationHistory` e `quizHistory` per progresso cross-device

## Acceptance criteria (lite)

- [ ] QR code generato da un itinerario corrente
- [ ] Scannerizzazione da altro device carica l'itinerario

## Acceptance criteria (full)

- [ ] Login → save → logout → login da altro device → vedo l'itinerario
- [ ] Validation/quiz history sincronizzata
- [ ] Offline-first: localStorage rimane source of truth in caso di no-network

## Riferimenti

- `src/lib/share-url.ts` (codifica già esistente per QR/link)
- `src/lib/storage.ts` (interface da estendere)
- `backlog/docs/persona-usability-tests.md` C.6, D.6
- `backlog/docs/feature-suggestions.md` (cloud sync)

## Decisione richiesta

Prima di implementare, scegliere fra **lite** (QR/link) e **full** (backend). Memoria utente indica "personal use" → lite è probabilmente sufficiente.
<!-- SECTION:DESCRIPTION:END -->
