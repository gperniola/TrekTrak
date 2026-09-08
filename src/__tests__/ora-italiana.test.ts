import {
  giornoItaliano,
  istanteItaliano,
  oraItalianaDi,
  minutiItalianiDi,
  defaultDeparture,
} from '@/lib/route-weather';

/**
 * Il pannello meteo scrive OGNI orario in ora italiana — arrivi, fasce critiche, alba
 * e tramonto — ma costruiva l'ora di partenza con `setHours`, cioe' col fuso del
 * dispositivo. Su una macchina fuori dall'Italia si sceglieva "le 5" e la tabella
 * partiva dalle 07:00: le due meta' dello stesso pannello parlavano di due fusi.
 *
 * Trovato perche' la suite falliva con `TZ=UTC`, e non era colpa del test.
 */
const leggiOraRoma = (d: Date) =>
  d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });

describe('la partenza si sceglie in ora italiana', () => {
  test('le 5 scelte sono le 5 italiane, non le 5 del dispositivo', () => {
    expect(leggiOraRoma(istanteItaliano('2026-08-28', 5))).toBe('05:00');
    expect(leggiOraRoma(istanteItaliano('2026-08-28', 0))).toBe('00:00');
    expect(leggiOraRoma(istanteItaliano('2026-08-28', 23))).toBe('23:00');
  });

  test('vale anche con l ora solare, quando lo scarto da UTC cambia', () => {
    // agosto: UTC+2 -> le 5 italiane sono le 03:00Z
    expect(istanteItaliano('2026-08-28', 5).toISOString()).toBe('2026-08-28T03:00:00.000Z');
    // gennaio: UTC+1 -> le 5 italiane sono le 04:00Z
    expect(istanteItaliano('2026-01-15', 5).toISOString()).toBe('2026-01-15T04:00:00.000Z');
    expect(leggiOraRoma(istanteItaliano('2026-01-15', 5))).toBe('05:00');
  });

  test('rileggere l ora di un istante da' + ' lo stesso numero che si e scelto', () => {
    for (const ora of [0, 5, 7, 13, 23]) {
      expect(oraItalianaDi(istanteItaliano('2026-08-28', ora))).toBe(ora);
      expect(oraItalianaDi(istanteItaliano('2026-01-15', ora))).toBe(ora);
    }
  });

  test('il giorno di un istante e quello civile italiano', () => {
    // 22:30Z del 28 agosto sono gia' le 00:30 del 29 in Italia
    expect(giornoItaliano(new Date('2026-08-28T22:30:00Z'))).toBe('2026-08-29');
    expect(giornoItaliano(istanteItaliano('2026-08-28', 23))).toBe('2026-08-28');
  });
});

/**
 * I minuti della partenza: il menu ne offre uno (a passi di 5) accanto all'ora, perche'
 * chi parte alle 7:30 non poteva sceglierlo quando c'era solo l'ora. Lo scarto del fuso
 * in Italia e' sempre di ore intere, quindi i minuti non lo toccano: le 7:30 italiane
 * sono le 7:30 in ogni stagione, cambia solo l'ora dietro.
 */
describe('anche i minuti della partenza sono in ora italiana', () => {
  test('l istante costruito porta i minuti scelti', () => {
    expect(leggiOraRoma(istanteItaliano('2026-08-28', 7, 30))).toBe('07:30');
    expect(leggiOraRoma(istanteItaliano('2026-08-28', 0, 5))).toBe('00:05');
    expect(leggiOraRoma(istanteItaliano('2026-08-28', 23, 55))).toBe('23:55');
  });

  test('senza minuti l istante e in punto (default retrocompatibile)', () => {
    expect(leggiOraRoma(istanteItaliano('2026-08-28', 9))).toBe('09:00');
    expect(minutiItalianiDi(istanteItaliano('2026-08-28', 9))).toBe(0);
  });

  test('i minuti si sommano diritti anche con l ora solare', () => {
    // gennaio, UTC+1: le 7:30 italiane sono le 06:30Z — i minuti restano 30
    expect(istanteItaliano('2026-01-15', 7, 30).toISOString()).toBe('2026-01-15T06:30:00.000Z');
    expect(minutiItalianiDi(istanteItaliano('2026-01-15', 7, 30))).toBe(30);
  });

  test('rileggere i minuti da' + ' lo stesso numero che si e scelto', () => {
    for (const min of [0, 5, 15, 30, 45, 55]) {
      expect(minutiItalianiDi(istanteItaliano('2026-08-28', 8, min))).toBe(min);
      expect(minutiItalianiDi(istanteItaliano('2026-01-15', 8, min))).toBe(min);
    }
  });

  test('cambiare solo l ora conserva i minuti gia scelti', () => {
    // Come fa ScegliPartenza: legge ora+minuti dall'istante e ricostruisce.
    const partenza = istanteItaliano('2026-08-28', 7, 30);
    const nuovaOra = istanteItaliano(
      giornoItaliano(partenza), 9, minutiItalianiDi(partenza),
    );
    expect(leggiOraRoma(nuovaOra)).toBe('09:30');
  });
});

/**
 * `defaultDeparture` decide "oggi" o "domani" guardando l'ora: quell'ora dev'essere
 * quella italiana, altrimenti la proposta cambia a seconda di dove e' impostato il
 * telefono.
 */
describe('la partenza proposta ragiona in ora italiana', () => {
  test('di primo mattino propone oggi, all ora successiva', () => {
    // 06:00Z di agosto = 08:00 italiane
    const scelta = defaultDeparture(new Date('2026-08-28T06:00:00Z'));
    expect(giornoItaliano(scelta)).toBe('2026-08-28');
    expect(oraItalianaDi(scelta)).toBe(9);
  });

  test('nel cuore della notte non propone un orario gia passato', () => {
    // 01:00Z = 03:00 italiane: la proposta non puo' essere prima di adesso
    const adesso = new Date('2026-08-28T01:00:00Z');
    const scelta = defaultDeparture(adesso);
    expect(scelta.getTime()).toBeGreaterThanOrEqual(adesso.getTime());
  });

  test('dal tardo mattino in poi propone domani alle 7 italiane', () => {
    // 09:00Z = 11:00 italiane
    const scelta = defaultDeparture(new Date('2026-08-28T09:00:00Z'));
    expect(giornoItaliano(scelta)).toBe('2026-08-29');
    expect(oraItalianaDi(scelta)).toBe(7);
    expect(leggiOraRoma(scelta)).toBe('07:00');
  });
});
