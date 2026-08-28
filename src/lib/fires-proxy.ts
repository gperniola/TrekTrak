import { parseFirmsCsv, type FirePoint } from './firms';

const SENSORS = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];
const ITALY_BBOX = '6.6,35.4,18.6,47.1'; // west,south,east,north
const CACHE_TTL_MS = 15 * 60 * 1000;
/**
 * TTL ridotto quando solo una parte dei sensori ha risposto: tenere per 15 minuti un
 * sottoinsieme dei focolai significa nascondere incendi reali mentre la UI dichiara
 * di essere aggiornata. Meglio ritentare presto.
 */
const PARTIAL_CACHE_TTL_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 8000;

export interface FiresPayload { points: FirePoint[]; fetchedAt: string; partial?: boolean; }
export type FiresProxyResult =
  | { status: 200; data: FiresPayload }
  | { status: 502 | 503; error: string };

let cache: { data: FiresPayload; expiresAt: number } | null = null;

export function _resetFiresCacheForTests(): void { cache = null; }

/**
 * Il timeout deve coprire ANCHE la lettura del body: FIRMS può mandare gli header e
 * poi bloccarsi a metà CSV. Se `clearTimeout` scatta appena `fetch` risolve (cioè
 * agli header), l'AbortController è già disarmato e `res.text()` resta appeso per
 * sempre, con la funzione serverless che aspetta fino a quando la piattaforma la
 * uccide. Perciò il body si legge dentro il try, prima del `finally`.
 */
async function fetchTextWithTimeout(url: string): Promise<{ ok: boolean; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    /*
     * `cache: 'no-store'` NON e' ridondante con `dynamic = 'force-dynamic'` sulla
     * route: quello rende dinamica la RESPOSTA, ma le fetch in uscita finiscono
     * comunque nella Data Cache su disco (`.next/cache/fetch-cache`), che sopravvive
     * ai riavvii. Verificato a mano: il 28/08 l'endpoint restituiva focolai con
     * `acquiredAt` del 26/08 mentre il pannello scriveva "Focolai attivi (24h) -
     * Aggiornato alle 09:29". Su un layer di sicurezza e' il modo peggiore di
     * sbagliare: dato vecchio presentato come fresco.
     */
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return { ok: false, text: '' };
    return { ok: true, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFiresUpstream(): Promise<FiresProxyResult> {
  const key = process.env.FIRMS_MAP_KEY;
  // Spec §4.3: il layer va marcato "non disponibile" nel pannello. Il messaggio esce
  // in UI, quindi non ci va il nome di una variabile d'ambiente del server.
  if (!key) return { status: 503, error: 'Layer non disponibile su questa installazione' };

  if (cache && Date.now() < cache.expiresAt) return { status: 200, data: cache.data };

  const results = await Promise.allSettled(
    SENSORS.map(async (sensor) => {
      const { ok, text } = await fetchTextWithTimeout(
        `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${sensor}/${ITALY_BBOX}/1`
      );
      if (!ok) throw new Error(`FIRMS ${sensor}: risposta non valida`);
      const parsed = parseFirmsCsv(text);
      // `null` = il corpo non è un CSV FIRMS (MAP_KEY invalida, quota esaurita:
      // FIRMS risponde 200 con testo semplice). Va trattato come fallimento del
      // sensore, non come "nessun focolaio".
      if (parsed == null) throw new Error(`FIRMS ${sensor}: corpo non riconosciuto`);
      return parsed;
    })
  );

  const ok = results.filter(
    (r): r is PromiseFulfilledResult<FirePoint[]> => r.status === 'fulfilled'
  );
  if (ok.length === 0) {
    return { status: 502, error: 'FIRMS non raggiungibile' };
  }

  const partial = ok.length < SENSORS.length;
  const data: FiresPayload = {
    points: ok.flatMap((r) => r.value),
    fetchedAt: new Date().toISOString(),
    ...(partial ? { partial: true } : {}),
  };
  cache = { data, expiresAt: Date.now() + (partial ? PARTIAL_CACHE_TTL_MS : CACHE_TTL_MS) };
  return { status: 200, data };
}
