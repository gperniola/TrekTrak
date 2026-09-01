import type { StateCreator } from 'zustand';
import type { ItineraryState } from './tipi';
import {
  avanti,
  indietro,
  passoCorrente,
  registra,
  storiaIniziale,
  type AzioneStoria,
  type Storia,
} from './storia';

export type SliceStoria = Pick<ItineraryState, 'storia' | 'registraGesto' | 'annulla' | 'rifai' | 'azzeraStoria'>;

/**
 * Annulla e rifai (task-19).
 *
 * **Che cosa entra nella storia.** Solo i gesti della persona: aggiungere, togliere,
 * spostare, rinominare, riordinare, scrivere un valore a mano. Restano fuori due
 * famiglie di scritture, e la ragione è la stessa per entrambe — non sono cose che
 * qualcuno ha *fatto*, quindi annullarle non risponde a nessuna domanda:
 *
 * - **i valori che calcola l'app** in modalità Track (distanze, dislivelli, geometria dei
 *   sentieri): chi li scrive passa `{ calcolata: true }`. Senza questa distinzione la
 *   storia si riempirebbe di passi generati dal programma, e «annulla» disferebbe un
 *   calcolo che il programma rifarebbe subito dopo;
 * - **i giudizi della verifica**, che sono una lettura dei dati e non un cambiamento.
 *
 * Fuori anche lo scambio Learn↔Track: cambia quali valori si guardano, non i valori.
 */
export const creaSliceStoria: StateCreator<ItineraryState, [], [], SliceStoria> = (set, get) => ({
  storia: storiaIniziale({ waypoints: [], legs: [], itineraryName: '' }),

  registraGesto: (azione: AzioneStoria) => {
    const { waypoints, legs, itineraryName, storia } = get();
    set({ storia: registra(storia, { waypoints, legs, itineraryName }, azione) });
  },

  /** Riparte da zero: dopo «Nuovo» o un caricamento, il passato non è più questo. */
  azzeraStoria: () => {
    const { waypoints, legs, itineraryName } = get();
    set({ storia: storiaIniziale({ waypoints, legs, itineraryName }) });
  },

  annulla: () => applica(set, get, indietro),
  rifai: () => applica(set, get, avanti),
});

/**
 * Sposta il cursore e rimette lo stato di quel passo.
 *
 * `storia` viene aggiornata nello stesso `set` dei dati: separarli farebbe passare
 * l'applicazione per uno stato intermedio in cui i waypoint sono già cambiati e il
 * cursore no — e chi ascolta lo store (l'autosalvataggio) lo vedrebbe.
 */
function applica(
  set: (s: Partial<ItineraryState>) => void,
  get: () => ItineraryState,
  mossa: (s: Storia) => Storia,
): void {
  const storia = mossa(get().storia);
  if (storia === get().storia) return;   // niente da annullare o da rifare
  const passo = passoCorrente(storia);
  set({
    storia,
    waypoints: passo.waypoints,
    legs: passo.legs,
    itineraryName: passo.itineraryName,
    // Il profilo altimetrico puntava a punti di prima: lasciarlo lo farebbe riferire a
    // waypoint che in questo passo non esistono.
    profileHover: null,
    profileFlyTo: null,
  });
}
