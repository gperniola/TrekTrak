/**
 * **Quale riga del pannello layer resta aperta quando un interruttore cambia.**
 *
 * Il pannello tiene aperta **una riga per volta** (v0.14.0: prima ogni layer acceso si
 * portava dietro per sempre descrizione e legenda, e il pannello puniva chi lo usava).
 * Fin qui la riga si apriva solo toccandola, e questo lasciava due gesti mancanti:
 *
 * - **accendere un layer senza vederne la legenda.** I colori sulla mappa non si spiegano
 *   da soli — quattro classi di recenza per le aree bruciate, cinque di pericolo per il
 *   FWI, una scala che per l'instabilità va addirittura al contrario — quindi il momento
 *   in cui la legenda serve è esattamente quello in cui il layer compare.
 * - **spegnere un layer e restare col suo dettaglio aperto**, cioè con la legenda di una
 *   cosa che non è più sulla mappa.
 *
 * È una funzione pura perché la regola è una regola, non un effetto: si decide qui e si
 * prova qui.
 */
export function rigaApertaDopo<T extends string>(
  apertaOra: T | null,
  id: T,
  acceso: boolean,
): T | null {
  // Acceso: si apre il suo, e quello di prima si chiude — la riga aperta e' una sola.
  if (acceso) return id;
  // Spento: si chiude il suo, e si lascia in pace quello di un altro layer.
  return apertaOra === id ? null : apertaOra;
}
