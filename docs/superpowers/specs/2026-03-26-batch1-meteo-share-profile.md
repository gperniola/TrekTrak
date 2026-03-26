# Batch 1 — Link Meteo, Condivisione URL, Profilo Interattivo

## Feature 1: Link Meteo

### Scopo
Pulsante nell'ActionBar che apre Meteoblue in una nuova tab, centrato sulle coordinate medie dell'itinerario.

### Comportamento
- URL: `https://www.meteoblue.com/it/tempo/settimana/{lat}N{lon}E` con lat/lon come centroide dei waypoint con coordinate valide
- Visibile solo quando ci sono almeno 2 waypoint con coordinate valide
- Si apre in `_blank`
- Nessuna API necessaria

### Implementazione
- Funzione `buildMeteoUrl(waypoints)` in `src/lib/meteo.ts`
  - Input: array di waypoint
  - Filtra waypoint con lat/lon non null
  - Calcola centroide: media aritmetica di lat e lon
  - Formatta URL Meteoblue con 4 decimali
  - Ritorna `null` se meno di 2 waypoint validi
- Pulsante in `ActionBar.tsx`: label "Meteo", stile coerente con gli altri pulsanti, `window.open(url, '_blank')`

### Test
- `buildMeteoUrl` ritorna null con 0-1 waypoint validi
- `buildMeteoUrl` calcola centroide corretto con 3+ waypoint
- `buildMeteoUrl` ignora waypoint senza coordinate
- URL generato contiene lat/lon corretti nel formato Meteoblue

---

## Feature 2: Condivisione via URL

### Scopo
Pulsante "Copia link" nell'ActionBar che serializza l'itinerario corrente in un URL compresso e lo copia negli appunti. Al caricamento, se l'URL contiene dati, l'itinerario viene ripristinato.

### Serializzazione
Dati inclusi (solo input utente, niente dati calcolati):
- `name`: nome itinerario
- `wps`: array di `[name, lat, lon, alt]` (lat/lon/alt possono essere null)
- `legs`: array di `[distance, elevGain, elevLoss, azimuth]` (tutti possono essere null)

Formato: JSON → `lz-string` compressToEncodedURIComponent → hash fragment `#data=...`

### Deserializzazione
- Al mount della pagina, controlla `window.location.hash`
- Se inizia con `#data=`, decomprimi con `lz-string` decompressFromEncodedURIComponent
- Parse JSON, valida struttura, chiama `loadItinerary` con i dati ricostruiti
- Pulisci l'hash dall'URL dopo il caricamento (`history.replaceState`)

### Limiti e feedback
- Se waypoints > 15 o URL risultante > 2000 caratteri: mostra alert "Itinerario troppo grande per la condivisione via link. Usa Export JSON."
- Dopo copia riuscita: toast "Link copiato!" visibile 2 secondi

### Implementazione
- `src/lib/share-url.ts`:
  - `encodeItinerary(name, waypoints, legs): string | null` — ritorna URL completo o null se troppo grande
  - `decodeItinerary(hash): { name, waypoints, legs } | null` — ritorna dati o null se invalido
- Pulsante in `ActionBar.tsx`: label "Copia link"
- Hook di caricamento in `page.tsx`: `useEffect` al mount che controlla hash e carica
- Toast component minimale o inline state per "Link copiato!"
- Dipendenza: `lz-string` (da installare)

### Test
- `encodeItinerary` produce stringa valida per itinerario con 3 waypoint
- `decodeItinerary` ricostruisce correttamente i dati originali (roundtrip)
- `encodeItinerary` ritorna null per itinerario con >15 waypoint
- `decodeItinerary` ritorna null per hash invalido/corrotto
- `decodeItinerary` ritorna null per JSON valido ma struttura non conforme
- Roundtrip preserva tutti i campi (nome, coordinate, altitudini, dati tratte)
- Waypoint con campi null vengono preservati correttamente nel roundtrip

---

## Feature 3: Profilo Altimetrico Interattivo (Bidirezionale)

### Scopo
Hover/click sul grafico altimetrico evidenzia il punto corrispondente sulla mappa. Hover su un segmento del percorso sulla mappa evidenzia il punto corrispondente sul grafico. Esperienza bidirezionale.

### Stato condiviso
Nuovo campo nello Zustand store:
```typescript
profileHover: {
  distance: number;  // distanza cumulativa in km dal primo waypoint
  source: 'chart' | 'map';  // chi ha emesso l'evento
} | null;
```

Azioni:
- `setProfileHover(distance, source)` — imposta hover
- `clearProfileHover()` — pulisce hover

### Grafico → Mappa
- `ElevationProfile.tsx`: Recharts `onMouseMove` emette `setProfileHover(distance, 'chart')`, `onMouseLeave` emette `clearProfileHover()`
- `InteractiveMap.tsx`: legge `profileHover`, se `source === 'chart'`:
  - Calcola la posizione geografica corrispondente alla distanza (interpolazione lungo le tratte)
  - Mostra un marker temporaneo (DivIcon cerchio pulsante, colore amber)
- Click sul grafico: chiama `map.flyTo(position, currentZoom)` per centrare

### Mappa → Grafico
- `InteractiveMap.tsx`: evento `mousemove` sulle Polyline del percorso
  - Calcola la distanza cumulativa dal primo waypoint al punto di hover
  - Emette `setProfileHover(distance, 'map')`
  - `mouseleave` emette `clearProfileHover()`
- `ElevationProfile.tsx`: legge `profileHover`, se `source === 'map'`:
  - Mostra una ReferenceLine verticale alla distanza indicata

### Funzione di interpolazione posizione
In `src/lib/calculations.ts`:
```typescript
distanceToPosition(
  distance: number,
  waypoints: Waypoint[],
  legs: Leg[]
): [number, number] | null
```
- Dato una distanza cumulativa in km, ritorna [lat, lon] interpolando lungo le tratte
- Usa la geometria del percorso (routeGeometry) se disponibile, altrimenti linea retta tra waypoint
- Ritorna null se la distanza è fuori range

Funzione inversa:
```typescript
positionToDistance(
  lat: number, lon: number,
  waypoints: Waypoint[],
  legs: Leg[]
): number | null
```
- Dato un punto, trova la distanza cumulativa più vicina lungo il percorso
- Proietta il punto sulla tratta più vicina

### Performance
- Throttle a 60ms su tutti gli eventi hover (sia chart che map)
- Il marker temporaneo sulla mappa usa DivIcon leggero (no immagini)
- ReferenceLine su Recharts è nativa e performante

### Test
- `distanceToPosition` ritorna posizione corretta a metà di una tratta rettilinea
- `distanceToPosition` ritorna primo waypoint per distanza 0
- `distanceToPosition` ritorna ultimo waypoint per distanza totale
- `distanceToPosition` ritorna null per distanza negativa o oltre il totale
- `distanceToPosition` interpola correttamente tra tratte consecutive
- `positionToDistance` ritorna 0 per il primo waypoint
- `positionToDistance` ritorna distanza totale per l'ultimo waypoint
- `positionToDistance` ritorna distanza corretta per punto sulla tratta
- Roundtrip: `positionToDistance(distanceToPosition(d)) ≈ d`
