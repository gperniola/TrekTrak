import { MINUTI_POSIZIONE_ATTUALE, etaPosizione, nomePosizione } from '@/lib/eta-posizione';

/**
 * L'età della posizione disegnata sulla mappa.
 *
 * Il campo `at` dello store esisteva dalla v0.11.5 e non lo leggeva nessuno: aggiungendo
 * il punto sulla mappa quella dimenticanza è diventata un difetto vero — un rilevamento
 * di due ore prima disegnato come «sei qui».
 */
describe('eta della posizione', () => {
  const adesso = new Date('2026-09-03T12:00:00Z').getTime();
  const minutiFa = (n: number) => adesso - n * 60_000;

  test('sotto la soglia e attuale', () => {
    expect(etaPosizione(minutiFa(0), adesso).attuale).toBe(true);
    expect(etaPosizione(minutiFa(MINUTI_POSIZIONE_ATTUALE - 1), adesso).attuale).toBe(true);
  });

  test('dalla soglia in su non lo e piu', () => {
    expect(etaPosizione(minutiFa(MINUTI_POSIZIONE_ATTUALE), adesso).attuale).toBe(false);
    expect(etaPosizione(minutiFa(120), adesso).attuale).toBe(false);
  });

  test('la soglia vale qualche centinaio di metri a passo d uomo', () => {
    // Cinque minuti: a passo di escursione sono 400-500 m, gia' piu' dell'incertezza
    // di qualunque GPS. Una soglia di mezz'ora renderebbe la distinzione inutile.
    expect(MINUTI_POSIZIONE_ATTUALE).toBeGreaterThanOrEqual(2);
    expect(MINUTI_POSIZIONE_ATTUALE).toBeLessThanOrEqual(10);
  });

  test('lo dice a parole, come il resto dell app', () => {
    expect(etaPosizione(minutiFa(0), adesso).detta).toBe('adesso');
    expect(etaPosizione(minutiFa(12), adesso).detta).toBe('12 min fa');
    expect(etaPosizione(minutiFa(180), adesso).detta).toBe('3 h fa');
  });

  /**
   * L'orologio del dispositivo può essere spostato, o un fix arrivare con un
   * millisecondo di anticipo: «-3 min fa» non vuol dire niente.
   */
  test('un istante nel futuro conta come adesso, non come eta negativa', () => {
    const e = etaPosizione(adesso + 90_000, adesso);
    expect(e.minuti).toBe(0);
    expect(e.attuale).toBe(true);
    expect(e.detta).toBe('adesso');
  });

  describe('il nome accessibile', () => {
    test('dice sempre quando, perche a parole e l unico posto dove si legge', () => {
      expect(nomePosizione(etaPosizione(minutiFa(1), adesso))).toMatch(/La tua posizione, rilevata adesso/);
      expect(nomePosizione(etaPosizione(minutiFa(45), adesso))).toMatch(/Dov'eri, rilevato 45 min fa/);
    });

    test('una posizione vecchia non si presenta come «la tua posizione»', () => {
      expect(nomePosizione(etaPosizione(minutiFa(45), adesso))).not.toMatch(/La tua posizione/);
    });
  });
});
