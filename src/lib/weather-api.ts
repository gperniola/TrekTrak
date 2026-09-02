import type { PuntoInterrogato, SerieOraria } from './route-weather';

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
] as const;

export const ATTRIBUZIONE_METEO = 'Previsione: Open-Meteo (modelli ICON/ECMWF)';

export interface RouteForecast {
  /** Una serie per punto, nello stesso ordine dei punti richiesti. */
  serie: SerieOraria[];
  /** Quota del modello per ogni punto: utile per dire quanto è grossolana la maglia. */
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
  return u.toString();
}

function serieValida(v: unknown): v is SerieOraria {
  if (v == null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.time)
    && Array.isArray(o.cape)
    && Array.isArray(o.weather_code)
    && Array.isArray(o.wind_gusts_10m)
    && Array.isArray(o.precipitation_probability)
    && Array.isArray(o.temperature_2m);
}

export async function fetchRouteForecast(
  punti: PuntoInterrogato[],
  giorni: number,
  signal?: AbortSignal
): Promise<RouteForecast> {
  if (punti.length === 0) return { serie: [], elevations: [] };

  const res = await fetch(buildForecastUrl(punti, giorni), { signal });
  if (!res.ok) throw new Error('Previsione non disponibile in questo momento');

  const dati: unknown = await res.json();
  // Con un solo punto il servizio risponde con un oggetto, con piu' punti con un
  // array: senza gestire entrambi i casi il pannello resta vuoto proprio nel piu'
  // semplice.
  const elenco = Array.isArray(dati) ? dati : [dati];

  const serie: SerieOraria[] = [];
  const elevations: number[] = [];
  for (const voce of elenco) {
    const o = voce as Record<string, unknown> | null;
    const orarie = o?.hourly;
    if (!serieValida(orarie)) throw new Error('Previsione in un formato non riconosciuto');
    serie.push(orarie);
    elevations.push(typeof o?.elevation === 'number' ? o.elevation : Number.NaN);
  }
  return { serie, elevations };
}
