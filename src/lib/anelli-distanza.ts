import { distanza } from './formato';

/**
 * Gli **anelli di distanza** attorno a un punto: cerchi concentrici a distanze tonde,
 * con la loro etichetta.
 *
 * Servono a leggere una distanza *a occhio*, senza misurarla: con tre anelli intorno alla
 * propria posizione, «quella cima è appena oltre il secondo anello» diventa un numero. È
 * il trucco delle carte militari e delle rose dei venti, ed è esattamente il genere di
 * cosa che questa app esiste per insegnare — la bussola dà **una** distanza, quella del
 * bersaglio; gli anelli la danno per tutto quello che si vede.
 *
 * ## Perché i raggi si scelgono da una scala 1-2-5
 *
 * Un anello a 337 m non si legge: il numero va ricordato per confrontarlo con qualcos'altro,
 * e nessuno ricorda 337. La scala 1-2-5 (100, 200, 500, 1.000, 2.000…) è quella dei
 * righelli e delle scale grafiche, e dà sempre numeri che si tengono a mente. Si sceglie il
 * passo più grande che permetta di vedere **tre** anelli nella vista: meno di tre non danno
 * il senso della progressione, più di tre sporcano la mappa.
 */

/** La scala dei passi: 1, 2 e 5 per ogni ordine di grandezza, in metri. */
const SCALA = [
  10, 20, 50,
  100, 200, 500,
  1_000, 2_000, 5_000,
  10_000, 20_000, 50_000,
  100_000,
];

/** Quanti anelli si disegnano. Tre: uno solo non fa scala, cinque sono un bersaglio. */
export const QUANTI_ANELLI = 3;

export interface Anello {
  /** Raggio in metri. */
  raggio: number;
  /** Come si scrive: «500 m», «1,5 km». */
  etichetta: string;
}

/**
 * Il passo degli anelli per una vista di raggio `raggioVistaMetri`.
 *
 * `null` se la vista è così stretta o così larga da non poter contenere tre anelli
 * leggibili: meglio non disegnarli che disegnarne uno che esce dallo schermo o tre
 * appiccicati al punto.
 */
export function passoAnelli(raggioVistaMetri: number): number | null {
  if (!Number.isFinite(raggioVistaMetri) || raggioVistaMetri <= 0) return null;
  // Il passo più grande che tiene tutti e tre gli anelli dentro la vista.
  let scelto: number | null = null;
  for (const passo of SCALA) {
    if (passo * QUANTI_ANELLI <= raggioVistaMetri) scelto = passo;
  }
  return scelto;
}

/**
 * Gli anelli da disegnare attorno al punto, dal più vicino.
 *
 * Vuoto quando non ce ne stanno: chi disegna non deve inventarsi un caso limite.
 */
export function anelliPerVista(raggioVistaMetri: number): Anello[] {
  const passo = passoAnelli(raggioVistaMetri);
  if (passo == null) return [];
  return Array.from({ length: QUANTI_ANELLI }, (_, i) => {
    const raggio = passo * (i + 1);
    return { raggio, etichetta: etichettaRaggio(raggio) };
  });
}

/**
 * L'etichetta di un raggio, in italiano.
 *
 * Passa da `distanza()`, che è la stessa funzione con cui l'app scrive ogni altra
 * distanza: sotto il chilometro i metri, sopra i chilometri con la virgola decimale. Un
 * anello che dicesse «0.5 km» mentre il pannello dice «500 m» sarebbe la stessa distanza
 * scritta in due modi nella stessa schermata.
 */
export function etichettaRaggio(raggioMetri: number): string {
  const inKm = raggioMetri / 1000;
  /*
    Zero decimali quando il numero e' tondo — e per costruzione lo e' quasi sempre, perche'
    i raggi vengono dalla scala 1-2-5. «1 km» invece di «1,0 km»: il decimale a zero su
    un'etichetta di due caratteri e' rumore, e questi numeri esistono per essere ricordati.
  */
  return distanza(inKm, Number.isInteger(inKm) ? 0 : 1);
}
