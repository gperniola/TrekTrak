import { proiettaSulPercorso, type ProiezioneSulPercorso } from './calculations';
import { etaPosizione } from './eta-posizione';
import type { Leg, Waypoint } from './types';
import type { KnownPosition } from '@/stores/positionStore';

/**
 * **Dove sono, sul profilo altimetrico.**
 *
 * Segnalato il 2026-09-22: «se clicco sulla geolocalizzazione e mi trovo sul percorso,
 * sul profilo dev'esserci un indicatore che mi dice dove sono». La mappa lo sa gia'
 * disegnare; il profilo e' l'altra meta' della stessa domanda — quanto ho fatto, quanto
 * manca, cosa mi aspetta in salita.
 *
 * ## «Sul percorso» va deciso, non presunto
 *
 * Il punto del tracciato piu' vicino esiste sempre, anche per chi e' a cento chilometri:
 * disegnarlo sarebbe dire il falso. Si disegna solo quando la posizione e' **vicina al
 * tracciato** (entro una tolleranza che cresce con l'incertezza del fix), il fix e'
 * **abbastanza preciso** da dire qualcosa, e la posizione e' **attuale** — un profilo con
 * un punto di un'ora fa dice «sei qui» a chi e' altrove, che e' esattamente il difetto
 * gia' corretto sul punto della mappa (v0.22.0).
 *
 * Questo modulo non chiede mai la posizione: legge quella che qualcuno ha gia' ottenuto.
 */

/**
 * Quanto si puo' stare fuori dal tracciato ed essere ancora «sul percorso», a fix
 * perfetto. Cento metri: un sentiero disegnato da OpenStreetMap o una linea d'aria fra
 * due waypoint sbagliano di decine di metri rispetto a dove si cammina davvero.
 */
export const TOLLERANZA_SUL_PERCORSO_M = 100;

/**
 * Oltre questa incertezza il fix non dice piu' dove sei: mezzo chilometro di raggio
 * copre un versante intero, e un punto sul profilo pretenderebbe una precisione che
 * non c'e'.
 */
export const INCERTEZZA_UTILE_M = 500;

/**
 * Il punto da disegnare sul profilo, o `null` se non si puo' dire «sei qui».
 *
 * L'incertezza sconosciuta vale zero: si applica la sola tolleranza base, che e' la
 * lettura piu' prudente possibile.
 */
export function posizioneSulProfilo(
  posizione: KnownPosition | null,
  waypoints: Waypoint[],
  legs: Leg[],
  adesso: number,
): ProiezioneSulPercorso | null {
  if (posizione == null) return null;
  if (!etaPosizione(posizione.at, adesso).attuale) return null;

  const incertezza = posizione.accuracy != null && Number.isFinite(posizione.accuracy) && posizione.accuracy > 0
    ? posizione.accuracy
    : 0;
  if (incertezza > INCERTEZZA_UTILE_M) return null;

  const proiezione = proiettaSulPercorso(posizione.lat, posizione.lon, waypoints, legs);
  if (proiezione == null) return null;
  if (proiezione.scostamentoM > TOLLERANZA_SUL_PERCORSO_M + incertezza) return null;
  return proiezione;
}
