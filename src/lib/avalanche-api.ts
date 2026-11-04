import type { BBoxGeo, Pericolo } from './avalanche';
import { safeJson } from './safe-json';

/**
 * Il lato client del pericolo valanghe: chiede alla **nostra** route.
 *
 * Non va diretto a `static.avalanche.report` per una misura, non per un'astrazione: le
 * geometrie sono 4,85 MB non compressi, e il ritaglio sulla vista può farlo solo chi le
 * ha tutte in mano. Vedi `avalanche-proxy.ts`.
 */

export interface ZonaValanghe {
  id: string;
  nome: string | null;
  pericolo: Pericolo;
  am: Pericolo | null;
  pm: Pericolo | null;
  alta: Pericolo | null;
  bassa: Pericolo | null;
  geometria: { type: string; coordinates: unknown };
}

export interface BollettinoValanghe {
  /** `null` = nessun bollettino: fuori stagione è la risposta normale. */
  bulletinDate: string | null;
  zones: ZonaValanghe[];
  totalRated: number;
  /** `true` se qualche regione non ha risposto: quello che si vede è incompleto. */
  partial?: boolean;
  /**
   * `true` quando il bollettino c'è ma nessuna zona si riesce a disegnare: gli id delle
   * micro-regioni non combaciano più con le geometrie. È un guasto, non un'assenza.
   */
  joinBroken?: boolean;
}

export const ATTRIBUZIONE_VALANGHE = 'Valanghe: <a href="https://www.avalanches.org/">EAWS</a>'
  + ' / servizi valanghe regionali e Meteomont';

function buildAvalancheUrl(vista: BBoxGeo, zoom: number): string {
  const p = new URLSearchParams({
    south: vista.south.toFixed(4),
    west: vista.west.toFixed(4),
    north: vista.north.toFixed(4),
    east: vista.east.toFixed(4),
    zoom: String(Math.round(zoom)),
  });
  return `/api/avalanche?${p.toString()}`;
}

export async function fetchAvalanche(
  vista: BBoxGeo,
  zoom: number,
  signal?: AbortSignal,
): Promise<BollettinoValanghe> {
  /*
    Come gli altri dati di emergenza: tempo massimo, e a schermo un messaggio italiano al
    posto del testo del browser («Failed to fetch»), che usciva così com'era. Il messaggio
    della route (`{ error }`) arriva intero.
  */
  const dati = await safeJson(buildAvalancheUrl(vista, zoom), {
    signal, nonDisponibile: 'Bollettino valanghe non disponibile',
  }) as BollettinoValanghe;
  if (!Array.isArray(dati?.zones)) throw new Error('Bollettino valanghe in un formato non riconosciuto');
  return dati;
}

/**
 * Come si scrive la data del bollettino a schermo.
 *
 * Il giorno arriva in `YYYY-MM-DD`; si scrive all'italiana perché è l'unico modo in cui
 * `03/09` non si può leggere come il 9 marzo.
 */
export function dataBollettino(giorno: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(giorno);
  return m == null ? giorno : `${m[3]}/${m[2]}/${m[1]}`;
}
