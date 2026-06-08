---
id: TASK-50
title: "[mobile] Menu \"Altro\" (Meteo/PDF/GPX) + gestione tasto Indietro"
status: Done
assignee: []
created_date: '2026-06-08 10:00'
labels:
  - ux
  - mobile
dependencies: []
priority: medium
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Due richieste utente (solo mobile `<lg`, desktop invariato):

1. **Quarto pulsante "Altro"** nella bottom nav che apre un menu a tendina con: **Meteo**, **PDF Sintetico**, **PDF Roadbook**, **GPX** (operano sull'itinerario corrente; disabilitati quando non applicabili, come la barra dell'Editor).
2. **Tasto Indietro del telefono** (History API): priorità — (a) se un overlay/menu è aperto lo chiude; (b) se sei su una scheda ≠ Mappa torna alla Mappa; (c) se sei sulla Mappa e nulla è aperto, popup in-app "Uscire da TrekTrak?" (no `beforeunload`).

Decisioni di design (utente, 2026-06-08): Indietro chiude prima gli overlay; conferma uscita solo via tasto Indietro (popup nostro), niente avviso di ricarica/chiusura.

## Acceptance criteria
- [ ] Bottom nav mobile a 4 voci: Mappa · Editor · Libreria · Altro (Altro apre il menu, non cambia scheda).
- [ ] Menu "Altro": Meteo/PDF Sintetico/PDF Roadbook/GPX; azioni sull'itinerario corrente; disabilitati quando non applicabili; si chiude dopo l'azione e con tap fuori.
- [ ] Indietro: chiude overlay → torna a Mappa → conferma uscita (in quest'ordine), solo `<lg`.
- [ ] Desktop invariato. Suite verde, build ok, verifica visiva mobile.

## Riferimenti
- `src/components/panel/BottomNav.tsx`, `src/app/page.tsx`, `src/stores/uiStore.ts`
- `src/components/panel/ActionBar.tsx` (logica export di riferimento), `src/lib/{meteo,export-gpx,export-pdf,calculations}.ts`
<!-- SECTION:DESCRIPTION:END -->
