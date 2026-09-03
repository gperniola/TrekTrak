import {
  BBOX_ITALIA, MAGNITUDO_MINIMA, MAX_EVENTI, ORE_FINESTRA,
  buildQuakesUrl, coloreMagnitudo, istanteEvento, parseQuakes, quandoDetto, raggioMagnitudo,
} from '@/lib/quakes-api';

/**
 * Terremoti INGV (task-51). Le due cose provate qui sono le due trappole misurate sui
 * dati veri il 2026-09-03, non la forma del parser.
 */
describe('terremoti', () => {
  describe('la richiesta', () => {
    const url = new URL(buildQuakesUrl(new Date('2026-09-03T12:00:00Z')));

    /**
     * **Il servizio è mondiale.** Senza rettangolo la prima risposta reale conteneva un
     * evento di magnitudo 6,1 nelle Isole Sandwich Australi: su una mappa dell'Appennino
     * non significa niente, e l'elenco si riempie di eventi che non riguardano nessuno.
     */
    test('chiede solo l Italia', () => {
      expect(url.searchParams.get('minlat')).toBe(String(BBOX_ITALIA.south));
      expect(url.searchParams.get('maxlat')).toBe(String(BBOX_ITALIA.north));
      expect(url.searchParams.get('minlon')).toBe(String(BBOX_ITALIA.west));
      expect(url.searchParams.get('maxlon')).toBe(String(BBOX_ITALIA.east));
    });

    test('chiede la finestra e la magnitudo dichiarate', () => {
      expect(url.searchParams.get('starttime')).toBe('2026-09-01T12:00:00');
      expect(url.searchParams.get('minmag')).toBe(String(MAGNITUDO_MINIMA));
      expect(url.searchParams.get('limit')).toBe(String(MAX_EVENTI));
      expect(ORE_FINESTRA).toBe(48);
    });

    test('nessuna chiave da gestire', () => {
      expect(url.toString()).not.toMatch(/key|token|apikey/i);
    });
  });

  /**
   * **Gli orari FDSN non hanno il fuso.** Misurato: `"2026-09-02T23:46:59.485000"`, senza
   * suffisso. Sono UTC per standard, ma `new Date()` su una stringa così la legge come ora
   * **locale**: in estate sono due ore, e sempre nella direzione di far sembrare la
   * scossa più recente di quanto sia.
   */
  describe('l orario', () => {
    test('una stringa senza fuso viene letta come UTC', () => {
      expect(istanteEvento('2026-09-02T23:46:59.485000')).toBe('2026-09-02T23:46:59.485Z');
    });

    test('una stringa che ha già il fuso non viene toccata', () => {
      expect(istanteEvento('2026-09-02T23:46:59Z')).toBe('2026-09-02T23:46:59.000Z');
      expect(istanteEvento('2026-09-02T23:46:59+02:00')).toBe('2026-09-02T21:46:59.000Z');
    });

    test('quello che non si legge resta ignoto, non diventa adesso', () => {
      expect(istanteEvento(null)).toBeNull();
      expect(istanteEvento('')).toBeNull();
      expect(istanteEvento('ieri')).toBeNull();
      expect(istanteEvento(1756800000)).toBeNull();
    });
  });

  describe('la lettura della risposta', () => {
    const evento = (over: Record<string, unknown> = {}, coord: unknown[] = [13.5, 42.4, 9.2]) => ({
      properties: {
        eventId: 47059832, time: '2026-09-03T05:10:00.000000', mag: 3.2, magType: 'ML',
        place: 'Monti della Laga', ...over,
      },
      geometry: { coordinates: coord },
    });

    test('legge magnitudo, luogo, orario e profondità', () => {
      const { quakes } = parseQuakes({ features: [evento()] });
      expect(quakes).toHaveLength(1);
      expect(quakes[0]).toMatchObject({
        id: '47059832', lat: 42.4, lon: 13.5, mag: 3.2, magType: 'ML', place: 'Monti della Laga',
      });
      // La terza coordinata è la PROFONDITÀ in km, non la quota.
      expect(quakes[0].depthKm).toBe(9.2);
      expect(quakes[0].timeISO).toBe('2026-09-03T05:10:00.000Z');
    });

    test('senza profondità la riga resta, ma non se la inventa', () => {
      const { quakes } = parseQuakes({ features: [evento({}, [13.5, 42.4])] });
      expect(quakes[0].depthKm).toBeNull();
    });

    /**
     * Una feature malformata si salta, non fa cadere il layer: un evento illeggibile non
     * deve nascondere i venti leggibili. È la stessa scelta del parser dei focolai.
     */
    test('le righe rotte si saltano, le buone restano', () => {
      const { quakes } = parseQuakes({
        features: [
          evento(),
          { properties: { mag: 2.5 } },                       // senza geometria
          evento({ mag: 'forte' }),                            // magnitudo non numerica
          evento({ time: 'ieri' }),                            // orario illeggibile
          { geometry: { coordinates: [12, 43, 5] } },           // senza properties
          evento({ eventId: 2, time: '2026-09-03T07:00:00' }),
        ],
      });
      expect(quakes.map((q) => q.id)).toEqual(['2', '47059832']);
    });

    test('dal più recente', () => {
      const { quakes } = parseQuakes({
        features: [
          evento({ eventId: 'vecchio', time: '2026-09-01T00:00:00' }),
          evento({ eventId: 'nuovo', time: '2026-09-03T00:00:00' }),
        ],
      });
      expect(quakes.map((q) => q.id)).toEqual(['nuovo', 'vecchio']);
    });

    test('col tetto pieno dichiara che ce ne sono altri', () => {
      const molti = Array.from({ length: MAX_EVENTI }, (_, i) => evento({ eventId: i }));
      expect(parseQuakes({ features: molti }).troncato).toBe(true);
      expect(parseQuakes({ features: [evento()] }).troncato).toBe(false);
    });

    test('una risposta di forma sbagliata è un errore, non un elenco vuoto', () => {
      expect(() => parseQuakes(null)).toThrow();
      expect(() => parseQuakes({})).toThrow();
      expect(() => parseQuakes({ features: 'niente' })).toThrow();
    });

    // Zero eventi è la condizione NORMALE in Italia: due giorni senza scosse sopra
    // magnitudo 2 sono frequenti, e non è un errore.
    test('zero eventi è una risposta valida', () => {
      expect(parseQuakes({ features: [] }).quakes).toEqual([]);
    });
  });

  describe('come si disegnano', () => {
    test('il colore cambia sulle soglie degli effetti', () => {
      expect(coloreMagnitudo(2.9)).toBe(coloreMagnitudo(1));
      expect(coloreMagnitudo(3)).not.toBe(coloreMagnitudo(2.9));
      expect(coloreMagnitudo(4)).not.toBe(coloreMagnitudo(3));
      expect(coloreMagnitudo(5.5)).toBe(coloreMagnitudo(5));
    });

    test('una magnitudo che non si sa non diventa un cerchio grande e rosso', () => {
      expect(coloreMagnitudo(Number.NaN)).toBe('#9ca3af');
      expect(raggioMagnitudo(Number.NaN)).toBeLessThan(raggioMagnitudo(5));
    });

    test('il raggio cresce ma resta dentro limiti visibili', () => {
      expect(raggioMagnitudo(1)).toBeGreaterThanOrEqual(5);
      expect(raggioMagnitudo(7)).toBeLessThanOrEqual(22);
      expect(raggioMagnitudo(5)).toBeGreaterThan(raggioMagnitudo(3));
    });
  });

  describe('da quanto è successo', () => {
    const adesso = new Date('2026-09-03T12:00:00Z');
    test('minuti, ore e giorni, al singolare quando è uno', () => {
      expect(quandoDetto('2026-09-03T11:30:00Z', adesso)).toBe('30 min fa');
      expect(quandoDetto('2026-09-03T11:00:00Z', adesso)).toBe('1 ora fa');
      expect(quandoDetto('2026-09-03T06:00:00Z', adesso)).toBe('6 ore fa');
      expect(quandoDetto('2026-09-02T11:00:00Z', adesso)).toBe('1 giorno fa');
    });

    test('un orario illeggibile lo dichiara', () => {
      expect(quandoDetto('ieri', adesso)).toBe('orario non noto');
    });

    // Le revisioni INGV possono arrivare con un orario di pochi secondi nel futuro
    // rispetto all'orologio locale: "-1 min fa" sarebbe assurdo.
    test('un orario nel futuro non diventa negativo', () => {
      expect(quandoDetto('2026-09-03T12:01:00Z', adesso)).toBe('appena registrato');
    });
  });
});
