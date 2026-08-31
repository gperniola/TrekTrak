import { PROFILI, type Profilo } from './profilo';

/**
 * Il profilo con cui parte l'app.
 *
 * Funzione pura, come `startup-itinerary.ts` fa per l'itinerario: la decisione si
 * verifica senza DOM e senza storage, e chi legge lo storage non decide nulla.
 */
export function profiloIniziale(input: { salvato: string | null; livello: string | null }): Profilo {
  if (input.salvato != null && PROFILI.includes(input.salvato as Profilo)) {
    return input.salvato as Profilo;
  }
  // Migrazione da prima di questa versione: c'e' solo il livello dichiarato
  // nell'onboarding, che finora decideva soltanto `appMode`.
  if (input.livello === 'beginner') return 'imparo';
  if (input.livello === 'expert') return 'montagna';
  /*
   * Nessuna informazione: Montagna. Il default non nasconde la sicurezza — in Imparo
   * l'avviso di allerta alla posizione non c'e', e imporlo a chi non ha ancora risposto
   * significherebbe togliere un avviso a qualcuno che potrebbe essere fuori adesso.
   */
  return 'montagna';
}
