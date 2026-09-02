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
 * La cache delle mattonelle, e la storia in tre atti che l'ha portata a questa forma.
 *
 * **Primo atto (v0.13.5).** Le cinque cache dei tile non esistevano nel browser, perche'
 * le loro regole stavano DOPO l'acchiappatutto di `...defaultCache` ed erano codice morto.
 * Sistemato l'ordine.
 *
 * **Secondo atto (v0.18.0).** Le regole erano raggiungibili e non conservavano comunque
 * nulla: Leaflet chiede le mattonelle con dei tag `<img>`, cioe' richieste `no-cors`, e la
 * risposta che ne torna e' **opaca** — stato 0, contenuto illeggibile. La strategia, per
 * difetto, accetta solo lo stato 200, quindi rifiutava tutto in silenzio. Misurato:
 * ventiquattro mattonelle a schermo, `caches.keys()` senza una sola cache dei tile. Si e'
 * aggiunto lo stato 0 fra quelli accettati, e la cache ha cominciato a riempirsi.
 *
 * **Terzo atto (v0.19.1), ed e' il motivo della forma attuale.** Accettare l'opaco
 * funzionava, ma a un prezzo che nessuno aveva misurato: il browser conta le risposte
 * opache in quota con un riempimento enorme, apposta, perche' il loro peso non trapeli.
 * Misurato il 2026-09-02 su Chrome, venti mattonelle per volta:
 *
 * | modo | quota addebitata per mattonella |
 * |---|---|
 * | `no-cors` (opaca) | **7.688.466 byte** |
 * | `cors` | **1.907 byte** |
 *
 * Quattromila volte tanto, per gli stessi byte sulla rete. Il pannello annunciava «giga
 * scaricati in pochi secondi» e diceva la verita' sulla **quota**, non sul traffico: una
 * mattonella vera pesa fra i 7 e i 53 kB.
 *
 * Da qui la forma attuale: non si accetta l'opaco, si evita di **produrlo** — la richiesta
 * si riscrive in CORS qui sotto, e tutti e cinque i servizi che l'app usa lo permettono.
 */
const tileHandler = (cacheName: string) =>
  new CacheFirst({
    cacheName,
    plugins: [
      {
        /**
         * **Le mattonelle si chiedono in CORS, anche quando arrivano da un `<img>`.**
         *
         * Leaflet le carica con dei tag `<img>` senza `crossorigin`, cioè richieste
         * `no-cors`, e la risposta che ne torna è **opaca**. Il browser conta le risposte
         * opache in quota con un riempimento enorme, apposta, perché il loro peso non
         * trapeli. Misurato il 2026-09-02 su Chrome: **7.688.466 byte addebitati per
         * mattonella** contro **1.907** per la stessa mattonella chiesta in CORS — un
         * fattore quattromila, per gli stessi byte sulla rete.
         *
         * È il motivo per cui il pannello annunciava «giga scaricati in pochi secondi»: i
         * giga erano veri come *quota trattenuta*, non come traffico. Una mattonella vera
         * pesa fra i 7 e i 53 kB.
         *
         * Riscrivere qui la richiesta copre **anche** le mattonelle che si conservano
         * navigando, non solo quelle pre-caricate: senza questo, ogni pezzo di mappa
         * guardato una volta costerebbe 7 MB di quota.
         *
         * Verificato che si può: tutti e cinque i servizi che l'app usa rispondono
         * `access-control-allow-origin: *`.
         */
        requestWillFetch: async ({ request }) =>
          new Request(request.url, { mode: 'cors', credentials: 'omit' }),
      },
      /*
        `statuses: [200]` e non `[0, 200]`. Lo zero e' lo stato di una risposta opaca:
        accettarlo rimetterebbe in cache — in silenzio, e a 7 MB di quota l'una — proprio
        le risposte che la riscrittura qui sopra esiste per evitare. Se un giorno qualcosa
        tornasse opaco, si preferisce che NON venga conservato (e il pannello dica «nessuna
        mappa conservata») piuttosto che scoprire i gigabyte a cose fatte.
      */
      new CacheableResponsePlugin({ statuses: [200] }),
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
