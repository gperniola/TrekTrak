import { describe, expect, test, beforeAll, beforeEach, jest } from '@jest/globals';

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Must set env BEFORE importing the module (ORS_API_KEY is read at module level)
process.env.NEXT_PUBLIC_ORS_API_KEY = 'test-api-key';

// Use dynamic import to ensure env is set
let fetchTrailRoute: typeof import('../lib/routing-api').fetchTrailRoute;
let isRoutingAvailable: typeof import('../lib/routing-api').isRoutingAvailable;

beforeAll(async () => {
  const mod = await import('../lib/routing-api');
  fetchTrailRoute = mod.fetchTrailRoute;
  isRoutingAvailable = mod.isRoutingAvailable;
});

beforeEach(() => {
  mockFetch.mockReset();
});

const mockOrsResponse = {
  features: [
    {
      properties: {
        summary: { distance: 3200, ascent: 150, descent: 80 },
      },
      geometry: {
        coordinates: [
          [11.0, 46.0, 1000],
          [11.005, 46.005, 1050],
          [11.01, 46.01, 1150],
        ],
      },
    },
  ],
};

describe('isRoutingAvailable', () => {
  test('returns true when API key is set', () => {
    expect(isRoutingAvailable()).toBe(true);
  });
});

describe('fetchTrailRoute', () => {
  test('returns parsed route from ORS response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrsResponse,
    } as Response);

    const result = await fetchTrailRoute(46.0, 11.0, 46.01, 11.01);
    expect(result).not.toBeNull();
    expect(result!.distanceKm).toBeCloseTo(3.2, 1);
    expect(result!.ascent).toBe(150);
    expect(result!.descent).toBe(80);
    expect(result!.geometry).toHaveLength(3);
    // Coordinates should be flipped to [lat, lon]
    expect(result!.geometry[0]).toEqual([46.0, 11.0]);
    expect(result!.geometry[2]).toEqual([46.01, 11.01]);
    // Elevation from first/last coord
    expect(result!.fromElevation).toBe(1000);
    expect(result!.toElevation).toBe(1150);
  });

  test('sends correct request body with elevation flag', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrsResponse,
    } as Response);

    await fetchTrailRoute(46.0, 11.0, 46.01, 11.01);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.coordinates).toEqual([
      [11.0, 46.0],
      [11.01, 46.01],
    ]);
    expect(body.elevation).toBe(true);
  });

  test('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await fetchTrailRoute(46.0, 11.0, 46.01, 11.01);
    expect(result).toBeNull();
  });

  test('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await fetchTrailRoute(46.0, 11.0, 46.01, 11.01);
    expect(result).toBeNull();
  });

  test('returns null when response has no features', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ features: [] }),
    } as Response);

    const result = await fetchTrailRoute(46.0, 11.0, 46.01, 11.01);
    expect(result).toBeNull();
  });

  test('returns null when summary is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [{ properties: {}, geometry: { coordinates: [[11, 46], [11.01, 46.01]] } }],
      }),
    } as Response);

    const result = await fetchTrailRoute(46.0, 11.0, 46.01, 11.01);
    expect(result).toBeNull();
  });

  test('handles coordinates without elevation (2D)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: { summary: { distance: 1000, ascent: 0, descent: 0 } },
            geometry: { coordinates: [[11.0, 46.0], [11.01, 46.01]] },
          },
        ],
      }),
    } as Response);

    const result = await fetchTrailRoute(46.0, 11.0, 46.01, 11.01);
    expect(result).not.toBeNull();
    expect(result!.fromElevation).toBeNull();
    expect(result!.toElevation).toBeNull();
  });
});
