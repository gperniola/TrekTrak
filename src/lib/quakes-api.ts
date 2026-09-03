/**
 * Terremoti recenti da **INGV** (servizio FDSN event, CC-BY 4.0).
 *
 * Nessuna chiave, CORS aperto (`access-control-allow-origin: *` verificato), quindi si
 * chiama dal browser senza proxy.
 *
 * ## Due trappole misurate il 2026-09-03
 *
 * 1. **Il servizio è mondiale.** Senza rettangolo, la prima risposta conteneva un evento
 *    di magnitudo 6,1 nelle Isole Sandwich Australi: su una mappa dell'Appennino non
 *    significa niente, e riempirebbe l'elenco di eventi che non riguardano nessuno. Si
 *    chiede l'Italia e basta.
 * 2. **Gli orari non hanno il fuso.** `"time": "2026-09-02T23:46:59.485000"` — senza
 *    suffisso. Sono UTC (è lo standard FDSN), ma `new Date()` su una stringa così la
 *    interpreta come ora **locale**: due ore di errore in estate, sempre nella direzione
 *    di far sembrare la scossa più recente. Si aggiunge la `Z` prima di leggerla.
 *
 * Densità misurata sull'Italia in 48 ore: 48 eventi da magnitudo 1, 7 da magnitudo 2,
 * 3 da magnitudo 2,5. Da 2 in su è un elenco che si legge; da 1 diventa un tappeto di
 * puntini che non aiuta a decidere niente.
 */

const BASE = 'https://webservices.ingv.it/fdsnws/event/1/query';

export const ATTRIBUZIONE_SISMI = 'Terremoti: <a href="https://terremoti.ingv.it/">INGV</a> (CC-BY 4.0)';

/** Rettangolo Italia, lo stesso dei focolai: `west, south, east, north`. */
export const BBOX_ITALIA = { west: 6.6, south: 35.4, east: 18.6, north: 47.2 } as const;

/** Quante ore indietro. Due giorni: abbastanza per vedere una sequenza in corso. */
export const ORE_FINESTRA = 48;

/**
 * Magnitudo minima. Sotto il 2 si scende nel rumore strumentale: 48 eventi in due giorni
 * contro 7, e nessuno dei 41 in più è qualcosa che si sente camminando.
 */
export const MAGNITUDO_MINIMA = 2;

/** Tetto di sicurezza: durante uno sciame gli eventi possono essere centinaia. */
export const MAX_EVENTI = 300;

export interface Quake {
  id: string;
  lat: number;
  lon: number;
  /** Profondità in km. Una scossa a 10 km si sente, una a 300 km quasi mai. */
  depthKm: number | null;
  mag: number;
  /** Tipo di magnitudo dichiarato (ML, Mw…): non tutte le scale sono confrontabili. */
  magType: string | null;
  place: string | null;
  /** Istante in ISO UTC. */
  timeISO: string;
}

export interface QuakesResult {
  quakes: Quake[];
  /** `true` se il servizio ha risposto col tetto pieno: ce ne sono altri. */
  troncato: boolean;
}

export function buildQuakesUrl(adesso: Date): string {
  const da = new Date(adesso.getTime() - ORE_FINESTRA * 3600_000);
  const u = new URL(BASE);
  u.searchParams.set('format', 'geojson');
  // Senza millisecondi e senza `Z`: è la forma che il servizio documenta e accetta.
  u.searchParams.set('starttime', da.toISOString().slice(0, 19));
  u.searchParams.set('minmag', String(MAGNITUDO_MINIMA));
  u.searchParams.set('minlat', String(BBOX_ITALIA.south));
  u.searchParams.set('maxlat', String(BBOX_ITALIA.north));
  u.searchParams.set('minlon', String(BBOX_ITALIA.west));
  u.searchParams.set('maxlon', String(BBOX_ITALIA.east));
  u.searchParams.set('limit', String(MAX_EVENTI));
  return u.toString();
}

/**
 * L'istante di un evento, in ISO UTC.
 *
 * `null` se la stringa non si legge: un terremoto senza orario è un terremoto di cui non
 * si sa niente di utile, e inventargli "adesso" lo farebbe sembrare in corso.
 */
export function istanteEvento(grezzo: unknown): string | null {
  if (typeof grezzo !== 'string' || grezzo.length === 0) return null;
  // Gli orari FDSN sono UTC ma arrivano senza suffisso: si aggiunge, se manca.
  const conFuso = /[Zz]$|[+-][0-9]{2}:?[0-9]{2}$/.test(grezzo) ? grezzo : `${grezzo}Z`;
  const d = new Date(conFuso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function numero(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Da GeoJSON INGV a `Quake[]`.
 *
 * Tollerante riga per riga: una feature malformata si salta, non fa cadere tutto il
 * layer. È la stessa scelta del parser dei focolai — un evento illeggibile non deve
 * nascondere i venti leggibili.
 */
export function parseQuakes(dati: unknown): QuakesResult {
  const o = dati as { features?: unknown } | null;
  if (o == null || !Array.isArray(o.features)) {
    throw new Error('Terremoti in un formato non riconosciuto');
  }
  const quakes: Quake[] = [];
  for (const f of o.features) {
    const feature = f as { id?: unknown; properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } };
    const p = feature.properties ?? {};
    const c = feature.geometry?.coordinates;
    if (!Array.isArray(c)) continue;
    // L'ordine è quello del GeoJSON: longitudine, latitudine, e la terza è la PROFONDITÀ
    // in km (non la quota).
    const lon = numero(c[0]);
    const lat = numero(c[1]);
    const mag = numero(p.mag);
    const timeISO = istanteEvento(p.time);
    if (lat == null || lon == null || mag == null || timeISO == null) continue;
    // Fuori dal mondo non si disegna: Leaflet metterebbe il cerchio in un punto qualunque
    // della mappa, e un epicentro inventato e' peggio di un epicentro mancante.
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    quakes.push({
      // L'id e' l'identita' dell'evento secondo l'INGV, e resta tale: la chiave per
      // disegnarlo e' un'altra cosa, e la costruisce chi disegna (vedi `chiaveQuake`).
      id: String(p.eventId ?? feature.id ?? timeISO),
      lat,
      lon,
      depthKm: numero(c[2]),
      mag,
      magType: typeof p.magType === 'string' ? p.magType : null,
      place: typeof p.place === 'string' && p.place.length > 0 ? p.place : null,
      timeISO,
    });
  }
  // Dal più recente: è l'ordine in cui interessano.
  quakes.sort((a, b) => b.timeISO.localeCompare(a.timeISO));
  return { quakes, troncato: o.features.length >= MAX_EVENTI };
}

export async function fetchQuakes(adesso: Date, signal?: AbortSignal): Promise<QuakesResult> {
  const res = await fetch(buildQuakesUrl(adesso), { signal });
  if (!res.ok) throw new Error('Terremoti non disponibili in questo momento');
  return parseQuakes(await res.json());
}

/**
 * Colore per magnitudo.
 *
 * Le soglie sono quelle degli effetti, non decimali scelti per fare una scala: sotto 3
 * la scossa la sentono pochi, da 3 si sente, da 4 fa muovere gli oggetti, da 5 può fare
 * danni. Per chi cammina il valore sta nel capire se una zona **si sta muovendo adesso**.
 */
export function coloreMagnitudo(mag: number): string {
  if (!Number.isFinite(mag)) return '#9ca3af';
  if (mag >= 5) return '#dc2626';
  if (mag >= 4) return '#f97316';
  if (mag >= 3) return '#eab308';
  return '#60a5fa';
}

/** Raggio del cerchio in pixel: cresce con la magnitudo, ma resta visibile anche piccolo. */
export function raggioMagnitudo(mag: number): number {
  if (!Number.isFinite(mag)) return 5;
  return Math.max(5, Math.min(22, 4 + (mag - 1) * 3));
}

/** Da quanto è successo, in italiano e senza falsa precisione. */
export function quandoDetto(timeISO: string, adesso: Date): string {
  const t = new Date(timeISO).getTime();
  if (Number.isNaN(t)) return 'orario non noto';
  const minuti = Math.round((adesso.getTime() - t) / 60000);
  if (minuti < 0) return 'appena registrato';
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'} fa`;
  const giorni = Math.round(ore / 24);
  return `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} fa`;
}

/**
 * La chiave per disegnare un evento.
 *
 * `eventId` **dovrebbe** essere unico, ma una risposta malformata potrebbe ripeterlo: due
 * chiavi React identiche fanno sbagliare la riconciliazione, e i focolai hanno pagato
 * esattamente questo (`pointKey`). L'indice la rende unica senza falsificare l'id.
 */
export function chiaveQuake(q: Quake, indice: number): string {
  return `${q.id}-${indice}`;
}
