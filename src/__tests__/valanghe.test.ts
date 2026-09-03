import {
  ORA_SCADENZA_UTC, REGIONI_EAWS, SCALA_EAWS, ZOOM_MINIMO_VALANGHE,
  bboxDiGeometria, dettaglioOrario, dettaglioQuote, etichettaPericolo, giorniDaProvare,
  parseRatings, regioniPerBbox, rettangoliSiToccano, semplificaGeometria, tolleranzaPerZoom,
  vistaTroppoGrande, LATO_MASSIMO_VISTA_GRADI,
  type Valutazione,
} from '@/lib/avalanche';

/**
 * Pericolo valanghe (task-51).
 *
 * Le fonti erano già validate nell'appendice del progetto, ma la verifica sui dati veri
 * del 2026-09-03 ha cambiato quattro decisioni: lo `0` che non è verde, la quota che
 * cambia il numero, l'ora in cui il bollettino scade, e il peso delle geometrie che ha
 * imposto il proxy. Qui si provano quelle quattro.
 */
describe('valanghe', () => {
  describe('la scala EAWS', () => {
    /**
     * Colori **letti dal CSS dell'app che pubblica i bollettini** il 2026-09-03:
     * `.warning-level-1 {#cf6}`, `-2 {#ff0}`, `-3 {#f90}`, `-4 {red}`. Inventarli avrebbe
     * reso la nostra mappa incoerente con ogni altro bollettino che l'utente consulta —
     * ed è l'errore già corretto due volte con le legende Copernicus.
     */
    test('i colori sono quelli pubblicati', () => {
      expect(SCALA_EAWS[1].colore).toBe('#ccff66');
      expect(SCALA_EAWS[2].colore).toBe('#ffff00');
      expect(SCALA_EAWS[3].colore).toBe('#ff9900');
      expect(SCALA_EAWS[4].colore).toBe('#ff0000');
      // Il 5 sul sito ufficiale è lo stesso rosso, a tratteggio: il colore non cambia.
      expect(SCALA_EAWS[5].colore).toBe('#ff0000');
    });

    test('i nomi italiani della scala', () => {
      expect([1, 2, 3, 4, 5].map((n) => SCALA_EAWS[n as 1].nome))
        .toEqual(['Debole', 'Moderato', 'Marcato', 'Forte', 'Molto forte']);
    });

    /**
     * **Lo zero non è verde.** Nell'aggregato EAWS `0` vuol dire *nessuna valutazione* —
     * misurato nei dati veri di IT-MeteoMont, dove compare accanto a 1, 2 e 3.
     * Presentarlo come "nessun pericolo" è la direzione di errore peggiore che esista in
     * un'app di montagna.
     */
    test('lo zero dice che non si sa, e non ha il colore del pericolo debole', () => {
      expect(SCALA_EAWS[0].nome).toMatch(/nessuna valutazione/i);
      expect(SCALA_EAWS[0].colore).not.toBe(SCALA_EAWS[1].colore);
      expect(etichettaPericolo(0)).toBe('Nessuna valutazione');
      expect(etichettaPericolo(3)).toBe('3 — Marcato');
    });
  });

  describe('la lettura dei rating', () => {
    // La forma è quella dei file veri: la chiave base più le varianti con i due punti.
    const grezzi = {
      maxDangerRatings: {
        'IT-32-BZ-01-01': 3,
        'IT-32-BZ-01-01:am': 2,
        'IT-32-BZ-01-01:pm': 3,
        'IT-32-BZ-01-01:high': 3,
        'IT-32-BZ-01-01:high:am': 3,
        'IT-32-BZ-01-01:low': 1,
        'IT-32-BZ-01-01:low:pm': 1,
        'IT-MeteoMont-14-1': 0,
      },
    };

    test('una voce per micro-regione, non una per variante', () => {
      const m = parseRatings(grezzi);
      expect(Array.from(m.keys()).sort()).toEqual(['IT-32-BZ-01-01', 'IT-MeteoMont-14-1']);
    });

    /**
     * **La quota cambia il numero.** Nei dati veri del 15/02/2026 su IT-32-BZ la stessa
     * micro-regione dava 3 sopra il limite del bosco e 1 sotto: mostrare solo il massimo
     * spaventerebbe chi resta in basso, mostrare solo il minimo ingannerebbe chi sale.
     */
    test('tiene mattina, pomeriggio, alta e bassa quota', () => {
      const v = parseRatings(grezzi).get('IT-32-BZ-01-01') as Valutazione;
      expect(v).toMatchObject({ pericolo: 3, am: 2, pm: 3, alta: 3, bassa: 1 });
    });

    test('lo zero si conserva come zero, non si butta', () => {
      expect(parseRatings(grezzi).get('IT-MeteoMont-14-1')?.pericolo).toBe(0);
    });

    test('i valori fuori scala si ignorano invece di finire sulla mappa', () => {
      const m = parseRatings({
        maxDangerRatings: {
          'A-1': 7, 'B-1': -1, 'C-1': 2.5, 'D-1': 'alto', 'E-1': null, 'F-1': 4,
        },
      });
      expect(Array.from(m.keys())).toEqual(['F-1']);
    });

    test('le varianti fuori scala non inquinano la voce buona', () => {
      const v = parseRatings({
        maxDangerRatings: { 'A-1': 2, 'A-1:am': 9, 'A-1:pm': 'x' },
      }).get('A-1') as Valutazione;
      expect(v.pericolo).toBe(2);
      expect(v.am).toBeNull();
      expect(v.pm).toBeNull();
    });

    test('una risposta di forma sbagliata è un errore', () => {
      expect(() => parseRatings(null)).toThrow();
      expect(() => parseRatings({})).toThrow();
      expect(() => parseRatings({ maxDangerRatings: 'niente' })).toThrow();
    });
  });

  /**
   * **Quale giorno.** MISURATO nel CAAML: il file del giorno D vale dalle 16:00 UTC di
   * D-1 alle 16:00 UTC di D, e i bollettini per il giorno dopo escono nel pomeriggio.
   * Quindi la mattina il corrente è quello di oggi, la sera è quello di domani — e
   * chiedere sempre "oggi" avrebbe mostrato un bollettino scaduto per tutta la serata,
   * cioè proprio quando si pianifica l'uscita del giorno dopo.
   */
  describe('quale bollettino', () => {
    test('la mattina si prova oggi per primo', () => {
      expect(giorniDaProvare(new Date('2026-02-15T08:00:00Z')))
        .toEqual(['2026-02-15', '2026-02-16', '2026-02-14']);
    });

    test('dopo le 16 UTC si prova domani per primo', () => {
      expect(giorniDaProvare(new Date('2026-02-15T16:30:00Z')))
        .toEqual(['2026-02-16', '2026-02-15', '2026-02-14']);
    });

    test('ieri resta sempre in coda, come ultimo ripiego', () => {
      for (const ora of ['00:30', '12:00', '23:30']) {
        expect(giorniDaProvare(new Date(`2026-02-15T${ora}:00Z`))[2]).toBe('2026-02-14');
      }
    });

    test('l ora di scadenza è quella misurata nel bollettino', () => {
      expect(ORA_SCADENZA_UTC).toBe(16);
    });
  });

  describe('quali regioni scaricare', () => {
    test('sono nove, e coprono Alpi e Appennini', () => {
      const id = REGIONI_EAWS.map((r) => r.id);
      expect(id).toHaveLength(9);
      expect(id).toContain('IT-32-BZ');
      expect(id).toContain('IT-MeteoMont');
    });

    /**
     * **Il rettangolo di MeteoMont copre l'Italia intera** (misurato: da 37,5 a 46,7 di
     * latitudine, isole comprese). È la ragione per cui il filtro per regione non basta e
     * il ritaglio si fa per micro-regione: senza saperlo, si scaricano 2,5 MB per
     * guardare le Dolomiti.
     */
    test('sulle Dolomiti servono le regioni alpine, e comunque anche MeteoMont', () => {
      const r = regioniPerBbox({ south: 46.3, west: 11.7, north: 46.5, east: 12.0 });
      expect(r).toContain('IT-32-BZ');
      expect(r).toContain('IT-MeteoMont');
      expect(r).not.toContain('IT-21'); // il Piemonte è lontano
    });

    test('in Sicilia non serve nessuna regione alpina', () => {
      const r = regioniPerBbox({ south: 37.7, west: 14.9, north: 37.9, east: 15.1 });
      expect(r).toEqual(['IT-MeteoMont']);
    });

    test('due rettangoli che si sfiorano contano come sovrapposti', () => {
      const a = { south: 0, west: 0, north: 1, east: 1 };
      expect(rettangoliSiToccano(a, { south: 1, west: 1, north: 2, east: 2 })).toBe(true);
      expect(rettangoliSiToccano(a, { south: 1.1, west: 0, north: 2, east: 1 })).toBe(false);
    });
  });

  describe('il rettangolo di una geometria', () => {
    test('si ricava da un poligono a qualunque livello di annidamento', () => {
      const b = bboxDiGeometria([[[[10, 45], [11, 46], [10.5, 45.5], [10, 45]]]]);
      expect(b).toEqual({ west: 10, south: 45, east: 11, north: 46 });
    });

    test('senza coordinate leggibili è null, non un rettangolo a zero', () => {
      expect(bboxDiGeometria(null)).toBeNull();
      expect(bboxDiGeometria([])).toBeNull();
      expect(bboxDiGeometria(['a', 'b'])).toBeNull();
    });
  });

  describe('la semplificazione', () => {
    /**
     * Un'area chiusa e frastagliata, come una micro-regione vera: un cerchio di circa
     * 5 km di raggio con 240 vertici e un'ondulazione sul bordo.
     *
     * La prima impalcatura era una linea quasi retta, e Douglas-Peucker la annullava —
     * giustamente, perché una linea retta *non ha* vertici intermedi che si vedano. Un
     * test che sbaglia l'impalcatura accusa il codice al posto proprio.
     */
    const anelloDenso = (): number[][] => {
      const p: number[][] = [];
      const n = 240;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 0.05 + Math.sin(a * 9) * 0.004;
        p.push([10 + Math.cos(a) * r, 45 + Math.sin(a) * r]);
      }
      p.push(p[0]);
      return p;
    };
    const vertici = (g: { coordinates: unknown }): number => {
      let n = 0;
      const guarda = (a: unknown): void => {
        if (!Array.isArray(a)) return;
        if (typeof a[0] === 'number') { n++; return; }
        a.forEach(guarda);
      };
      guarda(g.coordinates);
      return n;
    };

    test('toglie i vertici che non si vedono', () => {
      const originale = { type: 'Polygon', coordinates: [anelloDenso()] };
      const s = semplificaGeometria(originale, 0.002);
      expect(s).not.toBeNull();
      // Il bordo resta riconoscibile ma i vertici si dimezzano abbondantemente.
      expect(vertici(s!)).toBeLessThan(vertici(originale) / 3);
      expect(vertici(s!)).toBeGreaterThan(8);
    });

    test('con tolleranza minima resta quasi tutto', () => {
      const originale = { type: 'Polygon', coordinates: [anelloDenso()] };
      const s = semplificaGeometria(originale, 0.0000001);
      expect(vertici(s!)).toBeGreaterThan(vertici(originale) / 2);
    });

    /**
     * Quattro decimali sono circa 11 metri; i file veri arrivano con **quindici** cifre
     * decimali, cioè frazioni di micron — metà del peso per zero informazione.
     */
    test('arrotonda le coordinate', () => {
      const s = semplificaGeometria({
        type: 'Polygon',
        coordinates: [[[10.123456789012345, 45.987654321098765], [11, 46], [10.5, 45.5], [10.123456789012345, 45.987654321098765]]],
      }, 0);
      const primo = (s!.coordinates as number[][][])[0][0];
      expect(primo[0]).toBe(10.1235);
      expect(primo[1]).toBe(45.9877);
    });

    /**
     * Un anello che collassa sotto i quattro punti non è più un poligono: Leaflet lo
     * disegnerebbe come una linea sottile fuori posto, cioè un confine inventato.
     */
    test('un anello che collassa si butta, non si disegna storto', () => {
      const degenere = { type: 'Polygon', coordinates: [[[10, 45], [10.00001, 45], [10, 45.00001], [10, 45]]] };
      expect(semplificaGeometria(degenere, 0.01)).toBeNull();
    });

    test('tiene i multipoligoni, e scarta le parti degeneri', () => {
      const buono = [[10, 45], [11, 45], [11, 46], [10, 45]];
      const degenere = [[10, 45], [10.00001, 45], [10, 45.00001], [10, 45]];
      const s = semplificaGeometria({ type: 'MultiPolygon', coordinates: [[buono], [degenere]] }, 0.005);
      expect(s!.type).toBe('MultiPolygon');
      expect((s!.coordinates as unknown[]).length).toBe(1);
    });

    test('linee e punti non sono zone: non si semplificano affatto', () => {
      expect(semplificaGeometria({ type: 'LineString', coordinates: [[10, 45], [11, 46]] }, 0.001)).toBeNull();
      expect(semplificaGeometria({ type: 'Point', coordinates: [10, 45] }, 0.001)).toBeNull();
    });

    test('la tolleranza scende con lo zoom, e non supera il mezzo chilometro', () => {
      expect(tolleranzaPerZoom(14)).toBeLessThan(tolleranzaPerZoom(9));
      expect(tolleranzaPerZoom(2)).toBeLessThanOrEqual(0.005);
      expect(tolleranzaPerZoom(Number.NaN)).toBeGreaterThan(0);
      // A zoom 9 mezzo pixel vale circa 14 metri: abbastanza per tagliare i vertici
      // invisibili, troppo poco per spostare un confine.
      expect(tolleranzaPerZoom(9)).toBeCloseTo(0.00137, 4);
    });
  });

  describe('cosa dice il popup', () => {
    const v = (over: Partial<Valutazione> = {}): Valutazione => ({
      id: 'IT-32-BZ-01-01', pericolo: 3, am: null, pm: null, alta: null, bassa: null, ...over,
    });

    test('la differenza di quota si dice, quando c è', () => {
      expect(dettaglioQuote(v({ alta: 3, bassa: 1 })))
        .toBe('In alto 3 — Marcato, più in basso 1 — Debole');
    });

    test('se sopra e sotto è uguale non si dice niente', () => {
      expect(dettaglioQuote(v({ alta: 2, bassa: 2 }))).toBeNull();
      expect(dettaglioQuote(v())).toBeNull();
    });

    test('mattina e pomeriggio solo se differiscono davvero', () => {
      expect(dettaglioOrario(v({ am: 2, pm: 3 }))).toBe('Mattina 2 — Moderato, pomeriggio 3 — Marcato');
      expect(dettaglioOrario(v({ am: 3, pm: 3 }))).toBeNull();
      expect(dettaglioOrario(v({ am: 3, pm: null }))).toBeNull();
    });
  });

  describe('il tetto sulla vista servita', () => {
    test('una vista da telefono passa, mezzo continente no', () => {
      // A zoom 9 una vista da telefono copre meno di un grado.
      expect(vistaTroppoGrande({ south: 46.1, west: 11.3, north: 46.8, east: 12.4 })).toBe(false);
      expect(vistaTroppoGrande({ south: 35, west: 6, north: 47, east: 19 })).toBe(true);
    });

    test('il tetto è largo abbastanza da non intralciare la soglia di zoom', () => {
      expect(LATO_MASSIMO_VISTA_GRADI).toBeGreaterThanOrEqual(2);
    });
  });

  test('la soglia di zoom è quella dei ripari, per la stessa ragione', () => {
    expect(ZOOM_MINIMO_VALANGHE).toBeGreaterThanOrEqual(9);
    expect(ZOOM_MINIMO_VALANGHE).toBeLessThanOrEqual(12);
  });
});
