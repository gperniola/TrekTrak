import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import { buildOverpassQuery, parseOverpassResponse, fetchHikingPOIs } from '../lib/overpass-api';
import type { HikingPOI } from '../lib/overpass-api';

// ---------------------------------------------------------------------------
// buildOverpassQuery
// ---------------------------------------------------------------------------
describe('buildOverpassQuery', () => {
  const bounds = { south: 42.0, north: 43.0, west: 13.0, east: 14.0 };

  test('contains bbox coordinates', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('42');
    expect(query).toContain('43');
    expect(query).toContain('13');
    expect(query).toContain('14');
  });

  test('uses json output format', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('[out:json]');
  });

  test('includes natural=peak POI type', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('natural=peak');
  });

  test('includes natural=saddle POI type', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('natural=saddle');
  });

  test('includes mountain_pass=yes POI type', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('mountain_pass=yes');
  });

  test('includes natural=spring POI type', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('natural=spring');
  });

  test('includes tourism=alpine_hut POI type', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('tourism=alpine_hut');
  });

  test('includes tourism=wilderness_hut POI type', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('tourism=wilderness_hut');
  });

  test('includes sac_scale for trail nodes', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('sac_scale');
  });

  test('uses timeout of 8', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('[timeout:8]');
  });

  test('uses out center 200', () => {
    const query = buildOverpassQuery(bounds);
    expect(query).toContain('out center 200');
  });
});

// ---------------------------------------------------------------------------
// parseOverpassResponse
// ---------------------------------------------------------------------------
describe('parseOverpassResponse', () => {
  test('extracts node with name and type from natural tag', () => {
    const data = {
      elements: [
        {
          type: 'node',
          id: 1,
          lat: 42.5,
          lon: 13.5,
          tags: { natural: 'peak', name: 'Monte Bello' },
        },
      ],
    };
    const pois: HikingPOI[] = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
    expect(pois[0].lat).toBe(42.5);
    expect(pois[0].lon).toBe(13.5);
    expect(pois[0].name).toBe('Monte Bello');
    expect(pois[0].type).toBe('peak');
  });

  test('handles node without name (name is undefined)', () => {
    const data = {
      elements: [
        {
          type: 'node',
          id: 2,
          lat: 42.1,
          lon: 13.1,
          tags: { natural: 'spring' },
        },
      ],
    };
    const pois: HikingPOI[] = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBeUndefined();
    expect(pois[0].type).toBe('spring');
  });

  test('returns empty array for empty response', () => {
    const pois = parseOverpassResponse({ elements: [] });
    expect(pois).toEqual([]);
  });

  test('returns empty array for null/undefined response', () => {
    expect(parseOverpassResponse(null)).toEqual([]);
    expect(parseOverpassResponse(undefined)).toEqual([]);
  });

  test('skips elements without lat/lon (no center either)', () => {
    const data = {
      elements: [
        { type: 'node', id: 3, tags: { natural: 'peak', name: 'No Coords' } },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(0);
  });

  test('extracts way using center coordinates', () => {
    const data = {
      elements: [
        {
          type: 'way',
          id: 10,
          center: { lat: 43.0, lon: 14.0 },
          tags: { tourism: 'alpine_hut', name: 'Rifugio Alto' },
        },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
    expect(pois[0].lat).toBe(43.0);
    expect(pois[0].lon).toBe(14.0);
    expect(pois[0].name).toBe('Rifugio Alto');
    expect(pois[0].type).toBe('alpine_hut');
  });

  test('resolves type from mountain_pass tag', () => {
    const data = {
      elements: [
        {
          type: 'node',
          id: 4,
          lat: 42.8,
          lon: 13.8,
          tags: { mountain_pass: 'yes', name: 'Passo Alto' },
        },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
    expect(pois[0].type).toBe('mountain_pass');
  });

  test('resolves type as wilderness_hut for tourism=wilderness_hut', () => {
    const data = {
      elements: [
        {
          type: 'node',
          id: 5,
          lat: 42.2,
          lon: 13.2,
          tags: { tourism: 'wilderness_hut', name: 'Bivacco' },
        },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
    expect(pois[0].type).toBe('wilderness_hut');
  });

  test('resolves type as trail_node when sac_scale is present', () => {
    const data = {
      elements: [
        {
          type: 'node',
          id: 6,
          lat: 42.3,
          lon: 13.3,
          tags: { highway: 'path', sac_scale: 'hiking' },
        },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(1);
    expect(pois[0].type).toBe('trail_node');
  });

  test('handles multiple elements of different types', () => {
    const data = {
      elements: [
        { type: 'node', id: 7, lat: 42.0, lon: 13.0, tags: { natural: 'peak', name: 'Cima' } },
        { type: 'node', id: 8, lat: 42.1, lon: 13.1, tags: { natural: 'spring' } },
        {
          type: 'way',
          id: 9,
          center: { lat: 42.2, lon: 13.2 },
          tags: { tourism: 'alpine_hut', name: 'Rifugio' },
        },
      ],
    };
    const pois = parseOverpassResponse(data);
    expect(pois).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// fetchHikingPOIs (integration with mocked fetch)
// ---------------------------------------------------------------------------
describe('fetchHikingPOIs', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('returns parsed POIs on successful response', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          elements: [
            { type: 'node', id: 1, lat: 42.5, lon: 13.5, tags: { natural: 'peak', name: 'Cima Test' } },
          ],
        }),
      } as Response)
    ) as typeof fetch;

    const bounds = { south: 42.0, north: 43.0, west: 13.0, east: 14.0 };
    const pois = await fetchHikingPOIs(bounds);
    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBe('Cima Test');
    expect(pois[0].type).toBe('peak');
  });

  test('returns empty array on network error', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as typeof fetch;

    const bounds = { south: 10.0, north: 11.0, west: 20.0, east: 21.0 };
    const pois = await fetchHikingPOIs(bounds);
    expect(pois).toEqual([]);
  });

  test('returns empty array on non-ok response', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 429 } as Response)
    ) as typeof fetch;

    const bounds = { south: 20.0, north: 21.0, west: 30.0, east: 31.0 };
    const pois = await fetchHikingPOIs(bounds);
    expect(pois).toEqual([]);
  });

  test('uses cache for repeated calls with same bounds', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ elements: [{ type: 'node', id: 1, lat: 42.0, lon: 13.0, tags: { natural: 'spring' } }] }),
      } as Response)
    ) as typeof fetch;
    globalThis.fetch = mockFetch;

    const bounds = { south: 50.0, north: 51.0, west: 10.0, east: 11.0 };
    await fetchHikingPOIs(bounds);
    await fetchHikingPOIs(bounds);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
