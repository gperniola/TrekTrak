import type { AppMode } from './types';
import type { CurrentItinerary } from './current-itinerary';

export type StartupAction =
  /** C'è lavoro in corso salvato: si rimette come stava, modalità compresa. */
  | { kind: 'restore'; saved: CurrentItinerary }
  /** Niente da ripristinare, ma il livello dichiarato chiede una modalità precisa. */
  | { kind: 'appMode'; mode: AppMode }
  /** Si lascia il default dello store. */
  | { kind: 'none' };

/**
 * Cosa fare all'avvio, come funzione pura: la decisione sta in un posto solo e si può
 * verificare senza montare la pagina.
 *
 * La precedenza è deliberata: **la modalità dell'itinerario salvato vince** sul livello
 * dichiarato nell'onboarding. L'utente può aver cambiato modalità a mano dopo aver
 * risposto a quella domanda, e una preferenza di mesi prima non deve sovrascrivere un
 * gesto di ieri. Il livello serve solo quando non c'è nulla da ripristinare, cioè
 * tipicamente alla prima apertura.
 *
 * Un livello non riconosciuto vale `none`, non "learn": non si indovina la modalità.
 */
export function startupAction(
  saved: CurrentItinerary | null,
  livello: string | null | undefined
): StartupAction {
  if (saved != null) return { kind: 'restore', saved };
  if (livello === 'beginner') return { kind: 'appMode', mode: 'learn' };
  if (livello === 'expert') return { kind: 'none' }; // il default è già Track
  return { kind: 'none' };
}
