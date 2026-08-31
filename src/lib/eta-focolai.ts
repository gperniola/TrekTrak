import type { FirePoint } from './firms';
import { oraItaliana } from './formato';

/**
 * Quanto sono vecchi i focolai che stai guardando.
 *
 * Il pannello diceva "Aggiornato alle 09:29", che e' **quando abbiamo chiesto noi**, non
 * quando il satellite e' passato: due orari che possono distare ore. Chi guarda la mappa
 * prima di partire vuole sapere il secondo.
 *
 * Il satellite passa due volte al giorno, quindi l'eta' del dato piu' fresco non e' un
 * dettaglio: e' la differenza fra "questo incendio l'ha visto un'ora fa" e "l'ultimo
 * sguardo su quella valle e' di stanotte".
 */

/** Oltre questa eta' il dato non e' piu' "di adesso" — la stessa soglia dei colori. */
export const SOGLIA_VECCHIO_MIN = 6 * 60;

export interface FinestraRilevazioni {
  /** Acquisizione piu' vecchia fra i punti caricati. */
  daISO: string;
  /** Acquisizione piu' recente. */
  aISO: string;
  /** Minuti trascorsi dall'acquisizione piu' recente. */
  etaMinuti: number;
}

/**
 * La finestra coperta dalle rilevazioni, e l'eta' della piu' fresca.
 *
 * `null` quando non c'e' niente da dire: nessun punto, o date illeggibili. Un dato
 * mancante si dichiara, non si inventa un orario.
 */
export function finestraRilevazioni(
  punti: FirePoint[],
  adesso: number,
): FinestraRilevazioni | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of punti) {
    const t = Date.parse(p.acquiredAt);
    if (!Number.isFinite(t)) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return {
    daISO: new Date(min).toISOString(),
    aISO: new Date(max).toISOString(),
    // Un'acquisizione nel futuro (orologio locale indietro) vale "adesso", non un
    // numero negativo da mostrare.
    etaMinuti: Math.max(0, Math.round((adesso - max) / 60000)),
  };
}

/** L'eta' a parole: quello che si legge sotto il nome del layer. */
export function descriviEta(minuti: number): string {
  if (minuti < 2) return 'adesso';
  if (minuti < 90) return `${minuti} min fa`;
  const ore = Math.round(minuti / 60);
  if (ore < 48) return `${ore} h fa`;
  return `${Math.round(ore / 24)} giorni fa`;
}

/**
 * La frase completa, in ora italiana.
 *
 * Dice due cose diverse di proposito: la **finestra** coperta (che spiega perche' vedi
 * focolai in punti diversi con colori diversi) e l'**eta' del piu' recente** (che dice
 * quanto e' vecchio lo sguardo piu' fresco).
 */
export function descriviFinestra(f: FinestraRilevazioni): string {
  return `Passaggi satellite: ${oraItaliana(f.daISO)} – ${oraItaliana(f.aISO)} · il più recente ${descriviEta(f.etaMinuti)}`;
}

/** Il dato piu' fresco e' abbastanza vecchio da dover essere detto senza aprire nulla? */
export function datoVecchio(f: FinestraRilevazioni): boolean {
  return f.etaMinuti >= SOGLIA_VECCHIO_MIN;
}
