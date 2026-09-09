import { linkMeteoblue } from '@/lib/meteoblue';

/**
 * **Il link a Meteoblue per un punto qualsiasi.**
 *
 * Meteoblue non è fra i modelli di Open-Meteo e la sua API vuole una chiave, ma il
 * **link** non chiede niente e porta l'utente alla fonte che consulta di suo. La forma
 * dell'indirizzo è verificata con un browser vero il 2026-09-09: la pagina risponde col
 * titolo «Meteo 42.2°N 14.28°E - meteoblue».
 */
describe('linkMeteoblue', () => {
  test('costruisce l\'indirizzo per coordinate', () => {
    expect(linkMeteoblue(42.2, 14.28))
      .toBe('https://www.meteoblue.com/it/tempo/settimana/42.200N14.280E');
  });

  /**
   * I segni si ricavano dal valore. Darli per scontati funziona finché l'app resta in
   * Italia, e smette il primo giorno che non ci resta — è la classe di difetto che questo
   * progetto ha già pagato con i fusi e coi formati numerici.
   */
  test('emisfero sud e ovest: i segni non si danno per scontati', () => {
    expect(linkMeteoblue(-33.9, -18.4)).toContain('33.900S18.400W');
  });

  test('tre decimali: la pagina di Meteoblue li vuole così', () => {
    expect(linkMeteoblue(46.4, 11.8)).toContain('46.400N11.800E');
  });

  /** Il punto decimale è quello dell'indirizzo, non un numero da leggere: resta un punto. */
  test('l\'indirizzo usa il punto, non la virgola italiana', () => {
    expect(linkMeteoblue(42.2, 14.28)).not.toContain(',');
  });

  test('coordinate non finite: nessun indirizzo inventato', () => {
    expect(linkMeteoblue(Number.NaN, 14.28)).toBeNull();
  });
});
