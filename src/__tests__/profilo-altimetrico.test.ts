import { describe, expect, test } from '@jest/globals';
import type { Leg, Waypoint } from '@/lib/types';
import {
  costruisciProfilo,
  dominioY,
  messaggioProfiloVuoto,
  uniscoProfili,
} from '@/lib/profilo-altimetrico';

/**
 * **Il profilo altimetrico.**
 *
 * `ElevationProfile` era il componente più intricato dell'app e **l'unico grosso senza
 * nessun test**: centocinque righe di calcolo dentro un `useMemo`, in mezzo a Recharts.
 * Ora il calcolo è un modulo, e queste sono le domande che prima non si potevano fare.
 */

const wp = (i: number, altitude: number | null): Waypoint => ({
  id: `w${i}`, name: `P${i}`, lat: 42 + i / 100, lon: 14, altitude, order: i,
});

const tratta = (da: number, a: number, dati: Partial<Leg> = {}): Leg => ({
  id: `l${da}`, fromWaypointId: `w${da}`, toWaypointId: `w${a}`,
  distance: null, elevationGain: null, elevationLoss: null, azimuth: null,
  ...dati,
});

describe('la curva', () => {
  test('senza tratte e senza quote non c e profilo', () => {
    expect(costruisciProfilo([], [], 'learn').profileData).toEqual([]);
  });

  test('con due quote e una distanza disegna una spezzata di due punti', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, 1500)],
      [tratta(0, 1, { distance: 2 })],
      'learn',
    );
    expect(p.profileData).toEqual([
      { distance: 0, altitude: 1000 },
      { distance: 2, altitude: 1500 },
    ]);
  });

  /**
   * Quando la tratta porta il suo profilo campionato dal modello del terreno, si usa
   * quello: e' la differenza fra una spezzata e il terreno vero.
   */
  test('il profilo campionato di una tratta ha la precedenza sulle sole quote', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, 1500)],
      [tratta(0, 1, {
        distance: 2,
        elevationProfile: [
          { distance: 0, altitude: 1000 },
          { distance: 1, altitude: 1400 },
          { distance: 2, altitude: 1500 },
        ],
      })],
      'track',
    );
    expect(p.profileData).toHaveLength(3);
    expect(p.profileData[1]).toEqual({ distance: 1, altitude: 1400 });
  });

  /**
   * **Il primo punto di una tratta e' l'ultimo della precedente**: se si tenessero
   * entrambi, il grafico avrebbe un punto doppio a ogni giunzione.
   */
  test('due tratte in fila non ripetono il punto di giunzione', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, 1200), wp(2, 1300)],
      [
        tratta(0, 1, { distance: 1, elevationProfile: [
          { distance: 0, altitude: 1000 }, { distance: 1, altitude: 1200 },
        ] }),
        tratta(1, 2, { distance: 1, elevationProfile: [
          { distance: 0, altitude: 1200 }, { distance: 1, altitude: 1300 },
        ] }),
      ],
      'track',
    );
    expect(p.profileData).toEqual([
      { distance: 0, altitude: 1000 },
      { distance: 1, altitude: 1200 },
      { distance: 2, altitude: 1300 },
    ]);
  });

  /**
   * **Difetto: due quote senza distanze producono due punti allo stesso chilometro.**
   *
   * E' lo stato normale in Imparo appena si scrivono le quote e non ancora le distanze.
   * Il ripiego mette entrambi i punti a 0 km, quindi il componente disegna il grafico (i
   * punti sono due) con un asse orizzontale che va da zero a zero: si vede una riga
   * verticale sotto la scritta «Profilo altimetrico», invece della frase che dice che
   * mancano le distanze. E' la classe di difetto piu' ripetuta di questo progetto:
   * mostrare qualcosa di sbagliato invece di dire che non si sa.
   *
   * Marcato `failing` perche' descrive il comportamento **giusto**, che il codice non ha
   * ancora: la correzione arriva nel commit dopo lo spacchettamento.
   */
  test.failing('due quote senza distanze non sono un profilo', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, 1500)],
      [tratta(0, 1)],
      'learn',
    );
    expect(p.profileData.length).toBeLessThan(2);
  });

  test('un waypoint senza quota non entra nella curva', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, null), wp(2, 1300)],
      [tratta(0, 1, { distance: 1 }), tratta(1, 2, { distance: 1 })],
      'learn',
    );
    expect(p.profileData).toEqual([
      { distance: 0, altitude: 1000 },
      { distance: 2, altitude: 1300 },
    ]);
  });
});

describe('i pallini dei waypoint', () => {
  test('portano il nome, e la distanza cumulata', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, 1200), wp(2, 1100)],
      [tratta(0, 1, { distance: 1.5 }), tratta(1, 2, { distance: 2.5 })],
      'learn',
    );
    expect(p.waypointDots).toEqual([
      { distance: 0, altitude: 1000, name: 'P0' },
      { distance: 1.5, altitude: 1200, name: 'P1' },
      { distance: 4, altitude: 1100, name: 'P2' },
    ]);
  });

  test('un waypoint senza nome prende un numero', () => {
    const p = costruisciProfilo([{ ...wp(0, 900), name: '' }], [], 'learn');
    expect(p.waypointDots[0].name).toBe('WP1');
  });

  test('un waypoint senza quota non ha pallino', () => {
    const p = costruisciProfilo([wp(0, null)], [], 'learn');
    expect(p.waypointDots).toEqual([]);
  });
});

describe('il profilo reale sovrapposto (solo in Imparo)', () => {
  const conReale = (): Leg[] => [tratta(0, 1, {
    distance: 3,
    trackValues: {
      distance: 5, elevationGain: 500, elevationLoss: 0, azimuth: 0,
      elevationProfile: [
        { distance: 0, altitude: 1000 },
        { distance: 2.5, altitude: 1300 },
        { distance: 5, altitude: 1500 },
      ],
    },
  })];

  test('in Imparo c e, e viene dai valori di Pianificazione', () => {
    const p = costruisciProfilo([wp(0, 1000), wp(1, 1500)], conReale(), 'learn');
    expect(p.realProfileData).toHaveLength(3);
    expect(p.realProfileData[2]).toEqual({ distance: 5, altitude: 1500 });
  });

  /** In Pianificazione la curva **e'** quella reale: sovrapporla a se stessa non dice niente. */
  test('in Pianificazione non c e', () => {
    const p = costruisciProfilo([wp(0, 1000), wp(1, 1500)], conReale(), 'track');
    expect(p.realProfileData).toEqual([]);
  });

  /**
   * **I due profili devono condividere l'asse delle distanze.**
   *
   * L'utente ha stimato 3 km su una tratta che ne misura 5. Se la sua spezzata si
   * spaziasse coi suoi 3 km e quella reale coi 5, le due curve andrebbero fuori registro
   * e sembrerebbe sbagliata la quota invece della distanza. Quindi quando esiste una
   * distanza reale, e' quella a spaziare **entrambe**.
   */
  test('quando c e il reale, anche la stima si spazia sulle distanze reali', () => {
    const p = costruisciProfilo([wp(0, 1000), wp(1, 1500)], conReale(), 'learn');
    expect(p.profileData[1].distance).toBe(5); // non 3, che e' la stima dell'utente
    expect(p.waypointDots[1].distance).toBe(5);
  });

  test('senza nessun profilo reale non si sovrappone niente', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, 1500)],
      [tratta(0, 1, { distance: 2 })],
      'learn',
    );
    expect(p.realProfileData).toEqual([]);
  });

  /**
   * Una tratta senza profilo reale in mezzo a due che l'hanno: la distanza cumulata deve
   * avanzare comunque, altrimenti la seconda meta' della curva reale scivolerebbe
   * indietro e finirebbe sopra la prima.
   */
  test.failing('una tratta senza reale in mezzo non fa perdere la giunzione', () => {
    const p = costruisciProfilo(
      [wp(0, 1000), wp(1, 1200), wp(2, 1400)],
      [
        tratta(0, 1, { distance: 2 }),
        tratta(1, 2, { distance: 3, trackValues: {
          distance: 3, elevationGain: 200, elevationLoss: 0, azimuth: 0,
          elevationProfile: [
            { distance: 0, altitude: 1200 },
            { distance: 3, altitude: 1400 },
          ],
        } }),
      ],
      'learn',
    );
    /*
      La prima tratta non ha profilo reale, la seconda si'. Il salto del primo punto delle
      tratte successive alla prima serve a non ripetere il punto di giunzione — ma quando
      la tratta precedente non ha contribuito niente, quel punto NON c'e' e viene perso:
      la curva reale comincia a mezza salita, e se cosi' le restano meno di due punti
      **spariscce del tutto** senza dirlo. Misurato: con tre punti nel profilo reale della
      seconda tratta, la curva parte da 3,5 km invece che da 2.
    */
    expect(p.realProfileData[0].distance).toBe(2);
    expect(p.realProfileData[0].altitude).toBe(1200);
    expect(p.realProfileData[1].distance).toBe(5);
  });
});

describe('unire i due profili', () => {
  const stima = [{ distance: 0, altitude: 1000 }, { distance: 2, altitude: 1500 }];

  test('senza reale, ogni punto ha solo la quota dell utente', () => {
    expect(uniscoProfili(stima, [])).toEqual([
      { distance: 0, altitude: 1000, realAltitude: undefined },
      { distance: 2, altitude: 1500, realAltitude: undefined },
    ]);
  });

  test('alle stesse distanze le due quote stanno sullo stesso punto', () => {
    const unito = uniscoProfili(stima, [
      { distance: 0, altitude: 1000 }, { distance: 2, altitude: 1450 },
    ]);
    expect(unito[1]).toEqual({ distance: 2, altitude: 1500, realAltitude: 1450 });
  });

  /** Un punto che esiste solo nel reale entra comunque: il buco lo chiude `connectNulls`. */
  test('un punto solo nel reale entra con la sola quota reale', () => {
    const unito = uniscoProfili(stima, [
      { distance: 0, altitude: 1000 },
      { distance: 1, altitude: 1250 },
      { distance: 2, altitude: 1450 },
    ]);
    expect(unito[1]).toEqual({ distance: 1, realAltitude: 1250 });
    expect(unito[1].altitude).toBeUndefined();
  });

  test('l elenco esce ordinato per distanza', () => {
    const unito = uniscoProfili(
      [{ distance: 4, altitude: 900 }, { distance: 0, altitude: 800 }],
      [{ distance: 2, altitude: 850 }, { distance: 1, altitude: 820 }],
    );
    expect(unito.map((p) => p.distance)).toEqual([0, 1, 2, 4]);
  });

  /** Un solo punto reale non e' un profilo: serve una linea, non un puntino. */
  test('un solo punto reale non conta come profilo reale', () => {
    const unito = uniscoProfili(stima, [{ distance: 1, altitude: 1250 }]);
    expect(unito).toHaveLength(2);
  });
});

describe('il dominio verticale', () => {
  /**
   * Il margine e' adattivo perche' un profilo che sale di trenta metri e uno che sale di
   * duemila hanno bisogno di due margini diversi: col 10% fisso il primo diventa una riga
   * piatta in mezzo al riquadro.
   */
  test('un dislivello piccolo prende cinque metri, arrotondati a cinque', () => {
    const { yMin, yMax } = dominioY(
      [{ distance: 0, altitude: 1000 }, { distance: 1, altitude: 1030 }], [],
    );
    expect({ yMin, yMax }).toEqual({ yMin: 995, yMax: 1035 });
  });

  test('un dislivello grande prende il dieci per cento, arrotondato a dieci', () => {
    const { yMin, yMax } = dominioY(
      [{ distance: 0, altitude: 1000 }, { distance: 1, altitude: 2000 }], [],
    );
    // 100 m di margine per parte, e i due estremi sono gia' multipli di 10.
    expect({ yMin, yMax }).toEqual({ yMin: 900, yMax: 2100 });
  });

  /*
    Fra 50 e 200 m il margine cresce da 5 a 10, ma l'arrotondamento a 10 lo nasconde quasi
    sempre: si vede solo quando il margine scavalca un multiplo di 10. Con la quota minima
    a 1006 m, un intervallo di 60 m tiene il fondo a 1000 e uno di 190 lo porta a 990.
  */
  test('nella fascia intermedia il margine cresce da cinque a dieci', () => {
    const stretto = dominioY([{ distance: 0, altitude: 1006 }, { distance: 1, altitude: 1066 }], []);
    const largo = dominioY([{ distance: 0, altitude: 1006 }, { distance: 1, altitude: 1196 }], []);
    expect(stretto.yMin).toBe(1000);
    expect(largo.yMin).toBe(990);
  });

  /** Se il reale esce dall'intervallo della stima, il grafico lo deve contenere. */
  test('il dominio comprende anche il profilo reale', () => {
    const { yMin, yMax } = dominioY(
      [{ distance: 0, altitude: 1000 }, { distance: 1, altitude: 1100 }],
      [{ distance: 0, altitude: 800 }, { distance: 1, altitude: 1400 }],
    );
    expect(yMin).toBeLessThan(800);
    expect(yMax).toBeGreaterThan(1400);
  });

  test('un solo punto reale non allarga il dominio', () => {
    const { yMin } = dominioY(
      [{ distance: 0, altitude: 1000 }, { distance: 1, altitude: 1030 }],
      [{ distance: 0, altitude: 100 }],
    );
    expect(yMin).toBe(995);
  });
});

describe('il messaggio quando il profilo non si puo disegnare', () => {
  /**
   * Tre casi distinti: «aggiungi almeno 2 waypoint» detto a chi ne ha tre e' una frase
   * che non dice cosa fare.
   */
  test('senza waypoint dice di toccare la mappa', () => {
    expect(messaggioProfiloVuoto([])).toContain('Tocca la mappa');
  });

  test('con waypoint ma senza quote dice che mancano le quote', () => {
    expect(messaggioProfiloVuoto([wp(0, null), wp(1, null), wp(2, null)]))
      .toContain('Inserisci la quota');
  });

  test('con waypoint e quote dice che serve altro', () => {
    const m = messaggioProfiloVuoto([wp(0, 1000), wp(1, 1200)]);
    expect(m).not.toContain('Tocca la mappa');
    expect(m).not.toContain('Inserisci la quota');
  });

  /** L'accento e' un accento vero, non una sequenza di caratteri letta a schermo. */
  test('l accento si legge', () => {
    expect(messaggioProfiloVuoto([])).toContain('comparirà');
    expect(messaggioProfiloVuoto([])).not.toContain('u00e0');
  });
});
