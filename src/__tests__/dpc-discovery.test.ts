import { discoverLatestBulletin, _resetDpcCacheForTests } from '@/lib/dpc-discovery';

const COMMITS = [{ sha: 'abc123' }, { sha: 'def456' }];
const COMMIT_DETAIL = {
  sha: 'abc123',
  files: [{ filename: 'files/preview/20260825_1415_domani.png' }, { filename: 'files/20260825_1415.json' }],
};
const COMMIT_NO_BULLETIN = { sha: 'abc123', files: [{ filename: 'README.md' }] };

function mockFetchSequence(...responses: Array<{ ok: boolean; status?: number; json: unknown }>) {
  const fn = jest.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({ ok: r.ok, status: r.status ?? 200, json: async () => r.json });
  }
  return fn;
}

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

  test('estrae bulletinId dai file del commit e costruisce gli URL raw', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: COMMITS }, { ok: true, json: COMMIT_DETAIL });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) {
      expect(r.data.bulletinId).toBe('20260825_1415');
      expect(r.data.topojsonToday).toBe(
        'https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/topojson/20260825_1415_today.json'
      );
      expect(r.data.topojsonTomorrow).toContain('20260825_1415_tomorrow.json');
    }
  });

  test('scorre più commit finché trova un bollettino', async () => {
    global.fetch = mockFetchSequence(
      { ok: true, json: COMMITS },
      { ok: true, json: COMMIT_NO_BULLETIN },
      { ok: true, json: { sha: 'def456', files: [{ filename: 'files/preview/20260824_1500_domani.png' }] } },
    );
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260824_1500');
  });

  test('cache 30 min: seconda chiamata senza fetch, scaduta rifà', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: COMMITS }, { ok: true, json: COMMIT_DETAIL });
    await discoverLatestBulletin();
    await discoverLatestBulletin();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => COMMIT_DETAIL });
    jest.advanceTimersByTime(31 * 60 * 1000);
    // dopo il TTL rifà la discovery (il mock generico sopra risponde a entrambe le chiamate)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => COMMITS })
      .mockResolvedValueOnce({ ok: true, json: async () => COMMIT_DETAIL });
    await discoverLatestBulletin();
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(2);
  });

  test('rate limit (403) con cache stantia → serve la cache', async () => {
    global.fetch = mockFetchSequence({ ok: true, json: COMMITS }, { ok: true, json: COMMIT_DETAIL });
    await discoverLatestBulletin();
    jest.advanceTimersByTime(31 * 60 * 1000);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.data.bulletinId).toBe('20260825_1415');
  });

  test('errore senza cache → 502', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const r = await discoverLatestBulletin();
    expect(r.status).toBe(502);
  });
});
