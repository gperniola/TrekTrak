# Quiz su POI reali + Auto-naming waypoint

## Feature 1 — Quiz su POI/sentieri

### Problema
I punti quiz vengono generati casualmente dentro i bounds della mappa, finendo spesso su zone vuote, boschi inaccessibili o aree senza riferimenti cartografici utili.

### Soluzione
Usare Overpass API per cercare POI escursionistici e nodi sentiero reali dentro i bounds della mappa, poi selezionare casualmente tra quelli trovati.

### Nuovo modulo `src/lib/overpass-api.ts`
- Funzione `fetchHikingPOIs(bounds)` che interroga Overpass API
- Query per: `natural=peak`, `natural=saddle`, `mountain_pass`, `natural=spring`, `tourism=alpine_hut`, `tourism=wilderness_hut`, nodi su sentieri con `sac_scale`
- Ritorna `{ lat: number; lon: number; name?: string; type: string }[]`
- Cache in memoria (Map keyed su bounds arrotondati) per evitare richieste duplicate
- Timeout 8s

### Modifiche a `src/lib/quiz.ts`
- Nuova funzione `pickQuizPoint(bounds, poiList)` che seleziona random tra i POI dentro i bounds visibili
- `generateRandomPoint` rimane come fallback

### Modifiche a `src/components/quiz/QuizOverlay.tsx`
- `buildQuestion` chiama `fetchHikingPOIs` (cached), poi `pickQuizPoint`
- Fallback a `generateRandomPoint` se nessun POI trovato o Overpass non risponde

## Feature 2 — Auto-naming waypoint

### Problema
I waypoint creati cliccando sulla mappa hanno nomi generici (`Waypoint 1`, `Waypoint 2`). Sarebbe utile avere un nome descrittivo basato su cosa c'è nelle vicinanze.

### Soluzione
Reverse geocoding via Nominatim per ottenere un nome significativo dal punto cliccato.

### Nuovo modulo `src/lib/reverse-geocoding-api.ts`
- Funzione `reverseGeocode(lat, lon): Promise<string | null>`
- Chiama Nominatim reverse con `zoom=18` (raggio ~100m effettivo)
- Parsing risposta con priorità hiking: rifugio > vetta/cima > sella/passo > località > indirizzo
- Abbreviazioni: `Rifugio` → `Rif.`, `Monte` → `M.te`, `Sentiero` → `Sent.`
- Troncamento a max 30 caratteri
- Ritorna `null` se niente di significativo trovato
- Timeout 5s

### Modifiche a `src/components/map/InteractiveMap.tsx`
- Dopo `addWaypointAtPosition`, chiama `reverseGeocode(lat, lon)` async
- Se ritorna un nome e il waypoint ha ancora il nome default → `updateWaypoint(id, { name })`
- Non sovrascrive se l'utente ha già editato il nome

### Flusso dati

```
Click mappa → addWaypointAtPosition (sincrono, nome="Waypoint N")
           → reverseGeocode(lat, lon) (async, non-blocking)
           → se nome trovato e nome ancora default → updateWaypoint(id, { name })
```

```
Quiz start → fetchHikingPOIs(bounds) (cached)
          → pickQuizPoint seleziona random tra POI
          → fallback a generateRandomPoint se vuoto
```

### Edge cases
- Overpass down/lento → fallback silenzioso a punti random
- Nominatim non trova nulla → nome resta `Waypoint N`
- Utente edita nome prima che reverse geocoding risponda → non sovrascrivere
- Bounds troppo piccoli → pochi POI, supplementa con nodi sentiero
- Rate limiting Nominatim (1 req/s) → una sola chiamata per click, non parallele
