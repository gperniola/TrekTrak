import { cielo, cieliPresenti } from '@/lib/cielo';

/**
 * L'iconcina del cielo, chiesta il 2026-09-02. Quello che si prova qui non e' la tabella
 * — copiarla e ricopiarla in un test non dimostra niente — ma i casi in cui una versione
 * ingenua direbbe la cosa sbagliata.
 */
describe('il cielo di un ora', () => {
  test('i codici che contano hanno la loro parola', () => {
    expect(cielo(0)?.testo).toBe('sereno');
    expect(cielo(3)?.testo).toBe('coperto');
    expect(cielo(95)?.testo).toBe('temporale');
    expect(cielo(96)?.testo).toContain('grandine');
    expect(cielo(71)?.testo).toContain('neve');
    expect(cielo(45)?.testo).toBe('nebbia');
  });

  /**
   * **Il caso che conta.** Un dato mancante non e' bel tempo: se un codice non c'e' o non
   * si riconosce, la risposta e' "non lo so", e chi disegna deve scrivere n/d. Questo
   * progetto ha gia' corretto piu' volte lo stesso difetto in altre forme, e in un'app di
   * montagna un sole immaginario e' il modo di far partire qualcuno.
   */
  test('quello che non si sa non diventa sereno', () => {
    expect(cielo(undefined)).toBeNull();
    expect(cielo(null)).toBeNull();
    expect(cielo(Number.NaN)).toBeNull();
    // 4 e 30 non esistono nella WMO 4677: finiti, ma sconosciuti.
    expect(cielo(4)).toBeNull();
    expect(cielo(30)).toBeNull();
    expect(cielo(-1)).toBeNull();
  });

  test('ogni voce ha sia icona sia parola', () => {
    // Un'icona senza parola non e' leggibile da un lettore di schermo, una parola senza
    // icona lascia la colonna vuota: servono entrambe, per tutti i codici noti.
    for (const c of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
      71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]) {
      const v = cielo(c);
      expect(v).not.toBeNull();
      expect(v?.icona.length).toBeGreaterThan(0);
      expect(v?.testo).toMatch(/[a-z]/);
    }
  });

  describe('la legenda', () => {
    test('elenca una volta sola i cieli presenti, in ordine di comparsa', () => {
      const l = cieliPresenti([3, 0, 3, 95, 0]);
      expect(l.map((c) => c.testo)).toEqual(['coperto', 'sereno', 'temporale']);
    });

    test('salta quelli che non si conoscono, senza inventarli', () => {
      expect(cieliPresenti([undefined, Number.NaN, 4, null])).toEqual([]);
    });

    /**
     * Codici diversi con la stessa parola non vanno elencati due volte: 45 e 48 sono
     * entrambi nebbia con la stessa icona, e vederla due volte nella legenda sembrerebbe
     * un errore.
     */
    test('non ripete due codici che dicono la stessa cosa', () => {
      expect(cieliPresenti([61, 63]).length).toBe(2); // "pioggia debole" e "pioggia": diverse
      expect(cieliPresenti([45, 45]).length).toBe(1);
    });
  });
});
