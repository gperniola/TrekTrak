import { sunTimes } from '@/lib/sun';
import { buildRouteWeather } from '@/lib/route-weather';
import { saveCurrent, loadCurrent } from '@/lib/current-itinerary';
import type { Waypoint, Leg } from '@/lib/types';

const wp = (i: number): Waypoint => ({
  id: `w${i}`, name: `WP ${i}`, lat: 46.4, lon: 11.8, altitude: 2000, order: i,
});
const leg = (min: number): Leg => ({
  id: 'l0', fromWaypointId: 'w0', toWaypointId: 'w1',
  distance: 5, azimuth: 90, elevationGain: 500, elevationLoss: 0, estimatedTime: min,
});

const giornoIt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });

/**
 * Difetti trovati nella review del lavoro di questa giornata. Ognuno era **provato**
 * prima della correzione, e ognuno riguardava il momento in cui si cammina di notte o
 * il momento in cui un dato invecchia: le due situazioni in cui un'app di montagna
 * deve essere più precisa, non meno.
 */
describe('review: la partenza notturna', () => {
  /**
   * `sunTimes` usava il giorno **UTC**: chi partiva all'01:00 del 28 (23:00 UTC del 27)
   * leggeva l'orario del tramonto del 27. La partenza notturna non è un caso di
   * scuola, è la partenza classica per una vetta.
   */
  test('gli orari del sole sono quelli del giorno in cui cammini', () => {
    const t = sunTimes(46.4, 11.8, new Date('2026-08-27T23:00:00Z')); // 01:00 IT del 28
    expect(giornoIt(t.sunset as string)).toBe('2026-08-28');
    expect(giornoIt(t.sunrise as string)).toBe('2026-08-28');
  });

  test('e per una partenza diurna nulla cambia', () => {
    const t = sunTimes(46.4, 11.8, new Date('2026-08-28T05:00:00Z')); // 07:00 IT del 28
    expect(giornoIt(t.sunset as string)).toBe('2026-08-28');
  });

  /**
   * Le fasce critiche coprivano solo il giorno civile della partenza: una salita
   * notturna attraversa la mezzanotte, e un temporale alle 3 veniva dichiarato
   * inesistente. Provato prima della correzione: fasce `[]`, verdetto "Nessuna
   * criticità".
   */
  test('un temporale dopo la mezzanotte non sparisce dal verdetto', () => {
    const time: string[] = []; const cape: number[] = [];
    const weather_code: number[] = []; const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    for (const d of [27, 28]) {
      for (let h = 0; h < 24; h++) {
        time.push(`2026-08-${d}T${String(h).padStart(2, '0')}:00`);
        // critico solo alle 01:00 UTC del 28 = 03:00 italiane
        cape.push(d === 28 && h === 1 ? 1600 : 20);
        weather_code.push(0); wind_gusts_10m.push(10); precipitation_probability.push(0);
      }
    }
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)],
      legs: [leg(480)],
      departure: new Date('2026-08-27T19:00:00Z'), // 21:00 italiane del 27
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio' }],
      serie: [{ time, cape, weather_code, wind_gusts_10m, precipitation_probability }],
    });
    expect(r.windows).toHaveLength(1);
    expect(r.verdict.level).toBeGreaterThanOrEqual(2);
    expect(r.verdict.message).toMatch(/03:00/);
  });

  // Il contesto "cade quando sei rientrato" deve sopravvivere: e' la frase che dice
  // "puoi andare, ma prima delle 14".
  test('una fascia dopo il rientro resta visibile e dichiarata innocua', () => {
    const time: string[] = []; const cape: number[] = [];
    const weather_code: number[] = []; const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-08-28T${String(h).padStart(2, '0')}:00`);
      cape.push(h >= 14 && h <= 16 ? 1400 : 20);   // 16-18 italiane
      weather_code.push(0); wind_gusts_10m.push(10); precipitation_probability.push(0);
    }
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)],
      legs: [leg(180)],
      departure: new Date('2026-08-28T04:00:00Z'), // 06:00 IT, rientro 09:00 IT
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio' }],
      serie: [{ time, cape, weather_code, wind_gusts_10m, precipitation_probability }],
    });
    expect(r.windows).toHaveLength(1);
    expect(r.hitWindow).toBeNull();
    expect(r.verdict.level).toBe(0);
    expect(r.verdict.message).toMatch(/rientrato/);
  });
});

/**
 * `slim` veniva scritto nel salvataggio di ripiego e **letto da nessuno**: lo stesso
 * difetto di `trektrak_user_level`, corretto poche ore prima nella v0.11.8. Un
 * itinerario ripristinato senza il tracciato sui sentieri mostrava linee rette senza
 * spiegare perché.
 */
describe('review: il ripristino parziale si dichiara', () => {
  beforeEach(() => localStorage.clear());

  test('il salvataggio di ripiego resta riconoscibile alla rilettura', () => {
    const geometria = Array.from({ length: 3000 }, (_, i) => [46 + i / 1e5, 11 + i / 1e5] as [number, number]);
    const grande: Leg = { ...leg(120), routeGeometry: geometria };
    const reale = localStorage.setItem.bind(localStorage);
    let primo = true;
    const spia = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string, v: string) => {
      if (primo) { primo = false; throw new DOMException('quota', 'QuotaExceededError'); }
      reale(k, v);
    });
    saveCurrent({
      itineraryId: 'i1', itineraryName: 'Giro', createdAt: '2026-08-27T08:00:00.000Z',
      appMode: 'track', waypoints: [wp(0), wp(1)], legs: [grande],
    });
    spia.mockRestore();

    const letto = loadCurrent();
    expect(letto?.slim).toBe(true);
    expect(letto?.legs[0].routeGeometry).toBeUndefined();
  });

  test('un salvataggio completo non è marcato come parziale', () => {
    saveCurrent({
      itineraryId: 'i1', itineraryName: 'Giro', createdAt: '2026-08-27T08:00:00.000Z',
      appMode: 'track', waypoints: [wp(0), wp(1)], legs: [leg(120)],
    });
    expect(loadCurrent()?.slim).toBe(false);
  });
});
