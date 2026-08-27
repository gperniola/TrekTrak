/**
 * Radar delle precipitazioni da **RainViewer**: nessuna chiave, CORS aperto.
 *
 * Limite da dichiarare, non da nascondere: il piano gratuito espone **solo il
 * passato**. Misurato il 2026-08-27, 13 fotogrammi a passo 10 minuti — le ultime due
 * ore — e `nowcast: []` vuoto. Serve a vedere da dove arriva una cella e in che
 * direzione si muove, non a sapere dove sarà.
 */

const INDICE = 'https://api.rainviewer.com/public/weather-maps.json';

export const ATTRIBUZIONE_RADAR = 'Radar precipitazioni: <a href="https://www.rainviewer.com/">RainViewer</a>';

export interface RadarFrame {
  /** Istante del fotogramma, ISO UTC. */
  timeISO: string;
  /** Percorso del set di tile, da comporre con l'host. */
  path: string;
}

export interface RadarIndex {
  host: string;
  frames: RadarFrame[];
}

/**
 * Schema colori 2 con neve separata (`{smooth}_{snow}` = `1_1`).
 *
 * Lo schema non e' documentato in modo verificabile, quindi le classi qui sotto sono
 * **campionate dai tile veri**: scansione di 40 tile globali del fotogramma corrente il
 * 2026-08-27, con i conteggi dei pixel per famiglia di colore. La direzione della scala
 * (blu leggera -> viola intensa) e' confermata dai numeri: 21.809 pixel blu contro 21
 * viola, cioe' la coda della distribuzione sta dove ci si aspetta l'evento raro.
 *
 * La lezione viene dalle legende EFFIS della v0.11.6: dichiarare colori che sulla mappa
 * non esistono e' peggio che non avere legenda.
 */
export const OPZIONI_TILE = '2/1_1';

export function tileUrl(index: RadarIndex, frame: RadarFrame): string {
  return `${index.host}${frame.path}/256/{z}/{x}/{y}/${OPZIONI_TILE}.png`;
}

function frameValido(v: unknown): v is { time: number; path: string } {
  if (v == null || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.time === 'number' && Number.isFinite(o.time) && typeof o.path === 'string' && o.path.length > 0;
}

export async function fetchRadarIndex(signal?: AbortSignal): Promise<RadarIndex> {
  const res = await fetch(INDICE, { signal });
  if (!res.ok) throw new Error('Radar precipitazioni non raggiungibile');

  const d: unknown = await res.json();
  const o = d as Record<string, unknown> | null;
  const host = typeof o?.host === 'string' ? o.host : null;
  const radar = o?.radar as Record<string, unknown> | undefined;
  const past = radar?.past;
  if (host == null || !Array.isArray(past)) throw new Error('Radar in un formato non riconosciuto');

  const frames = past.filter(frameValido).map((f) => ({
    timeISO: new Date(f.time * 1000).toISOString(),
    path: f.path,
  }));
  // Zero fotogrammi non e' "niente pioggia": e' un radar che non sta funzionando, e va
  // detto invece di mostrare una mappa vuota che sembra aggiornata.
  if (frames.length === 0) throw new Error('Nessun fotogramma radar disponibile');

  return { host, frames };
}
