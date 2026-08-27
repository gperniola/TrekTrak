import { defaultCache } from '@serwist/next/worker';
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const TILE_EXPIRATION = { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 };

const tileHandler = (cacheName: string) =>
  new CacheFirst({
    cacheName,
    plugins: [new ExpirationPlugin(TILE_EXPIRATION)],
  });

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Dati di emergenza: MAI serviti da cache (dati stantii = rischio, non feature).
    { matcher: /\/api\/(fires|dpc-alerts)/, handler: new NetworkOnly() },
    { matcher: /^https:\/\/maps\.effis\.emergency\.copernicus\.eu\//i, handler: new NetworkOnly() },
    { matcher: /^https:\/\/raw\.githubusercontent\.com\/pcm-dpc\//i, handler: new NetworkOnly() },
    // Radar e previsione meteo: un fotogramma di due ore fa servito dalla cache come se
    // fosse l'ultimo e' esattamente il difetto che questa regola esiste per evitare.
    { matcher: /^https:\/\/(api|tilecache)\.rainviewer\.com\//i, handler: new NetworkOnly() },
    { matcher: /^https:\/\/api\.open-meteo\.com\//i, handler: new NetworkOnly() },
    { matcher: /^https:\/\/view\.eumetsat\.int\//i, handler: new NetworkOnly() },
    ...defaultCache,
    {
      matcher: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
      handler: tileHandler('tiles-osm'),
    },
    {
      matcher: /^https:\/\/.*\.tile\.opentopomap\.org\/.*/i,
      handler: tileHandler('tiles-opentopomap'),
    },
    {
      matcher: /^https:\/\/tile\.thunderforest\.com\/.*/i,
      handler: tileHandler('tiles-thunderforest'),
    },
    {
      matcher: /^https:\/\/.*\.tile-cyclosm\.openstreetmap\.fr\/.*/i,
      handler: tileHandler('tiles-cyclosm'),
    },
    {
      matcher: /^https:\/\/tile\.waymarkedtrails\.org\/.*/i,
      handler: tileHandler('tiles-waymarked'),
    },
  ],
});

serwist.addEventListeners();
