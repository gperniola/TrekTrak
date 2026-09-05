/**
 * **Interruttori temporanei: funzioni spente in attesa di tornare a posto.**
 *
 * Non è configurazione per ambiente e non è un sistema di feature flag: è il posto — uno
 * solo — dove sta scritto cosa è spento ADESSO e perché. Una funzione rotta con il suo
 * pulsante a schermo è peggio di nessun pulsante: promette e poi delude, e per un
 * rilascio pubblico la promessa mancata è la prima impressione.
 *
 * Vive in un modulo suo, e non dentro `profilo.ts`, per una ragione di test: i test che
 * documentano il comportamento a funzione ACCESA restano validi — accendono l'interruttore
 * con `jest.replaceProperty` — e quelli dello stato spento documentano l'oggi. Quando la
 * funzione torna, si rimette `true` e nessun test va riscritto.
 */

/**
 * La libreria condivisa su cloud: il flusso di accesso (`request-access`) al momento non
 * funziona, quindi ogni suo ingresso è nascosto (2026-09-05, preparazione al rilascio
 * pubblico). Il gate è `mostra('libreria', …)` in `lib/profilo.ts`: scheda della bottom
 * nav, switch Editor/Libreria, Salva/Carica e onboarding passano tutti da lì.
 */
// Tipata `boolean` e non col letterale `false`: i test dello stato acceso la alzano
// con `jest.replaceProperty`, e col tipo letterale il compilatore glielo vieterebbe.
export const LIBRERIA_DISPONIBILE: boolean = false;
