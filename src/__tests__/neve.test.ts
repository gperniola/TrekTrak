import {
  GIORNI_INDIETRO_MAX, LEGENDA_NEVE, ZOOM_NATIVO_MASSIMO_NEVE, giorniDaProvare, giornoUTC, templateNeve,
} from '@/lib/snow-cover';

/**
 * Copertura nevosa da NASA GIBS (task-51).
 *
 * Tre cose provate, tutte misurate sul servizio vero il 2026-09-03: l'ordine dei
 * segnaposto nell'URL, il tetto di zoom che il servizio dichiara, e i colori della scala.
 */
describe('copertura nevosa', () => {
  /**
   * **`{y}` prima di `{x}`.** È la convenzione REST del WMTS, l'opposto di quella XYZ a
   * cui l'URL somiglia. Con l'ordine scambiato le mattonelle arrivano tutte — 200, PNG
   * validi — ma di un altro posto: un errore che non compare fra gli errori di rete e si
   * vede solo guardando la mappa.
   */
  test('l URL mette y prima di x, come vuole il WMTS', () => {
    const t = templateNeve('2026-02-15');
    expect(t).toContain('/{z}/{y}/{x}.png');
    expect(t.indexOf('{y}')).toBeLessThan(t.indexOf('{x}'));
  });

  test('la data sta nel percorso, non fra i parametri', () => {
    const t = templateNeve('2026-02-15');
    expect(t).toContain('/2026-02-15/');
    expect(t).not.toContain('?');
  });

  test('nessuna chiave da gestire', () => {
    expect(templateNeve('2026-02-15')).not.toMatch(/key|token|apikey/i);
  });

  /**
   * Il tetto non è prudenza: il set di mattonelle dichiarato dal capabilities si chiama
   * `GoogleMapsCompatible_Level8`, quindi **oltre lo zoom 8 non esistono**.
   */
  test('il set di mattonelle e il tetto di zoom coincidono', () => {
    expect(ZOOM_NATIVO_MASSIMO_NEVE).toBe(8);
    expect(templateNeve('2026-02-15')).toContain('GoogleMapsCompatible_Level8');
  });

  describe('quale giorno', () => {
    test('si prova oggi per primo, poi indietro', () => {
      const g = giorniDaProvare(new Date('2026-02-15T10:00:00Z'));
      expect(g[0]).toBe('2026-02-15');
      expect(g[1]).toBe('2026-02-14');
      expect(g).toHaveLength(GIORNI_INDIETRO_MAX + 1);
    });

    // I giorni GIBS sono indicizzati in UTC: usare il giorno locale sposterebbe di uno
    // per due ore ogni sera, in estate.
    test('il giorno è quello UTC', () => {
      expect(giornoUTC(new Date('2026-02-15T23:30:00Z'))).toBe('2026-02-15');
      expect(giornoUTC(new Date('2026-02-16T00:30:00Z'))).toBe('2026-02-16');
    });

    test('il ripiego copre qualche giorno, non un mese', () => {
      expect(GIORNI_INDIETRO_MAX).toBeGreaterThanOrEqual(2);
      expect(GIORNI_INDIETRO_MAX).toBeLessThanOrEqual(7);
    });
  });

  /**
   * **I colori sono campionati dalla color map ufficiale**
   * (`colormaps/v1.3/MODIS_NDSI_Snow_Cover.xml`, letta il 2026-09-03), non scelti: NDSI 1
   * è `240,240,128` e 100 è `255,0,0`. La scala va dal giallo pallido al rosso, che è
   * controintuitivo per la neve — e per questo le etichette dicono i valori.
   *
   * Dichiarare colori che sulla mappa non esistono è peggio che non avere legenda: è
   * l'errore corretto due volte in questo progetto con le legende Copernicus.
   */
  describe('la legenda', () => {
    test('i due estremi sono quelli pubblicati', () => {
      expect(LEGENDA_NEVE[0].color).toBe('#f0f080'); // 240,240,128
      expect(LEGENDA_NEVE[LEGENDA_NEVE.length - 1].color).toBe('#ff0000');
    });

    test('nessun bianco e nessun azzurro: la scala non li contiene', () => {
      const colori = LEGENDA_NEVE.map((v) => v.color.toLowerCase());
      expect(colori).not.toContain('#ffffff');
      expect(colori.some((c) => c.startsWith('#00'))).toBe(false);
    });

    test('ogni voce dice a che valori corrisponde', () => {
      for (const v of LEGENDA_NEVE) {
        expect(v.label).toMatch(/\d/);
        expect(v.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });
});
