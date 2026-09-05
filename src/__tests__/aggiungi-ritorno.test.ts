import { describe, expect, test, beforeEach } from '@jest/globals';
import { useItineraryStore } from '../stores/itineraryStore';
import type { AppMode, Waypoint } from '../lib/types';

/**
 * **Il percorso di ritorno, in un gesto.**
 *
 * La maggior parte delle escursioni torna per la stessa strada, e fin qui l'unico modo di
 * dirlo all'app era rimettere a mano ogni punto in ordine inverso. `aggiungiRitorno`
 * specchia l'andata: un waypoint nuovo per ogni punto, escluso l'ultimo — dove ci si gira.
 */

const wp = (i: number, nome = `P${i}`): Waypoint => ({
  id: `w${i}`,
  name: nome,
  lat: 42.1 + i / 100,
  lon: 14.1 + i / 100,
  altitude: 1000 + i * 100,
  order: i,
});

function semina(...punti: Waypoint[]) {
  useItineraryStore.setState({ waypoints: punti });
  // Le tratte le ricostruisce lo store come per i punti veri: qui bastano vuote in catena.
  useItineraryStore.setState({
    legs: punti.slice(0, -1).map((p, i) => ({
      id: `l${i}`, fromWaypointId: p.id, toWaypointId: punti[i + 1].id,
      distance: null, elevationGain: null, elevationLoss: null, azimuth: null,
    })),
  });
  useItineraryStore.getState().azzeraStoria();
}

beforeEach(() => {
  useItineraryStore.setState({
    itineraryId: 'test-id', itineraryName: '', waypoints: [], legs: [],
    appMode: 'learn' as AppMode,
  });
});

describe('aggiungiRitorno', () => {
  test('A-B-C diventa A-B-C-B-A', () => {
    semina(wp(0), wp(1), wp(2));
    useItineraryStore.getState().aggiungiRitorno();
    const dopo = useItineraryStore.getState().waypoints;
    expect(dopo.map((w) => w.name)).toEqual(['P0', 'P1', 'P2', 'P1', 'P0']);
  });

  /** L'ultimo punto non si duplica: e' il posto dove ci si gira, non un passaggio doppio. */
  test('l ultimo punto dell andata non si ripete', () => {
    semina(wp(0), wp(1), wp(2));
    useItineraryStore.getState().aggiungiRitorno();
    const nomi = useItineraryStore.getState().waypoints.map((w) => w.name);
    expect(nomi.filter((n) => n === 'P2')).toHaveLength(1);
  });

  test('coordinate e quote si copiano: sono proprieta del luogo', () => {
    semina(wp(0), wp(1));
    useItineraryStore.getState().aggiungiRitorno();
    const [a, , aRitorno] = useItineraryStore.getState().waypoints;
    expect(aRitorno.lat).toBe(a.lat);
    expect(aRitorno.lon).toBe(a.lon);
    expect(aRitorno.altitude).toBe(a.altitude);
  });

  /**
   * Ogni copia e' un waypoint NUOVO: rinominarlo o spostarlo al ritorno non deve toccare
   * l'andata — nel percorso ci si passa due volte, ma sono due passaggi.
   */
  test('le copie hanno id nuovi', () => {
    semina(wp(0), wp(1), wp(2));
    useItineraryStore.getState().aggiungiRitorno();
    const ids = useItineraryStore.getState().waypoints.map((w) => w.id);
    expect(new Set(ids).size).toBe(5);
  });

  test('gli order restano progressivi', () => {
    semina(wp(0), wp(1), wp(2));
    useItineraryStore.getState().aggiungiRitorno();
    expect(useItineraryStore.getState().waypoints.map((w) => w.order)).toEqual([0, 1, 2, 3, 4]);
  });

  test('le tratte nuove sono in catena, e nascono vuote', () => {
    semina(wp(0), wp(1), wp(2));
    useItineraryStore.getState().aggiungiRitorno();
    const { waypoints, legs } = useItineraryStore.getState();
    expect(legs).toHaveLength(4);
    for (let i = 0; i < legs.length; i++) {
      expect(legs[i].fromWaypointId).toBe(waypoints[i].id);
      expect(legs[i].toWaypointId).toBe(waypoints[i + 1].id);
    }
    // In Imparo i valori li scrive l'utente: le tratte del ritorno non arrivano compilate.
    expect(legs[2].distance).toBeNull();
    expect(legs[3].distance).toBeNull();
  });

  /** «Annulla» toglie tutto il ritorno in un colpo, non un punto per volta. */
  test('un solo passo di annulla toglie tutto il ritorno', () => {
    semina(wp(0), wp(1), wp(2));
    useItineraryStore.getState().aggiungiRitorno();
    expect(useItineraryStore.getState().waypoints).toHaveLength(5);
    useItineraryStore.getState().annulla();
    expect(useItineraryStore.getState().waypoints.map((w) => w.name)).toEqual(['P0', 'P1', 'P2']);
    expect(useItineraryStore.getState().legs).toHaveLength(2);
  });

  test('con meno di due punti non fa niente', () => {
    semina(wp(0));
    useItineraryStore.getState().aggiungiRitorno();
    expect(useItineraryStore.getState().waypoints).toHaveLength(1);
  });

  /**
   * Sopra il tetto dei 50 non parte affatto: un ritorno che si ferma a meta' strada
   * senza dirlo sarebbe un percorso che mente.
   */
  test('se supererebbe i 50 waypoint, non aggiunge nemmeno il primo', () => {
    semina(...Array.from({ length: 26 }, (_, i) => wp(i)));
    useItineraryStore.getState().aggiungiRitorno();
    expect(useItineraryStore.getState().waypoints).toHaveLength(26);
  });

  test('a 25 punti il ritorno ci sta esatto: 49', () => {
    semina(...Array.from({ length: 25 }, (_, i) => wp(i)));
    useItineraryStore.getState().aggiungiRitorno();
    expect(useItineraryStore.getState().waypoints).toHaveLength(49);
  });

  /** I giudizi della verifica non si copiano: il ritorno non e' mai stato verificato. */
  test('la validazione dell andata non si copia sul ritorno', () => {
    const conGiudizio: Waypoint = {
      ...wp(0),
      validationState: { altitude: { status: 'valid', userValue: 1000, tolerance: { strict: 50, loose: 100 } } },
    };
    semina(conGiudizio, wp(1));
    useItineraryStore.getState().aggiungiRitorno();
    const copia = useItineraryStore.getState().waypoints[2];
    expect(copia.name).toBe('P0');
    expect(copia.validationState).toBeUndefined();
  });
});
