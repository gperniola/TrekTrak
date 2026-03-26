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

  test('exactly 95 points uses single batch', async () => {
    const points: [number, number][] = Array.from({ length: 95 }, (_, i) => [42.0 + i * 0.001, 14.0]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: Array.from({ length: 95 }, (_, i) => ({ elevation: i })),
      }),
    } as Response);

    const result = await fetchElevationProfile(points);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(95);
  });

  test('96 points splits into 95 + 1', async () => {
    const points: [number, number][] = Array.from({ length: 96 }, (_, i) => [42.0 + i * 0.001, 14.0]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: Array.from({ length: 95 }, (_, i) => ({ elevation: i })),
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ elevation: 999 }],
      }),
    } as Response);

    const result = await fetchElevationProfile(points);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(96);
    expect(result[94]).toBe(94);
    expect(result[95]).toBe(999);
  });

  test('splits >95 points into multiple batches', async () => {
    // Create 100 points — should split into 2 batches (95 + 5)
    const points: [number, number][] = Array.from({ length: 100 }, (_, i) => [42.0 + i * 0.001, 14.0]);

    // First batch: 95 points
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: Array.from({ length: 95 }, (_, i) => ({ elevation: 100 + i })),
      }),
    } as Response);

    // Second batch: 5 points
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: Array.from({ length: 5 }, (_, i) => ({ elevation: 195 + i })),
      }),
    } as Response);

    const result = await fetchElevationProfile(points);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(100);
    expect(result[0]).toBe(100);
    expect(result[94]).toBe(194);
    expect(result[95]).toBe(195);
    expect(result[99]).toBe(199);
  });

  test('multi-batch handles partial batch failure gracefully', async () => {
    const points: [number, number][] = Array.from({ length: 100 }, (_, i) => [42.0 + i * 0.001, 14.0]);

    // First batch succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: Array.from({ length: 95 }, (_, i) => ({ elevation: 100 + i })),
      }),
    } as Response);

    // Second batch fails
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const result = await fetchElevationProfile(points);

    expect(result).toHaveLength(100);
    expect(result[0]).toBe(100); // first batch OK
    expect(result[94]).toBe(194);
    expect(result[95]).toBeNull(); // second batch failed — nulls
    expect(result[99]).toBeNull();
  });
});
