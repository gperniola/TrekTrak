import type { Itinerary } from '../types';

/**
 * Un formato in cui l'itinerario può uscire dall'app.
 *
 * Nasce dal task-28: JSON e GPX erano due moduli che ripetevano lo stesso pezzo di
 * codice — costruisci il Blob, crea un `<a download>`, appendi, clicca, rimuovi, revoca
 * l'URL dopo un secondo — e ogni formato nuovo avrebbe ripetuto quel pezzo una terza
 * volta. Qui il formato dichiara solo **cosa** produce; il **come** lo consegna sta in
 * `downloadAs`, scritto una volta.
 */
export interface Exporter {
  /** Chiave stabile, usata come `key` React e nei test. */
  id: string;
  /** Come si chiama per chi lo sceglie da un menu. */
  etichetta: string;
  /** A cosa serve: si legge accanto all'etichetta, quindi dice l'uso, non il formato. */
  descrizione: string;
  /** Senza punto. */
  estensione: string;
  mime: string;

  /**
   * **Perché adesso non si può**, oppure `null` se si può.
   *
   * Torna la ragione e non un booleano di proposito: chi disegna il menu deve poter
   * dire cosa manca, non solo spegnere una voce. Un pulsante grigio senza spiegazione
   * era il difetto corretto nella v0.11.8, e con un `disponibile: boolean` la
   * spiegazione andrebbe riscritta a mano da ogni chiamante — cioè prima o poi in modo
   * diverso dalla condizione vera.
   */
  impedimento(itinerary: Itinerary): string | null;

  /** Il contenuto del file, come testo. */
  contenuto(itinerary: Itinerary): string;
}

/** Waypoint con coordinate valide: la condizione che quasi tutti i formati richiedono. */
export function conCoordinate(itinerary: Itinerary) {
  return itinerary.waypoints.filter(
    (wp) => wp.lat != null && wp.lon != null && Number.isFinite(wp.lat) && Number.isFinite(wp.lon),
  );
}
