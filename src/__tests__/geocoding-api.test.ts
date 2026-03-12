import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { searchLocation } from '../lib/geocoding-api';

const mockFetch = jest.fn() as jest.MockedFunction<typeof global.fetch>;
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('searchLocation', () => {
  test('returns empty array for query shorter than 3 chars', async () => {
    const results = await searchLocation('ab');
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('returns empty array for empty query', async () => {
    const results = await searchLocation('');
    expect(results).toEqual([]);
  });

  test('parses Nominatim response correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: '42.351', lon: '14.168', display_name: 'Chieti, Abruzzo, Italia', type: 'city' },
        { lat: '41.902', lon: '12.496', display_name: 'Roma, Lazio, Italia', type: 'city' },
      ],
    } as Response);

    const results = await searchLocation('Chieti');
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      displayName: 'Chieti, Abruzzo, Italia',
      lat: 42.351,
      lon: 14.168,
      type: 'city',
    });
  });

  test('returns empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const results = await searchLocation('Roma');
    expect(results).toEqual([]);
  });

  test('returns empty array on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);
    const results = await searchLocation('Roma');
    expect(results).toEqual([]);
  });

  test('filters out results with invalid coordinates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { lat: 'not-a-number', lon: '14.168', display_name: 'Bad', type: 'city' },
        { lat: '42.351', lon: '14.168', display_name: 'Good', type: 'city' },
      ],
    } as Response);

    const results = await searchLocation('test query');
    expect(results).toHaveLength(1);
    expect(results[0].displayName).toBe('Good');
  });

  test('handles non-array response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: 'unexpected' }),
    } as Response);
    const results = await searchLocation('test query');
    expect(results).toEqual([]);
  });

  test('passes correct parameters and headers to Nominatim', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await searchLocation('Chieti centro');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('q=Chieti');
    expect(url).toContain('format=json');
    expect(url).toContain('limit=5');
    const options = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('TrekTrak');
  });

  test('parses boundingbox from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: '42.351', lon: '14.168',
          display_name: 'Chieti, Abruzzo, Italia',
          type: 'city',
          boundingbox: ['42.300', '42.400', '14.100', '14.200'],
        },
      ],
    } as Response);

    const results = await searchLocation('Chieti');
    expect(results).toHaveLength(1);
    expect(results[0].boundingbox).toEqual([42.3, 42.4, 14.1, 14.2]);
  });

  test('omits boundingbox when invalid', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: '42.351', lon: '14.168',
          display_name: 'Test', type: 'city',
          boundingbox: ['NaN', '42.4', '14.1', '14.2'],
        },
      ],
    } as Response);

    const results = await searchLocation('test query');
    expect(results).toHaveLength(1);
    expect(results[0].boundingbox).toBeUndefined();
  });

  test('accepts external AbortSignal for cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const results = await searchLocation('Roma centro', controller.signal);
    expect(results).toEqual([]);
  });

  test('returns empty array when no results match', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);
    const results = await searchLocation('xyznonexistent');
    expect(results).toEqual([]);
  });
});
