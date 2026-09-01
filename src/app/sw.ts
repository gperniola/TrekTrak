import { defaultCache } from '@serwist/next/worker';
import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, NetworkOnly, Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { ENDPOINT_OVERPASS } from '@/lib/overpass';
import { CACHE_TESSERE } from '@/lib/tile-offline';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

/**
 * Quanto si conserva di ogni servizio di mattonelle.
 *
 * `maxEntries` è **per cache**, e deve stare comodamente sopra `TETTO_TESSERE`: un
 * pre-caricamento riempie fino a 500 voci in una sola cache, e se il tetto della cache
 * fosse vicino a quello dello scaricamento le mattonelle appena prese sfratterebbero
 * quelle prese un attimo prima — si tornerebbe in quota con metà mappa, senza che nulla
 * lo abbia segnalato. Il rapporto è verificato in `service-worker-ordine.test.ts`.
 *
 * `purgeOnQuotaError` dichiara queste cache **le prime da sacrificare** quando lo spazio
 * finisce. È la scelta giusta perché sono le uniche che si riottengono da sole: tutto il
 * resto — il guscio dell'app, i dati salvati — non si può riscaricare a comando. Ed è
 * proprio la cache che riempie lo spazio, visto che il browser conta le risposte opache
 * con un forte arrotondamento in eccesso.
 */
const TILE_EXPIRATION = {
  maxEntries: 1000,
  maxAgeSeconds: 30 * 24 * 60 * 60,
  purgeOnQuotaError: true,
};

/** Host di tutte le porte Overpass, per la regola piu' sotto. */
const hostOverpass = new Set(ENDPOINT_OVERPASS.map((e) => new URL(e).hostname));

/**
 * La cache delle mattonelle.
 *
 * **`statuses: [0, 200]` non e' un dettaglio: senza, questa cache non esiste.** Leaflet
 * chiede le mattonelle con dei tag `<img>`, cioe' richieste `no-cors`, e la risposta che
 * ne torna e' **opaca**: stato 0, contenuto illeggibile dal codice. La strategia, per
 * difetto, conserva solo le risposte con stato 200 — quindi rifiutava tutto, in silenzio.
 *
 * Misurato il 2026-09-01 su build di produzione: ventiquattro mattonelle caricate a
 * schermo, `caches.keys()` senza nemmeno una delle cinque cache dei tile. La mappa
 * offline che il progetto credeva di avere **non e' mai esistita**: la correzione della
 * v0.13.5 aveva sistemato l'ORDINE delle regole, cioe' aveva reso la regola
 * raggiungibile, ma raggiunta rifiutava comunque.
 *
 * Il prezzo di accettare le risposte opache va detto: non potendone leggere lo stato, una
 * pagina d'errore del server finisce in cache come se fosse una mattonella. E' il
 * compromesso obbligato per le immagini, e la scadenza a trenta giorni lo limita.
 */
const tileHandler = (cacheName: string) =>
  new CacheFirst({
    cacheName,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin(TILE_EXPIRATION),
    ],
  });

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    /*
     * L'ORDINE E' LA COSA PIU' IMPORTANTE DI QUESTO ELENCO.
     *
     * Vince la prima regola che corrisponde. `defaultCache` finisce con un
     * acchiappatutto per QUALUNQUE richiesta cross-origin
     * (`matcher: ({ sameOrigin }) => !sameOrigin`, NetworkFirst, cache "cross-origin",
     * 32 voci, un'ora, `networkTimeoutSeconds: 10`): se sta prima, tutto quello che
     * viene dopo non viene mai raggiunto.
     *
     * Con `...defaultCache` in mezzo all'elenco succedeva questo, misurato nel
     * browser:
     * - i cinque cache dei tile non esistevano proprio, e le mattonelle della mappa
     *   finivano nell'acchiappatutto: **32 voci per un'ora** invece di 1000 per
     *   trenta giorni. Per un'app da montagna significa che la mappa offline non
     *   c'era;
     * - la richiesta dei ripari veniva troncata a 10 secondi e il service worker
     *   restituiva un **504** sintetico, mentre la stessa URL da `curl` rispondeva
     *   200: il pannello diceva "il servizio e' occupato" quando il servizio stava
     *   benissimo. La nostra query dichiara `[timeout:20]`, e il worker la tagliava
     *   a meta'.
     *
     * Quindi: prima le regole specifiche, `...defaultCache` per ultimo, sempre.
     */

    // Dati di emergenza: MAI serviti da cache (dati stantii = rischio, non feature).
    { matcher: /\/api\/(fires|dpc-alerts)/, handler: new NetworkOnly() },
    { matcher: /^https:\/\/maps\.effis\.emergency\.copernicus\.eu\//i, handler: new NetworkOnly() },
    { matcher: /^https:\/\/raw\.githubusercontent\.com\/pcm-dpc\//i, handler: new NetworkOnly() },
    // Radar e previsione meteo: un fotogramma di due ore fa servito dalla cache come se
    // fosse l'ultimo e' esattamente il difetto che questa regola esiste per evitare.
    { matcher: /^https:\/\/(api|tilecache)\.rainviewer\.com\//i, handler: new NetworkOnly() },
    { matcher: /^https:\/\/api\.open-meteo\.com\//i, handler: new NetworkOnly() },
    { matcher: /^https:\/\/view\.eumetsat\.int\//i, handler: new NetworkOnly() },
    /*
     * Ripari: nessun taglio a 10 secondi. Overpass e' un servizio pubblico che mette
     * in coda le richieste, la nostra query gli concede 20 secondi, e la risposta non
     * va riusata un'ora dopo da un'altra parte della montagna.
     */
    /*
     * La regola si RICAVA dall'elenco delle porte in `lib/overpass.ts`: aggiungerne una
     * senza ricordarsi di questa riga la farebbe cadere nel `defaultCache` in fondo, che
     * e' `NetworkFirst` con un'ora di cache — esattamente il difetto della v0.13.5.
     *
     * Oggi quelle chiamate sono POST, e il router non intercetta i metodi diversi da GET:
     * la regola e' quindi una rete di sicurezza per il giorno in cui una query tornasse a
     * viaggiare in GET, non l'unica cosa che le tiene fuori dalla cache.
     */
    { matcher: ({ url }) => hostOverpass.has(url.hostname), handler: new NetworkOnly() },

    // Mattonelle della mappa: qui la cache lunga serve, ed e' quella che rende
    // l'itinerario consultabile senza campo.
    {
      matcher: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
      handler: tileHandler(CACHE_TESSERE[0]),
    },
    {
      matcher: /^https:\/\/.*\.tile\.opentopomap\.org\/.*/i,
      handler: tileHandler(CACHE_TESSERE[1]),
    },
    {
      matcher: /^https:\/\/tile\.thunderforest\.com\/.*/i,
      handler: tileHandler(CACHE_TESSERE[2]),
    },
    {
      matcher: /^https:\/\/.*\.tile-cyclosm\.openstreetmap\.fr\/.*/i,
      handler: tileHandler(CACHE_TESSERE[3]),
    },
    {
      matcher: /^https:\/\/tile\.waymarkedtrails\.org\/.*/i,
      handler: tileHandler(CACHE_TESSERE[4]),
    },

    // Per ultimo, sempre: acchiappa tutto il resto.
    ...defaultCache,
  ],
});

serwist.addEventListeners();
