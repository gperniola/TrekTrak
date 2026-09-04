import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import type { Leg, ValidationResult, ValidationSession, Waypoint } from '@/lib/types';

jest.mock('@/lib/elevation-api', () => ({
  fetchElevation: jest.fn(),
  fetchElevationProfile: jest.fn(),
}));
jest.mock('@/lib/routing-api', () => ({ fetchTrailRoute: jest.fn() }));

import { useItineraryStore } from '@/stores/itineraryStore';
import { fetchElevation, fetchElevationProfile } from '@/lib/elevation-api';
import { fetchTrailRoute } from '@/lib/routing-api';
import { miglioramento, raccogliEsiti, verificaItinerario } from '@/lib/verifica-itinerario';

/**
 * **La verifica dell'itinerario.**
 *
 * Duecento righe che stavano dentro `ActionBar` — un pannello di pulsanti — e non avevano
 * **nessun test**: l'unica cosa provata era che il pulsante «Verifica» comparisse. È il
 * cuore del profilo Imparo, cioè la ragione per cui questa app esiste, e nessuno
 * controllava che giudicasse giusto.
 *
 * Non era pigrizia di chi ha scritto i test: dentro un componente quella logica non si
 * poteva chiamare senza montare mezza interfaccia e aspettare dei timer. È il motivo per
 * cui è stata portata fuori, e questi sono i test che prima non si potevano scrivere.
 */

const quote = fetchElevation as jest.MockedFunction<typeof fetchElevation>;
const profilo = fetchElevationProfile as jest.MockedFunction<typeof fetchElevationProfile>;
const sentieri = fetchTrailRoute as jest.MockedFunction<typeof fetchTrailRoute>;

const sempre = () => false;

/** Due punti sulla Majella a poco meno di un chilometro d'aria l'uno dall'altro. */
const A: Waypoint = { id: 'a', name: 'A', lat: 42.10, lon: 14.10, altitude: null, order: 0 };
const B: Waypoint = { id: 'b', name: 'B', lat: 42.11, lon: 14.10, altitude: null, order: 1 };

const tratta = (dati: Partial<Leg> = {}): Leg => ({
  id: 'l1', fromWaypointId: 'a', toWaypointId: 'b',
  distance: null, elevationGain: null, elevationLoss: null, azimuth: null,
  ...dati,
});

function semina(waypoints: Waypoint[], legs: Leg[]) {
  useItineraryStore.setState({ waypoints, legs });
}

beforeEach(() => {
  jest.clearAllMocks();
  sentieri.mockResolvedValue(null);
  quote.mockResolvedValue(1500);
  profilo.mockResolvedValue([1500, 1550, 1600]);
  useItineraryStore.setState({
    waypoints: [], legs: [],
    settings: {
      tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
      mapDisplay: {
        coloredPath: false, trailRouting: false, sampleInterval: 50, baseMap: 'osm',
        showHikingTrails: false, showCoordinateGrid: false, emergencyLayers: [],
      },
    },
  });
});

describe('verificaItinerario: dove l utente ha scritto, si giudica', () => {
  test('una distanza vicina al vero e valida', async () => {
    // La distanza d'aria fra A e B e' ~1,11 km: scrivere 1,1 e' dentro il 10%.
    semina([A, B], [tratta({ distance: 1.1 })]);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(useItineraryStore.getState().legs[0].validationState?.distance?.status).toBe('valid');
  });

  test('una distanza sbagliata di molto e un errore', async () => {
    semina([A, B], [tratta({ distance: 5 })]);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(useItineraryStore.getState().legs[0].validationState?.distance?.status).toBe('error');
  });

  test('l azimut fra due punti uno a nord dell altro e zero gradi', async () => {
    semina([A, B], [tratta({ azimuth: 2 })]);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    // B sta esattamente a nord di A: 0 gradi, e 2 e' dentro la tolleranza di 5.
    expect(useItineraryStore.getState().legs[0].validationState?.azimuth?.status).toBe('valid');
  });

  test('una quota vicina al vero e valida, una lontana no', async () => {
    quote.mockResolvedValue(1500);
    semina([{ ...A, altitude: 1520 }, { ...B, altitude: 900 }], []);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    const dopo = useItineraryStore.getState().waypoints;
    expect(dopo[0].validationState?.altitude?.status).toBe('valid');
    expect(dopo[1].validationState?.altitude?.status).toBe('error');
  });
});

describe('verificaItinerario: dove l utente NON ha scritto, si compila', () => {
  test('la distanza mancante viene calcolata, non giudicata', async () => {
    semina([A, B], [tratta()]);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    const l = useItineraryStore.getState().legs[0];
    expect(l.distance).toBeCloseTo(1.111, 2);
    expect(l.validationState?.distance).toBeUndefined();
  });

  test('la quota mancante viene compilata dal servizio', async () => {
    quote.mockResolvedValue(1847);
    semina([{ ...A, altitude: null }], []);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(useItineraryStore.getState().waypoints[0].altitude).toBe(1847);
  });
});

describe('verificaItinerario: quando il terreno non risponde', () => {
  /**
   * **Il caso che conta piu' di tutti.** Se il servizio delle quote tace, distanza e azimut
   * sono comunque validati e quota e dislivelli no: presentare quel risultato come «tutto
   * a posto» insegnerebbe che i conti tornavano quando nessuno li ha fatti.
   */
  test('lo dichiara, invece di far finta', async () => {
    profilo.mockResolvedValue([null, null, null]);
    semina([A, B], [tratta({ distance: 1.1, elevationGain: 100 })]);
    const { servizioQuote } = await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(servizioQuote).toBe(false);
    // ...ma la distanza e' stata giudicata comunque.
    expect(useItineraryStore.getState().legs[0].validationState?.distance?.status).toBe('valid');
    expect(useItineraryStore.getState().legs[0].validationState?.elevationGain).toBeUndefined();
  });

  test('con tutto a posto dichiara che il servizio c era', async () => {
    semina([A, B], [tratta({ distance: 1.1 })]);
    const { servizioQuote } = await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(servizioQuote).toBe(true);
  });

  test('una quota che il servizio non sa non diventa zero', async () => {
    quote.mockResolvedValue(null);
    semina([{ ...A, altitude: null }], []);
    const { servizioQuote } = await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(servizioQuote).toBe(false);
    expect(useItineraryStore.getState().waypoints[0].altitude).toBeNull();
  });
});

describe('verificaItinerario: annullata', () => {
  /**
   * Se il pannello si chiude o parte una verifica nuova, questa deve **smettere di
   * scrivere**: i suoi risultati sarebbero vecchi sopra quelli nuovi.
   */
  test('non scrive niente se e annullata dall inizio', async () => {
    semina([A, B], [tratta({ distance: 5 })]);
    await verificaItinerario({
      annullata: () => true,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(useItineraryStore.getState().legs[0].validationState?.distance).toBeUndefined();
    expect(profilo).not.toHaveBeenCalled();
  });

  /**
   * **Annullata non vuol dire solo «non scrivere»: vuol dire non chiedere.** Una verifica
   * abbandonata che continua a interrogare il servizio dei sentieri spende la banda di
   * qualcun altro per un risultato che nessuno leggera'. (Questo test e' nato da una
   * mutazione sopravvissuta: togliendo il primo `break` del ciclo delle tratte, tutti gli
   * altri restavano verdi, perche' il controllo successivo bastava a non far scrivere.)
   */
  test('non interroga nemmeno i sentieri, se e annullata dall inizio', async () => {
    useItineraryStore.setState({
      settings: {
        ...useItineraryStore.getState().settings,
        mapDisplay: { ...useItineraryStore.getState().settings.mapDisplay, trailRouting: true },
      },
    });
    semina([A, B], [tratta({ distance: 5 })]);
    await verificaItinerario({
      annullata: () => true,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(sentieri).not.toHaveBeenCalled();
  });

  test('non chiede le quote dei waypoint se viene annullata a meta', async () => {
    let giri = 0;
    semina([A, B], [tratta({ distance: 1.1 })]);
    await verificaItinerario({
      annullata: () => ++giri > 1,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    expect(quote).not.toHaveBeenCalled();
  });
});

describe('verificaItinerario: coi sentieri accesi', () => {
  test('distanza e dislivelli arrivano dal servizio dei sentieri, non dall aria', async () => {
    useItineraryStore.setState({
      settings: {
        ...useItineraryStore.getState().settings,
        mapDisplay: { ...useItineraryStore.getState().settings.mapDisplay, trailRouting: true },
      },
    });
    sentieri.mockResolvedValue({
      geometry: [], distanceKm: 2.5, ascent: 300, descent: 40,
      fromElevation: 1200, toElevation: 1460, elevationProfile: [],
    });
    semina([A, B], [tratta()]);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    const l = useItineraryStore.getState().legs[0];
    // 2,5 km per il sentiero contro 1,11 in linea d'aria: il sentiero gira.
    expect(l.distance).toBe(2.5);
    expect(l.elevationGain).toBe(300);
    expect(l.elevationLoss).toBe(40);
    expect(profilo).not.toHaveBeenCalled();
  });

  test('le quote degli estremi arrivano dal sentiero, senza una chiamata in piu', async () => {
    useItineraryStore.setState({
      settings: {
        ...useItineraryStore.getState().settings,
        mapDisplay: { ...useItineraryStore.getState().settings.mapDisplay, trailRouting: true },
      },
    });
    sentieri.mockResolvedValue({
      geometry: [], distanceKm: 2.5, ascent: 300, descent: 40,
      fromElevation: 1200, toElevation: 1460, elevationProfile: [],
    });
    semina([{ ...A, altitude: null }, { ...B, altitude: null }], [tratta()]);
    await verificaItinerario({
      annullata: sempre,
      updateLeg: useItineraryStore.getState().updateLeg,
      updateWaypoint: useItineraryStore.getState().updateWaypoint,
    });
    const dopo = useItineraryStore.getState().waypoints;
    expect(dopo[0].altitude).toBe(1200);
    expect(dopo[1].altitude).toBe(1460);
    expect(quote).not.toHaveBeenCalled();
  });
});

describe('raccogliEsiti', () => {
  const TOLLERANZA = { strict: 10, loose: 20 };
  const giudizio = (status: 'valid' | 'warning' | 'error'): ValidationResult =>
    ({ status, userValue: 100, realValue: 101, delta: 1, tolerance: TOLLERANZA });

  test('conta i tre stati separatamente', () => {
    const { validi, avvisi, errori, esiti } = raccogliEsiti(
      [{ ...A, validationState: { altitude: giudizio('valid') } }],
      [tratta({ validationState: {
        distance: giudizio('warning'),
        elevationGain: giudizio('error'),
        azimuth: giudizio('valid'),
      } })],
    );
    expect({ validi, avvisi, errori }).toEqual({ validi: 2, avvisi: 1, errori: 1 });
    expect(esiti).toHaveLength(4);
  });

  /** Un campo che l'utente non ha compilato non e' un errore: falserebbe la percentuale. */
  test('salta gli unverified', () => {
    const { esiti, errori } = raccogliEsiti(
      [{ ...A, validationState: { altitude: { status: 'unverified', userValue: 0, tolerance: TOLLERANZA } } }],
      [tratta({ validationState: { distance: { status: 'unverified', userValue: 0, tolerance: TOLLERANZA } } })],
    );
    expect(esiti).toEqual([]);
    expect(errori).toBe(0);
  });

  test('un itinerario senza giudizi non produce esiti', () => {
    expect(raccogliEsiti([A, B], [tratta()]).esiti).toEqual([]);
  });

  test('nomina il campo, cosi il diario sa di cosa parla', () => {
    const { esiti } = raccogliEsiti([], [tratta({ validationState: { elevationLoss: giudizio('valid') } })]);
    expect(esiti[0].field).toBe('elevationLoss');
  });
});

describe('miglioramento', () => {
  const sessione = (validi: number, totali: number): ValidationSession => ({
    date: '2026-09-01T10:00:00Z',
    itineraryName: 'prima',
    results: Array.from({ length: totali }, (_, i) => ({
      field: 'distance' as const,
      status: (i < validi ? 'valid' : 'error') as 'valid' | 'error',
      delta: 0,
      tolerance: { strict: 10, loose: 20 },
    })),
  });

  test('senza un prima non dice niente', () => {
    expect(miglioramento(5, 10, [])).toBeUndefined();
  });

  test('senza esiti non dice niente', () => {
    expect(miglioramento(0, 0, [sessione(5, 10)])).toBeUndefined();
  });

  /** Fra il 75% e il 78% non e' successo niente: festeggiare il rumore costa credibilita'. */
  test('sotto i cinque punti tace', () => {
    expect(miglioramento(78, 100, [sessione(75, 100)])).toBeUndefined();
  });

  test('a cinque punti esatti parla', () => {
    expect(miglioramento(80, 100, [sessione(75, 100)])).toBe(5);
  });

  test('un salto in avanti si dice, col segno', () => {
    expect(miglioramento(9, 10, [sessione(5, 10)])).toBe(40);
  });

  test('e un passo indietro pure', () => {
    expect(miglioramento(4, 10, [sessione(9, 10)])).toBe(-50);
  });

  test('confronta con l ULTIMA sessione, non con la prima', () => {
    expect(miglioramento(9, 10, [sessione(1, 10), sessione(8, 10)])).toBe(10);
  });

  test('una sessione precedente vuota conta come zero per cento', () => {
    expect(miglioramento(9, 10, [sessione(0, 0)])).toBe(90);
  });
});
