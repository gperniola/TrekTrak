import { useItineraryStore } from '@/stores/itineraryStore';
import { puoAnnullare, puoRifare } from '@/stores/itinerary/storia';

/**
 * TASK-19 sullo store vero: i criteri di accettazione del task, più la regola che decide
 * **cosa è un gesto** e cosa no.
 */

const store = () => useItineraryStore.getState();

beforeEach(() => {
  useItineraryStore.setState({ waypoints: [], legs: [], itineraryName: '' });
  store().azzeraStoria();
});

describe('i criteri del task', () => {
  test('aggiungere, annullare: il waypoint sparisce', () => {
    store().addWaypointAtPosition(45, 7);
    expect(store().waypoints).toHaveLength(1);
    store().annulla();
    expect(store().waypoints).toHaveLength(0);
  });

  test('cancellare, annullare: il waypoint torna', () => {
    store().addWaypointAtPosition(45, 7);
    store().addWaypointAtPosition(46, 8);
    const id = store().waypoints[0].id;
    store().removeWaypoint(id);
    expect(store().waypoints).toHaveLength(1);
    store().annulla();
    expect(store().waypoints).toHaveLength(2);
    expect(store().waypoints[0].id).toBe(id);
  });

  test('rinominare, annullare: torna il vecchio nome', () => {
    store().addWaypointAtPosition(45, 7);
    const id = store().waypoints[0].id;
    store().updateWaypoint(id, { name: 'Cima' });
    expect(store().waypoints[0].name).toBe('Cima');
    store().annulla();
    expect(store().waypoints[0].name).toBe('Waypoint 1');
  });

  test('spostare, annullare: torna la vecchia posizione', () => {
    store().addWaypointAtPosition(45, 7);
    const id = store().waypoints[0].id;
    store().updateWaypointPosition(id, 46, 8);
    expect(store().waypoints[0].lat).toBe(46);
    store().annulla();
    expect(store().waypoints[0].lat).toBe(45);
  });

  test('riordinare, annullare: torna l ordine di prima', () => {
    store().addWaypointAtPosition(45, 7);
    store().addWaypointAtPosition(46, 8);
    const primo = store().waypoints[0].id;
    store().reorderWaypoints([1, 0]);
    expect(store().waypoints[0].id).not.toBe(primo);
    store().annulla();
    expect(store().waypoints[0].id).toBe(primo);
  });

  test('rifare rimette quello che si era annullato', () => {
    store().addWaypointAtPosition(45, 7);
    store().annulla();
    store().rifai();
    expect(store().waypoints).toHaveLength(1);
  });
});

/**
 * **Cosa NON è un gesto.** Sono le due famiglie di scritture che il programma fa da sé:
 * annullarle non risponde a nessuna domanda, e riempirebbero la storia di passi che
 * nessuno ha compiuto.
 */
describe('quello che non entra nella storia', () => {
  test('i valori calcolati in Track non sono annullabili', () => {
    store().addWaypointAtPosition(45, 7);
    store().addWaypointAtPosition(46, 8);
    const passiPrima = store().storia.passi.length;
    const leg = store().legs[0];
    // come scrive `auto-fill`: e' l'app che calcola, non una persona che digita
    store().updateLeg(leg.id, { distance: 12.3, elevationGain: 400 }, { calcolata: true });
    expect(store().storia.passi.length).toBe(passiPrima);
    expect(store().legs[0].distance).toBe(12.3);
  });

  test('il giudizio della verifica non e annullabile', () => {
    store().addWaypointAtPosition(45, 7);
    store().addWaypointAtPosition(46, 8);
    const passiPrima = store().storia.passi.length;
    const leg = store().legs[0];
    store().updateLeg(leg.id, { validationState: { distance: { status: 'valid' } } as never });
    expect(store().storia.passi.length).toBe(passiPrima);
  });

  test('lo scambio Learn/Track non e annullabile: cambia la vista, non i dati', () => {
    store().addWaypointAtPosition(45, 7);
    const passiPrima = store().storia.passi.length;
    store().setAppMode('learn');
    expect(store().storia.passi.length).toBe(passiPrima);
  });

  /** Un valore scritto a mano invece SI': quello e' esattamente un gesto. */
  test('un valore scritto a mano e annullabile', () => {
    store().addWaypointAtPosition(45, 7);
    store().addWaypointAtPosition(46, 8);
    const leg = store().legs[0];
    store().updateLeg(leg.id, { distance: 3.2 });
    expect(store().legs[0].distance).toBe(3.2);
    store().annulla();
    expect(store().legs[0].distance).toBeNull();
  });
});

describe('quando la storia riparte da capo', () => {
  test('«Nuovo» azzera il passato', () => {
    store().addWaypointAtPosition(45, 7);
    expect(puoAnnullare(store().storia)).toBe(true);
    store().resetItinerary();
    expect(puoAnnullare(store().storia)).toBe(false);
  });

  test('caricare un itinerario azzera il passato', () => {
    store().addWaypointAtPosition(45, 7);
    store().loadItinerary('x', 'Altro', [
      { id: 'a', name: 'A', lat: 44, lon: 9, altitude: 100, order: 0 },
    ], []);
    expect(puoAnnullare(store().storia)).toBe(false);
    expect(store().waypoints[0].id).toBe('a');
  });

  /**
   * Il ripristino all'avvio non e' un gesto: dopo una ricarica non si deve poter
   * «annullare» fino a un itinerario vuoto che non si e' mai avuto davanti.
   */
  test('il ripristino dell autosalvataggio non lascia niente da annullare', () => {
    store().hydrateCurrent({
      itineraryId: 'i', itineraryName: 'Ripreso', createdAt: '2026-09-01T00:00:00.000Z',
      appMode: 'track',
      waypoints: [{ id: 'a', name: 'A', lat: 44, lon: 9, altitude: 100, order: 0 }],
      legs: [],
    });
    expect(puoAnnullare(store().storia)).toBe(false);
    expect(puoRifare(store().storia)).toBe(false);
  });
});

/**
 * Trovato **solo a schermo**, provando l'app: dopo aver messo un punto sulla mappa,
 * «Annulla» diceva «modifica del waypoint» e il primo colpo toglieva il NOME invece del
 * punto — perché il nome lo scrive il geocoder inverso un istante dopo, e per il mio
 * criterio un cambio di nome è un gesto.
 *
 * Nessun test poteva vederlo: nella suite il geocoder non gira. Ecco perché la regola
 * «cosa è un gesto» non si verifica solo leggendo il codice.
 */
describe('il nome messo dal geocoder', () => {
  test('non aggiunge un passo alla storia', () => {
    store().addWaypointAtPosition(45, 7);
    const passiDopoAggiunta = store().storia.passi.length;
    const id = store().waypoints[0].id;
    // come fa `MapEvents` quando la geocodifica inversa risponde
    store().updateWaypoint(id, { name: 'Colle San Paolo' }, { calcolata: true });
    expect(store().storia.passi.length).toBe(passiDopoAggiunta);
    expect(store().waypoints[0].name).toBe('Colle San Paolo');
  });

  test('un colpo solo di annulla toglie il punto, nome compreso', () => {
    store().addWaypointAtPosition(45, 7);
    const id = store().waypoints[0].id;
    store().updateWaypoint(id, { name: 'Colle San Paolo' }, { calcolata: true });
    store().annulla();
    expect(store().waypoints).toHaveLength(0);
  });
});
