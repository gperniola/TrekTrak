import { discoverLatestBulletin, bulletinIdFrom, _resetDpcCacheForTests } from '@/lib/dpc-discovery';

/** Commit di `master`: nel caso normale basta questo, una sola chiamata. */
const MASTER_COMMIT = {
  sha: 'abc123',
  files: [
    { filename: 'files/preview/20260826_0000_domani.png' },
    { filename: 'files/topojson/20260825_1415_today.json' },
    { filename: 'files/topojson/20260825_1415_tomorrow.json' },
  ],
};
const MASTER_NO_BULLETIN = { sha: 'abc123', files: [{ filename: 'README.md' }] };
const COMMITS = [{ sha: 'abc123' }, { sha: 'def456' }];

function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; json: unknown }>) {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ ok: r.ok, status: r.status ?? 200, json: async () => r.json });
  }
  return fn;
}

const RAW_TODAY =
  'https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/topojson/20260825_1415_today.json';

describe('bulletinIdFrom', () => {
  // La vecchia regex pretendeva l'id subito dopo `files/` o `files/preview/`, quindi
  // NON matchava la forma canonica che il modulo stesso costruisce.
  test('riconosce la forma canonica files/topojson/<id>_today.json', () => {
    expect(bulletinIdFrom('files/topojson/20260825_1415_today.json')).toBe('20260825_1415');
    expect(bulletinIdFrom('files/geojson/20260825_1415_tomorrow.json')).toBe('20260825_1415');
    expect(bulletinIdFrom('files/20260825_1415.zip')).toBe('20260825_1415');
  });

  // Un id di preview esiste prima dei topojson pubblicati: usarlo dà 404 su entrambi
  // i giorni e il layer non mostra nessuna zona.
  test('ignora i path di preview', () => {
    expect(bulletinIdFrom('files/preview/20260826_0000_domani.png')).toBeNull();
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

  test('una sola chiamata nel caso normale, e sceglie il bollettino pubblicato non il preview', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: MASTER_COMMIT });
    const r = await discoverLatestBulletin();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('/commits/master');
    expect(r.status).toBe(200);
    if (r.status === 200) {
      expect(r.data.bulletinId).toBe('20260825_1415');
      expect(r.data.topojsonToday).toBe(RAW_TODAY);
      expect(r.data.topojsonTomorrow).toContain('20260825_1415_tomorrow.json');
    }
  });

  test('se master non porta bollettini, scorre i commit recenti', async () => {
    global.fetch = mockFetchSequence(
      { ok: true, json: MASTER_NO_BULLETIN },
      { ok: true, json: COMMITS },
      { ok: true, json: MASTER_NO_BULLETIN },
      { ok: true, json: { sha: 'def456', files: [{ filename: 'files/topojson/20260824_1500_today.json' }] } },
    );
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260824_1500');
  });

  test('cache 30 min: seconda chiamata senza fetch, scaduta rifà', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: MASTER_COMMIT });
    await discoverLatestBulletin();
    await discoverLatestBulletin();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(31 * 60 * 1000);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => MASTER_COMMIT });
    await discoverLatestBulletin();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('rate limit con cache entro il tetto d\'età → serve la cache', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: MASTER_COMMIT });
    await discoverLatestBulletin();
    jest.advanceTimersByTime(31 * 60 * 1000);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260825_1415');
  });

  // Senza tetto, una cache di due giorni veniva servita come buona: bulletinDates
  // produce due date passate, il layer resta "ready" e non disegna nulla.
  test('cache oltre il tetto d\'età → 502, non dati vecchi spacciati per buoni', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: MASTER_COMMIT });
    await discoverLatestBulletin();
    jest.advanceTimersByTime(7 * 60 * 60 * 1000);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
  });

  // Senza cache negativa ogni richiesta ritenta e brucia il rate limit di GitHub.
  test('dopo un fallimento non ritenta subito (cache negativa)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const first = await discoverLatestBulletin();
    const callsAfterFirst = (global.fetch as jest.Mock).mock.calls.length;
    const second = await discoverLatestBulletin();
    expect(first.status).toBe(502);
    expect(second.status).toBe(502);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
  });

  test('errore senza cache → 502', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
  });

  // Il messaggio finisce nel pannello e in un toast: mai il testo grezzo di upstream
  // ("GitHub API: HTTP 403") né quello inglese della piattaforma per abort e DNS.
  test('errore di discovery: messaggio in italiano, senza dettagli di upstream', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
    if (r.status === 502) {
      expect(r.error).toBe('Bollettino DPC non raggiungibile');
      expect(r.error).not.toMatch(/HTTP|GitHub|abort|ENOTFOUND/i);
    }
  });
});
