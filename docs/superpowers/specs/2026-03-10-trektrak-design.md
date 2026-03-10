# TrekTrak — Design Specification

## Scopo

App web didattica per l'apprendimento della cartografia manuale, con supporto alla creazione di itinerari di trekking tracciati su mappa. L'utente inserisce manualmente tutti i dati cartografici (coordinate, altitudini, distanze, azimuth) e l'app li valida confrontandoli con dati reali su richiesta.

## Stack Tecnologico

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Mappa**: React-Leaflet + tile OpenStreetMap (gratuito, nessun API key)
- **Elevazione**: Open-Elevation API (solo per validazione su richiesta)
- **PDF**: jsPDF + html2canvas
- **Persistenza**: localStorage
- **Styling**: Tailwind CSS (mobile-first)

## Layout

Layout a due colonne (desktop) con comportamento stacked su mobile:

- **Desktop (1280px+)**: Pannello sinistro (380px) con form waypoint, lista tratte, riepilogo totali, azioni export. Pannello destro con mappa interattiva e profilo altimetrico in basso.
- **Mobile (<768px)**: Mappa in alto, contenuto sotto con tab bar (Waypoint / Profilo / Export). Footer con riepilogo totali.

## Flusso Dati (Didattico)

Il flusso e' progettato per l'apprendimento della cartografia manuale:

1. **Input manuale completo** (default): l'utente inserisce tutti i dati per ogni waypoint (nome, latitudine, longitudine, altitudine) e per ogni tratta (distanza, dislivello positivo/negativo, azimuth)
2. **Calcoli derivati automatici**: dai dati inseriti l'app calcola automaticamente tempo di percorrenza, pendenza percentuale, difficolta'
3. **Verifica su richiesta**: pulsante "Verifica" che confronta i dati inseriti con quelli reali (API elevazione, calcolo geodesico) mostrando scostamenti

## Features Core

### 1. Gestione Waypoint
- Aggiungi / rimuovi / riordina waypoint con drag-and-drop
- Campi input: nome, latitudine, longitudine, altitudine
- Click sulla mappa posiziona il marker ma NON auto-compila altitudine e altri campi (l'utente li inserisce manualmente)

### 2. Gestione Tratte
- Per ogni coppia di waypoint consecutivi, campi input: distanza (km), dislivello positivo (m), dislivello negativo (m), azimuth (gradi)
- Calcolo automatico derivato: tempo di percorrenza, pendenza %

### 3. Mappa Interattiva
- Click per aggiungere waypoint
- Marker draggabili per riposizionare
- Linea del percorso tra waypoint consecutivi
- Zoom / pan standard

### 4. Tabella Itinerario
- Riepilogo tutte le tratte con dati inseriti e calcolati
- Riga totali in fondo (distanza totale, dislivello totale +/-, tempo totale)

### 5. Profilo Altimetrico
- Grafico del dislivello lungo il percorso basato sui dati inseriti dall'utente
- Waypoint evidenziati sul grafico con label

### 6. Export PDF
- **Formato sintetico** (1 pagina): tabella riassuntiva + mappa statica del percorso
- **Formato roadbook** (multi-pagina): dettaglio per ogni tratta con indicazioni di navigazione, azimuth, profilo altimetrico, mappa

### 7. Export GPX
- File GPX standard con waypoint e traccia
- Compatibile con dispositivi GPS (Garmin, ecc.) e app (Komoot, Wikiloc, ecc.)

### 8. Salvataggio Locale
- CRUD itinerari in localStorage
- Lista itinerari salvati con nome, data, riepilogo
- Import/export JSON per backup

## Features Didattiche

### 9. Validazione con Feedback Visivo
- Per ogni dato inserito, dopo "Verifica":
  - **Verde**: corretto (entro tolleranza)
  - **Giallo**: margine accettabile (es. +/- 5-10%)
  - **Rosso**: errore significativo
- Mostra il valore reale e il delta (differenza)
- Icone e colori chiari, non intrusivi

### 10. Quiz Mode
- Dato un punto sulla mappa, l'utente deve stimare:
  - Coordinate (lat/lon)
  - Altitudine
  - Distanza da un altro punto
  - Azimuth verso un altro punto
- Punteggio basato sulla precisione delle risposte
- Feedback immediato con spiegazione

### 11. Suggerimenti Didattici Contestuali
- Quando l'utente sbaglia, mostra spiegazioni contestuali:
  - Formula per il calcolo dell'azimuth
  - Come leggere le curve di livello
  - Come stimare distanze dalla scala
  - Concetti di proiezione e coordinate
- Tooltip o pannello espandibile, non invasivo

### 12. Report di Apprendimento
- Tracking degli errori piu' frequenti tra sessioni (salvato in localStorage)
- Categorie: altitudine, coordinate, distanza, azimuth, dislivello
- Trend di miglioramento nel tempo
- Riepilogo statistico (% accuratezza per categoria)

### 13. Margini di Tolleranza Configurabili
- Soglie personalizzabili per ogni tipo di dato:
  - Altitudine: default +/- 20m
  - Coordinate: default +/- 0.001 gradi (~100m)
  - Distanza: default +/- 10%
  - Azimuth: default +/- 5 gradi
  - Dislivello: default +/- 15%
- Pannello impostazioni accessibile

### 14. Overlay Griglia UTM/Coordinate
- Toggle per mostrare/nascondere griglia sulla mappa
- Griglia UTM e/o gradi decimali
- Aiuto visivo per la lettura delle coordinate

## Features Extra

### 15. Stima Difficolta'
- Calcolo automatico scala T1-T6 basato su pendenza media/massima e dislivello totale
- Visualizzato nel riepilogo e nel PDF

### 16. Link Meteo
- Link rapido a servizio meteo esterno per le coordinate del percorso
- Nessuna API necessaria, semplice link parametrizzato

### 17. Condivisione via URL
- Itinerario codificato in URL (base64 o compresso)
- Nessun server necessario, il destinatario apre il link e vede l'itinerario

### 18. Waypoint Card Stampabili
- Mini-schede ritagliabili per ogni waypoint con:
  - Nome, coordinate, altitudine
  - Direzione e distanza al prossimo waypoint
  - Azimuth, tempo stimato
- Layout ottimizzato per stampa su A4

## Formula Tempi di Percorrenza (Munter)

- Velocita' orizzontale: 4 km/h
- Velocita' verticale salita: 400 m/h
- Velocita' verticale discesa: 800 m/h
- **Tempo totale** = max(T_orizzontale, T_verticale) + 0.5 * min(T_orizzontale, T_verticale)

## Scala Difficolta' (SAC T1-T6)

| Scala | Pendenza | Descrizione |
|-------|----------|-------------|
| T1 | < 15% | Escursione facile |
| T2 | 15-25% | Escursione media |
| T3 | 25-35% | Escursione impegnativa |
| T4 | 35-45% | Percorso alpino |
| T5 | 45-55% | Percorso alpino impegnativo |
| T6 | > 55% | Percorso alpino difficile |

## Stato di Validazione

Ogni campo validabile ha tre stati:
- `unverified` — dato inserito, non ancora verificato
- `valid` — verificato, entro tolleranza
- `warning` — verificato, margine accettabile
- `error` — verificato, errore significativo

Lo stato include: `{ status, userValue, realValue, delta, tolerance }`.
