import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { fetchElevation, fetchElevationProfile } from '../lib/elevation-api';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchElevation', () => {
  test('returns elevation from proxy', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ elevation: 1450.2, location: { lat: 46.0, lng: 11.0 } }],
      }),
    } as Response);

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeCloseTo(1450.2, 1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/elevation');
  });

  test('returns null on proxy failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('returns null if response has no valid elevation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ elevation: null }] }),
    } as Response);

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeNull();
  });

  test('returns null for invalid coordinates', async () => {
    const result = await fetchElevation(NaN, 11.0);
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('fetchElevationProfile', () => {
  test('returns batch elevations from proxy', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { elevation: 100.0 },
          { elevation: 150.5 },
          { elevation: 200.0 },
        ],
      }),
    } as Response);

    const result = await fetchElevationProfile([[42.0, 14.0], [42.1, 14.1], [42.2, 14.2]]);
    expect(result).toEqual([100.0, 150.5, 200.0]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0][0] as string)).toContain('%7C');
  });

  test('returns all nulls on proxy failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const result = await fetchElevationProfile([[42.0, 14.0], [42.1, 14.1]]);
    expect(result).toEqual([null, null]);
  });

  test('returns empty array for empty input', async () => {
    const result = await fetchElevationProfile([]);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('returns all nulls for invalid coordinates', async () => {
    const result = await fetchElevationProfile([[NaN, 14.0], [42.0, Infinity]]);
    expect(result).toEqual([null, null]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('handles partial null elevations in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { elevation: 100.0 },
          { elevation: null },
          { elevation: 200.0 },
        ],
      }),
    } as Response);

    const result = await fetchElevationProfile([[42.0, 14.0], [42.1, 14.1], [42.2, 14.2]]);
    expect(result).toEqual([100.0, null, 200.0]);
  });
});
