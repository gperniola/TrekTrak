import { QUANTI_ANELLI, anelliPerVista, etichettaRaggio, passoAnelli } from '@/lib/anelli-distanza';

/**
 * Gli **anelli di distanza** attorno al punto (chiesti il 2026-09-03).
 *
 * Quello che si prova qui non è l'aritmetica dei multipli, ma le due decisioni: che i
 * numeri siano **tondi** — un anello a 337 m non si tiene a mente, quindi non serve a
 * niente — e che ce ne stiano tre **dentro la vista**, perché un anello fuori schermo non
 * si vede e uno solo non dà la scala.
 */
describe('anelli di distanza', () => {
  describe('il passo', () => {
    test('è sempre un numero tondo della scala 1-2-5', () => {
      const ammessi = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000];
      for (const raggio of [40, 100, 340, 700, 1500, 3300, 8000, 17_000, 60_000, 250_000]) {
        const p = passoAnelli(raggio);
        if (p != null) expect(ammessi).toContain(p);
      }
    });

    test('tre anelli ci stanno dentro la vista', () => {
      for (const raggio of [100, 340, 700, 1500, 3300, 8000, 17_000, 60_000]) {
        const p = passoAnelli(raggio);
        if (p != null) expect(p * QUANTI_ANELLI).toBeLessThanOrEqual(raggio);
      }
    });

    /**
     * Il passo scelto è il **più grande** che ci sta: con un passo troppo piccolo i tre
     * anelli si accalcano attorno al punto e la parte utile della vista resta senza
     * riferimenti.
     */
    test('e nessun passo più grande ci starebbe', () => {
      const ammessi = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000];
      for (const raggio of [340, 700, 1500, 3300, 8000]) {
        const p = passoAnelli(raggio) as number;
        const successivo = ammessi[ammessi.indexOf(p) + 1];
        expect(successivo * QUANTI_ANELLI).toBeGreaterThan(raggio);
      }
    });

    /**
     * Su una vista minuscola (pochi metri, zoom massimo) nessun anello della scala ci
     * sta: meglio non disegnarne che disegnarne uno che esce dallo schermo.
     */
    test('in una vista troppo piccola non si disegna niente', () => {
      expect(passoAnelli(20)).toBeNull();
      expect(anelliPerVista(20)).toEqual([]);
    });

    test('una vista assurda non produce anelli assurdi', () => {
      expect(passoAnelli(0)).toBeNull();
      expect(passoAnelli(-100)).toBeNull();
      expect(passoAnelli(Number.NaN)).toBeNull();
      // Un raggio infinito non e' una vista: e' un dato rotto, e la risposta e' "non lo
      // so". La prima stesura di questo test si aspettava il passo piu' grande della
      // scala, cioe' pretendeva che il codice indovinasse.
      expect(passoAnelli(Number.POSITIVE_INFINITY)).toBeNull();
    });
  });

  describe('gli anelli', () => {
    test('sono tre, multipli del passo, dal più vicino', () => {
      const a = anelliPerVista(3300); // passo 1 km
      expect(a.map((x) => x.raggio)).toEqual([1000, 2000, 3000]);
    });

    /**
     * Le etichette passano dal formattatore dell'app: sotto il chilometro i metri, sopra
     * i chilometri con la **virgola** decimale. Un anello che dicesse «1.5 km» mentre il
     * pannello della bussola dice «1,5 km» sarebbe la stessa distanza scritta in due modi
     * nella stessa schermata — ed è il difetto che questo progetto ha corretto in 55
     * punti nella v0.13.3.
     */
    test('le etichette sono scritte all italiana', () => {
      expect(etichettaRaggio(500)).toBe('500 m');
      expect(etichettaRaggio(1000)).toBe('1 km');
      expect(etichettaRaggio(1500)).toBe('1,5 km');
      expect(etichettaRaggio(10_000)).toBe('10 km');
      expect(anelliPerVista(3300).map((x) => x.etichetta)).toEqual(['1 km', '2 km', '3 km']);
    });

    test('niente punti decimali all inglese, in nessun caso della scala', () => {
      for (const raggio of [60, 150, 400, 900, 2400, 7000, 30_000, 150_000]) {
        for (const a of anelliPerVista(raggio)) {
          expect(a.etichetta).not.toMatch(/\d\.\d/);
        }
      }
    });
  });
});
