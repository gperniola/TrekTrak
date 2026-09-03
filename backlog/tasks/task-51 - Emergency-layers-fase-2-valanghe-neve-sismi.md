---
id: TASK-51
title: Layer emergenza fase 2 — valanghe, copertura nevosa, terremoti/GDACS (v0.12.0)
status: Done
assignee: []
created_date: '2026-08-25 15:00'
labels:
  - map
  - emergency-layers
  - feature
dependencies:
  - task-52
priority: medium
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seconda fase dei layer di emergenza (la fase 1 — incendi + allerte DPC — è la v0.11.0).
Da rilasciare **prima dell'inverno**: valanghe e neve sono le categorie stagionali.

Tutte le fonti sono **già validate** (fetch reali, CORS aperto, client-side) — dettagli completi con
endpoint in `backlog/docs/emergency-layers-design.md` **Appendice B**. In sintesi:

- **Valanghe**: aggregato EAWS su `static.avalanche.report` (rating 1–5 per micro-regione, tutte le
  regioni italiane incluso `IT-MeteoMont`/Appennini) + geometrie da `regions.avalanches.org`.
  Gestire stagionalità (404 = nessun bollettino) e fallback data odierna→ieri.
- **Copertura nevosa**: NASA GIBS WMTS `MODIS_Terra_NDSI_Snow_Cover`, senza chiave, maxNativeZoom 8.
- **Terremoti**: INGV FDSN event (GeoJSON, CC-BY).
- **GDACS multi-hazard**: opzionale, soglia di rilevanza globale.

Grazie al registry della fase 1, il lavoro dovrebbe ridursi a: nuove entry `EMERGENCY_LAYERS`
(+ categoria `neve`/`sismi`), un fetcher/parser per i ratings valanghe con join id→GeoJSON, popup
dedicati (valanga: rating am/pm e quota; sisma: magnitudo/profondità/ora), voci legenda scala EAWS.

## Task

- [x] Layer valanghe (zones): fetch ratings + join micro-regioni, colori scala EAWS 1–5, popup, stagionalità
- [x] Layer copertura nevosa (tile WMTS GIBS con data, maxNativeZoom 8)
- [x] Layer terremoti INGV (points, ultime 48h, minmag configurato, popup)
- [x] Valutare layer GDACS → **scartato, con misura** (sotto)
- [x] Estendere registry/pannello con le nuove categorie (`neve`, `sismi`)
- [x] Test secondo il pattern della fase 1 (87 test nuovi)

## Acceptance criteria

- [x] Rating valanghe visibile su Alpi e Appennini quando i bollettini sono in stagione —
      verificato contro il servizio VERO con data in stagione (15/02/2026): Dolomiti 6 zone
      a zoom 12 e 34 a zoom 9, Gran Sasso 3, Maiella 3, coi nomi italiani veri
      («Dolomiti di Braies», «Majella») e il salto di quota reale (3 in alto, 1 in basso)
- [x] Fuori stagione il layer mostra "nessun bollettino", non un errore — verificato a
      schermo il 03/09: «Nessuna valutazione pubblicata per questi giorni»
- [x] Nessuna nuova API key richiesta

## GDACS: scartato, e perché

MISURATO il 2026-09-03 sull'API vera (`eventlist=FL;WF;EQ`, ultimi 30 giorni): **12 eventi
in tutto il mondo, zero in Italia**. La soglia di rilevanza è globale, quindi per l'Italia
non aggiunge niente a FIRMS/EFFIS (incendi), DPC (alluvioni e frane) e INGV (sismi da
magnitudo 2, cioè tre ordini di sensibilità in più). I loro ToU dichiarano i dati
"indicativi". Un layer che non mostra mai nulla insegna solo a diffidare del pannello.

## Cosa ha cambiato la verifica sulle fonti vere

L'appendice diceva «il lavoro dovrebbe ridursi a nuove entry nel registry». Non è andata
così: otto scoperte hanno cambiato l'implementazione, e la più pesante ha imposto una
route nuova.

1. **Le geometrie sono 4,85 MB non compressi** per le nove regioni italiane, e il server
   non fa gzip (verificato chiedendo con `--compressed`). Dal telefono non si scaricano →
   `/api/avalanche` ritaglia sulla vista e semplifica: al client arrivano **31-106 KB**.
2. **Il rettangolo di `IT-MeteoMont` copre l'Italia intera**, isole comprese: filtrare per
   regione non serve a niente, il ritaglio va fatto per micro-regione.
3. **Fuori stagione Meteomont pubblica ogni giorno 39 zone tutte a `0`** mentre le otto
   regioni alpine danno 404. `0` = «nessuna valutazione»: senza gestirlo, a settembre l'app
   dipingeva 39 poligoni grigi annunciando «Bollettino del 03/09».
4. **Il bollettino del giorno D vale fino alle 16:00 UTC di D** (dal CAAML), e quello per
   domani esce nel pomeriggio: si prova domani, oggi, ieri — in quest'ordine dopo le 16.
5. **La quota cambia il numero**: la stessa micro-regione dava 3 sopra il limite del bosco
   e 1 sotto. Il popup dice entrambi — e non e' un caso raro: passando tutte e nove le
   regioni dal parser vero (15/02/2026, 160 zone valutate), **109 zone su 160 hanno un
   pericolo diverso sopra e sotto quota**. Le regioni alpine lo differenziano quasi
   sempre, `IT-MeteoMont` mai: per l'Appennino il popup mostra un numero solo, e sta bene
   cosi'.
6. **242 feature per 172 id distinti**: una micro-regione può essere più poligoni separati.
7. **INGV è mondiale** (il primo evento della prima risposta era nelle Sandwich Australi) e
   i suoi orari **non hanno il fuso** — due ore di errore, sempre verso "più recente".
8. **GIBS**: `{y}` prima di `{x}`, zoom massimo 8 dichiarato dal capabilities, nubi e acqua
   **trasparenti** (quindi il layer non dipinge nuvole, ma "nessun colore" può voler dire
   "nuvola sopra"), e la scala va dal giallo al rosso, non al bianco. Il tile di oggi
   risponde 404 fino al passaggio del satellite: il ripiego al giorno prima è servito
   subito, il primo giorno.

## Riferimenti

- `backlog/docs/emergency-layers-design.md` (Appendice B — endpoint verificati il 2026-08-25)
- Fase 1: [[task-52]]
<!-- SECTION:DESCRIPTION:END -->
