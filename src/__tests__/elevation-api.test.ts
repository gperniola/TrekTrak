import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { fetchElevation } from '../lib/elevation-api';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchElevation', () => {
  test('returns elevation from OpenTopoData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ elevation: 1450.2, location: { lat: 46.0, lng: 11.0 } }],
      }),
    } as Response);

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeCloseTo(1450.2, 1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('opentopodata');
  });

  test('falls back to Open-Elevation on primary failure', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ elevation: 1448.0, latitude: 46.0, longitude: 11.0 }],
        }),
      } as Response);

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeCloseTo(1448.0, 1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('returns null if both APIs fail', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));

    const result = await fetchElevation(46.0, 11.0);
    expect(result).toBeNull();
  });
});
