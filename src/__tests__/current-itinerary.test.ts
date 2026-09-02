import { saveCurrent, loadCurrent, clearCurrent, CURRENT_KEY } from '@/lib/current-itinerary';
import type { Waypoint, Leg, AppMode } from '@/lib/types';

const wp = (id: string, alt: number | null = 2000): Waypoint => ({
  id, name: `WP ${id}`, lat: 46.4, lon: 11.8, altitude: alt, order: 0,
});

const leg = (id: string): Leg => ({
  id, fromWaypointId: 'a', toWaypointId: 'b', distance: 1.5, azimuth: 137,
  elevationGain: 200, elevationLoss: 50,
});

const stato = (over: Partial<Parameters<typeof saveCurrent>[0]> = {}) => ({
  itineraryId: 'it1',
  itineraryName: 'Giro del Sassolungo',
  createdAt: '2026-08-27T08:00:00.000Z',
  appMode: 'learn' as AppMode,
  waypoints: [wp('w1'), wp('w2')],
  legs: [leg('l1')],
  ...over,
});

beforeEach(() => localStorage.clear());

/**
 * Il difetto che questo modulo chiude: l'itinerario in lavorazione viveva solo in
 * memoria. Una ricarica — proprio quella che l'avviso di aggiornamento della PWA
 * invita a fare — lo cancellava, e chi non è nella libreria condivisa non aveva
 * nessun modo di salvarlo.
 */
describe('autosalvataggio dell\'itinerario in lavorazione', () => {
  test('salva e rilegge waypoint, tratte, nome e modalità', () => {
    saveCurrent(stato());
    const letto = loadCurrent();
    expect(letto?.itineraryName).toBe('Giro del Sassolungo');
    expect(letto?.appMode).toBe('learn');
    expect(letto?.waypoints.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(letto?.legs[0].distance).toBe(1.5);
    expect(letto?.itineraryId).toBe('it1');
    expect(letto?.createdAt).toBe('2026-08-27T08:00:00.000Z');
  });

  test('senza nulla salvato restituisce null', () => {
    expect(loadCurrent()).toBeNull();
  });

  // Un itinerario vuoto non è lavoro da conservare: non si scrive.
  test('un itinerario senza waypoint non viene conservato', () => {
    saveCurrent(stato({ waypoints: [], legs: [] }));
    expect(loadCurrent()).toBeNull();
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull();
  });

  /**
   * **Salvare non cancella.** Trovato il 2026-09-02: qui c'era una `removeItem` per lo
   * stato vuoto, e siccome l'autosalvataggio salva anche quando la pagina viene nascosta,
   * bastava aprire l'app in una seconda scheda — che parte sempre vuota, perche' il
   * ripristino avviene dopo — e cambiare scheda, per far sparire il lavoro salvato dalla
   * prima. Cancellare e' un gesto dell'utente, e ha la sua funzione.
   */
  test('salvare uno stato vuoto non cancella quello che c era', () => {
    saveCurrent(stato());
    saveCurrent(stato({ waypoints: [], legs: [] }));
    expect(loadCurrent()?.waypoints).toHaveLength(2);
  });

  test('clearCurrent cancella', () => {
    saveCurrent(stato());
    clearCurrent();
    expect(loadCurrent()).toBeNull();
  });

  /**
   * Quello che si legge da localStorage è dato non fidato: può essere di una versione
   * precedente, troncato, o scritto da un'altra scheda. Deve valere "non lo so",
   * mai un itinerario a metà che poi si comporta in modo strano.
   */
  describe('dato non fidato in lettura', () => {
    test.each([
      ['JSON invalido', '{non json'],
      ['non un oggetto', '"stringa"'],
      ['versione futura', JSON.stringify({ v: 99, waypoints: [], legs: [] })],
      ['waypoint non array', JSON.stringify({ v: 1, waypoints: 'x', legs: [] })],
      ['waypoint malformato', JSON.stringify({ v: 1, itineraryId: 'i', itineraryName: '', createdAt: 'x', appMode: 'learn', waypoints: [{ id: 1 }], legs: [] })],
      ['modalità sconosciuta', JSON.stringify({ v: 1, itineraryId: 'i', itineraryName: '', createdAt: 'x', appMode: 'volo', waypoints: [{ id: 'w', name: 'n', lat: 1, lon: 2, altitude: null, order: 0 }], legs: [] })],
    ])('%s → null', (_nome, raw) => {
      localStorage.setItem(CURRENT_KEY, raw);
      expect(loadCurrent()).toBeNull();
    });
  });

  /**
   * Le tratte portano la geometria del sentiero e il profilo altimetrico: su un
   * itinerario lungo sono la parte grossa. Se lo spazio finisce, meglio conservare i
   * valori scritti dall'utente — che non si possono ricalcolare — buttando ciò che si
   * riottiene dalla rete.
   */
  test('spazio esaurito → riprova senza geometria e profilo, tenendo i valori utente', () => {
    const geometria = Array.from({ length: 5000 }, (_, i) => [46 + i / 1e5, 11 + i / 1e5] as [number, number]);
    const profilo = Array.from({ length: 5000 }, (_, i) => ({ distance: i / 100, altitude: 2000 + i }));
    const grande = {
      ...leg('l1'),
      // i valori scritti a mano dall'utente: questi non si possono ricalcolare
      learnValues: { distance: 1.4, elevationGain: 180, elevationLoss: 40, azimuth: 140 },
      routeGeometry: geometria,
      elevationProfile: profilo,
      // la copia annidata della modalita' Track porta gli stessi dati pesanti
      trackValues: { distance: 1.5, elevationGain: 200, elevationLoss: 50, azimuth: 137, routeGeometry: geometria, elevationProfile: profilo },
    };
    const reale = localStorage.setItem.bind(localStorage);
    let primoTentativo = true;
    const spia = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string, v: string) => {
      if (k === CURRENT_KEY && primoTentativo) {
        primoTentativo = false;
        throw new DOMException('quota', 'QuotaExceededError');
      }
      reale(k, v);
    });

    saveCurrent(stato({ legs: [grande] }));
    spia.mockRestore();

    const letto = loadCurrent();
    expect(letto).not.toBeNull();
    expect(letto?.legs[0].learnValues?.distance).toBe(1.4);
    expect(letto?.legs[0].routeGeometry).toBeUndefined();
    expect(letto?.legs[0].elevationProfile).toBeUndefined();
    // anche la copia annidata: e' la meta' del peso
    expect(letto?.legs[0].trackValues?.routeGeometry).toBeUndefined();
    expect(letto?.legs[0].trackValues?.distance).toBe(1.5);
    // e va detto che il salvataggio è parziale, per non mentire sullo stato
    expect(letto?.slim).toBe(true);
  });

  test('se anche il ripiego fallisce non lancia', () => {
    const spia = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => saveCurrent(stato())).not.toThrow();
    spia.mockRestore();
  });
});
