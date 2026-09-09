import { cielo, cieliPresenti, cieloDellOra } from '@/lib/cielo';

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
      // La legenda ora riceve i CIELI mostrati, non i codici: deve spiegare quello che si
      // vede in tabella, e ciò che si vede può essere «possibile pioggia», che un codice
      // non è.
      const l = cieliPresenti([3, 0, 3, 95, 0].map(cielo));
      expect(l.map((c) => c.testo)).toEqual(['coperto', 'sereno', 'temporale']);
    });

    test('salta quelli che non si conoscono, senza inventarli', () => {
      expect(cieliPresenti([undefined, Number.NaN, 4, null].map((c) => cielo(c as number)))).toEqual([]);
    });

    /**
     * Codici diversi con la stessa parola non vanno elencati due volte: 45 e 48 sono
     * entrambi nebbia con la stessa icona, e vederla due volte nella legenda sembrerebbe
     * un errore.
     */
    test('non ripete due codici che dicono la stessa cosa', () => {
      expect(cieliPresenti([61, 63].map(cielo)).length).toBe(2); // "pioggia debole" e "pioggia": diverse
      expect(cieliPresenti([45, 45].map(cielo)).length).toBe(1);
    });
  });
});

/**
 * **L'iconcina non può dire «sereno» mentre la riga avverte di pioggia.**
 *
 * Segnalato dall'utente il 2026-09-09: «pioggia 78%, possibili temporali forti, raffiche
 * 31 km/h» e l'iconcina mostrava il sole. Non è un codice WMO strano — «temporali con
 * schiarite» non esiste: sono **due domande diverse**. Il `weather_code` è il cielo di UNA
 * corsa del modello, la probabilità viene da un ensemble di simulazioni. Quella corsa era
 * capitata fra le asciutte.
 *
 * Misurato sui due mesi di verifica: succede nel 6,4% delle ore con ECMWF, e nell'1,6% con
 * l'iconcina proprio del sole. Non è un caso limite, ed è concentrato nei giorni convettivi.
 *
 * Perché dalla probabilità e non contando i membri dell'ensemble: misurato sul caso vero,
 * la maggioranza dei membri dava comunque «poco nuvoloso» (19 su 51), e il conteggio dei
 * membri (5% sopra 0,1 mm) e la probabilità dichiarata (54%) vengono da **due popolazioni
 * diverse** — mescolarle nella stessa riga sarebbe il difetto che l'app si è imposta di
 * non fare.
 */
describe('il cielo mostrato quando la probabilità contraddice il codice', () => {
  test('sereno con pioggia probabile diventa «possibile pioggia»', () => {
    expect(cieloDellOra(0, 78, 32)?.testo).toBe('possibile pioggia');
  });

  test('anche «coperto» con pioggia probabile: è la stessa contraddizione', () => {
    expect(cieloDellOra(3, 54, 32)?.testo).toBe('possibile pioggia');
  });

  test('sotto la soglia del modello il codice resta quello che è', () => {
    expect(cieloDellOra(0, 31, 32)?.testo).toBe('sereno');
    expect(cieloDellOra(3, 0, 32)?.testo).toBe('coperto');
  });

  /** La soglia è del MODELLO: con ICON basta molto meno, ed è voluto. */
  test('la soglia è quella del modello che sta parlando', () => {
    expect(cieloDellOra(0, 12, 10)?.testo).toBe('possibile pioggia');
    expect(cieloDellOra(0, 12, 32)?.testo).toBe('sereno');
  });

  /** Se il codice già dichiara precipitazione, non c'è niente da correggere. */
  test('un codice di pioggia resta il suo, con la sua parola precisa', () => {
    expect(cieloDellOra(80, 78, 32)?.testo).toBe('rovesci deboli');
    expect(cieloDellOra(95, 78, 32)?.testo).toBe('temporale');
  });

  /** La nebbia non si copre: in montagna è un pericolo suo, non un dettaglio del cielo. */
  test('la nebbia resta nebbia anche con pioggia probabile', () => {
    expect(cieloDellOra(45, 78, 32)?.testo).toBe('nebbia');
  });

  test('senza codice non si inventa un cielo, nemmeno con la probabilità alta', () => {
    expect(cieloDellOra(Number.NaN, 78, 32)).toBeNull();
    expect(cieloDellOra(null, 78, 32)).toBeNull();
  });

  test('probabilità ignota: decide il codice, come sempre', () => {
    expect(cieloDellOra(0, Number.NaN, 32)?.testo).toBe('sereno');
  });
});
