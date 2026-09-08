import { describe, expect, test, beforeEach } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { AppMode, Waypoint } from '@/lib/types';

/**
 * **Le pause e il passo nello store.**
 *
 * La pausa è un gesto della persona (entra in annulla/rifai); il cambio di passo è un
 * ricalcolo dell'app che deve toccare TUTTE le tratte (non solo quelle future) e non
 * cancellare i giudizi di verifica.
 */

const wp = (i: number, over: Partial<Waypoint> = {}): Waypoint => ({
  id: `w${i}`, name: `P${i}`, lat: 42.1 + i / 100, lon: 14.1 + i / 100,
  altitude: 1000 + i * 100, order: i, ...over,
});

beforeEach(() => {
  useItineraryStore.setState({
    itineraryId: 'test', itineraryName: '', waypoints: [], legs: [], appMode: 'learn' as AppMode,
    settings: {
      tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 },
      mapDisplay: { coloredPath: false, trailRouting: false, sampleInterval: 50, baseMap: 'osm', showHikingTrails: false, showCoordinateGrid: false, emergencyLayers: [] },
      pace: { factor: 1 },
    },
  });
  useItineraryStore.getState().azzeraStoria();
});

describe('impostaPausaWaypoint', () => {
  test('imposta i minuti sul waypoint', () => {
    useItineraryStore.setState({ waypoints: [wp(0), wp(1)] });
    useItineraryStore.getState().impostaPausaWaypoint('w1', 30);
    expect(useItineraryStore.getState().waypoints[1].pausaMin).toBe(30);
  });

  test('zero o negativo azzera (undefined, non 0)', () => {
    useItineraryStore.setState({ waypoints: [wp(0, { pausaMin: 30 })] });
    useItineraryStore.getState().impostaPausaWaypoint('w0', 0);
    expect(useItineraryStore.getState().waypoints[0].pausaMin).toBeUndefined();
  });

  test('è un gesto: si annulla', () => {
    useItineraryStore.setState({ waypoints: [wp(0)] });
    useItineraryStore.getState().azzeraStoria();
    useItineraryStore.getState().impostaPausaWaypoint('w0', 45);
    expect(useItineraryStore.getState().waypoints[0].pausaMin).toBe(45);
    useItineraryStore.getState().annulla();
    expect(useItineraryStore.getState().waypoints[0].pausaMin).toBeUndefined();
  });

  test('taglia le pause assurde al tetto di 24 ore', () => {
    useItineraryStore.setState({ waypoints: [wp(0)] });
    useItineraryStore.getState().impostaPausaWaypoint('w0', 99999);
    expect(useItineraryStore.getState().waypoints[0].pausaMin).toBe(24 * 60);
  });
});

describe('applicaPasso', () => {
  const legConDati = () => ({
    id: 'l0', fromWaypointId: 'w0', toWaypointId: 'w1',
    distance: 4, elevationGain: 400, elevationLoss: 0, azimuth: 90,
    estimatedTime: 60, slope: 10,
  });

  test('ricalcola i tempi di TUTTE le tratte, non solo le future', () => {
    useItineraryStore.setState({ waypoints: [wp(0), wp(1)], legs: [legConDati()] });
    const prima = useItineraryStore.getState().legs[0].estimatedTime!;
    useItineraryStore.getState().applicaPasso(1.5);
    const dopo = useItineraryStore.getState().legs[0].estimatedTime!;
    expect(dopo).toBeGreaterThan(prima);           // passo più lento = più tempo
    expect(useItineraryStore.getState().settings.pace?.factor).toBe(1.5);
  });

  test('conserva i giudizi di verifica (cambia solo i derivati)', () => {
    const giudizio = { status: 'valid' as const, userValue: 4, tolerance: { strict: 10, loose: 20 } };
    useItineraryStore.setState({
      waypoints: [wp(0), wp(1)],
      legs: [{ ...legConDati(), validationState: { distance: giudizio } }],
    });
    useItineraryStore.getState().applicaPasso(0.8);
    expect(useItineraryStore.getState().legs[0].validationState?.distance).toEqual(giudizio);
  });

  test('un fattore assurdo ripiega su 1', () => {
    useItineraryStore.setState({ waypoints: [wp(0), wp(1)], legs: [legConDati()] });
    useItineraryStore.getState().applicaPasso(0);
    expect(useItineraryStore.getState().settings.pace?.factor).toBe(1);
  });
});

describe('il ritorno non porta le pause', () => {
  test('aggiungiRitorno non copia pausaMin sui punti specchiati', () => {
    useItineraryStore.setState({
      waypoints: [wp(0, { pausaMin: 30 }), wp(1, { pausaMin: 15 }), wp(2)],
      legs: [
        { id: 'l0', fromWaypointId: 'w0', toWaypointId: 'w1', distance: 1, elevationGain: 0, elevationLoss: 0, azimuth: 0 },
        { id: 'l1', fromWaypointId: 'w1', toWaypointId: 'w2', distance: 1, elevationGain: 0, elevationLoss: 0, azimuth: 0 },
      ],
    });
    useItineraryStore.getState().aggiungiRitorno();
    const wps = useItineraryStore.getState().waypoints;
    expect(wps).toHaveLength(5); // P0 P1 P2 P1' P0'
    // andata: pause conservate
    expect(wps[0].pausaMin).toBe(30);
    expect(wps[1].pausaMin).toBe(15);
    // ritorno: nessuna pausa
    expect(wps[3].pausaMin).toBeUndefined();
    expect(wps[4].pausaMin).toBeUndefined();
  });
});
