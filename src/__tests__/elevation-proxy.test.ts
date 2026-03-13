import { describe, expect, test, beforeEach, jest } from '@jest/globals';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

import { fetchElevationUpstream, LOCATION_RE } from '../lib/elevation-proxy';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('elevation-proxy', () => {
  describe('LOCATION_RE validation', () => {
    test('accepts valid coordinates', () => {
      expect(LOCATION_RE.test('46.0,11.0')).toBe(true);
      expect(LOCATION_RE.test('-33.8,151.2')).toBe(true);
      expect(LOCATION_RE.test('0,0')).toBe(true);
      expect(LOCATION_RE.test('-90,-180')).toBe(true);
    });

    test('rejects invalid formats', () => {
      expect(LOCATION_RE.test('abc,def')).toBe(false);
      expect(LOCATION_RE.test('46.0')).toBe(false);
      expect(LOCATION_RE.test('')).toBe(false);
      expect(LOCATION_RE.test('46.0,11.0,100')).toBe(false);
    });
  });

  describe('fetchElevationUpstream', () => {
    test('returns elevation from primary upstream', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ elevation: 1450.2, location: { lat: 46.0, lng: 11.0 } }],
        }),
      } as Response);

      const result = await fetchElevationUpstream('46.0,11.0');

      expect(result.status).toBe(200);
      expect(result).toHaveProperty('data');
      if (result.status === 200) {
        expect((result.data as { results: { elevation: number }[] }).results[0].elevation).toBeCloseTo(1450.2, 1);
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect((mockFetch.mock.calls[0][0] as string)).toContain('opentopodata');
    });

    test('falls back to secondary upstream on primary failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ elevation: 1448.0 }],
          }),
        } as Response);

      const result = await fetchElevationUpstream('46.0,11.0');

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect((mockFetch.mock.calls[1][0] as string)).toContain('open-elevation');
    });

    test('returns 502 when both upstreams fail', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'));

      const result = await fetchElevationUpstream('46.0,11.0');

      expect(result.status).toBe(502);
    });

    test('returns 400 for invalid locations', async () => {
      const result = await fetchElevationUpstream('abc,def');

      expect(result.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('returns 400 for empty locations', async () => {
      const result = await fetchElevationUpstream('');

      expect(result.status).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('falls back when primary returns non-ok status', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ elevation: 1200.0 }] }),
        } as Response);

      const result = await fetchElevationUpstream('46.0,11.0');

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
