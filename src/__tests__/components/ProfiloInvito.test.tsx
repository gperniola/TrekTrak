import { useUIStore } from '@/stores/uiStore';
import { profiloPerInvito } from '@/lib/startup-profilo';

/**
 * Secondo giro di review. Caso limite: **la porta che qualcun altro ti ha aperto**.
 *
 * La libreria condivisa e' un'area del profilo Montagna, quindi in Imparo e' nascosta.
 * Ma un link di invito e' un invito esplicito a usare proprio quella: chi arriva da li'
 * non deve trovare l'app che gli nasconde la cosa per cui e' stato invitato.
 *
 * Regola generale che ne esce: un modo che nasconde funzioni non deve nascondere quelle
 * a cui l'utente e' stato portato da un collegamento esterno.
 */
describe('review 2: il link di invito ha la precedenza sul profilo', () => {
  test('con un invito in corso il profilo diventa Montagna', () => {
    expect(profiloPerInvito('imparo', true)).toBe('montagna');
  });

  test('senza invito il profilo non si tocca', () => {
    expect(profiloPerInvito('imparo', false)).toBe('imparo');
    expect(profiloPerInvito('montagna', false)).toBe('montagna');
  });

  test('chi e gia in Montagna resta dov e', () => {
    expect(profiloPerInvito('montagna', true)).toBe('montagna');
  });

  /** La funzione e' pura: decide, non scrive. Chi la usa applica il risultato. */
  test('non tocca lo store da sola', () => {
    useUIStore.setState({ profilo: 'imparo' });
    profiloPerInvito('imparo', true);
    expect(useUIStore.getState().profilo).toBe('imparo');
  });
});
