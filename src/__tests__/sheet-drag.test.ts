import {
  intenzione,
  puoPrendereIlComando,
  chiudeAlRilascio,
  opacitaBackdrop,
  FRAZIONE_CHIUSURA,
  VELOCITA_CHIUSURA,
} from '@/lib/sheet-drag';

/**
 * Il gesto "trascina in basso per chiudere" sugli sheet dal basso.
 *
 * Qui si verifica la parte che si puo' verificare: le decisioni. Il trascinamento vero
 * — dito, inerzia, conflitto con lo scorrimento — si prova a mano, e nessun test lo
 * sostituisce.
 */
describe('cosa sta facendo il dito', () => {
  test('pochi pixel non sono ancora un gesto', () => {
    expect(intenzione(0, 0)).toBe('attesa');
    expect(intenzione(3, 4)).toBe('attesa');
  });

  test('in basso e prevalentemente verticale: e una chiusura', () => {
    expect(intenzione(0, 20)).toBe('chiusura');
    expect(intenzione(8, 30)).toBe('chiusura');
  });

  /** Rubare un gesto orizzontale o verso l'alto e' il modo di rompere quello che c'era. */
  test('verso l alto non chiude', () => {
    expect(intenzione(0, -30)).toBe('altro');
  });

  test('prevalentemente orizzontale non chiude', () => {
    expect(intenzione(40, 12)).toBe('altro');
    expect(intenzione(-40, 12)).toBe('altro');
  });
});

describe('quando il foglio puo prendersi il comando', () => {
  test('dalla maniglia sempre, anche a contenuto scorso', () => {
    expect(puoPrendereIlComando({ daManiglia: true, scrollTop: 350 })).toBe(true);
  });

  test('dal corpo solo se il contenuto e in cima', () => {
    expect(puoPrendereIlComando({ daManiglia: false, scrollTop: 0 })).toBe(true);
    expect(puoPrendereIlComando({ daManiglia: false, scrollTop: 1 })).toBe(false);
    expect(puoPrendereIlComando({ daManiglia: false, scrollTop: 350 })).toBe(false);
  });
});

describe('al rilascio', () => {
  const ALTEZZA = 500;

  test('oltre la soglia chiude', () => {
    expect(chiudeAlRilascio(ALTEZZA * FRAZIONE_CHIUSURA, ALTEZZA, 800)).toBe(true);
    expect(chiudeAlRilascio(300, ALTEZZA, 800)).toBe(true);
  });

  test('sotto la soglia e piano torna al suo posto', () => {
    expect(chiudeAlRilascio(60, ALTEZZA, 800)).toBe(false);
  });

  /** Il colpo secco: poco spostamento ma veloce. E' il gesto che si fa davvero. */
  test('un colpo veloce chiude anche sotto la soglia', () => {
    const dy = 60;
    const durata = dy / VELOCITA_CHIUSURA; // esattamente alla velocita' di soglia
    expect(chiudeAlRilascio(dy, ALTEZZA, durata)).toBe(true);
    expect(chiudeAlRilascio(dy, ALTEZZA, durata * 4)).toBe(false);
  });

  test('verso l alto non chiude mai', () => {
    expect(chiudeAlRilascio(-300, ALTEZZA, 100)).toBe(false);
  });

  test('durata zero non fa dividere per zero', () => {
    expect(chiudeAlRilascio(10, ALTEZZA, 0)).toBe(false);
    expect(chiudeAlRilascio(300, ALTEZZA, 0)).toBe(true);
  });

  test('altezza sconosciuta: decide solo la velocita', () => {
    expect(chiudeAlRilascio(100, 0, 100)).toBe(true);
    expect(chiudeAlRilascio(10, 0, 1000)).toBe(false);
  });
});

describe('il backdrop sbiadisce mentre il foglio scende', () => {
  test('da opaco a trasparente', () => {
    expect(opacitaBackdrop(0, 400)).toBe(1);
    expect(opacitaBackdrop(200, 400)).toBe(0.5);
    expect(opacitaBackdrop(400, 400)).toBe(0);
  });

  test('non esce dall intervallo', () => {
    expect(opacitaBackdrop(900, 400)).toBe(0);
    expect(opacitaBackdrop(-50, 400)).toBe(1);
  });
});
