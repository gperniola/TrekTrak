import { AREE, mostra, PROFILI, ETICHETTE_PROFILO, type Area } from '@/lib/profilo';

/**
 * Con quindici aree sparse in una dozzina di componenti, la domanda «questo pulsante in
 * quale profilo si vede?» deve avere UNA sola risposta in UN solo posto. Questa e' la
 * tabella che la contiene, e questi test sono il suo contratto.
 */
describe('la tabella delle aree', () => {
  test('le aree didattiche stanno solo in Imparo', () => {
    for (const a of ['validazione', 'quiz', 'progresso', 'tipsDidattici', 'switchLearnTrack'] as Area[]) {
      expect(mostra(a, 'imparo')).toBe(true);
      expect(mostra(a, 'montagna')).toBe(false);
    }
  });

  test('le aree da campo stanno solo in Montagna', () => {
    for (const a of ['layerEmergenza', 'meteo', 'allertaPosizione', 'libreria', 'exportDati'] as Area[]) {
      expect(mostra(a, 'montagna')).toBe(true);
      expect(mostra(a, 'imparo')).toBe(false);
    }
  });

  /** Strumenti didattici prima che da campo: misurare un azimut sulla mappa e' un esercizio. */
  test('bussola, righello e PDF stanno in entrambi', () => {
    for (const a of ['bussola', 'righello', 'pdf'] as Area[]) {
      expect(mostra(a, 'imparo')).toBe(true);
      expect(mostra(a, 'montagna')).toBe(true);
    }
  });

  test('ogni area dichiara almeno un profilo: invisibile a tutti sarebbe codice morto', () => {
    for (const [nome, profili] of Object.entries(AREE)) {
      expect(profili.length).toBeGreaterThan(0);
      expect(nome).not.toBe('');
    }
  });

  test('i profili e le loro etichette in italiano', () => {
    expect(PROFILI).toEqual(['imparo', 'montagna']);
    expect(ETICHETTE_PROFILO.imparo).toBe('Imparo');
    expect(ETICHETTE_PROFILO.montagna).toBe('Vado in montagna');
  });
});
