import { numero, km, metri, gradi, percento, distanza } from '@/lib/formato';
import { parseDecimale } from '@/components/shared/NumberInput';

describe('numeri scritti in italiano', () => {
  test('la virgola separa i decimali', () => {
    expect(numero(3.161, 3)).toBe('3,161');
    expect(numero(2.4, 1)).toBe('2,4');
    expect(numero(0.5, 1)).toBe('0,5');
  });

  test('il punto separa le migliaia', () => {
    expect(numero(1500)).toBe('1.500');
    expect(numero(12345)).toBe('12.345');
    expect(numero(1234567)).toBe('1.234.567');
    expect(numero(999)).toBe('999');
  });

  test('migliaia e decimali insieme', () => {
    expect(numero(1234.5, 1)).toBe('1.234,5');
  });

  test('i negativi tengono il segno, lo zero no', () => {
    expect(numero(-590)).toBe('-590');
    expect(numero(-0.4)).toBe('0');
    expect(numero(-0.04, 1)).toBe('0,0');
  });

  test('un valore non numerico si dichiara, non si stampa NaN', () => {
    expect(numero(NaN)).toBe('—');
    expect(numero(Infinity)).toBe('—');
    expect(distanza(NaN)).toBe('—');
  });

  test('le unita di misura', () => {
    expect(km(3.161)).toBe('3,2 km');
    expect(km(3.161, 3)).toBe('3,161 km');
    expect(metri(1500)).toBe('1.500 m');
    expect(gradi(45)).toBe('45,0°');
    expect(percento(11.1)).toBe('11,1%');
  });

  test('sotto il chilometro si scrive in metri', () => {
    expect(distanza(0.761)).toBe('761 m');
    expect(distanza(0.05)).toBe('50 m');
    expect(distanza(1)).toBe('1,0 km');
    expect(distanza(3.161)).toBe('3,2 km');
  });
});

/**
 * Il motivo per cui questa formattazione esiste: quello che l'app SCRIVE dev'essere
 * ribattibile nei suoi stessi campi e valere lo stesso numero. Prima non era vero —
 * `Calcolato: 3.161 km` letto in italiano fa 3161, e in un campo in metri l'app lo
 * interpretava proprio cosi'.
 */
describe('quello che stampo, riletto dai campi dell app, vale lo stesso numero', () => {
  test('una distanza in km torna indietro identica', () => {
    const stampato = numero(3.161, 3);
    expect(parseDecimale(stampato)).toBeCloseTo(3.161, 6);
  });

  test('una quota in metri torna indietro identica', () => {
    const stampato = numero(1500);
    expect(parseDecimale(stampato, true)).toBe(1500);
  });

  test('un dislivello sotto il migliaio torna indietro identico', () => {
    expect(parseDecimale(numero(380), true)).toBe(380);
  });

  test('una pendenza con un decimale torna indietro identica', () => {
    expect(parseDecimale(numero(11.1, 1))).toBeCloseTo(11.1, 6);
  });
});
