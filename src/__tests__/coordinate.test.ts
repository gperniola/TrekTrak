import { parseCoordinate, parseValore } from '@/lib/coordinate';

/**
 * TASK-26. Oggi l'unico modo di posizionare un waypoint con precisione è toccare la mappa
 * col dito: chi arriva con una coordinata già in mano — da una relazione, da una guida,
 * da un messaggio di un compagno — non ha nessuna porta d'ingresso.
 *
 * Il punto delicato è che **la virgola fa due mestieri**: separa i decimali all'italiana
 * e separa le due coordinate. `42,4419, 13,5595` è ambiguo a occhio nudo.
 *
 * Il riferimento di tutti i casi è lo stesso punto vero, Campo Imperatore:
 * 42,4419 N — 13,5595 E.
 */

const vicino = (v: number | null | undefined, atteso: number) => {
  expect(v).not.toBeNull();
  expect(v as number).toBeCloseTo(atteso, 3);
};

describe('un valore alla volta', () => {
  test('gradi decimali', () => {
    vicino(parseValore('42.4419'), 42.4419);
  });

  test('gradi decimali all italiana', () => {
    vicino(parseValore('42,4419'), 42.4419);
  });

  test('gradi primi secondi', () => {
    // 42° 26' 30,84" = 42 + 26/60 + 30.84/3600
    vicino(parseValore('42° 26\' 30.84" N'), 42.4419);
  });

  test('gradi e primi decimali, la forma dei geocacher', () => {
    vicino(parseValore("N 42 26.514"), 42.4419);
  });

  test('la lettera S rende negativo', () => {
    vicino(parseValore('33° 55\' 0" S'), -33.91667);
  });

  test('la O italiana e la W inglese valgono lo stesso', () => {
    vicino(parseValore('18° 25\' 0" O'), -18.41667);
    vicino(parseValore('18° 25\' 0" W'), -18.41667);
  });

  test('il meno esplicito funziona senza lettere', () => {
    vicino(parseValore('-33.91667'), -33.91667);
  });

  /** Primi e secondi stanno sotto 60: oltre, la stringa non era una coordinata. */
  test('primi o secondi fuori scala non si indovinano', () => {
    expect(parseValore('42° 75\' 0"')).toBeNull();
    expect(parseValore('42° 30\' 90"')).toBeNull();
  });

  test('quello che non e un numero non diventa zero', () => {
    expect(parseValore('')).toBeNull();
    expect(parseValore('nord')).toBeNull();
    expect(parseValore('   ')).toBeNull();
  });
});

describe('la coppia', () => {
  const CAMPO_IMPERATORE = { lat: 42.4419, lon: 13.5595 };

  const uguale = (testo: string, atteso = CAMPO_IMPERATORE) => {
    const c = parseCoordinate(testo);
    expect(c).not.toBeNull();
    expect(c!.lat).toBeCloseTo(atteso.lat, 3);
    expect(c!.lon).toBeCloseTo(atteso.lon, 3);
  };

  test('decimali con la virgola separatrice', () => {
    uguale('42.4419, 13.5595');
  });

  test('decimali separati dal solo spazio', () => {
    uguale('42.4419 13.5595');
  });

  test('decimali ALL ITALIANA, separati dallo spazio', () => {
    uguale('42,4419 13,5595');
  });

  /** Il caso che rende tutto ambiguo: quattro numeri e tre virgole. */
  test('decimali all italiana separati da virgola e spazio', () => {
    uguale('42,4419, 13,5595');
  });

  test('decimali all italiana separati da punto e virgola', () => {
    uguale('42,4419; 13,5595');
  });

  test('gradi primi secondi con le lettere', () => {
    uguale('42° 26\' 30.84" N, 13° 33\' 34.2" E');
  });

  test('gradi e primi decimali con la lettera davanti', () => {
    uguale('N 42 26.514, E 13 33.570');
  });

  /** Le lettere dicono quale è quale: l'ordine è solo una convenzione. */
  test('longitudine per prima, se lo dichiara', () => {
    uguale('E 13.5595, N 42.4419');
  });

  test('emisferi sud e ovest', () => {
    uguale('33° 55\' 0" S, 18° 25\' 0" O', { lat: -33.91667, lon: -18.41667 });
    uguale('-33.91667, -18.41667', { lat: -33.91667, lon: -18.41667 });
  });

  test('gli apici tipografici valgono come quelli dritti', () => {
    uguale('42° 26’ 30.84” N, 13° 33’ 34.2” E');
  });

  /**
   * Fuori dai limiti si rifiuta invece di avvicinarsi: un punto messo dove non e' non
   * si distingue da uno messo dove doveva stare, e nessuno lo verifica.
   */
  test('valori impossibili non vengono accettati', () => {
    expect(parseCoordinate('95, 13')).toBeNull();
    expect(parseCoordinate('42, 200')).toBeNull();
    expect(parseCoordinate('-91, 0')).toBeNull();
  });

  test('un numero solo non e una coppia', () => {
    expect(parseCoordinate('42.4419')).toBeNull();
  });

  test('testo che non c entra', () => {
    expect(parseCoordinate('Campo Imperatore')).toBeNull();
    expect(parseCoordinate('')).toBeNull();
    expect(parseCoordinate('42.4419, ciao')).toBeNull();
  });

  test('non e una stringa', () => {
    expect(parseCoordinate(null as never)).toBeNull();
    expect(parseCoordinate(42 as never)).toBeNull();
  });

  /**
   * Il caso citato nei criteri del task: incollando questo il waypoint deve finire sul
   * Corno Grande, in Abruzzo.
   */
  test('i due casi dichiarati nel task portano allo stesso punto', () => {
    const a = parseCoordinate('42.4768, 13.5602');
    const b = parseCoordinate('42° 28\' 36" N, 13° 33\' 37" E');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.lat).toBeCloseTo(b!.lat, 3);
    expect(a!.lon).toBeCloseTo(b!.lon, 3);
    expect(a!.lat).toBeCloseTo(42.4768, 4);
  });
});
