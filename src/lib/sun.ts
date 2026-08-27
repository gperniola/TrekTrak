/**
 * Alba, tramonto e crepuscolo civile, calcolati **in locale**: nessuna rete, nessuna
 * chiave, funziona anche offline.
 *
 * Serve a una domanda pratica del trekking: se l'orario di arrivo stimato cade dopo il
 * tramonto, si scende al buio. È uno dei modi più comuni in cui una gita facile diventa
 * un problema, e non richiede alcun servizio esterno per essere detto.
 *
 * Algoritmo NOAA (approssimazione a basso ordine): errore tipico entro un paio di
 * minuti alle nostre latitudini, che per decidere se partire un'ora prima è più che
 * sufficiente. `null` dove il fenomeno **non avviene** (sole di mezzanotte, notte
 * polare) o non è calcolabile: un orario inventato sarebbe peggio di un "non lo so".
 */

const GRADI = Math.PI / 180;

/** Zenit del centro del sole: 90° + rifrazione e semidiametro. */
const ZENIT_TRAMONTO = 90.833;
/** Crepuscolo civile: sole 6° sotto l'orizzonte, oltre il quale serve la frontale. */
const ZENIT_CIVILE = 96;

export interface SunTimes {
  sunrise: string | null;
  sunset: string | null;
  /** Fine del crepuscolo civile: da qui in poi è buio per camminare. */
  civilDusk: string | null;
  civilDawn: string | null;
}

const NULLO: SunTimes = { sunrise: null, sunset: null, civilDusk: null, civilDawn: null };

/** Giorno giuliano a mezzogiorno UTC del giorno civile di `data`. */
function giornoGiuliano(data: Date): number {
  const y = data.getUTCFullYear();
  const m = data.getUTCMonth() + 1;
  const d = data.getUTCDate();
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/**
 * Istante dell'evento come frazione di giorno UTC, o `null` se a quella data e
 * latitudine il sole non raggiunge quello zenit.
 */
function evento(
  lat: number, lon: number, jd: number, zenit: number, alba: boolean
): number | null {
  const n = jd - 2451545.0 + 0.0008;
  // media solare, equazione del centro, longitudine ecclittica
  const M = (357.5291 + 0.98560028 * n) % 360;
  const C = 1.9148 * Math.sin(M * GRADI) + 0.02 * Math.sin(2 * M * GRADI) + 0.0003 * Math.sin(3 * M * GRADI);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transito = 2451545.0 + n + 0.0053 * Math.sin(M * GRADI) - 0.0069 * Math.sin(2 * lambda * GRADI) - lon / 360;
  const delta = Math.asin(Math.sin(lambda * GRADI) * Math.sin(23.44 * GRADI));

  const cosH = (Math.cos(zenit * GRADI) - Math.sin(lat * GRADI) * Math.sin(delta))
    / (Math.cos(lat * GRADI) * Math.cos(delta));
  // Fuori da [-1, 1] il sole non attraversa quello zenit: sole di mezzanotte o notte
  // polare. Non e' un errore da nascondere con un clamp, e' un "non avviene".
  if (cosH > 1 || cosH < -1) return null;
  const H = Math.acos(cosH) / GRADI / 360;
  return alba ? transito - H : transito + H;
}

function aIso(jd: number | null): string | null {
  if (jd == null || !Number.isFinite(jd)) return null;
  // Giorno giuliano -> millisecondi Unix
  const ms = (jd - 2440587.5) * 86400000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function sunTimes(lat: number, lon: number, data: Date): SunTimes {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Number.isNaN(data.getTime())) return NULLO;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return NULLO;
  const jd = giornoGiuliano(data);
  return {
    sunrise: aIso(evento(lat, lon, jd, ZENIT_TRAMONTO, true)),
    sunset: aIso(evento(lat, lon, jd, ZENIT_TRAMONTO, false)),
    civilDawn: aIso(evento(lat, lon, jd, ZENIT_CIVILE, true)),
    civilDusk: aIso(evento(lat, lon, jd, ZENIT_CIVILE, false)),
  };
}
