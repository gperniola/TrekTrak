import type { Leg, Waypoint } from '../../lib/types';

/**
 * Lo stack di annullamento (task-19), come logica pura: qui non si tocca lo store, si
 * decide soltanto cosa contiene la storia dopo ogni gesto.
 */

/** Oltre questo, la storia occupa memoria per un passato che nessuno ripercorre. */
export const MASSIMO_PASSI = 50;

/**
 * Che cosa si annulla. Il nome serve al pulsante: «Annulla» da solo costringe a
 * ricordarsi cosa si è appena fatto, e chi annulla di solito lo fa proprio perché non
 * ne è più sicuro.
 */
export type AzioneStoria =
  | 'aggiunta del waypoint'
  | 'rimozione del waypoint'
  | 'spostamento del waypoint'
  | 'modifica del waypoint'
  | 'modifica della tratta'
  | 'riordino dei waypoint'
  | 'cancellazione dei waypoint'
  | 'modifica del nome';

export interface Istantanea {
  waypoints: Waypoint[];
  legs: Leg[];
  itineraryName: string;
  /** Cosa è stato fatto PER ARRIVARE a questa istantanea. Il primo passo non ha nulla. */
  azione: AzioneStoria | null;
}

export interface Storia {
  passi: Istantanea[];
  /** Dove siamo dentro `passi`. Annullare lo fa arretrare, rifare avanzare. */
  cursore: number;
}

export function storiaIniziale(istantanea: Omit<Istantanea, 'azione'>): Storia {
  return { passi: [{ ...istantanea, azione: null }], cursore: 0 };
}

/**
 * Registra un gesto.
 *
 * Due regole che rendono la storia una linea e non un albero:
 *
 * 1. **Il futuro si tronca.** Se si è annullato e poi si fa qualcosa di nuovo, i passi
 *    che erano stati annullati spariscono: da lì in avanti la strada è un'altra, e
 *    tenerli farebbe «rifai» un salto in una realtà che non è più successa.
 * 2. **Il tetto morde in coda.** Oltre `MASSIMO_PASSI` si butta il più vecchio, non il
 *    più recente: si perde la possibilità di tornare all'inizio, non quella di tornare
 *    indietro di un passo, che è quella che serve.
 */
export function registra(storia: Storia, istantanea: Omit<Istantanea, 'azione'>, azione: AzioneStoria): Storia {
  const fino = storia.passi.slice(0, storia.cursore + 1);
  const passi = [...fino, { ...istantanea, azione }];
  const tagliati = passi.length > MASSIMO_PASSI ? passi.slice(passi.length - MASSIMO_PASSI) : passi;
  return { passi: tagliati, cursore: tagliati.length - 1 };
}

export function puoAnnullare(storia: Storia): boolean {
  return storia.cursore > 0;
}

export function puoRifare(storia: Storia): boolean {
  return storia.cursore < storia.passi.length - 1;
}

/** L'azione che «Annulla» disferebbe, per scriverla sul pulsante. */
export function azioneDaAnnullare(storia: Storia): AzioneStoria | null {
  return puoAnnullare(storia) ? storia.passi[storia.cursore].azione : null;
}

/** L'azione che «Rifai» rifarebbe. */
export function azioneDaRifare(storia: Storia): AzioneStoria | null {
  return puoRifare(storia) ? storia.passi[storia.cursore + 1].azione : null;
}

export function indietro(storia: Storia): Storia {
  return puoAnnullare(storia) ? { ...storia, cursore: storia.cursore - 1 } : storia;
}

export function avanti(storia: Storia): Storia {
  return puoRifare(storia) ? { ...storia, cursore: storia.cursore + 1 } : storia;
}

export function passoCorrente(storia: Storia): Istantanea {
  return storia.passi[storia.cursore];
}
