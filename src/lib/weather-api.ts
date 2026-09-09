import type { PuntoInterrogato, SerieOraria } from './route-weather';
import type { ModelloMeteo } from './types';

/**
 * Previsione oraria per i punti del percorso, da **Open-Meteo**.
 *
 * Nessuna chiave, CORS aperto, quindi si chiama dal browser senza proxy: misurato il
 * 2026-08-27, 6 punti per 48 ore stanno in 12 KB, in una sola richiesta.
 *
 * Gli orari si chiedono in **UTC** e si convertono solo quando si scrivono a schermo.
 * Con `timezone=auto` si riceverebbero stringhe senza offset, da interpretare a mano:
 * e' il modo classico di sbagliare di un'ora, e in un'app che dice "arrivi alle 14:40"
 * sbagliare di un'ora e' peggio che non dire niente.
 */

const BASE = 'https://api.open-meteo.com/v1/forecast';

/** Oltre una settimana la previsione oraria è rumore, non informazione. */
const GIORNI_MAX = 7;

const VARIABILI = [
  'cape',                        // energia disponibile alla convezione
  'weather_code',                // 95/96/99 = temporale dichiarato
  'precipitation_probability',
  'wind_gusts_10m',              // le raffiche, non il vento medio: in cresta contano quelle
  'temperature_2m',              // alla quota chiesta: vedi `elevation` piu' sotto
  'precipitation',               // i millimetri: la probabilita' dice «se», questi «quanto»
] as const;

export const ATTRIBUZIONE_METEO = 'Previsione: Open-Meteo (modelli ICON/ECMWF)';

/**
 * Gli identificativi veri di Open-Meteo.
 *
 * `ecmwf_ifs_hres` **non esiste**: l'API risponde «Cannot initialize MultiDomains from
 * invalid String value», anche se la documentazione lo lascia intendere. Provato il
 * 2026-09-09.
 */
const MODELLI_API: Record<ModelloMeteo, string> = {
  ecmwf: 'ecmwf_ifs',
  icon: 'icon_seamless',
};

/** Sentinella: questo modello ha gia' fallito su un punto, quindi si butta tutto. */
const MODELLO_ASSENTE: SerieOraria[] = [];

export interface RouteForecast {
  /**
   * Una serie per punto, nello stesso ordine dei punti richiesti, **per ogni modello**.
   *
   * Si chiedono entrambi in una volta (misurato: ~17 KB) perche' cosi' cambiare modello
   * dalla tendina e' un ricalcolo locale e non una nuova richiesta — la stessa regola gia'
   * valida per il passo e le soste.
   */
  serie: Record<ModelloMeteo, SerieOraria[]>;
  /**
   * Quota del modello per ogni punto: utile per dire quanto è grossolana la maglia.
   * Resta **un campo solo** anche con piu' modelli (verificato sulla risposta vera).
   */
  elevations: number[];
}

/**
 * La previsione si chiede **alla quota dei punti**, quando le si conoscono tutte.
 *
 * MISURATO il 2026-09-02 su Cima delle Murelle (42,0847 / 14,0139, quota reale 2596 m):
 * senza `elevation` il modello risponde per una maglia a **1257 m** e da' 26,1 gradi e
 * raffiche a 47,5 km/h alle 12; con `elevation=2596` da' 19,5 gradi e 40,3 km/h. Sei
 * gradi e mezzo di differenza, cioe' il meteo del fondovalle spacciato per quello di
 * vetta — e per un'app che serve a decidere se partire e' la direzione di errore
 * peggiore.
 *
 * O tutte o nessuna: il servizio pretende che la lista abbia **tanti elementi quante le
 * coordinate** (verificato: `elevation=2596,` risponde con un errore esplicito), e non
 * esiste un modo di dire "questo punto lascialo al valore di default". Inventare la quota
 * mancante sarebbe peggio del difetto: senza la lista i valori restano quelli della
 * maglia, e il pannello lo dichiara confrontandoli con la quota del punto.
 */
function quoteDaChiedere(punti: PuntoInterrogato[]): string | null {
  const quote = punti.map((p) => p.alt);
  if (quote.some((q) => q == null || !Number.isFinite(q))) return null;
  return quote.map((q) => Math.round(q as number)).join(',');
}

export function buildForecastUrl(punti: PuntoInterrogato[], giorni: number): string {
  const u = new URL(BASE);
  u.searchParams.set('latitude', punti.map((p) => p.lat).join(','));
  u.searchParams.set('longitude', punti.map((p) => p.lon).join(','));
  u.searchParams.set('hourly', VARIABILI.join(','));
  const quote = quoteDaChiedere(punti);
  if (quote != null) u.searchParams.set('elevation', quote);
  u.searchParams.set('forecast_days', String(Math.min(GIORNI_MAX, Math.max(1, Math.round(giorni)))));
  u.searchParams.set('timezone', 'UTC');
  u.searchParams.set('models', Object.values(MODELLI_API).join(','));
  return u.toString();
}

/**
 * La serie di UN modello dentro una risposta multi-modello.
 *
 * Con piu' modelli il servizio **suffissa ogni variabile** col nome del modello
 * (`weather_code_ecmwf_ifs`), mentre `time` resta unico. Verificato sulla risposta vera
 * il 2026-09-09.
 */
function serieDelModello(orarie: Record<string, unknown>, api: string): SerieOraria | null {
  const time = orarie.time;
  if (!Array.isArray(time)) return null;
  const v = (nome: string) => orarie[`${nome}_${api}`];
  const campi = {
    cape: v('cape'),
    weather_code: v('weather_code'),
    wind_gusts_10m: v('wind_gusts_10m'),
    precipitation_probability: v('precipitation_probability'),
    temperature_2m: v('temperature_2m'),
    precipitation: v('precipitation'),
  };
  if (!Object.values(campi).every((x) => Array.isArray(x))) return null;
  return { time, ...campi } as SerieOraria;
}

/**
 * Separa la risposta nelle serie dei due modelli. Estratta dalla `fetch` per poterla
 * provare senza rete: e' la parte dove un cambio di formato del servizio farebbe danno
 * in silenzio.
 */
export function leggiRisposta(dati: unknown): RouteForecast {
  // Con un solo punto il servizio risponde con un oggetto, con piu' punti con un
  // array: senza gestire entrambi i casi il pannello resta vuoto proprio nel piu'
  // semplice.
  const elenco = Array.isArray(dati) ? dati : [dati];
  const serie: Record<ModelloMeteo, SerieOraria[]> = { ecmwf: [], icon: [] };
  const elevations: number[] = [];
  for (const voce of elenco) {
    const o = voce as Record<string, unknown> | null;
    const orarie = o?.hourly as Record<string, unknown> | undefined;
    if (orarie == null) throw new Error('Previsione in un formato non riconosciuto');
    for (const modello of Object.keys(MODELLI_API) as ModelloMeteo[]) {
      const s = serieDelModello(orarie, MODELLI_API[modello]);
      // Un modello che tace per QUESTO punto si scarta **per intero**, non a meta': le
      // serie devono corrispondere uno a uno ai punti chiesti, e tenerne una in meno
      // vorrebbe dire attribuire a un punto il meteo di un altro.
      if (s == null) serie[modello] = MODELLO_ASSENTE;
      else if (serie[modello] !== MODELLO_ASSENTE) serie[modello].push(s);
    }
    elevations.push(typeof o?.elevation === 'number' ? o.elevation : Number.NaN);
  }
  for (const modello of Object.keys(MODELLI_API) as ModelloMeteo[]) {
    if (serie[modello] === MODELLO_ASSENTE) serie[modello] = [];
  }
  /*
   * Un modello in meno non e' un errore: gli identificativi di Open-Meteo non sono stabili
   * (`ecmwf_ifs_hres` non esiste, `ecmwf_ifs04` risponde senza dati) e la serie che il
   * pannello sta mostrando puo' benissimo essere l'altra. Si dichiara errore solo quando
   * non ha parlato **nessuno**.
   */
  if (serie.ecmwf.length === 0 && serie.icon.length === 0) {
    throw new Error('Previsione in un formato non riconosciuto');
  }
  return { serie, elevations };
}

export async function fetchRouteForecast(
  punti: PuntoInterrogato[],
  giorni: number,
  signal?: AbortSignal
): Promise<RouteForecast> {
  if (punti.length === 0) return { serie: { ecmwf: [], icon: [] }, elevations: [] };

  const res = await fetch(buildForecastUrl(punti, giorni), { signal });
  if (!res.ok) throw new Error('Previsione non disponibile in questo momento');

  return leggiRisposta(await res.json());
}
