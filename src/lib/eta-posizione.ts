import { descriviEta } from './eta-focolai';

/**
 * Quanto è **vecchia** la posizione che stiamo disegnando.
 *
 * Il difetto che questo modulo esiste per evitare l'ho introdotto io lo stesso giorno in
 * cui ho aggiunto il punto sulla mappa: il campo `at` dello store era scritto e **letto da
 * nessuno**, quindi il punto restava lì per sempre, alle coordinate dell'ultimo fix. Chi
 * concede la posizione all'imbocco del sentiero alle 9 e cammina due ore si ritrova la
 * mappa che lo disegna ancora al parcheggio — e un punto su una mappa si legge «sei qui,
 * adesso», non «eri qui, prima».
 *
 * Non si cancella: la posizione vecchia è un'informazione vera (**eri** lì). Si dichiara.
 */

/**
 * Oltre questi minuti la posizione non è più «adesso».
 *
 * Cinque: a passo di escursione sono quattro o cinquecento metri, cioè già più
 * dell'incertezza di qualunque GPS. Sotto, il punto è dove sei; sopra, è dove eri.
 */
export const MINUTI_POSIZIONE_ATTUALE = 5;

export interface EtaPosizione {
  /** Minuti dal rilevamento, arrotondati. */
  minuti: number;
  /** `true` finché il punto può dire «sei qui». */
  attuale: boolean;
  /** Come si scrive: «adesso», «12 min fa», «2 h fa». */
  detta: string;
}

/**
 * L'età di un rilevamento.
 *
 * Un istante nel futuro (orologio del dispositivo spostato, o un fix arrivato con un
 * millisecondo di anticipo) conta come **adesso**, non come età negativa: «-3 min fa» non
 * vuol dire niente.
 */
export function etaPosizione(at: number, adesso: number): EtaPosizione {
  const minuti = Math.max(0, Math.round((adesso - at) / 60_000));
  return {
    minuti,
    attuale: minuti < MINUTI_POSIZIONE_ATTUALE,
    detta: descriviEta(minuti),
  };
}

/**
 * Il nome accessibile del punto.
 *
 * Dice **quando**, perché per chi non vede la differenza fra pieno e vuoto non esiste: è
 * l'unico posto in cui l'età della posizione è leggibile a parole, e per questo la dice
 * sempre — anche quando è fresca.
 */
export function nomePosizione(eta: EtaPosizione): string {
  return eta.attuale
    ? `La tua posizione, rilevata ${eta.detta}`
    : `Dov'eri, rilevato ${eta.detta}`;
}
