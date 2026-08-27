import { fetchDpcTodayZones, fetchFiresClient, fetchDpcClient } from '@/lib/emergency-api';

const TOPO = { // stessa mini-topology del Task 4, 1 zona basta
  type: 'Topology',
  objects: { zone: { type: 'GeometryCollection', geometries: [{
    type: 'Polygon', arcs: [[0]],
    properties: { 'Nome zona': 'Z1', 'Per rischio idraulico': 'NESSUNA ALLERTA',
      'Per rischio temporali': 'NESSUNA ALLERTA', 'Per rischio idrogeologico': "ORDINARIA CRITICITA' / ALLERTA GIALLA" },
  }] } },
  arcs: [[[13.0, 42.0], [13.1, 42.0], [13.1, 42.1], [13.0, 42.1], [13.0, 42.0]]],
};

describe('fetchFiresClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('ritorna il payload del proxy', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
    });
    const r = await fetchFiresClient();
    expect(r.fetchedAt).toBe('2026-08-25T10:00:00Z');
    // Il secondo argomento porta il signal dell'AbortController (timeout client).
    expect(global.fetch).toHaveBeenCalledWith('/api/fires', expect.objectContaining({ signal: expect.anything() }));
  });

  test('errore HTTP → throw con messaggio', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'no key' }) });
    await expect(fetchFiresClient()).rejects.toThrow();
  });

  test('fetch di rete fallita → messaggio in italiano, non il TypeError del browser', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchFiresClient()).rejects.toThrow('Rete non disponibile');
  });
});

describe('fetchDpcClient', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const INFO = {
    bulletinId: '20260825_1415',
    topojsonToday: 'https://raw.example/today.json',
    topojsonTomorrow: 'https://raw.example/tomorrow.json',
  };

  test('discovery + 2 topojson → DpcData con 2 giorni', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO });
    const data = await fetchDpcClient();
    expect(data.bulletinId).toBe('20260825_1415');
    expect(data.issuedLabel).toBe('25/08 14:15');
    expect(data.days.map((d) => d.date)).toEqual(['2026-08-25', '2026-08-26']);
    expect(data.days[0].zones).toHaveLength(1);
  });

  test('un topojson fallito → resta il giorno buono', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockResolvedValueOnce({ ok: true, json: async () => TOPO })
      .mockRejectedValueOnce(new Error('404'));
    const data = await fetchDpcClient();
    expect(data.days).toHaveLength(1);
    expect(data.days[0].date).toBe('2026-08-25');
  });

  test('entrambi falliti → throw', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => INFO })
      .mockRejectedValue(new Error('down'));
    await expect(fetchDpcClient()).rejects.toThrow();
  });

  test('fetch di rete fallita (discovery) → messaggio in italiano, non il TypeError del browser', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchDpcClient()).rejects.toThrow('Rete non disponibile');
  });

  test('discovery non-ok con messaggio del proxy → propagato invece del generico', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'xyz' }) });
    await expect(fetchDpcClient()).rejects.toThrow('xyz');
  });
});
/**
 * Il controllo di posizione all'avvio partiva scaricando ~400 KB compressi di
 * geometrie a ogni sessione, non cacheabili, anche a chi non ha mai attivato il layer.
 * Il manifest giornaliero pesa ~2,4 KB e dice se in tutta Italia ci sono allerte: nei
 * giorni tranquilli, che sono la maggioranza, tanto basta.
 */
describe('fetchDpcTodayZones: il manifest evita il download delle geometrie', () => {
  const realFetch = global.fetch;
  const OGGI = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const idOggi = `${ymd(OGGI).replace(/-/g, '')}_1400`;

  function mockRete(
    descrizioneOggi: string | undefined,
    opts: { manifestRotto?: boolean; bulletinId?: string; descrizioneDomani?: string } = {}
  ) {
    const chiamate: string[] = [];
    global.fetch = jest.fn((u: string) => {
      const url = String(u);
      chiamate.push(url);
      if (url.includes('/api/dpc-alerts')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({
          bulletinId: opts.bulletinId ?? idOggi,
          topojsonToday: 'https://raw.test/topojson/x_today.json',
          topojsonTomorrow: 'https://raw.test/topojson/x_tomorrow.json',
          manifest: 'https://raw.test/manifest.json',
        }) });
      }
      if (url.includes('manifest.json')) {
        if (opts.manifestRotto) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
        return Promise.resolve({ ok: true, status: 200, json: async () => ({
          today: { html_descrition: descrizioneOggi },
          tomorrow: { html_descrition: opts.descrizioneDomani },
        }) });
      }
      // geometrie: una topologia minima ma valida
      return Promise.resolve({ ok: true, status: 200, json: async () => ({
        type: 'Topology',
        objects: { zone: { type: 'GeometryCollection', geometries: [] } },
        arcs: [],
      }) });
    }) as unknown as typeof global.fetch;
    return chiamate;
  }

  afterEach(() => { global.fetch = realFetch; });

  test('giorno tranquillo → esito no-alerts e nessuna richiesta di topojson', async () => {
    const chiamate = mockRete('ASSENZA DI FENOMENI SIGNIFICATIVI PREVEDIBILI / NESSUNA ALLERTA');
    const r = await fetchDpcTodayZones();
    expect(r?.kind).toBe('no-alerts');
    expect(chiamate.some((u) => u.includes('topojson'))).toBe(false);
  });

  test('giorno con allerta → scarica le geometrie', async () => {
    const chiamate = mockRete("ORDINARIA CRITICITA' PER RISCHIO TEMPORALI / ALLERTA GIALLA: Emilia Romagna");
    const r = await fetchDpcTodayZones();
    expect(r?.kind).toBe('zones');
    expect(chiamate.some((u) => u.includes('topojson'))).toBe(true);
  });

  // Il manifest e' solo un'ottimizzazione: se non e' leggibile si lavora come prima.
  // Non deve poter produrre un falso "nessuna allerta".
  test('manifest non raggiungibile → scarica le geometrie', async () => {
    const chiamate = mockRete(undefined, { manifestRotto: true });
    const r = await fetchDpcTodayZones();
    expect(r?.kind).toBe('zones');
    expect(chiamate.some((u) => u.includes('topojson'))).toBe(true);
  });

  test('descrizione non riconosciuta → scarica le geometrie', async () => {
    const chiamate = mockRete('Situazione in evoluzione su tutto il territorio');
    const r = await fetchDpcTodayZones();
    expect(r?.kind).toBe('zones');
    expect(chiamate.some((u) => u.includes('topojson'))).toBe(true);
  });

  /**
   * Il caso NORMALE, non un caso limite: il bollettino e' emesso nel pomeriggio, quindi
   * per buona parte della giornata l'ultimo disponibile e' quello di ieri e la data
   * odierna sta nel suo campo `tomorrow`. Misurato dal vivo il 27/08: l'id servito era
   * `20260826_1422`.
   *
   * Qui il riepilogo di `today` (ieri) parla di allerta gialla e quello di `tomorrow`
   * (oggi) dice che non ce ne sono: leggere il campo sbagliato porterebbe a scaricare
   * 400 KB per nulla, e nel caso opposto a saltare il controllo in un giorno con
   * allerte in corso.
   */
  test('bollettino di ieri → il manifest viene letto sul giorno giusto (tomorrow)', async () => {
    const ieri = new Date(OGGI.getTime() - 24 * 3600 * 1000);
    const chiamate = mockRete("ORDINARIA CRITICITA' / ALLERTA GIALLA: Emilia Romagna", {
      bulletinId: `${ymd(ieri).replace(/-/g, '')}_1422`,
      descrizioneDomani: 'ASSENZA DI FENOMENI SIGNIFICATIVI PREVEDIBILI / NESSUNA ALLERTA',
    });
    const r = await fetchDpcTodayZones();
    expect(r?.kind).toBe('no-alerts');
    expect(r?.date).toBe(ymd(OGGI));
    expect(chiamate.some((u) => u.includes('topojson'))).toBe(false);
  });
});
