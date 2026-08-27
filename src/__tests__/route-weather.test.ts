import {
  samplePoints, arrivalTimes, classifyHour, defaultDeparture, buildRouteWeather,
  type PuntoOrario,
} from '@/lib/route-weather';
import type { Waypoint, Leg } from '@/lib/types';

const wp = (i: number, lat = 46.4 + i / 100, alt: number | null = 2000 + i * 100): Waypoint => ({
  id: `w${i}`, name: `WP ${i}`, lat, lon: 11.8 + i / 100, altitude: alt, order: i,
});

const leg = (i: number, minuti: number): Leg => ({
  id: `l${i}`, fromWaypointId: `w${i}`, toWaypointId: `w${i + 1}`,
  distance: 2, azimuth: 90, elevationGain: 300, elevationLoss: 0, estimatedTime: minuti,
});

describe('campionamento dei punti', () => {
  test('pochi waypoint: si interrogano tutti', () => {
    const p = samplePoints([wp(0), wp(1), wp(2)]);
    expect(p.map((x) => x.waypointIndex)).toEqual([0, 1, 2]);
  });

  /**
   * I modelli meteo hanno maglie di chilometri: interrogare 30 waypoint restituirebbe
   * 30 volte lo stesso numero. Si campiona, e il pannello lo dice — cosi' nessuno
   * crede che il dato sia stato calcolato per ogni waypoint.
   */
  test('molti waypoint: al massimo 12, primo e ultimo sempre inclusi', () => {
    const molti = Array.from({ length: 30 }, (_, i) => wp(i));
    const p = samplePoints(molti);
    expect(p.length).toBeLessThanOrEqual(12);
    expect(p[0].waypointIndex).toBe(0);
    expect(p[p.length - 1].waypointIndex).toBe(29);
  });

  test('i waypoint senza coordinate non si interrogano', () => {
    const p = samplePoints([wp(0), { ...wp(1), lat: null, lon: null }, wp(2)]);
    expect(p.map((x) => x.waypointIndex)).toEqual([0, 2]);
  });

  test('nessuna coordinata → nessun punto', () => {
    expect(samplePoints([{ ...wp(0), lat: null, lon: null }])).toEqual([]);
  });
});

describe('orari di arrivo dai tempi Munter', () => {
  const partenza = new Date('2026-08-28T05:00:00Z'); // 07:00 in Italia

  test('il primo waypoint è l\'ora di partenza', () => {
    const t = arrivalTimes([wp(0), wp(1)], [leg(0, 90)], partenza);
    expect(t[0].toISOString()).toBe(partenza.toISOString());
  });

  test('ogni tratta somma il suo tempo', () => {
    const t = arrivalTimes([wp(0), wp(1), wp(2)], [leg(0, 90), leg(1, 45)], partenza);
    expect((t[1].getTime() - partenza.getTime()) / 60000).toBe(90);
    expect((t[2].getTime() - partenza.getTime()) / 60000).toBe(135);
  });

  // Una tratta senza stima non deve far collassare tutti gli orari successivi
  // sull'ora di partenza: si tratta come tempo ignoto, quindi zero, ma il resto
  // della catena continua a scorrere.
  test('una tratta senza tempo stimato non rompe la catena', () => {
    const senza = { ...leg(0, 0), estimatedTime: undefined };
    const t = arrivalTimes([wp(0), wp(1), wp(2)], [senza, leg(1, 60)], partenza);
    expect((t[2].getTime() - partenza.getTime()) / 60000).toBe(60);
  });
});

/**
 * La classificazione prende il **peggio** fra tre letture indipendenti. Il codice
 * meteo che dichiara temporale è la lettura più forte: il CAPE dice quanta energia
 * c'è, non che il temporale ci sarà.
 */
describe('classificazione di un\'ora', () => {
  const ora = (over: Partial<PuntoOrario> = {}): PuntoOrario => ({
    time: '2026-08-28T12:00:00.000Z', cape: 0, weatherCode: 0, gusts: 10, precipProb: 0, ...over,
  });

  test('cielo sereno e vento debole → nessun rischio', () => {
    expect(classifyHour(ora()).level).toBe(0);
  });

  test.each([
    [95, 'temporale'], [96, 'temporale con grandine'], [99, 'temporale con grandine forte'],
  ])('codice %i → livello massimo', (code) => {
    expect(classifyHour(ora({ weatherCode: code })).level).toBe(3);
  });

  test.each([
    [200, 0], [500, 1], [1000, 2], [2000, 3],
  ])('CAPE %i J/kg → livello %i', (cape, atteso) => {
    expect(classifyHour(ora({ cape })).level).toBe(atteso);
  });

  test.each([
    [20, 0], [40, 1], [60, 2], [85, 3],
  ])('raffiche %i km/h → livello %i', (gusts, atteso) => {
    expect(classifyHour(ora({ gusts })).level).toBe(atteso);
  });

  test('vince la lettura peggiore', () => {
    const c = classifyHour(ora({ cape: 200, gusts: 85 }));
    expect(c.level).toBe(3);
    expect(c.reasons.join(' ')).toMatch(/raffiche/i);
  });

  test('ogni motivo è nominato, non solo il livello', () => {
    const c = classifyHour(ora({ cape: 1200, gusts: 55, weatherCode: 95, precipProb: 80 }));
    expect(c.reasons.length).toBeGreaterThanOrEqual(3);
    expect(c.reasons.join(' ')).toMatch(/temporale/i);
    expect(c.reasons.join(' ')).toMatch(/CAPE/);
  });

  // Dati mancanti non devono diventare "nessun rischio": chi legge crederebbe di
  // sapere qualcosa che non sa.
  test('valori non numerici → si dichiara ignoto, non sereno', () => {
    const c = classifyHour(ora({ cape: Number.NaN, weatherCode: Number.NaN, gusts: Number.NaN }));
    expect(c.level).toBeNull();
  });
});

describe('ora di partenza suggerita', () => {
  test('la mattina presto si pianifica oggi', () => {
    const d = defaultDeparture(new Date('2026-08-28T04:30:00Z')); // 06:30 locali
    expect(d.toISOString().slice(0, 10)).toBe('2026-08-28');
  });

  test('nel pomeriggio si pianifica domani alle 7', () => {
    const d = defaultDeparture(new Date('2026-08-28T14:00:00Z')); // 16:00 locali
    expect(d.toISOString().slice(0, 10)).toBe('2026-08-29');
  });

  test('mai un\'ora di partenza già passata', () => {
    const ora = new Date('2026-08-28T06:40:00Z');
    expect(defaultDeparture(ora).getTime()).toBeGreaterThanOrEqual(ora.getTime());
  });
});

/**
 * Il verdetto è la ragione per cui esiste tutto il resto: incrocia la finestra
 * critica con gli orari di arrivo e dice "parti prima" oppure "oggi no", che è la
 * decisione vera.
 */
describe('rapporto completo', () => {
  const partenza = new Date('2026-08-28T05:00:00Z');
  const orario = (base: Record<string, number>) => {
    const time: string[] = [];
    const cape: number[] = [];
    const weather_code: number[] = [];
    const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-08-28T${String(h).padStart(2, '0')}:00`);
      cape.push(base[h] ?? 0);
      weather_code.push(0);
      wind_gusts_10m.push(15);
      precipitation_probability.push(10);
    }
    return { time, cape, weather_code, wind_gusts_10m, precipitation_probability };
  };

  test('giornata tranquilla: nessuna finestra critica', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 120)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0' }],
      serie: [orario({})],
    });
    expect(r.windows).toEqual([]);
    expect(r.hitWindow).toBeNull();
    expect(r.verdict.level).toBe(0);
  });

  test('CAPE alto nel pomeriggio: finestra e verdetto', () => {
    // dalle 12 alle 18 UTC il CAPE sale sopra 800 → livello 2
    const pomeriggio: Record<string, number> = {};
    for (let h = 12; h <= 18; h++) pomeriggio[h] = 1200;
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 480)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0' }],
      serie: [orario(pomeriggio)],
    });
    // Una sola fascia, contigua, con istanti: le ore nude stampate come erano
    // mostravano UTC a chi legge ora italiana, cioe' due ore di errore.
    expect(r.windows).toHaveLength(1);
    expect(r.windows[0].fromISO).toBe('2026-08-28T12:00:00.000Z');
    // si chiude in fondo all'ultima ora critica, non al suo inizio
    expect(r.windows[0].toISO).toBe('2026-08-28T19:00:00.000Z');
    expect(r.hitWindow).not.toBeNull();
    // si arriva alle 13:00 UTC, dentro la finestra
    expect(r.verdict.level).toBeGreaterThanOrEqual(2);
    // il messaggio deve dire QUANDO, non solo che c'e' un rischio
    expect(r.verdict.message).toMatch(/critica/i);
    expect(r.verdict.message).toMatch(/dalle \d\d:\d\d alle \d\d:\d\d/);
  });

  /**
   * Il difetto che questa asserzione blocca l'ho visto solo guardando lo schermo: la
   * finestra 12-19 UTC veniva scritta "12-19" a un utente che legge ora italiana, dove
   * sono le 14-21. I test non potevano vederlo, perche' al loro interno tutto era
   * coerentemente UTC.
   */
  test('il messaggio parla in ora italiana, non UTC', () => {
    const pomeriggio: Record<string, number> = {};
    for (let h = 12; h <= 18; h++) pomeriggio[h] = 1200;
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 480)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0' }],
      serie: [orario(pomeriggio)],
    });
    // 12:00 UTC in agosto = 14:00 in Italia
    expect(r.verdict.message).toMatch(/14:00/);
    expect(r.verdict.message).not.toMatch(/12:00/);
  });

  /**
   * Il difetto che questo test blocca l'ho visto sui dati veri: con il CAPE critico
   * a tratti lungo tutta la giornata, un'unica fascia dal minimo al massimo diventava
   * "00:00-00:00" — aritmeticamente giusto e inutile. Le fasce vere sono due, e
   * dirle e' l'unico modo di essere d'aiuto.
   */
  test('ore critiche non contigue → due fasce, non un unico intervallo', () => {
    const sparse: Record<string, number> = {};
    for (const h of [2, 3, 14, 15, 16]) sparse[h] = 1200;
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 120)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0' }],
      serie: [orario(sparse)],
    });
    expect(r.windows).toHaveLength(2);
    expect(r.windows[0].fromISO).toBe('2026-08-28T02:00:00.000Z');
    expect(r.windows[0].toISO).toBe('2026-08-28T04:00:00.000Z');
    expect(r.windows[1].fromISO).toBe('2026-08-28T14:00:00.000Z');
  });

  test('la fascia nominata nel verdetto è quella che ti prende, non l’elenco', () => {
    const sparse: Record<string, number> = {};
    for (const h of [2, 3, 6, 7]) sparse[h] = 1200;  // 05:00-06:00 UTC: dentro il cammino
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 180)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0' }],
      serie: [orario(sparse)],
    });
    expect(r.hitWindow?.fromISO).toBe('2026-08-28T06:00:00.000Z');
    expect(r.verdict.message).toMatch(/dalle 08:00 alle 10:00/);   // in ora italiana
    expect(r.verdict.message).not.toMatch(/04:00/);
  });

  /**
   * Difetto visto sui dati veri: nessun punto interrogato era critico all'ora del suo
   * arrivo, ma una fascia critica cadeva fra due punti. Il messaggio diceva "verso le
   * 11:00 sei a «X» e la previsione e' critica" mentre a quell'ora, in quel punto, era
   * tranquilla. Una frase falsa su un dato di sicurezza — e invisibile ai test, che
   * guardavano i livelli e non la verita' della frase.
   */
  test('se la criticita cade fra due punti, si nomina l ora della fascia', () => {
    // critico solo alle 08:00 UTC: il primo punto arriva alle 05:00, il secondo alle 11:00
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 360)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio' }],
      serie: [orario({ 8: 1200 })],
    });
    expect(r.verdict.level).toBe(2);
    // 08:00 UTC = 10:00 in Italia
    expect(r.verdict.message).toMatch(/dalle 10:00/);
    expect(r.verdict.message).toMatch(/diventa critica/);
    // e NON deve dire che il punto e' critico all'ora del suo arrivo
    expect(r.verdict.message).not.toMatch(/verso le 07:00 sei a/);
  });

  test('senza serie non si inventa un verdetto', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0)], legs: [], departure: partenza, punti: [], serie: [],
    });
    expect(r.verdict.level).toBeNull();
    expect(r.rows).toEqual([]);
  });
});
