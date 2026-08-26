/**
 * "La fonte ha risposto, ma per il giorno richiesto non c'è nulla" — spec §6: un 404
 * dalle fonti è *nessun dato disponibile*, non un guasto. Va distinto da un errore di
 * rete perché il pannello lo presenta in modo diverso e non fa scattare il toast rosso.
 *
 * Vive in un modulo suo, e non in `emergency-api`, perché diversi test mockano quel
 * modulo per intero: importando la classe da lì, nello store diventava `undefined` e
 * `instanceof` lanciava "Right-hand side of 'instanceof' is not an object".
 */
export class NoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoDataError';
  }
}
