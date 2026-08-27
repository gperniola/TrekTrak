import { sunTimes } from '@/lib/sun';

/** Confronto in minuti, tollerando l'imprecisione dell'algoritmo (±3 minuti). */
function vicino(iso: string | null, atteso: string, tolleranzaMin = 3) {
  expect(iso).not.toBeNull();
  const d = new Date(iso as string);
  const [h, m] = atteso.split(':').map(Number);
  const attesoMin = h * 60 + m;
  // confronto in ora locale di Roma, che e' il fuso dei valori attesi
  const locale = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const realeMin = locale.getHours() * 60 + locale.getMinutes();
  expect(Math.abs(realeMin - attesoMin)).toBeLessThanOrEqual(tolleranzaMin);
}

/**
 * Essere colti dal buio è uno dei modi più comuni in cui una gita facile diventa un
 * problema. I valori attesi vengono dalle effemeridi pubblicate: se l'algoritmo sbaglia
 * di un'ora (errore tipico: segno della longitudine o fuso) questi test lo vedono.
 */
describe('alba, tramonto e crepuscolo', () => {
  test('Roma, solstizio d\'estate 2026', () => {
    // 21 giugno 2026 a Roma (41.90 N, 12.50 E): alba ~05:35, tramonto ~20:49 locali
    const t = sunTimes(41.9, 12.5, new Date('2026-06-21T12:00:00Z'));
    vicino(t.sunrise, '05:35');
    vicino(t.sunset, '20:49');
  });

  test('Roma, solstizio d\'inverno 2026', () => {
    // 21 dicembre 2026: alba ~07:34, tramonto ~16:41 locali
    const t = sunTimes(41.9, 12.5, new Date('2026-12-21T12:00:00Z'));
    vicino(t.sunrise, '07:34');
    vicino(t.sunset, '16:41');
  });

  test('il crepuscolo civile viene dopo il tramonto, di mezz\'ora circa', () => {
    const t = sunTimes(46.4, 11.8, new Date('2026-08-27T12:00:00Z'));
    const tramonto = new Date(t.sunset as string).getTime();
    const buio = new Date(t.civilDusk as string).getTime();
    const minuti = (buio - tramonto) / 60000;
    expect(minuti).toBeGreaterThan(20);
    expect(minuti).toBeLessThan(50);
  });

  test('in Dolomiti d\'agosto il giorno è lungo', () => {
    const t = sunTimes(46.4, 11.8, new Date('2026-08-27T12:00:00Z'));
    const ore = (new Date(t.sunset as string).getTime() - new Date(t.sunrise as string).getTime()) / 3600000;
    expect(ore).toBeGreaterThan(12.5);
    expect(ore).toBeLessThan(14);
  });

  /**
   * Oltre il circolo polare il sole puo' non tramontare: `null` significa "non
   * succede", che e' diverso da un orario inventato. Non e' un caso di TrekTrak, ma
   * un algoritmo che restituisce NaN silenziosamente e' un algoritmo che un giorno
   * stampa "Invalid Date" a schermo.
   */
  test('sole di mezzanotte a Capo Nord → null, non un orario finto', () => {
    const t = sunTimes(71.17, 25.78, new Date('2026-06-21T12:00:00Z'));
    expect(t.sunset).toBeNull();
    expect(t.sunrise).toBeNull();
  });

  test('coordinate non valide → tutto null', () => {
    const t = sunTimes(Number.NaN, 11.8, new Date('2026-08-27T12:00:00Z'));
    expect(t.sunrise).toBeNull();
    expect(t.sunset).toBeNull();
    expect(t.civilDusk).toBeNull();
  });
});
