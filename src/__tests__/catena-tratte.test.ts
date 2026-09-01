import { catenaTratte, createEmptyLeg } from '@/stores/itinerary/helpers';
import type { Leg, Waypoint } from '@/lib/types';

/**
 * TASK-27. Questo pezzo era scritto **tre volte** quasi identico — alla rimozione di un
 * waypoint, al riordino e al caricamento di un itinerario — e le tre copie differivano
 * per un dettaglio: il caricamento ricalcolava tempi e pendenze, le altre due no. È
 * esattamente il modo in cui tre copie diventano tre comportamenti diversi senza che
 * nessuno se ne accorga.
 */

const wp = (id: string, order: number): Waypoint =>
  ({ id, name: id.toUpperCase(), lat: 45 + order / 100, lon: 7, altitude: 1000 + order * 100, order });

const tratta = (from: string, to: string, over: Partial<Leg> = {}): Leg => ({
  id: `${from}${to}`,
  fromWaypointId: from,
  toWaypointId: to,
  distance: 1.5,
  elevationGain: 200,
  elevationLoss: 10,
  azimuth: 90,
  ...over,
});

describe('catenaTratte', () => {
  test('con meno di due waypoint non ci sono tratte', () => {
    expect(catenaTratte([], [])).toEqual([]);
    expect(catenaTratte([wp('a', 0)], [])).toEqual([]);
  });

  test('crea una tratta fra ogni coppia consecutiva', () => {
    const punti = [wp('a', 0), wp('b', 1), wp('c', 2)];
    const catena = catenaTratte(punti, []);
    expect(catena).toHaveLength(2);
    expect(catena[0]).toMatchObject({ fromWaypointId: 'a', toWaypointId: 'b' });
    expect(catena[1]).toMatchObject({ fromWaypointId: 'b', toWaypointId: 'c' });
  });

  /**
   * Il motivo per cui questa funzione non e' un semplice `map`: i dati di una tratta —
   * la geometria del sentiero scaricata dalla rete, i valori scritti a mano — vanno
   * conservati se i suoi due estremi non sono cambiati. Buttarli costringerebbe a
   * riscaricare, o peggio a riscrivere.
   */
  test('conserva i dati delle tratte i cui estremi non cambiano', () => {
    const punti = [wp('a', 0), wp('b', 1), wp('c', 2)];
    const esistenti = [tratta('a', 'b', { distance: 9.9, routeGeometry: [[45, 7], [45.1, 7.1]] })];
    const catena = catenaTratte(punti, esistenti);
    expect(catena[0].distance).toBe(9.9);
    expect(catena[0].routeGeometry).toHaveLength(2);
    // la seconda non esisteva: nasce vuota, non copiata dalla prima
    expect(catena[1].distance).toBeNull();
  });

  test('una tratta i cui estremi non sono piu consecutivi non viene riusata', () => {
    // si toglie B: la tratta a-b e la tratta b-c non servono piu', serve a-c
    const rimasti = [wp('a', 0), wp('c', 1)];
    const prima = [tratta('a', 'b', { distance: 3 }), tratta('b', 'c', { distance: 4 })];
    const catena = catenaTratte(rimasti, prima);
    expect(catena).toHaveLength(1);
    expect(catena[0]).toMatchObject({ fromWaypointId: 'a', toWaypointId: 'c' });
    expect(catena[0].distance).toBeNull();
  });

  /**
   * Il giudizio della verifica si azzera sempre: se i punti si sono spostati, un verde
   * dato su valori precedenti direbbe una cosa non piu' vera.
   */
  test('la validazione precedente non sopravvive', () => {
    const punti = [wp('a', 0), wp('b', 1)];
    const esistenti = [tratta('a', 'b', { validationState: { distance: { status: 'valid' } } as never })];
    expect(catenaTratte(punti, esistenti)[0].validationState).toBeUndefined();
  });

  /** L'unica differenza fra le tre copie di prima, ora esplicita. */
  test('su richiesta ricalcola tempo e pendenza', () => {
    const punti = [wp('a', 0), wp('b', 1)];
    const esistenti = [tratta('a', 'b', { distance: 4, elevationGain: 400, elevationLoss: 0 })];

    const senza = catenaTratte(punti, esistenti)[0];
    expect(senza.estimatedTime).toBeUndefined();

    const con = catenaTratte(punti, esistenti, { ricalcolaCon: 1 })[0];
    // 4 km in piano = 60 min, 400 m di salita = 60 min: la piu' lunga piu' meta' dell'altra
    expect(con.estimatedTime).toBeCloseTo(90, 5);
    expect(con.slope).toBeGreaterThan(0);
  });

  test('il passo personale entra nel ricalcolo', () => {
    const punti = [wp('a', 0), wp('b', 1)];
    const esistenti = [tratta('a', 'b', { distance: 4, elevationGain: 0, elevationLoss: 0 })];
    const lento = catenaTratte(punti, esistenti, { ricalcolaCon: 1.5 })[0];
    expect(lento.estimatedTime).toBeCloseTo(90, 5);
  });

  test('le tratte nuove hanno id diversi', () => {
    const punti = [wp('a', 0), wp('b', 1), wp('c', 2)];
    const catena = catenaTratte(punti, []);
    expect(catena[0].id).not.toBe(catena[1].id);
  });

  test('createEmptyLeg non inventa valori', () => {
    const vuota = createEmptyLeg('a', 'b');
    expect(vuota.distance).toBeNull();
    expect(vuota.elevationGain).toBeNull();
    expect(vuota.elevationLoss).toBeNull();
    expect(vuota.azimuth).toBeNull();
  });
});
