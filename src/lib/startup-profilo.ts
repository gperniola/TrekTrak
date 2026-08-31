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

/**
 * Il profilo da usare quando c'e' un invito alla libreria condivisa in corso.
 *
 * La libreria e' un'area del profilo Montagna, quindi in Imparo e' nascosta. Ma un link
 * di invito e' un invito esplicito a usare **proprio quella**: chi arriva da li' non
 * deve trovare l'app che gli nasconde la cosa per cui e' stato invitato.
 *
 * Regola generale: un modo che nasconde funzioni non deve nascondere quelle a cui
 * l'utente e' stato portato da un collegamento esterno.
 */
export function profiloPerInvito(attuale: Profilo, invitoInCorso: boolean): Profilo {
  return invitoInCorso ? 'montagna' : attuale;
}
