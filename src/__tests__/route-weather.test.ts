import {
  samplePoints, arrivalTimes, classifyHour, defaultDeparture, buildRouteWeather,
  scartoQuota, scartoQuotaMassimo, SCARTO_QUOTA_RILEVANTE, SOGLIA_PAUSA_METEO, pausaDi,
  righeVisibili, SPAZIO_MAX_KM, SOGLIA_MOSTRA_INTERMEDIO,
  type OraDaClassificare, type RigaPercorso,
} from '@/lib/route-weather';
import { haversineDistance } from '@/lib/calculations';
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
    expect(t[0]?.toISOString()).toBe(partenza.toISOString());
  });

  test('ogni tratta somma il suo tempo', () => {
    const t = arrivalTimes([wp(0), wp(1), wp(2)], [leg(0, 90), leg(1, 45)], partenza);
    expect(((t[1] as Date).getTime() - partenza.getTime()) / 60000).toBe(90);
    expect(((t[2] as Date).getTime() - partenza.getTime()) / 60000).toBe(135);
  });

  /**
   * SPECIFICA CAMBIATA nel secondo giro di review, perche' quella di prima codificava
   * un difetto: il tempo ignoto valeva zero e "la catena continuava a scorrere", cioe'
   * i punti successivi ricevevano orari **inventati**. In modalita' Learn le tratte
   * nascono senza distanza ne' dislivelli, quindi era la condizione normale: un
   * principiante leggeva di arrivare in vetta all'ora di partenza.
   *
   * Adesso da quel punto in poi l'orario e' `null`: un'ora che non si conosce si
   * dichiara, non si stima a zero.
   */
  test('una tratta senza tempo stimato interrompe gli orari, invece di inventarli', () => {
    const senza = { ...leg(0, 0), estimatedTime: undefined };
    const t = arrivalTimes([wp(0), wp(1), wp(2)], [senza, leg(1, 60)], partenza);
    expect(t[0]).not.toBeNull();
    expect(t[1]).toBeNull();
    expect(t[2]).toBeNull();
  });

  test('con tutti i tempi noti gli orari ci sono tutti', () => {
    const t = arrivalTimes([wp(0), wp(1), wp(2)], [leg(0, 30), leg(1, 45)], partenza);
    expect(t.every((x) => x != null)).toBe(true);
  });

  /**
   * **Una sosta a un punto sposta in avanti gli arrivi dei punti SUCCESSIVI**, non
   * l'arrivo a quel punto: si arriva, ci si ferma, si riparte. L'arrivo al punto della
   * sosta resta l'ora in cui ci si arriva.
   */
  test('la pausa a un punto ritarda gli arrivi successivi, non il suo', () => {
    const conPausa = { ...wp(1), pausaMin: 30 };
    const t = arrivalTimes([wp(0), conPausa, wp(2)], [leg(0, 60), leg(1, 60)], partenza);
    const min = (x: Date | null) => x == null ? null : (x.getTime() - partenza.getTime()) / 60000;
    expect(min(t[0])).toBe(0);
    expect(min(t[1])).toBe(60);        // arrivo al punto 1: invariato
    expect(min(t[2])).toBe(60 + 30 + 60); // punto 2: cammino + sosta + cammino
  });

  test('la pausa dell ultimo punto non sposta nessun arrivo', () => {
    const ultimoConPausa = { ...wp(2), pausaMin: 45 };
    const t = arrivalTimes([wp(0), wp(1), ultimoConPausa], [leg(0, 30), leg(1, 30)], partenza);
    const min = (x: Date | null) => x == null ? null : (x!.getTime() - partenza.getTime()) / 60000;
    expect(min(t[2])).toBe(60);
  });

  test('pausaDi legge solo valori positivi e finiti', () => {
    expect(pausaDi(wp(0))).toBe(0);
    expect(pausaDi({ ...wp(0), pausaMin: 15 })).toBe(15);
    expect(pausaDi({ ...wp(0), pausaMin: 0 })).toBe(0);
    expect(pausaDi({ ...wp(0), pausaMin: -5 })).toBe(0);
    expect(pausaDi(undefined)).toBe(0);
  });
});

/**
 * **Il rischio di un'ora segue la PREVISIONE, e il CAPE è solo il contesto.**
 *
 * Il CAPE è l'energia disponibile alla convezione — il carburante, non il fuoco: da solo
 * non fa un temporale. La versione precedente lo lasciava alzare il livello da solo, e
 * gridava «attenzione» sui pomeriggi coperti ma stabili con CAPE alto (misurato
 * sull'Abruzzo il 2026-09-06: coperto, pioggia 0-3%, CAPE ~1000, verdetto arancione —
 * segnalato dall'utente). Ora il modello (codice meteo + probabilità di pioggia) è il
 * giudice del «ci sarà o no», e il CAPE conta come aggravante di un innesco già previsto.
 */
describe('classificazione di un\'ora', () => {
  // Il tipo e' quello che `classifyHour` accetta davvero: la temperatura non entra nel
  // giudizio, e chiederla qui vorrebbe dire inventarne una in ogni caso di prova.
  const ora = (over: Partial<OraDaClassificare> = {}): OraDaClassificare => ({
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

  /**
   * **Il caso dell'utente**: CAPE alto SENZA pioggia prevista non è un'allerta. È il
   * pomeriggio d'estate coperto ma stabile, e prima era un falso «attenzione».
   */
  test.each([
    [300, 0], [720, 0], [1000, 0], [1500, 0], [1900, 0],
  ])('CAPE %i J/kg senza pioggia → livello %i (energia, non evento)', (cape, atteso) => {
    expect(classifyHour(ora({ cape, precipProb: 0 })).level).toBe(atteso);
  });

  /** Sopra la soglia estrema, una nota gialla anche senza pioggia: convezione orografica. */
  test('CAPE estremo senza pioggia → «tienila d\'occhio», non «attenzione»', () => {
    const c = classifyHour(ora({ cape: 2500, precipProb: 5 }));
    expect(c.level).toBe(1);
    expect(c.reasons.join(' ')).toMatch(/instabilità/i);
  });

  /** Con l'innesco previsto (pioggia probabile), il CAPE alto diventa aggravante forte. */
  test('pioggia probabile + CAPE alto → possibili temporali forti', () => {
    const c = classifyHour(ora({ cape: 1000, precipProb: 50 }));
    expect(c.level).toBe(3);
    expect(c.reasons.join(' ')).toMatch(/temporali forti/i);
  });

  test('pioggia probabile ma CAPE basso → livello della pioggia, non oltre', () => {
    expect(classifyHour(ora({ cape: 200, precipProb: 50 })).level).toBe(1);
    expect(classifyHour(ora({ cape: 200, precipProb: 80 })).level).toBe(2);
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
    const c = classifyHour(ora({ cape: Number.NaN, weatherCode: Number.NaN, gusts: Number.NaN, precipProb: Number.NaN }));
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
  /*
    `base[h]` e' la PROBABILITA' DI PIOGGIA a quell'ora: dal fix del 2026-09-06 e' quella
    il segnale di criticita', non il CAPE (che da solo, col cielo stabile, era un falso
    allarme). 75% -> livello 2. La logica delle finestre qui sotto e' indipendente da
    quale lettura sia critica: usa quella piu' onesta.
  */
  const orario = (base: Record<string, number>) => {
    const time: string[] = [];
    const cape: number[] = [];
    const weather_code: number[] = [];
    const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-08-28T${String(h).padStart(2, '0')}:00`);
      cape.push(0);
      weather_code.push(0);
      wind_gusts_10m.push(15);
      precipitation_probability.push(base[h] ?? 10);
    }
    return { time, cape, weather_code, wind_gusts_10m, precipitation_probability, temperature_2m: [] };
  };

  test('giornata tranquilla: nessuna finestra critica', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 120)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0', alt: null }],
      serie: [orario({})],
    });
    expect(r.windows).toEqual([]);
    expect(r.hitWindow).toBeNull();
    expect(r.verdict.level).toBe(0);
  });

  test('pioggia probabile nel pomeriggio: finestra e verdetto', () => {
    // dalle 12 alle 18 UTC il modello dà 75% di pioggia → livello 2
    const pomeriggio: Record<string, number> = {};
    for (let h = 12; h <= 18; h++) pomeriggio[h] = 75;
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 480)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0', alt: null }],
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
    for (let h = 12; h <= 18; h++) pomeriggio[h] = 75;
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 480)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0', alt: null }],
      serie: [orario(pomeriggio)],
    });
    // 12:00 UTC in agosto = 14:00 in Italia
    expect(r.verdict.message).toMatch(/14:00/);
    expect(r.verdict.message).not.toMatch(/12:00/);
  });

  /**
   * Il difetto che questo test blocca l'ho visto sui dati veri: con la criticita' a
   * tratti lungo tutta la giornata, un'unica fascia dal minimo al massimo diventava
   * "00:00-00:00" — aritmeticamente giusto e inutile. Le fasce vere sono due, e
   * dirle e' l'unico modo di essere d'aiuto.
   */
  test('ore critiche non contigue → due fasce, non un unico intervallo', () => {
    const sparse: Record<string, number> = {};
    for (const h of [2, 3, 14, 15, 16]) sparse[h] = 75;
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 120)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0', alt: null }],
      serie: [orario(sparse)],
    });
    expect(r.windows).toHaveLength(2);
    expect(r.windows[0].fromISO).toBe('2026-08-28T02:00:00.000Z');
    expect(r.windows[0].toISO).toBe('2026-08-28T04:00:00.000Z');
    expect(r.windows[1].fromISO).toBe('2026-08-28T14:00:00.000Z');
  });

  test('la fascia nominata nel verdetto è quella che ti prende, non l’elenco', () => {
    const sparse: Record<string, number> = {};
    for (const h of [2, 3, 6, 7]) sparse[h] = 75;  // 05:00-06:00 UTC: dentro il cammino
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 180)], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0', alt: null }],
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
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio', alt: null }],
      serie: [orario({ 8: 75 })],
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

/**
 * In modalita' Learn le tratte nascono senza distanza ne' dislivelli: senza quelli non
 * esiste un orario di arrivo da incrociare con la previsione. Il pannello non deve
 * inventare orari, ma non deve nemmeno tacere: le ore instabili della giornata sono
 * informazione vera, e quello che manca e' solo l'incrocio.
 */
describe('quando i tempi di percorrenza non ci sono', () => {
  const partenza = new Date('2026-08-28T05:00:00Z');
  const serieCritica = () => {
    const time: string[] = []; const cape: number[] = []; const wc: number[] = [];
    const g: number[] = []; const pp: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-08-28T${String(h).padStart(2, '0')}:00`);
      cape.push(0); wc.push(0); g.push(10);
      pp.push(h >= 12 && h <= 15 ? 75 : 0);
    }
    return { time, cape, weather_code: wc, wind_gusts_10m: g, precipitation_probability: pp, temperature_2m: [] };
  };
  const senzaTempo = { ...leg(0, 0), estimatedTime: undefined };

  test('gli orari sono dichiarati non stimabili, non messi a zero', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [senzaTempo], departure: partenza,
      punti: [
        { waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio', alt: null },
        { waypointIndex: 1, lat: 46.5, lon: 11.8, name: 'Vetta', alt: null },
      ],
      serie: [serieCritica(), serieCritica()],
    });
    expect(r.rows[0].arrival).not.toBeNull();      // la partenza si conosce
    expect(r.rows[1].arrival).toBeNull();          // il resto no
    expect(r.rows[1].classification.reasons.join(' ')).toMatch(/non stimabile/i);
  });

  test('il verdetto non afferma nulla sull\'incrocio, ma dice le ore instabili', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [senzaTempo], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio', alt: null }],
      serie: [serieCritica()],
    });
    expect(r.verdict.level).toBeNull();
    expect(r.hitWindow).toBeNull();
    expect(r.verdict.message).toMatch(/14:00-18:00/);          // ora italiana
    expect(r.verdict.message).toMatch(/dislivelli|Track/);      // dice cosa manca
  });

  test('in Pianificazione non dice «passa a Pianificazione» (ci sei già), ma parla di calcolo/connessione', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [senzaTempo], departure: partenza, appMode: 'track',
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio', alt: null }],
      serie: [serieCritica()],
    });
    expect(r.verdict.message).not.toMatch(/passa a Pianificazione/);
    expect(r.verdict.message).toMatch(/calcolat|connessione/i);
  });

  test('in Impara (o senza modalità) invita a inserire i valori o passare a Pianificazione', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [senzaTempo], departure: partenza, appMode: 'learn',
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio', alt: null }],
      serie: [serieCritica()],
    });
    expect(r.verdict.message).toMatch(/passa a Pianificazione/);
  });

  test('senza criticità lo dice, e spiega comunque cosa manca', () => {
    const time: string[] = []; const cape: number[] = []; const wc: number[] = [];
    const g: number[] = []; const pp: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-08-28T${String(h).padStart(2, '0')}:00`);
      cape.push(20); wc.push(0); g.push(10); pp.push(0);
    }
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [senzaTempo], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Parcheggio', alt: null }],
      serie: [{ time, cape, weather_code: wc, wind_gusts_10m: g, precipitation_probability: pp, temperature_2m: [] }],
    });
    expect(r.verdict.level).toBeNull();
    expect(r.verdict.message).toMatch(/Nessuna criticità/i);
    expect(r.verdict.message).toMatch(/dislivelli/);
  });
});

/**
 * Lo **scarto di quota**: di quanto la maglia del modello sta piu' in basso (o in alto)
 * del punto. Non e' un dettaglio da nascondere — sono i gradi e le raffiche di un altro
 * posto — ed e' l'unica cosa che il pannello puo' dire quando le quote non ci sono tutte
 * e la previsione non ha potuto essere chiesta alla quota giusta.
 */
describe('scarto fra la quota del punto e quella del modello', () => {
  const riga = (alt: number | null, modelElevation: number | null): RigaPercorso => ({
    waypointIndex: 0, name: 'Vetta', alt, modelElevation,
    arrival: null, hour: null, classification: { level: null, reasons: [] },
  });

  test('lo dice col segno: negativo se il modello sta piu in basso', () => {
    expect(scartoQuota(riga(2596, 1257))).toBe(-1339);
    expect(scartoQuota(riga(1000, 1200))).toBe(200);
  });

  /**
   * Se manca una delle due quote la risposta e' **non lo so**, non "coincidono": un
   * "nessuno scarto" inventato farebbe leggere la temperatura del fondovalle come se
   * fosse quella della vetta, che e' il difetto per cui tutto questo esiste.
   */
  test('senza una delle due quote non si sa', () => {
    expect(scartoQuota(riga(null, 1257))).toBeNull();
    expect(scartoQuota(riga(2596, null))).toBeNull();
    expect(scartoQuota(riga(Number.NaN, 1257))).toBeNull();
  });

  test('fra piu righe conta lo scarto piu grosso, in valore assoluto', () => {
    expect(scartoQuotaMassimo([riga(1000, 1050), riga(2596, 1257), riga(1000, 900)])).toBe(-1339);
    expect(scartoQuotaMassimo([riga(null, null)])).toBeNull();
    expect(scartoQuotaMassimo([])).toBeNull();
  });

  /**
   * Un punto in mezzo non entra nello scarto: l'avviso invita a «scrivere la quota
   * nell'Editor», ma per un punto inserito dall'app non c'è un campo — sarebbe un
   * consiglio non applicabile.
   */
  test('gli intermedi non contano nello scarto (non hanno una quota da correggere)', () => {
    const intermedio: RigaPercorso = {
      ...riga(1000, 2596),
      intermedio: { ibIndex: 1, frazione: 0.5, kmDaInizio: 6, traA: 'A', traB: 'B' },
    };
    // il grosso scarto è su un intermedio: ignorato
    expect(scartoQuotaMassimo([riga(1000, 1050), intermedio])).toBe(50);
    // se restano solo intermedi, non c'è nulla da correggere
    expect(scartoQuotaMassimo([intermedio])).toBeNull();
  });

  test('la soglia per parlarne vale circa un grado', () => {
    // Un grado ogni 150 m: sotto, il margine e' minore dell'incertezza del modello.
    expect(SCARTO_QUOTA_RILEVANTE).toBeGreaterThanOrEqual(100);
    expect(SCARTO_QUOTA_RILEVANTE).toBeLessThanOrEqual(300);
  });
});

/**
 * Il pezzo che unisce l'itinerario alla richiesta: la quota che l'utente ha scritto deve
 * arrivare fino al servizio, o la previsione resta quella della maglia del modello.
 */
describe('la quota dei punti campionati', () => {
  test('viene dall itinerario, punto per punto', () => {
    // 46,4 e 46,5 distano ~11 km: ora fra i due si inseriscono punti in mezzo. La quota
    // dei WAYPOINT resta quella dell'itinerario; gli intermedi hanno la loro interpolata.
    const punti = samplePoints([wp(0, 46.4, 1200), wp(1, 46.5, 2596)]);
    expect(punti.filter((p) => p.intermedio == null).map((p) => p.alt)).toEqual([1200, 2596]);
  });

  test('una quota che manca resta mancante, non diventa zero', () => {
    const punti = samplePoints([wp(0, 46.4, null), wp(1, 46.5, 2596)]);
    expect(punti[0].alt).toBeNull();
  });
});

/** La temperatura dell'ora d'arrivo arriva fino alla riga, o l'iconcina resta senza. */
describe('la temperatura nella riga', () => {
  test('e quella dell ora piu vicina all arrivo', () => {
    const time: string[] = [];
    const temperature_2m: number[] = [];
    const vuoti: number[] = [];
    const giorno = new Date().toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) {
      time.push(`${giorno}T${String(h).padStart(2, '0')}:00`);
      temperature_2m.push(h);            // la temperatura E' l'ora: facile da riconoscere
      vuoti.push(0);
    }
    const partenza = new Date(`${giorno}T09:00:00.000Z`);
    const r = buildRouteWeather({
      waypoints: [wp(0)], legs: [], departure: partenza,
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0', alt: 2000 }],
      serie: [{
        time, cape: vuoti, weather_code: vuoti, wind_gusts_10m: vuoti,
        precipitation_probability: vuoti, temperature_2m,
      }],
      elevations: [2000],
    });
    expect(r.rows[0].hour?.temp).toBe(9);
    expect(r.rows[0].modelElevation).toBe(2000);
    expect(scartoQuota(r.rows[0])).toBe(0);
  });

  test('senza temperature nella risposta, la riga non ne inventa una', () => {
    const giorno = new Date().toISOString().slice(0, 10);
    const r = buildRouteWeather({
      waypoints: [wp(0)], legs: [], departure: new Date(`${giorno}T09:00:00.000Z`),
      punti: [{ waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'WP 0', alt: 2000 }],
      serie: [{
        time: [`${giorno}T09:00`], cape: [0], weather_code: [0], wind_gusts_10m: [0],
        precipitation_probability: [0], temperature_2m: [],
      }],
    });
    expect(Number.isFinite(r.rows[0].hour?.temp)).toBe(false);
    // E senza le quote del modello, lo scarto non si sa: non e' "zero".
    expect(r.rows[0].modelElevation).toBeNull();
    expect(scartoQuota(r.rows[0])).toBeNull();
  });
});

/**
 * **Le soste nel rapporto meteo.**
 *
 * Scelta dell'utente: se la sosta dura ≥ 1 ora, il meteo all'arrivo e alla ripartenza
 * possono essere diversi, quindi il punto compare DUE volte (arrivo e ripartenza). Sotto
 * l'ora, la lettura oraria sarebbe la stessa e la seconda riga sarebbe un doppione:
 * una riga sola, e la sosta slitta solo gli arrivi successivi.
 */
describe('le soste nel rapporto', () => {
  const partenza = new Date('2026-08-28T05:00:00Z'); // 07:00 IT
  // Serie con weathercode temporale (95) solo alle 09:00 UTC (11:00 IT), sereno altrove.
  const serie = () => {
    const time: string[] = []; const cape: number[] = []; const wc: number[] = [];
    const g: number[] = []; const pp: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-08-28T${String(h).padStart(2, '0')}:00`);
      cape.push(0); g.push(10); pp.push(0);
      wc.push(h === 9 ? 95 : 0);   // 09:00 UTC = temporale
    }
    return { time, cape, weather_code: wc, wind_gusts_10m: g, precipitation_probability: pp, temperature_2m: [] };
  };
  const punto = (i: number) => ({ waypointIndex: i, lat: 46.4 + i / 100, lon: 11.8, name: `P${i}`, alt: null });

  test('sosta lunga (>= 1h): due righe per il punto, arrivo e ripartenza', () => {
    // arrivo a P1 alle 08:00 UTC (180 min dopo la partenza delle 05:00), sosta 90 min -> ripartenza 09:30
    const conPausa = { ...wp(1), pausaMin: 90 };
    const r = buildRouteWeather({
      waypoints: [wp(0), conPausa], legs: [leg(0, 180)], departure: partenza,
      punti: [punto(0), punto(1)],
      serie: [serie(), serie()],
    });
    const righeP1 = r.rows.filter((x) => x.waypointIndex === 1);
    expect(righeP1).toHaveLength(2);
    expect(righeP1[0].fase).toBe('arrivo');
    expect(righeP1[1].fase).toBe('ripartenza');
    // l'arrivo è alle 08:00 UTC (sereno), la ripartenza alle 09:30 -> l'ora vicina è le 09:00 (temporale)
    expect(righeP1[0].classification.level).toBe(0);
    expect(righeP1[1].classification.level).toBe(3);
    expect(SOGLIA_PAUSA_METEO).toBe(60);
  });

  test('sosta breve (< 1h): una riga sola, ma la sosta è dichiarata', () => {
    const conPausa = { ...wp(1), pausaMin: 20 };
    const r = buildRouteWeather({
      waypoints: [wp(0), conPausa, wp(2)], legs: [leg(0, 60), leg(1, 60)], departure: partenza,
      punti: [punto(0), punto(1), punto(2)],
      serie: [serie(), serie(), serie()],
    });
    const righeP1 = r.rows.filter((x) => x.waypointIndex === 1);
    expect(righeP1).toHaveLength(1);
    expect(righeP1[0].fase).toBeUndefined();
    expect(righeP1[0].pausaMin).toBe(20);
  });

  test('la sosta breve sposta comunque l arrivo al punto successivo', () => {
    const conPausa = { ...wp(1), pausaMin: 20 };
    const senza = buildRouteWeather({
      waypoints: [wp(0), wp(1), wp(2)], legs: [leg(0, 60), leg(1, 60)], departure: partenza,
      punti: [punto(0), punto(1), punto(2)], serie: [serie(), serie(), serie()],
    });
    const con = buildRouteWeather({
      waypoints: [wp(0), conPausa, wp(2)], legs: [leg(0, 60), leg(1, 60)], departure: partenza,
      punti: [punto(0), punto(1), punto(2)], serie: [serie(), serie(), serie()],
    });
    const arrivoP2 = (r: typeof con) => r.rows.filter((x) => x.waypointIndex === 2)[0].arrival;
    const diff = (new Date(arrivoP2(con)!).getTime() - new Date(arrivoP2(senza)!).getTime()) / 60000;
    expect(diff).toBe(20);
  });

  test('senza sosta il punto resta una riga sola, senza pausaMin ne fase', () => {
    const r = buildRouteWeather({
      waypoints: [wp(0), wp(1)], legs: [leg(0, 60)], departure: partenza,
      punti: [punto(0), punto(1)], serie: [serie(), serie()],
    });
    const p1 = r.rows.filter((x) => x.waypointIndex === 1)[0];
    expect(p1.pausaMin).toBeUndefined();
    expect(p1.fase).toBeUndefined();
  });
});

describe('punti in mezzo sui tratti lunghi (densificazione)', () => {
  const far = (i: number, lat: number, lon: number, alt: number | null = 1000): Waypoint => ({
    id: `f${i}`, name: `F${i}`, lat, lon, altitude: alt, order: i,
  });

  test('due waypoint vicini: nessun punto in mezzo', () => {
    const p = samplePoints([far(0, 46.0, 11.0), far(1, 46.02, 11.0)]); // ~2,2 km
    expect(p).toHaveLength(2);
    expect(p.every((x) => x.intermedio == null)).toBe(true);
  });

  test('due waypoint lontani: punti in mezzo, e nessun buco oltre ~5 km', () => {
    const p = samplePoints([far(0, 46.0, 11.0), far(1, 46.108, 11.0)]); // ~12 km
    // gli estremi restano i waypoint reali
    expect(p[0].intermedio).toBeUndefined();
    expect(p[p.length - 1].intermedio).toBeUndefined();
    const mezzi = p.filter((x) => x.intermedio != null);
    expect(mezzi.length).toBeGreaterThan(0);
    for (let k = 1; k < p.length; k++) {
      const d = haversineDistance(p[k - 1].lat, p[k - 1].lon, p[k].lat, p[k].lon);
      expect(d).toBeLessThanOrEqual(SPAZIO_MAX_KM + 0.6);
    }
    const m = mezzi[0];
    expect(m.intermedio!.traA).toBe('F0');
    expect(m.intermedio!.traB).toBe('F1');
    expect(m.intermedio!.frazione).toBeGreaterThan(0);
    expect(m.intermedio!.frazione).toBeLessThan(1);
    expect(m.intermedio!.kmDaInizio).toBeGreaterThan(0);
    expect(m.alt).not.toBeNull(); // quota interpolata fra 1000 e 1000
  });

  test('percorso lunghissimo con 2 soli waypoint: si resta entro il tetto', () => {
    const p = samplePoints([far(0, 45.0, 11.0), far(1, 46.0, 11.0)]); // ~111 km
    expect(p.length).toBeLessThanOrEqual(12);
    expect(p.filter((x) => x.intermedio != null).length).toBe(10); // 12 - 2 reali
  });

  test('quota mancante a un estremo: intermedio senza quota, non zero', () => {
    const p = samplePoints([far(0, 46.0, 11.0, null), far(1, 46.108, 11.0, 1500)]);
    const m = p.find((x) => x.intermedio != null);
    expect(m).toBeDefined();
    expect(m!.alt).toBeNull(); // «non lo so», non 750
  });
});

describe('righeVisibili: gli intermedi si mostrano solo se critici', () => {
  const riga = (over: Partial<RigaPercorso>): RigaPercorso => ({
    waypointIndex: 0, name: 'x', alt: null, modelElevation: null, arrival: null, hour: null,
    classification: { level: 0, reasons: [] }, ...over,
  });
  const meta = { ibIndex: 1, frazione: 0.5, kmDaInizio: 6, traA: 'A', traB: 'B' };

  test('un waypoint reale si mostra sempre, anche a livello 0', () => {
    expect(righeVisibili([riga({})])).toHaveLength(1);
  });

  test('un intermedio sotto la soglia (0 o 1) è nascosto', () => {
    const rows = [riga({ intermedio: meta, classification: { level: 1, reasons: [] } })];
    expect(righeVisibili(rows)).toHaveLength(0);
  });

  test('un intermedio da Attenzione in su si mostra', () => {
    const rows = [riga({ intermedio: meta, classification: { level: SOGLIA_MOSTRA_INTERMEDIO, reasons: ['x'] } })];
    expect(righeVisibili(rows)).toHaveLength(1);
  });
});

describe('il meteo in mezzo nel rapporto', () => {
  const far = (i: number, lat: number, lon: number): Waypoint => ({
    id: `f${i}`, name: `F${i}`, lat, lon, altitude: 1000, order: i,
  });
  const serieCostante = (over: Partial<{ cape: number; weather_code: number; gusts: number; precip: number }> = {}) => {
    const time: string[] = [], cape: number[] = [], weather_code: number[] = [];
    const wind_gusts_10m: number[] = [], precipitation_probability: number[] = [], temperature_2m: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`2026-08-28T${String(h).padStart(2, '0')}:00`);
      cape.push(over.cape ?? 0); weather_code.push(over.weather_code ?? 0);
      wind_gusts_10m.push(over.gusts ?? 10); precipitation_probability.push(over.precip ?? 0);
      temperature_2m.push(15);
    }
    return { time, cape, weather_code, wind_gusts_10m, precipitation_probability, temperature_2m };
  };
  const partenza = new Date('2026-08-28T05:00:00Z');
  const A = far(0, 46.0, 11.0), B = far(1, 46.108, 11.0); // ~12 km

  test('un punto in mezzo ha un orario di arrivo fra A e B', () => {
    const punti = samplePoints([A, B]);
    const r = buildRouteWeather({
      waypoints: [A, B], legs: [leg(0, 120)], departure: partenza, punti,
      serie: punti.map(() => serieCostante()),
    });
    const arrA = new Date(r.rows[0].arrival as string).getTime();
    const arrB = new Date(r.rows[r.rows.length - 1].arrival as string).getTime();
    const mezzi = r.rows.filter((x) => x.intermedio != null);
    expect(mezzi.length).toBeGreaterThan(0);
    for (const m of mezzi) {
      const t = new Date(m.arrival as string).getTime();
      expect(t).toBeGreaterThan(arrA);
      expect(t).toBeLessThan(arrB);
    }
  });

  test('un temporale su un punto in mezzo alza il verdetto e rende visibile la riga', () => {
    const punti = samplePoints([A, B]);
    const idxMezzo = punti.findIndex((x) => x.intermedio != null);
    const serie = punti.map((_, k) => (k === idxMezzo ? serieCostante({ weather_code: 95 }) : serieCostante()));
    const r = buildRouteWeather({ waypoints: [A, B], legs: [leg(0, 120)], departure: partenza, punti, serie });
    expect(r.verdict.level).toBe(3);
    const visibili = righeVisibili(r.rows);
    expect(visibili.some((x) => x.intermedio != null && x.classification.level === 3)).toBe(true);
    // gli altri intermedi (sereni) restano nascosti
    const mezziTotali = r.rows.filter((x) => x.intermedio != null).length;
    const mezziVisibili = visibili.filter((x) => x.intermedio != null).length;
    expect(mezziVisibili).toBeLessThan(mezziTotali);
    // Il verdetto nomina il TRATTO, senza virgolette annidate («tra «A» e «B»»).
    expect(r.verdict.message).toContain('nel tratto tra «F0» e «F1»');
    expect(r.verdict.message).not.toContain('«tra «');
  });
});
