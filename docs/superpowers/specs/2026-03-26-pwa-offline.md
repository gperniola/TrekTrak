# PWA Offline

## Scopo
Rendere TrekTrak una Progressive Web App installabile con funzionamento offline completo: app shell, tile mappa cachati, dati localStorage accessibili senza rete.

## Service Worker

### Libreria
`next-pwa` (wrapper Workbox per Next.js) — genera automaticamente il service worker dalla configurazione in `next.config.ts`.

### Strategie di caching

| Risorsa | Strategia | Dettagli |
|---|---|---|
| App shell (JS, CSS, HTML) | Stale-while-revalidate | Caricamento istantaneo, aggiornamento in background |
| Tile mappa | Cache-first | TTL 30 giorni, max 2000 tile |
| API elevation (`/api/elevation`) | Network-first | Fallisce silenziosamente offline (già gestito) |
| Nominatim, ORS | Network-only | Falliscono silenziosamente offline |

### URL pattern per tile caching
- `https://*.tile.openstreetmap.org/**`
- `https://*.tile.opentopomap.org/**`
- `https://tile.thunderforest.com/**`
- `https://*.tile-cyclosm.openstreetmap.fr/**`
- `https://tile.waymarkedtrails.org/**`

### Limiti cache tile
- Max 2000 entries (LRU eviction)
- TTL 30 giorni (ExpirationPlugin)

## Manifest (`public/manifest.json`)

```json
{
  "name": "TrekTrak",
  "short_name": "TrekTrak",
  "description": "App didattica per cartografia manuale e trekking",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#4ade80",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## Icone PWA
- Generare `public/icons/icon-192.png` e `public/icons/icon-512.png`
- Triangolo verde su sfondo nero (coerente col logo "▲ TrekTrak")
- Formato PNG, sfondo opaco

## Banner Offline

### Componente `OfflineBanner.tsx`
- Ascolta `navigator.onLine` + eventi `window.online`/`window.offline`
- Mostra banner fisso in alto quando offline: "Modalità offline — alcune funzioni non disponibili"
- Sfondo amber, testo piccolo, non blocca interazione
- Sparisce automaticamente al ritorno della connessione
- z-index sopra la mappa ma sotto i modali (z-[1050])

## Cosa funziona offline
- App si apre e si carica completamente (app shell cachata)
- Mappa navigabile nelle zone già visitate (tile cachati cache-first)
- Itinerari salvati in localStorage accessibili
- Creazione/modifica waypoint e tratte (input manuale)
- Export PDF e GPX (generati client-side)
- Profilo altimetrico con dati già calcolati
- URL sharing (encode/decode è client-side)
- Griglia coordinate, righello (calcoli client-side)

## Cosa NON funziona offline
- Fetch elevazione (API esterna) — fallisce, campi restano vuoti
- Verifica (richiede API) — fallisce con messaggio esistente
- Quiz altitudine — domande altitude falliscono (retry esauriti), distance e azimuth funzionano
- Ricerca località (Nominatim) — fallisce silenziosamente
- Trail routing (ORS) — fallisce, fallback a modalità classic

## Implementazione

### File nuovi
- `public/manifest.json` — manifest PWA
- `public/icons/icon-192.png` — icona 192x192
- `public/icons/icon-512.png` — icona 512x512
- `src/components/shared/OfflineBanner.tsx` — banner stato offline

### File modificati
- `next.config.ts` — configurazione next-pwa con runtimeCaching per tile
- `src/app/layout.tsx` — meta tag manifest + theme-color
- `src/app/page.tsx` — render OfflineBanner

### Dipendenza
- `next-pwa` (da installare)
