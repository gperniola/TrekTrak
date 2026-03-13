import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { fetchElevation } from '../lib/elevation-api';

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
