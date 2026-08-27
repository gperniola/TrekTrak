---
id: TASK-60
title: Fase C — instabilità osservata da satellite (EUMETSAT GII)
status: Done
assignee: []
created_date: '2026-08-27 20:00'
labels:
  - weather
  - emergency-layers
dependencies: []
priority: medium
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fase C di [[storm-safety-design]], decisa dopo il rilascio di A e B: il **Lifted Index**
del prodotto Global Instability Index di Meteosat, come layer WMS.

Il valore aggiunto rispetto al CAPE del pannello meteo è la natura del dato: il CAPE è
**previsto** da un modello, questo è **osservato dal satellite adesso** e aggiornato ogni
15 minuti. Serve la mattina della partenza, per confermare o smentire la previsione della
sera prima.

## Cosa ho verificato prima di scrivere codice

| Domanda | Esito misurato |
|---|---|
| Come si chiama il layer? | **`msg_fes:gii_liftedindex`**. `msg_gii_li` — il nome che avevo in mano dall'analisi — è lo **stile**, non il layer: usarlo come `LAYERS` avrebbe dato `LayerNotDefined` |
| Serve passare lo stile? | No: senza `styles` la risposta è identica (13.546 byte, 55.610 pixel opachi) |
| Funziona in EPSG:3857? | Sì, quindi il `WMSTileLayer` di Leaflet va bene così com'è, senza cambiare CRS |
| Come si chiede l'istante più recente? | **Omettendo TIME**: il capabilities dichiara `default="2026-08-27T17:15:00Z"` e `nearestValue="1"`. Con un TIME di tre ore prima si ottiene un'immagine diversa (8.328 byte invece di 13.546), quindi la dimensione temporale funziona davvero |
| È interrogabile? | Il capabilities dice `queryable="1"`, **ma è inutile**: GetFeatureInfo risponde `RED_BAND / GREEN_BAND / BLUE_BAND`, cioè i canali del PNG renderizzato, non il valore in K. Dichiararlo interrogabile avrebbe fatto leggere "RED_BAND = 0" a chi tiene premuto |
| Che scala ha? | Letta dalla barra ufficiale: **da -16 a +20 K**, colori rossi → oliva → viola → marroni (38 tinte campionate). **Polarità inversa** rispetto al CAPE: negativo = instabile |

## Scelte che ne derivano

- `timeMode: 'latest'`, nuovo: non aggiunge il parametro TIME.
- `queryable: false`, malgrado il capabilities: la misura conta più della dichiarazione.
- La legenda **non** riproduce le 38 tinte: quattro classi a parole con i valori in K, e
  la polarità detta esplicitamente. I colori della barra non sono interpretabili a
  intuito — il viola sta fra il giallo e il marrone — quindi lasciare interpretare la
  tinta sarebbe stato inutile o dannoso.
- EUMETSAT escluso dalla cache del service worker, come le altre fonti di emergenza.

## Difesa aggiuntiva: gli accenti italiani

Scrivendo questo layer ho sbagliato per la **quarta volta in due giorni** lo stesso
errore: apostrofo al posto dell'accento ("Instabilita’ osservata" invece di
"Instabilità"), perché evito le lettere accentate per non litigare con la shell.

Ora c'è `src/__tests__/accenti-italiani.test.ts`, che scandisce i sorgenti cercando
`vocale + apostrofo + spazio` in entrambe le forme — carattere e escape `\uXXXX`, che è
quella che uso io — con una lista di eccezioni per le parole che l'apostrofo lo vogliono
davvero ("un po’"). Appena scritto ha trovato **quattro** errori veri, incluso uno nel
popup delle novità che non avevo notato.
