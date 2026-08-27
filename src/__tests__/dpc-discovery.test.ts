import { discoverLatestBulletin, bulletinIdFrom, _resetDpcCacheForTests } from '@/lib/dpc-discovery';

const RAW_TODAY =
  'https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/topojson/20260825_1415_today.json';

/**
 * Mock a dispatch per URL, non a sequenza: la discovery alterna chiamate all'API di
 * GitHub e HEAD su raw.githubusercontent per verificare che le geometrie esistano, e
 * un mock a sequenza si rompe al primo cambio d'ordine senza dire nulla di utile.
 */
function mockGithub(opts: {
  /** File toccati dal commit di `master`. */
  masterFiles?: string[];
  /** File per sha, per lo scorrimento dei commit recenti. */
  commitFiles?: Record<string, string[]>;
  /** Ordine dei commit recenti. */
  shas?: string[];
  /** Id per cui i topojson risultano pubblicati. */
  published?: string[];
  /** Forza un errore su tutte le chiamate all'API. */
  apiStatus?: number;
}) {
  const published = new Set(opts.published ?? []);
  const fn = jest.fn((url: string) => {
    const u = String(url);

    if (u.includes('raw.githubusercontent.com')) {
      const m = /topojson\/(\d{8}_\d{4})_today\.json/.exec(u);
      const ok = m != null && published.has(m[1]);
      return Promise.resolve({ ok, status: ok ? 200 : 404, json: async () => ({}) });
    }
    if (opts.apiStatus && opts.apiStatus >= 400) {
      return Promise.resolve({ ok: false, status: opts.apiStatus, json: async () => ({}) });
    }
    if (u.includes('/commits/master')) {
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => ({ sha: 'master', files: (opts.masterFiles ?? []).map((filename) => ({ filename })) }),
      });
    }
    if (u.includes('/commits?per_page')) {
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => (opts.shas ?? []).map((sha) => ({ sha })),
      });
    }
    const sha = u.split('/commits/')[1];
    return Promise.resolve({
      ok: true, status: 200,
      json: async () => ({ sha, files: (opts.commitFiles?.[sha] ?? []).map((filename) => ({ filename })) }),
    });
  });
  return fn as unknown as typeof global.fetch;
}

describe('bulletinIdFrom', () => {
  // La regex originale pretendeva l'id subito dopo `files/`, quindi NON matchava la
  // forma canonica che il modulo stesso costruisce.
  test('riconosce la forma canonica files/topojson/<id>_today.json', () => {
    expect(bulletinIdFrom('files/topojson/20260825_1415_today.json')).toBe('20260825_1415');
    expect(bulletinIdFrom('files/geojson/20260825_1415_tomorrow.json')).toBe('20260825_1415');
    expect(bulletinIdFrom('files/20260825_1415.zip')).toBe('20260825_1415');
  });

  // Il repo DPC committa spesso i soli preview: il 26/08/2026 l'ultimo commit su
  // master toccava unicamente `files/preview/20260826_1422_{oggi,domani}.png`, con i
  // topojson dello stesso id già pubblicati. Escluderli — come facevo prima — buttava
  // via l'unico segnale disponibile e il layer risultava sempre non raggiungibile.
  test('accetta anche i path di preview: l’id del bollettino è lo stesso', () => {
    expect(bulletinIdFrom('files/preview/20260826_1422_domani.png')).toBe('20260826_1422');
    expect(bulletinIdFrom('files/preview/20260826_1422_oggi.png')).toBe('20260826_1422');
  });

  test('path senza bollettino → null', () => {
    expect(bulletinIdFrom('README.md')).toBeNull();
    expect(bulletinIdFrom('files/topojson/index.json')).toBeNull();
  });
});

describe('discoverLatestBulletin', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    _resetDpcCacheForTests();
    jest.useFakeTimers();
  });
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  test('caso normale: id dal commit di master, geometrie verificate', async () => {
    global.fetch = mockGithub({
      masterFiles: ['files/topojson/20260825_1415_today.json'],
      published: ['20260825_1415'],
    });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) {
      expect(r.data.bulletinId).toBe('20260825_1415');
      expect(r.data.topojsonToday).toBe(RAW_TODAY);
    }
  });

  // Il caso che aveva rotto il layer in produzione.
  test('master con SOLI preview: l\'id viene usato se le geometrie ci sono', async () => {
    global.fetch = mockGithub({
      masterFiles: ['files/preview/20260826_1422_domani.png', 'files/preview/20260826_1422_oggi.png'],
      published: ['20260826_1422'],
    });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260826_1422');
  });

  // Il rischio che avevo cercato di evitare escludendo i preview: un preview della
  // prossima emissione, i cui topojson non esistono ancora. Va scartato per assenza
  // di geometrie, non per la cartella in cui sta.
  test('preview più avanti dei topojson: scarta e prende il bollettino pubblicato', async () => {
    global.fetch = mockGithub({
      masterFiles: [
        'files/preview/20260827_0000_domani.png',
        'files/topojson/20260826_1422_today.json',
      ],
      published: ['20260826_1422'],
    });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260826_1422');
  });

  test('se master non porta id utilizzabili, scorre i commit recenti', async () => {
    global.fetch = mockGithub({
      masterFiles: ['README.md'],
      shas: ['aaa', 'bbb'],
      commitFiles: { aaa: ['docs/x.md'], bbb: ['files/topojson/20260824_1500_today.json'] },
      published: ['20260824_1500'],
    });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260824_1500');
  });

  test('nessun bollettino con geometrie → 502', async () => {
    global.fetch = mockGithub({
      masterFiles: ['files/preview/20260827_0000_domani.png'],
      shas: [],
      published: [],
    });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
  });

  test('cache 30 min: seconda chiamata senza rete, scaduta rifà', async () => {
    global.fetch = mockGithub({
      masterFiles: ['files/topojson/20260825_1415_today.json'],
      published: ['20260825_1415'],
    });
    await discoverLatestBulletin();
    const chiamate = (global.fetch as jest.Mock).mock.calls.length;
    await discoverLatestBulletin();
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(chiamate);
    jest.advanceTimersByTime(31 * 60 * 1000);
    await discoverLatestBulletin();
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(chiamate);
  });

  test('rate limit con cache entro il tetto d\'età → serve la cache', async () => {
    global.fetch = mockGithub({
      masterFiles: ['files/topojson/20260825_1415_today.json'],
      published: ['20260825_1415'],
    });
    await discoverLatestBulletin();
    jest.advanceTimersByTime(31 * 60 * 1000);
    global.fetch = mockGithub({ apiStatus: 403 });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260825_1415');
  });

  // Senza tetto, una cache di due giorni veniva servita come buona: bulletinDates
  // produce due date passate, il layer resta "ready" e non disegna nulla.
  test('cache oltre il tetto d\'età → 502, non dati vecchi spacciati per buoni', async () => {
    global.fetch = mockGithub({
      masterFiles: ['files/topojson/20260825_1415_today.json'],
      published: ['20260825_1415'],
    });
    await discoverLatestBulletin();
    jest.advanceTimersByTime(7 * 60 * 60 * 1000);
    global.fetch = mockGithub({ apiStatus: 403 });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
  });

  // Senza cache negativa ogni richiesta ritenta e brucia il rate limit di GitHub.
  test('dopo un fallimento non ritenta subito (cache negativa)', async () => {
    global.fetch = mockGithub({ apiStatus: 500 });
    const primo = await discoverLatestBulletin();
    const chiamate = (global.fetch as jest.Mock).mock.calls.length;
    const secondo = await discoverLatestBulletin();
    expect(primo.status).toBe(502);
    expect(secondo.status).toBe(502);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(chiamate);
  });

  // Il messaggio finisce nel pannello e in un toast: mai il testo grezzo di upstream
  // ("GitHub API: HTTP 403") né quello inglese della piattaforma per abort e DNS.
  test('errore di discovery: messaggio in italiano, senza dettagli di upstream', async () => {
    global.fetch = mockGithub({ apiStatus: 403 });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
    if (r.status === 502) {
      expect(r.error).toBe('Bollettino DPC non raggiungibile');
      expect(r.error).not.toMatch(/HTTP|GitHub|abort|ENOTFOUND/i);
    }
  });
});
