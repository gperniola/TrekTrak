import { svuotaCacheValanghe, zoneValanghe } from '@/lib/avalanche-proxy';

/**
 * Il proxy delle valanghe: scarica, ritaglia, semplifica.
 *
 * Le risposte sono finte ma la **forma** è quella misurata sui file veri il 2026-09-03:
 * `maxDangerRatings` con le varianti, geometrie con `properties.id`, e più feature con lo
 * stesso id (242 feature per 172 id distinti, nei dati reali).
 */

const OGGI = new Date('2026-02-15T08:00:00Z');

/** Un quadrato di un decimo di grado attorno al punto indicato. */
const quadrato = (lon: number, lat: number) => ({
  type: 'Polygon',
  coordinates: [[
    [lon, lat], [lon + 0.1, lat], [lon + 0.1, lat + 0.1], [lon, lat + 0.1], [lon, lat],
  ]],
});

interface Finta {
  ratings?: Record<string, Record<string, number>>;
  geometrie?: Record<string, Array<{ id: string; geometry: unknown }>>;
  nomi?: Record<string, string>;
  chiamate?: string[];
}

function fingiLaRete(f: Finta) {
  const chiamate = f.chiamate ?? [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    chiamate.push(url);
    const ratings = /eaws_bulletins\/([\d-]+)\/[\d-]+-(.+)\.ratings\.json/.exec(url);
    if (ratings != null) {
      const chiave = `${ratings[1]}|${ratings[2]}`;
      const dati = f.ratings?.[chiave];
      if (dati == null) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ maxDangerRatings: dati }) };
    }
    const geo = /micro-regions\/(.+)_micro-regions\.geojson\.json/.exec(url);
    if (geo != null) {
      const lista = f.geometrie?.[geo[1]] ?? [];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: 'FeatureCollection',
          features: lista.map((v) => ({ type: 'Feature', properties: { id: v.id }, geometry: v.geometry })),
        }),
      };
    }
    if (url.includes('micro-regions_names')) {
      return { ok: true, status: 200, json: async () => f.nomi ?? {} };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }) as unknown as typeof global.fetch;
  return chiamate;
}

const vero = global.fetch;
beforeEach(() => svuotaCacheValanghe());
afterEach(() => { global.fetch = vero; });

describe('proxy valanghe', () => {
  /**
   * **Fuori stagione non è un errore.**
   *
   * Verificato sul servizio vero il 2026-09-03: tutte e nove le regioni rispondono 404.
   * È il criterio di accettazione del task — «fuori stagione il layer mostra "nessun
   * bollettino", non un errore» — e la differenza conta: un errore invita a riprovare,
   * mentre qui non c'è niente da riprovare fino a novembre.
   */
  test('fuori stagione: nessun bollettino, e nessuna zona', async () => {
    fingiLaRete({}); // ogni ratings risponde 404
    const r = await zoneValanghe({ south: 46.3, west: 11.7, north: 46.5, east: 12.0 }, 11, OGGI);
    expect(r.bulletinDate).toBeNull();
    expect(r.zones).toEqual([]);
    expect(r.totalRated).toBe(0);
  });

  test('fuori stagione non scarica nemmeno le geometrie', async () => {
    const chiamate = fingiLaRete({ chiamate: [] });
    await zoneValanghe({ south: 46.3, west: 11.7, north: 46.5, east: 12.0 }, 11, OGGI);
    // 4,85 MB di confini per non disegnare niente sarebbero un regalo a nessuno.
    expect(chiamate.filter((u) => u.includes('_micro-regions.geojson'))).toEqual([]);
  });

  describe('in stagione', () => {
    const inStagione = (): Finta => ({
      ratings: {
        '2026-02-15|IT-32-BZ': {
          'IT-32-BZ-01-01': 3,
          'IT-32-BZ-01-01:high': 3,
          'IT-32-BZ-01-01:low': 1,
          'IT-32-BZ-02-01': 2,
          // Valutata "nessuna valutazione": esiste, ma non dice niente.
          'IT-32-BZ-03-01': 0,
        },
      },
      geometrie: {
        'IT-32-BZ': [
          { id: 'IT-32-BZ-01-01', geometry: quadrato(11.7, 46.3) },
          // Stesso id, secondo poligono: nei dati veri succede per 61 id su 172.
          { id: 'IT-32-BZ-01-01', geometry: quadrato(11.9, 46.3) },
          { id: 'IT-32-BZ-02-01', geometry: quadrato(11.7, 46.4) },
          // Geometria SENZA rating: nei dati veri 7 su 36 in questa regione.
          { id: 'IT-32-BZ-09-09', geometry: quadrato(11.8, 46.35) },
          // Fuori dalla vista chiesta.
          { id: 'IT-32-BZ-02-01', geometry: quadrato(10.4, 46.9) },
        ],
      },
      nomi: { 'IT-32-BZ-01-01': 'Gruppo Sesvenna settentrionale' },
    });

    test('unisce rating e geometrie, e dice di che giorno è il bollettino', async () => {
      fingiLaRete(inStagione());
      const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
      expect(r.bulletinDate).toBe('2026-02-15');
      expect(r.totalRated).toBe(2); // la terza zona e' a zero: non conta come valutata
      const z = r.zones.find((x) => x.id === 'IT-32-BZ-01-01');
      expect(z).toMatchObject({ pericolo: 3, alta: 3, bassa: 1, nome: 'Gruppo Sesvenna settentrionale' });
    });

    /**
     * **Una zona senza valutazione non si disegna.** Colorarla di grigio direbbe
     * "valutata, nessun pericolo": tacere è l'unica cosa vera che se ne può dire.
     */
    test('le geometrie senza rating non finiscono sulla mappa', async () => {
      fingiLaRete(inStagione());
      const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
      expect(r.zones.map((z) => z.id)).not.toContain('IT-32-BZ-09-09');
    });

    test('un id con due poligoni li porta entrambi', async () => {
      fingiLaRete(inStagione());
      const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
      expect(r.zones.filter((z) => z.id === 'IT-32-BZ-01-01')).toHaveLength(2);
    });

    test('quello che sta fuori dalla vista non arriva', async () => {
      fingiLaRete(inStagione());
      const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
      // Il quadrato a 10,4 / 46,9 è fuori: la stessa zona compare una volta sola.
      expect(r.zones.filter((z) => z.id === 'IT-32-BZ-02-01')).toHaveLength(1);
    });

    /**
     * **Le zone a zero non si disegnano.**
     *
     * Nell'aggregato EAWS `0` vuol dire *nessuna valutazione*, e disegnarla — anche grigia
     * — direbbe "di quest'area sappiamo qualcosa" quando non sappiamo niente. La decisione
     * e' cambiata guardando i dati veri: fuori stagione `IT-MeteoMont` pubblica le sue 39
     * zone tutte a zero, e la prima versione le dipingeva tutte.
     */
    test('una zona valutata zero non finisce sulla mappa', async () => {
      fingiLaRete({
        ...inStagione(),
        geometrie: { 'IT-32-BZ': [{ id: 'IT-32-BZ-03-01', geometry: quadrato(11.7, 46.3) }] },
      });
      const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
      expect(r.zones).toEqual([]);
    });

    test('e un bollettino di soli zeri non e un bollettino', async () => {
      fingiLaRete({
        ratings: { '2026-02-15|IT-MeteoMont': Object.fromEntries(
          Array.from({ length: 39 }, (_, i) => [`IT-MeteoMont-${i}-1`, 0]),
        ) },
        geometrie: {},
      });
      const r = await zoneValanghe({ south: 42.0, west: 13.9, north: 42.2, east: 14.2 }, 11, OGGI);
      // Fuori stagione e' esattamente questa la risposta del servizio vero.
      expect(r.bulletinDate).toBeNull();
      expect(r.zones).toEqual([]);
    });

    test('il nome che manca resta nullo, non diventa l id travestito', async () => {
      fingiLaRete({ ...inStagione(), nomi: {} });
      const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
      expect(r.zones[0].nome).toBeNull();
    });

    test('le geometrie arrivano semplificate, non con quindici decimali', async () => {
      fingiLaRete({
        ...inStagione(),
        geometrie: {
          'IT-32-BZ': [{
            id: 'IT-32-BZ-01-01',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [11.700000000000001, 46.300000000000004], [11.8, 46.3],
                [11.8, 46.4], [11.7, 46.4], [11.700000000000001, 46.300000000000004],
              ]],
            },
          }],
        },
      });
      const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
      const punti = (r.zones[0].geometria.coordinates as number[][][])[0];
      expect(punti.every((p) => String(p[0]).length <= 8)).toBe(true);
    });

    /**
     * Le geometrie sono confini amministrativi e pesano 4,85 MB: richiederle a ogni
     * spostamento della mappa vanificherebbe tutto il senso del proxy.
     */
    test('la seconda richiesta non riscarica le geometrie', async () => {
      const chiamate = fingiLaRete({ ...inStagione(), chiamate: [] });
      const vista = { south: 46.25, west: 11.65, north: 46.55, east: 12.05 };
      await zoneValanghe(vista, 11, OGGI);
      const dopoLaPrima = chiamate.filter((u) => u.includes('_micro-regions.geojson')).length;
      await zoneValanghe({ ...vista, north: 46.6 }, 12, OGGI);
      const dopoLaSeconda = chiamate.filter((u) => u.includes('_micro-regions.geojson')).length;
      expect(dopoLaPrima).toBeGreaterThan(0);
      expect(dopoLaSeconda).toBe(dopoLaPrima);
    });
  });

  /**
   * Se il bollettino di oggi non c'è ancora ma quello di ieri sì, si mostra quello di
   * ieri **dichiarando la data**: in stagione un giorno di ritardo è informazione, un
   * pannello vuoto no.
   */
  test('se oggi manca, ripiega su un altro giorno e lo dice', async () => {
    fingiLaRete({
      ratings: { '2026-02-14|IT-32-BZ': { 'IT-32-BZ-01-01': 2 } },
      geometrie: { 'IT-32-BZ': [{ id: 'IT-32-BZ-01-01', geometry: quadrato(11.7, 46.3) }] },
    });
    const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
    expect(r.bulletinDate).toBe('2026-02-14');
    expect(r.zones).toHaveLength(1);
  });

  /**
   * Un guasto sulle geometrie di una regione non deve far sparire le altre: sulle
   * Dolomiti si scaricano sia Bolzano sia MeteoMont, e se una delle due cade il
   * bollettino dell'altra resta valido.
   */
  test('una regione che non risponde non porta giù le altre', async () => {
    const f = {
      ratings: { '2026-02-15|IT-32-BZ': { 'IT-32-BZ-01-01': 3 }, '2026-02-15|IT-MeteoMont': { 'IT-MeteoMont-01-1': 2 } },
      geometrie: { 'IT-32-BZ': [{ id: 'IT-32-BZ-01-01', geometry: quadrato(11.7, 46.3) }] },
    };
    fingiLaRete(f);
    const originale = global.fetch;
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('IT-MeteoMont_micro-regions')) throw new Error('rete giù');
      return (originale as unknown as (i: RequestInfo | URL) => Promise<unknown>)(input);
    }) as unknown as typeof global.fetch;

    const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
    expect(r.zones.map((z) => z.id)).toEqual(['IT-32-BZ-01-01']);
  });
});

/**
 * **Un guasto non è "fuori stagione".**
 *
 * Il difetto era mio, e l'ho visto provando il codice contro la rete vera: il primo
 * `catch` restituiva `null` sia per un 404 sia per una rete interrotta, quindi senza
 * connessione il pannello dichiarava «nessun bollettino: fuori stagione valanghe» — a
 * gennaio. Chi legge "fuori stagione" non riprova, e non sa di non sapere.
 */
describe('quando qualcosa si rompe', () => {
  const conRete = (risposta: (url: string) => unknown) => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => risposta(String(input))) as unknown as typeof global.fetch;
  };

  test('la rete giù è un errore, non fuori stagione', async () => {
    conRete(() => { throw new Error('rete giù'); });
    await expect(
      zoneValanghe({ south: 46.3, west: 11.7, north: 46.5, east: 12.0 }, 11, OGGI),
    ).rejects.toThrow(/non raggiungibile/i);
  });

  test('un 500 del servizio è un errore, non fuori stagione', async () => {
    conRete((url) => (url.includes('ratings')
      ? { ok: false, status: 500, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ features: [] }) }));
    await expect(
      zoneValanghe({ south: 46.3, west: 11.7, north: 46.5, east: 12.0 }, 11, OGGI),
    ).rejects.toThrow();
  });

  /**
   * Se una regione cade ma le altre rispondono, il bollettino si mostra **dichiarando**
   * che è incompleto: per un layer di sicurezza il parziale dichiarato batte il niente,
   * ma il parziale silenzioso è peggio di entrambi.
   */
  test('una regione sola che cade: si mostra il resto, dichiarato incompleto', async () => {
    conRete((url) => {
      if (url.includes('IT-MeteoMont.ratings')) throw new Error('rete giù');
      if (url.includes('IT-32-BZ.ratings')) {
        return { ok: true, status: 200, json: async () => ({ maxDangerRatings: { 'IT-32-BZ-01-01': 3 } }) };
      }
      if (url.includes('ratings')) return { ok: false, status: 404, json: async () => ({}) };
      if (url.includes('micro-regions_names')) return { ok: true, status: 200, json: async () => ({}) };
      // Solo Bolzano ha geometrie: le altre regioni rispondono con un elenco vuoto, come
      // farebbero se nella vista non avessero niente.
      const features = url.includes('IT-32-BZ_micro-regions')
        ? [{ type: 'Feature', properties: { id: 'IT-32-BZ-01-01' }, geometry: quadrato(11.7, 46.3) }]
        : [];
      return { ok: true, status: 200, json: async () => ({ type: 'FeatureCollection', features }) };
    });
    const r = await zoneValanghe({ south: 46.25, west: 11.65, north: 46.55, east: 12.05 }, 11, OGGI);
    expect(r.zones).toHaveLength(1);
    expect(r.partial).toBe(true);
  });

  test('col servizio che risponde a tutti i giorni, il fuori stagione non è parziale', async () => {
    conRete((url) => (url.includes('ratings')
      ? { ok: false, status: 404, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({}) }));
    const r = await zoneValanghe({ south: 46.3, west: 11.7, north: 46.5, east: 12.0 }, 11, OGGI);
    expect(r.bulletinDate).toBeNull();
    expect(r.partial).toBe(false);
  });
});

/**
 * **Due richieste insieme non scaricano due volte.**
 *
 * Su cache fredda, due chiamate contemporanee prendevano gli stessi confini due volte —
 * per `IT-MeteoMont` sono 2,5 MB a testa, da un servizio gratuito. Il client fa da
 * tampone (attesa di 700 ms e annullamento della precedente), ma il server non deve
 * dipendere dalla buona educazione del client: due schede aperte bastano a scavalcarlo.
 */
test('due richieste contemporanee scaricano i confini una volta sola', async () => {
  const chiamate: string[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    chiamate.push(url);
    // Una risposta lenta: e' la condizione in cui le due richieste si sovrappongono.
    await new Promise((r) => setTimeout(r, 30));
    if (url.includes('ratings')) {
      return url.includes('IT-32-BZ')
        ? { ok: true, status: 200, json: async () => ({ maxDangerRatings: { 'IT-32-BZ-01-01': 3 } }) }
        : { ok: false, status: 404, json: async () => ({}) };
    }
    if (url.includes('micro-regions_names')) return { ok: true, status: 200, json: async () => ({}) };
    const features = url.includes('IT-32-BZ_micro-regions')
      ? [{ type: 'Feature', properties: { id: 'IT-32-BZ-01-01' }, geometry: quadrato(11.7, 46.3) }]
      : [];
    return { ok: true, status: 200, json: async () => ({ type: 'FeatureCollection', features }) };
  }) as unknown as typeof global.fetch;

  const vista = { south: 46.25, west: 11.65, north: 46.55, east: 12.05 };
  const [a, b] = await Promise.all([
    zoneValanghe(vista, 11, OGGI),
    zoneValanghe(vista, 12, OGGI),
  ]);
  expect(a.zones).toHaveLength(1);
  expect(b.zones).toHaveLength(1);
  const scaricamenti = chiamate.filter((u) => u.includes('IT-32-BZ_micro-regions')).length;
  expect(scaricamenti).toBe(1);
});

/**
 * **«Niente qui» e «non riesco a disegnarlo» sono la stessa immagine e l'opposto come
 * significato.**
 *
 * I servizi valanghe ridisegnano le micro-regioni fra una stagione e l'altra: se gli id
 * dei bollettini non combaciano piu' con quelli delle geometrie, la mappa resta senza
 * colori — identica a quando si guarda Roma, dove aree valanghive non ce ne sono. Senza
 * distinguerle, un inverno intero di bollettini poteva restare invisibile mentre il
 * pannello diceva che non c'era niente da vedere.
 */
describe('quando gli id non combaciano piu', () => {
  const rete = (ratings: Record<string, number>, idGeometrie: string[]) => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('ratings')) {
        return url.includes('IT-32-BZ')
          ? { ok: true, status: 200, json: async () => ({ maxDangerRatings: ratings }) }
          : { ok: false, status: 404, json: async () => ({}) };
      }
      if (url.includes('micro-regions_names')) return { ok: true, status: 200, json: async () => ({}) };
      const features = url.includes('IT-32-BZ_micro-regions')
        ? idGeometrie.map((id) => ({ type: 'Feature', properties: { id }, geometry: quadrato(11.7, 46.3) }))
        : [];
      return { ok: true, status: 200, json: async () => ({ type: 'FeatureCollection', features }) };
    }) as unknown as typeof global.fetch;
  };
  const vista = { south: 46.25, west: 11.65, north: 46.55, east: 12.05 };

  test('bollettino con id vecchi e geometrie con id nuovi: e un guasto, non un vuoto', async () => {
    rete({ 'IT-32-BZ-01-01': 3 }, ['IT-32-BZ-2027-01']);
    const r = await zoneValanghe(vista, 11, OGGI);
    expect(r.zones).toEqual([]);
    expect(r.joinBroken).toBe(true);
  });

  test('id che combaciano: nessun allarme', async () => {
    rete({ 'IT-32-BZ-01-01': 3 }, ['IT-32-BZ-01-01']);
    const r = await zoneValanghe(vista, 11, OGGI);
    expect(r.zones).toHaveLength(1);
    expect(r.joinBroken).toBe(false);
  });

  /**
   * Il caso legittimo che NON deve suonare l'allarme: la zona valutata esiste e ha la sua
   * geometria, semplicemente sta fuori dall'inquadratura. E' quello che succede guardando
   * una citta' di pianura, ed e' la maggioranza delle viste.
   */
  test('zona vera ma fuori dalla vista: nessun allarme', async () => {
    rete({ 'IT-32-BZ-01-01': 3 }, ['IT-32-BZ-01-01']);
    // La stessa geometria, ma chiedendo una vista lontana da dove sta.
    const r = await zoneValanghe({ south: 46.90, west: 12.30, north: 47.00, east: 12.45 }, 11, OGGI);
    expect(r.zones).toEqual([]);
    expect(r.joinBroken).toBe(false);
  });

  /**
   * L'altro caso legittimo: si guarda l'Appennino, dove quel giorno il bollettino non
   * c'e', mentre le Alpi ce l'hanno. Le valutazioni alpine non hanno geometrie caricate
   * — non serviva caricarle — e questo non e' un guasto.
   */
  test('valutazioni di un altra regione, non caricata: nessun allarme', async () => {
    rete({ 'IT-32-BZ-01-01': 3 }, ['IT-32-BZ-01-01']);
    const r = await zoneValanghe({ south: 42.0, west: 13.9, north: 42.2, east: 14.2 }, 11, OGGI);
    expect(r.joinBroken).toBe(false);
  });
});
