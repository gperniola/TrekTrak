/**
 * Le decisioni del gesto "trascina in basso per chiudere", separate dal DOM.
 *
 * Sta qui, in funzioni pure, perche' e' la parte che si puo' verificare davvero: quanto
 * bisogna trascinare, con che velocita', quando il gesto va lasciato allo scorrimento.
 * Il resto — ascoltare i puntatori, muovere il foglio — vive in `useSheetDrag.ts` e si
 * verifica a mano, perche' un trascinamento a dito non lo prova nessun test.
 */

/** Oltre questa frazione dell'altezza del foglio, il rilascio chiude. */
export const FRAZIONE_CHIUSURA = 0.35;

/**
 * Velocita' che chiude anche senza aver superato la soglia, in px/ms.
 *
 * Serve perche' il gesto naturale e' un colpo secco, non un trascinamento lento fino a
 * meta' schermo: senza questa scorciatoia il foglio tornerebbe su proprio quando lo
 * butti giu' con convinzione.
 */
export const VELOCITA_CHIUSURA = 0.5;

/** Sotto questo spostamento non si decide ancora nulla: e' un tocco, non un gesto. */
export const SOGLIA_INTENZIONE = 6;

export type Intenzione = 'attesa' | 'chiusura' | 'altro';

/**
 * Cosa sta facendo il dito.
 *
 * `altro` comprende il gesto orizzontale e quello verso l'alto: entrambi devono
 * restare a chi li aspetta (lo scorrimento, o niente), non essere rubati dal foglio.
 */
export function intenzione(dx: number, dy: number): Intenzione {
  if (Math.abs(dx) < SOGLIA_INTENZIONE && Math.abs(dy) < SOGLIA_INTENZIONE) return 'attesa';
  // Prevalentemente verticale E verso il basso.
  if (dy > 0 && Math.abs(dy) > Math.abs(dx)) return 'chiusura';
  return 'altro';
}

/**
 * Il gesto puo' prendersi il comando?
 *
 * Dalla maniglia sempre. Dal corpo del foglio solo se il contenuto e' gia' in cima:
 * e' la regola degli sheet nativi, ed evita di rubare lo scorrimento a chi stava
 * leggendo. Nel pannello layer con le righe chiuse il contenuto non scorre affatto,
 * quindi la condizione e' sempre vera — il caso normale non ha conflitti.
 */
export function puoPrendereIlComando(opts: { daManiglia: boolean; scrollTop: number }): boolean {
  return opts.daManiglia || opts.scrollTop <= 0;
}

/**
 * Al rilascio: chiudere o tornare al proprio posto?
 *
 * `durataMs` a 0 non e' un caso reale ma arriva dai test e dai puntatori sintetici:
 * si tratta come "nessuna velocita' misurabile" invece di dividere per zero.
 */
export function chiudeAlRilascio(dy: number, altezza: number, durataMs: number): boolean {
  if (dy <= 0) return false;
  if (altezza > 0 && dy >= altezza * FRAZIONE_CHIUSURA) return true;
  if (durataMs > 0 && dy / durataMs >= VELOCITA_CHIUSURA) return true;
  return false;
}

/**
 * Quanto e' opaco il backdrop mentre il foglio scende: da 1 a 0, in proporzione a
 * quanto e' stato trascinato. Il gesto si deve vedere mentre lo fai, altrimenti non si
 * capisce che sta funzionando.
 */
export function opacitaBackdrop(dy: number, altezza: number): number {
  if (altezza <= 0) return 1;
  const frazione = Math.min(Math.max(dy / altezza, 0), 1);
  return Number((1 - frazione).toFixed(3));
}
