import { creaSorgenteNeve } from '@/lib/neve-sorgente';
import type { FetchMinimo, RispostaMinima } from '@/lib/neve-rete';
import { pixelZ8 } from '@/lib/snow-cover';
import { inflateNode, leggiFixture, pngTavolozza } from './fixtures/gibs/png-sintetico';

const NEVE = leggiFixture('terra-2026-10-13-8-94-138.png');
const NUBE = leggiFixture('terra-2026-10-16-8-94-138.png');
const TERRA = 'MODIS_Terra_NDSI_Snow_Cover';
const MONTE_AMARO = pixelZ8(42.0858, 14.0858);
const ADESSO = () => new Date('2026-10-16T12:00:00Z');

const url = (layer: string, giorno: string, z = 8, x = 138, y = 94) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${giorno}/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`;

function copia(b: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(b.length);
  new Uint8Array(out).set(b);
  return out;
}
const dati = (b: Uint8Array): RispostaMinima => ({
  status: 200,
  headers: { get: (n) => (n === 'layer-identifier-actual' ? 'x' : null) },
  arrayBuffer: () => Promise.resolve(copia(b)),
});
const vuoto = (): RispostaMinima => ({
  status: 200,
  headers: { get: () => null },
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  body: { cancel: () => Promise.resolve() },
});
const stato = (status: number): RispostaMinima => ({
  status,
  headers: { get: () => null },
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
});

function finto(risposte: Record<string, () => RispostaMinima>, predefinita: () => RispostaMinima = () => stato(404)) {
  const richieste: string[] = [];
  const f: FetchMinimo = (u) => {
    richieste.push(u);
    return Promise.resolve((risposte[u] ?? predefinita)());
  };
  return { f, richieste };
}
const sorgente = (f: FetchMinimo, extra: { maxPassaggiInCache?: number; maxAssentiInCache?: number } = {}) =>
  creaSorgenteNeve({ fetch: f, inflate: inflateNode, adesso: ADESSO, ...extra });

describe('sorgente neve', () => {
  it('oggi con dati: oggi, ieri, l altro ieri', async () => {
    const { f, richieste } = finto({
      [url(TERRA, '2026-10-16')]: () => dati(NUBE),
      [url(TERRA, '2026-10-15')]: () => dati(NEVE),
    });
    const s = sorgente(f);
    const r = await s.punto(42.0858, 14.0858);
    expect(r).toMatchObject({ stato: 'neve', ndsi: 82, giorno: '2026-10-15' });
    expect(richieste.some((u) => u.includes('/2026-10-13/'))).toBe(false);
  });

  it('al mattino, senza dati di oggi, si parte da ieri', async () => {
    const { f, richieste } = finto({
      ...Object.fromEntries(
        ['MODIS_Aqua_NDSI_Snow_Cover', 'VIIRS_NOAA20_NDSI_Snow_Cover', 'VIIRS_SNPP_NDSI_Snow_Cover',
          'VIIRS_NOAA21_NDSI_Snow_Cover', TERRA].map((l) => [url(l, '2026-10-16'), vuoto]),
      ),
      [url(TERRA, '2026-10-13')]: () => dati(NEVE),
    });
    const s = sorgente(f);
    const r = await s.punto(42.0858, 14.0858);
    expect(richieste.some((u) => u.includes('/2026-10-13/'))).toBe(true);
    expect(r).toMatchObject({ stato: 'neve', giorno: '2026-10-13' });
    expect(MONTE_AMARO.x).toBe(138);
  });

  it('ci si ferma quando ogni pixel ha una vista', async () => {
    const verde = pngTavolozza({
      larghezza: 256, altezza: 256,
      indici: new Uint8Array(256 * 256),
      tavolozza: new Uint8Array([0, 255, 0]),
    });
    const { f, richieste } = finto({ [url(TERRA, '2026-10-16')]: () => dati(verde) });
    await sorgente(f).mattonella(8, 138, 94);
    expect(richieste.some((u) => u.includes('/2026-10-15/'))).toBe(false);
  });

  it('un passaggio fallito si richiede la volta dopo, uno con dati no', async () => {
    const guasto = url('MODIS_Aqua_NDSI_Snow_Cover', '2026-10-16');
    const buono = url(TERRA, '2026-10-16');
    const { f, richieste } = finto({ [guasto]: () => stato(500), [buono]: () => dati(NUBE) });
    const s = sorgente(f);
    jest.useFakeTimers(); // ogni chiamata prova il guasto due volte, con un'attesa fra i due
    for (let i = 0; i < 2; i++) {
      const p = s.mattonella(8, 138, 94);
      await jest.advanceTimersByTimeAsync(5000);
      await p;
    }
    jest.useRealTimers();
    // 2 chiamate x 2 tentativi: l'errore non si ricorda (si richiede la volta dopo), i dati si'
    expect(richieste.filter((u) => u === guasto)).toHaveLength(4);
    expect(richieste.filter((u) => u === buono)).toHaveLength(1);
  });

  /**
   * Gli assenti si richiedono «al prossimo aggiornamento» (spec), non a ogni mattonella:
   * a zoom >= 9 ogni figlia nuova di un genitore z8 gia' composto rifaceva la composizione,
   * e riscaricava ogni «nessun dato» (fino a 152 KB di rumore, misurato su Aqua) e ogni 404.
   */
  describe('gli assenti si ricordano fino a rinnova()', () => {
    const AQUA = 'MODIS_Aqua_NDSI_Snow_Cover';
    const NOAA20 = 'VIIRS_NOAA20_NDSI_Snow_Cover';
    const NESSUN_DATO = url(AQUA, '2026-10-16');
    const NON_PUBBLICATO = url(NOAA20, '2026-10-16');
    const DATI_OGGI = url(TERRA, '2026-10-16');
    const DATI_IERI = url(TERRA, '2026-10-15');
    const scenario = () => finto({
      [DATI_OGGI]: () => dati(NUBE),
      [DATI_IERI]: () => dati(NEVE),
      [NESSUN_DATO]: vuoto,
    });

    it('la seconda volta nessun «nessun dato» e nessun 404 torna in rete', async () => {
      const { f, richieste } = scenario();
      const s = sorgente(f);
      await s.mattonella(8, 138, 94);
      expect(richieste).toContain(NESSUN_DATO);
      expect(richieste).toContain(NON_PUBBLICATO);
      const prima = richieste.length;

      await s.mattonella(8, 138, 94);

      const dopo = richieste.slice(prima);
      expect(dopo).not.toContain(NESSUN_DATO);
      expect(dopo).not.toContain(NON_PUBBLICATO);
      expect(dopo).toEqual([]);
    });

    it('dopo rinnova si richiedono gli assenti e i dati di oggi, non quelli di ieri', async () => {
      const { f, richieste } = scenario();
      const s = sorgente(f);
      await s.mattonella(8, 138, 94);
      const prima = richieste.length;

      s.rinnova();
      await s.mattonella(8, 138, 94);

      const dopo = richieste.slice(prima);
      expect(dopo).toContain(NESSUN_DATO);
      expect(dopo).toContain(NON_PUBBLICATO);
      // GIBS pubblica a pezzi: i passaggi di oggi possono essere cambiati, quelli di ieri no.
      expect(dopo).toContain(DATI_OGGI);
      expect(dopo).not.toContain(DATI_IERI);
    });

    it('gli assenti ricordati hanno un tetto loro', async () => {
      const { f, richieste } = finto({}); // tutto 404: 5 sensori x 4 giorni = 20 assenti
      const s = sorgente(f, { maxAssentiInCache: 5 });
      await s.mattonella(8, 138, 94);
      const prima = richieste.length;
      expect(prima).toBe(20);

      await s.mattonella(8, 138, 94);

      // Restano gli ultimi 5 (l'ultimo giorno): quelli di oggi sono usciti, e tornano in rete.
      expect(richieste.slice(prima)).toContain(NON_PUBBLICATO);
    });
  });

  it('la cache ha un tetto', async () => {
    const { f } = finto({}, () => dati(NEVE));
    const s = sorgente(f, { maxPassaggiInCache: 3 });
    for (let x = 100; x < 105; x++) await s.mattonella(8, x, 94);
    expect(s.dimensioneCache()).toBeLessThanOrEqual(3);
    expect(s.dimensioneCache()).toBe(3);
  });

  it('chiamate concorrenti sulla stessa mattonella: ogni URL una volta sola, stesso composito', async () => {
    const { f, richieste } = finto({ [url(TERRA, '2026-10-16')]: () => dati(NUBE) });
    const s = sorgente(f);
    const [a, b] = await Promise.all([s.mattonella(8, 138, 94), s.mattonella(8, 138, 94)]);
    expect(a).toBe(b);
    expect(new Set(richieste).size).toBe(richieste.length);
  });

  it('se uno dei due chiamanti annulla, lui rifiuta con AbortError e l altro risolve', async () => {
    const { f } = finto({ [url(TERRA, '2026-10-16')]: () => dati(NUBE) });
    const s = sorgente(f);
    const c = new AbortController();
    const annullato = s.mattonella(8, 138, 94, c.signal);
    const altro = s.mattonella(8, 138, 94);
    c.abort();
    await expect(annullato).rejects.toMatchObject({ name: 'AbortError' });
    await expect(altro).resolves.toBeDefined();
    await expect(s.mattonella(8, 138, 94, c.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
