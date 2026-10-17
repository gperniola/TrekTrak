import {
  ACQUA, COLORE_VELO_CSS, LEGENDA_NEVE, NON_VISTO, SENSORI_NEVE, SENZA_NEVE,
  VELO_NON_VISTO, classificaTavolozza, giorniCandidati,
  giornoUTC, pixelZ8, urlMattonellaNeve,
} from '@/lib/snow-cover';
import { decodificaPngTavolozza } from '@/lib/png-tavolozza';
import { inflateNode, leggiFixture, pngTavolozza } from './fixtures/gibs/png-sintetico';

const LAYER_TERRA = 'MODIS_Terra_NDSI_Snow_Cover';
const templateNeve = (giorno: string) => urlMattonellaNeve(LAYER_TERRA, giorno, 8, 138, 94);

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
    const t = urlMattonellaNeve(LAYER_TERRA, '2026-02-15', 8, 138, 94);
    expect(t).toContain('/8/94/138.png');
    expect(t.indexOf('/94/')).toBeLessThan(t.indexOf('/138.'));
  });

  test('l URL ha la riga prima della colonna', () => {
    expect(urlMattonellaNeve(LAYER_TERRA, '2026-10-13', 8, 138, 94)).toMatch(
      /\/2026-10-13\/GoogleMapsCompatible_Level8\/8\/94\/138\.png$/);
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
   * Il set di mattonelle dichiarato dal capabilities si chiama
   * `GoogleMapsCompatible_Level8`, quindi **oltre lo zoom 8 non esistono**: sopra, il
   * disegno ingrandisce un quadrante della mattonella z8 (`neve-disegno.ts`).
   */
  test('il set di mattonelle arriva al livello 8', () => {
    expect(templateNeve('2026-02-15')).toContain('GoogleMapsCompatible_Level8');
  });

  /*
    I giorni da provare per tutto il layer (`giorniDaProvare`) se ne sono andati col
    vecchio ripiego: la finestra ora si sceglie per mattonella, dai `giorniCandidati`
    provati qui sotto e in `neve-sorgente.test.ts`.
  */
  describe('quale giorno', () => {
    // I giorni GIBS sono indicizzati in UTC: usare il giorno locale sposterebbe di uno
    // per due ore ogni sera, in estate.
    test('il giorno è quello UTC', () => {
      expect(giornoUTC(new Date('2026-02-15T23:30:00Z'))).toBe('2026-02-15');
      expect(giornoUTC(new Date('2026-02-16T00:30:00Z'))).toBe('2026-02-16');
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

  describe('sensori, giorni e classi', () => {
    test('quattro giorni candidati, in UTC, oggi per primo', () => {
      expect(giorniCandidati(new Date('2026-10-16T05:00:00Z'))).toEqual(
        ['2026-10-16', '2026-10-15', '2026-10-14', '2026-10-13']);
      expect(giorniCandidati(new Date('2026-10-16T23:30:00Z'))[0]).toBe('2026-10-16');
    });

    test('cinque sensori, dal passaggio piu tardo', () => {
      expect(SENSORI_NEVE.map((s) => s.id)).toEqual(['aqua', 'noaa20', 'snpp', 'noaa21', 'terra']);
      expect(SENSORI_NEVE.map((s) => s.nome)).toEqual(['Aqua', 'NOAA-20', 'S-NPP', 'NOAA-21', 'Terra']);
      expect(SENSORI_NEVE.map((s) => s.layer)).toEqual([
        'MODIS_Aqua_NDSI_Snow_Cover', 'VIIRS_NOAA20_NDSI_Snow_Cover', 'VIIRS_SNPP_NDSI_Snow_Cover',
        'VIIRS_NOAA21_NDSI_Snow_Cover', 'MODIS_Terra_NDSI_Snow_Cover']);
    });

    test('le classi vengono dalla tavolozza vera', async () => {
      const t = await decodificaPngTavolozza(leggiFixture('terra-2026-10-13-8-94-138.png'), inflateNode);
      expect(t).not.toBeNull();
      const c = classificaTavolozza(t!);
      expect(c[106]).toBe(NON_VISTO);
      expect(c[105]).toBe(ACQUA);
      expect(c[0]).toBe(SENZA_NEVE);
      expect(c[82]).toBe(82);
    });

    // Mutazione: far restituire SENZA_NEVE qui dichiarerebbe «senza neve» un dato che non
    // sappiamo leggere.
    test('un trasparente sconosciuto non diventa senza neve', async () => {
      const tavolozza = new Uint8Array(121 * 3);
      tavolozza.set([1, 2, 3], 120 * 3);
      const alfa = new Uint8Array(121).fill(255);
      alfa[120] = 0;
      const png = pngTavolozza({ larghezza: 1, altezza: 1, indici: new Uint8Array([120]), tavolozza, alfa });
      const t = await decodificaPngTavolozza(png, inflateNode);
      expect(classificaTavolozza(t!)[120]).toBe(NON_VISTO);
    });

    test('Monte Amaro cade nel pixel giusto', () => {
      expect(pixelZ8(42.0858, 14.0858)).toEqual({ x: 138, y: 94, px: 4, py: 243 });
      expect(pixelZ8(42.4692, 13.5658)).toEqual({ x: 137, y: 94, px: 165, py: 148 });
    });

    test('la prima voce della legenda dice anche incerta', () => {
      expect(LEGENDA_NEVE[0].label).toBe('~1-20: poca neve o incerta');
    });

    test('il velo della legenda e quello disegnato sono lo stesso', () => {
      expect(COLORE_VELO_CSS).toBe('rgba(71,85,105,0.45)');
      const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(COLORE_VELO_CSS);
      expect(m).not.toBeNull();
      expect([Number(m![1]), Number(m![2]), Number(m![3])]).toEqual([...VELO_NON_VISTO].slice(0, 3));
      expect(m![4]).toBe((VELO_NON_VISTO[3] / 255).toFixed(2));
    });
  });
});
