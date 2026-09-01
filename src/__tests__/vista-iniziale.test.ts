import {
  MAX_ZOOM_INQUADRAMENTO,
  VICINANZA_KM,
  distanzaDalRettangoloKm,
  seguireLaPosizione,
  vistaIniziale,
} from '@/lib/vista-iniziale';

/**
 * Cosa deve guardare la mappa quando si apre (task-61).
 *
 * Il difetto di partenza: si scaricavano le mattonelle del proprio itinerario e poi,
 * riaprendo l'app, la mappa mostrava il centro predefinito. Chi ha il GPS acceso non se
 * ne accorge — è sul percorso, la mappa lo segue — ma chi apre l'app **senza segnale e
 * senza posizione**, che è esattamente la situazione per cui esiste il pre-caricamento,
 * si trovava altrove e doveva cercare il proprio percorso trascinando la mappa a mano.
 *
 * Qui stanno le sole decisioni, senza Leaflet: quale vista vince all'apertura, e se
 * seguire la posizione quando il fix GPS arriva.
 */

const GRAN_SASSO = { south: 42.44, north: 42.50, west: 13.54, east: 13.60 };

describe('quale vista vince all apertura', () => {
  const salvata = { lat: 41.9, lng: 12.5, z: 15 };

  /**
   * La vista salvata è la promessa che l'app già faceva: dentro una sessione, un remount
   * o una ricarica non devono spostare la mappa da dove la si stava guardando. Un
   * itinerario ripristinato non è una buona ragione per rompere quella promessa — se sei
   * lì, ci sei andato apposta.
   */
  test('una vista salvata in questa sessione batte tutto', () => {
    expect(vistaIniziale(salvata, GRAN_SASSO)).toEqual({ tipo: 'salvata', vista: salvata });
  });

  test('senza vista salvata, si inquadra l itinerario', () => {
    expect(vistaIniziale(null, GRAN_SASSO)).toEqual({ tipo: 'itinerario', rettangolo: GRAN_SASSO });
  });

  test('senza niente, resta il centro predefinito', () => {
    expect(vistaIniziale(null, null)).toEqual({ tipo: 'predefinita' });
  });
});

describe('quanto dista un punto da un rettangolo', () => {
  test('dentro vale zero, non un numero piccolo', () => {
    expect(distanzaDalRettangoloKm({ lat: 42.47, lon: 13.57 }, GRAN_SASSO)).toBe(0);
  });

  test('sul bordo vale zero', () => {
    expect(distanzaDalRettangoloKm({ lat: 42.44, lon: 13.57 }, GRAN_SASSO)).toBe(0);
  });

  test('a nord, la distanza e solo in latitudine', () => {
    // 0,09 gradi di latitudine ≈ 9,95 km
    const d = distanzaDalRettangoloKm({ lat: 42.59, lon: 13.57 }, GRAN_SASSO);
    expect(d).toBeCloseTo(9.95, 1);
  });

  /**
   * In longitudine un grado vale meno di un grado in latitudine, e quanto meno dipende
   * dalla latitudine. Ignorarlo, a 42°, gonfierebbe la distanza di un terzo.
   */
  test('a est, la distanza tiene conto del coseno della latitudine', () => {
    const d = distanzaDalRettangoloKm({ lat: 42.47, lon: 13.70 }, GRAN_SASSO);
    // 0,10 gradi × 111,32 × cos(42,47°) ≈ 8,21 km
    expect(d).toBeCloseTo(8.21, 1);
    // e deve essere sensibilmente MENO dei 11,1 km che darebbe senza coseno
    expect(d).toBeLessThan(10);
  });

  test('in diagonale si compongono i due lati', () => {
    const d = distanzaDalRettangoloKm({ lat: 42.59, lon: 13.70 }, GRAN_SASSO);
    expect(d).toBeCloseTo(Math.hypot(9.95, 8.21), 0);
  });

  test('Roma dal Gran Sasso e lontana come ci si aspetta', () => {
    const d = distanzaDalRettangoloKm({ lat: 41.9, lon: 12.5 }, GRAN_SASSO);
    expect(d).toBeGreaterThan(90);
  });
});

describe('se seguire la posizione quando arriva', () => {
  const daItinerario = { tipo: 'itinerario', rettangolo: GRAN_SASSO } as const;

  /**
   * Il caso che ha motivato la regola: si prepara la gita **da casa**. La mappa inquadra
   * l'itinerario, poi arriva il GPS e dice «Roma». Seguirlo vorrebbe dire sbalzare via
   * dal percorso proprio la persona che lo sta guardando.
   */
  test('da casa, lontano dal percorso, non si segue', () => {
    expect(seguireLaPosizione({
      posizione: { lat: 41.9, lon: 12.5 },
      partenza: daItinerario,
      utenteHaMosso: false,
    })).toBe(false);
  });

  test('al punto di partenza del sentiero, si segue', () => {
    expect(seguireLaPosizione({
      posizione: { lat: 42.47, lon: 13.57 },
      partenza: daItinerario,
      utenteHaMosso: false,
    })).toBe(true);
  });

  test('poco fuori dal rettangolo si segue lo stesso: il parcheggio non e sul sentiero', () => {
    // ~3 km a nord del bordo, dentro la soglia di vicinanza
    expect(seguireLaPosizione({
      posizione: { lat: 42.527, lon: 13.57 },
      partenza: daItinerario,
      utenteHaMosso: false,
    })).toBe(true);
  });

  test('oltre la soglia non si segue piu', () => {
    expect(seguireLaPosizione({
      posizione: { lat: 42.70, lon: 13.57 },
      partenza: daItinerario,
      utenteHaMosso: false,
    })).toBe(false);
  });

  /** Senza itinerario il comportamento e quello di sempre: il GPS comanda. */
  test('senza itinerario si segue, come ha sempre fatto', () => {
    expect(seguireLaPosizione({
      posizione: { lat: 41.9, lon: 12.5 },
      partenza: { tipo: 'predefinita' },
      utenteHaMosso: false,
    })).toBe(true);
  });

  /**
   * Chi ha gia' toccato la mappa ha detto dove vuole guardare. E' una garanzia che
   * l'app dava gia' prima di questo lavoro e non va persa.
   */
  test('se l utente ha gia mosso la mappa, non si segue mai', () => {
    for (const partenza of [daItinerario, { tipo: 'predefinita' } as const]) {
      expect(seguireLaPosizione({
        posizione: { lat: 42.47, lon: 13.57 },
        partenza,
        utenteHaMosso: true,
      })).toBe(false);
    }
  });

  test('da una vista salvata non ci si sposta', () => {
    expect(seguireLaPosizione({
      posizione: { lat: 42.47, lon: 13.57 },
      partenza: { tipo: 'salvata', vista: { lat: 42.47, lng: 13.57, z: 14 } },
      utenteHaMosso: false,
    })).toBe(false);
  });
});

describe('i numeri della decisione', () => {
  test('la soglia di vicinanza e dell ordine dei chilometri a piedi', () => {
    expect(VICINANZA_KM).toBeGreaterThanOrEqual(2);
    expect(VICINANZA_KM).toBeLessThanOrEqual(15);
  });

  /**
   * Un itinerario con un waypoint solo da' un rettangolo di dimensione zero, e
   * `fitBounds` su un rettangolo nullo porta Leaflet allo zoom massimo: si aprirebbe
   * l'app incollati a un tetto. Il tetto allo zoom serve a evitarlo.
   */
  test('l inquadramento non arriva mai allo zoom massimo della mappa', () => {
    expect(MAX_ZOOM_INQUADRAMENTO).toBeLessThan(19);
    expect(MAX_ZOOM_INQUADRAMENTO).toBeGreaterThanOrEqual(13);
  });
});
