import { classifyHour, SOGLIE_MODELLO, type OraDaClassificare } from '@/lib/route-weather';

/**
 * **Il pomeriggio del 2026-09-09 sulla Murgia: temporale osservato, app che taceva.**
 *
 * Segnalato dall'utente mentre stava succedendo — «ci sono dei temporali in corso lì ma
 * il modello che usavamo diceva coperto e verde». È il caso che ha fatto nascere tutto
 * questo lavoro, e sta qui perché non torni.
 *
 * **La verità non è un altro modello, sono le osservazioni.** METAR di Gioia del Colle
 * (LIBV, ~20 km da Altamura), quel pomeriggio:
 *
 * ```
 * 14:55 it.  FEW040TCU              cumuli in sviluppo
 * 16:55 it.  VCTS FEW040CB … RETS   temporale nelle vicinanze, e uno recente
 * 17:55 it.  VCTS FEW040CB          ancora in zona, temperatura 30 → 27
 * ```
 *
 * E a Grottaglie, `-TSRA` e poi `TS`: temporale con pioggia **sulla stazione**.
 *
 * I numeri qui sotto sono quelli **veri** dei due modelli per Altamura (40,8264 /
 * 16,5540), presi dall'archivio delle previsioni: non sono inventati per far passare il
 * test.
 */

/** Le letture vere dei due modelli, ora per ora. */
const ALTAMURA = {
  16: {
    icon: { weatherCode: 2, precipProb: 18, cape: 380, gusts: 13.3 },
    ecmwf: { weatherCode: 51, precipProb: 53, cape: 1030, gusts: 37.8 },
  },
  17: {
    icon: { weatherCode: 80, precipProb: 28, cape: 1390, gusts: 32.8 },
    ecmwf: { weatherCode: 0, precipProb: 65, cape: 960, gusts: 29.5 },
  },
  18: {
    icon: { weatherCode: 0, precipProb: 10, cape: 1230, gusts: 32.8 },
    ecmwf: { weatherCode: 0, precipProb: 54, cape: 1050, gusts: 22.3 },
  },
} as const;

const giudizio = (ora: 16 | 17 | 18, modello: 'icon' | 'ecmwf') => {
  const v = ALTAMURA[ora][modello];
  const lettura: OraDaClassificare = { time: `2026-09-09T${ora - 2}:00`, ...v };
  return classifyHour(lettura, SOGLIE_MODELLO[modello]);
};

describe('Altamura, 2026-09-09: il pomeriggio del temporale', () => {
  /**
   * Il difetto peggiore, e il più stupido: alle 17:00 il modello aveva in mano
   * `80 = rovesci deboli` e l'unico motivo che l'app scriveva era «raffiche 32».
   */
  test('con ICON la pioggia si nomina, non solo il vento', () => {
    const c = giudizio(17, 'icon');
    expect(c.reasons).toContain('rovesci deboli');
    expect(c.reasons.join(' ')).toMatch(/pioggia 28%/);
  });

  test('con ICON le 17:00 non sono più un giallo da vento', () => {
    expect(giudizio(17, 'icon').level).toBeGreaterThanOrEqual(2);
  });

  /** Alle 16:00 e alle 18:00 l'app era VERDE mentre il temporale era in zona. */
  test.each([[16], [18]] as const)('con ICON le %i:00 non sono più verdi', (ora) => {
    expect(giudizio(ora, 'icon').level).toBeGreaterThanOrEqual(1);
  });

  test('con ECMWF il pomeriggio è critico, come è stato davvero', () => {
    expect(giudizio(16, 'ecmwf').level).toBe(3);
    expect(giudizio(17, 'ecmwf').level).toBe(3);
    expect(giudizio(18, 'ecmwf').level).toBe(3);
    expect(giudizio(17, 'ecmwf').reasons.join(' ')).toMatch(/temporali forti/);
  });

  /**
   * Il confronto che spiega la tendina: alle 18:00 ECMWF grida e ICON sussurra. Nessuno
   * dei due è «sbagliato» — e per questo l'app dice sempre da chi vengono i numeri.
   */
  test('i due modelli non concordano, ed è il motivo per cui si sceglie', () => {
    expect(giudizio(18, 'ecmwf').level).toBeGreaterThan(giudizio(18, 'icon').level as number);
  });
});
