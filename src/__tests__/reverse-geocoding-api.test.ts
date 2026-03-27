import { describe, expect, test, jest, afterEach } from '@jest/globals';
import { extractHikingName, reverseGeocode } from '../lib/reverse-geocoding-api';

describe('extractHikingName', () => {
  test('extracts peak name and abbreviates Monte', () => {
    const data = {
      name: 'Monte Corno',
      address: { peak: 'Monte Corno', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('M.te Corno');
  });

  test('extracts alpine hut and abbreviates Rifugio', () => {
    const data = {
      name: 'Rifugio Duca degli Abruzzi',
      address: { alpine_hut: 'Rifugio Duca degli Abruzzi', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('Rif. Duca degli Abruzzi');
  });

  test('extracts saddle name from address when no top-level name', () => {
    const data = {
      address: { saddle: 'Passo Gardena', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('Passo Gardena');
  });

  test('abbreviates Sentiero in top-level name', () => {
    const data = {
      name: 'Sentiero della Pace',
    };
    const result = extractHikingName(data);
    expect(result).toBe('Sent. della Pace');
  });

  test('abbreviates Bivacco (case-insensitive)', () => {
    const data = {
      name: 'BIVACCO Fanton',
    };
    const result = extractHikingName(data);
    expect(result).toBe('Biv. Fanton');
  });

  test('abbreviates Malga', () => {
    const data = {
      name: 'Malga Nemes',
    };
    const result = extractHikingName(data);
    expect(result).toBe('Mlg. Nemes');
  });

  test('truncates name longer than 30 chars', () => {
    const data = {
      name: 'Monte Corno degli Innamorati del Sole',
    };
    const result = extractHikingName(data);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(31); // 30 + ellipsis char counts as 1
    expect(result).toContain('…');
  });

  test('returns null for empty object', () => {
    expect(extractHikingName({})).toBeNull();
  });

  test('returns null for null input', () => {
    expect(extractHikingName(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(extractHikingName(undefined)).toBeNull();
  });

  test('returns null when address has only country and state level', () => {
    const data = {
      address: {
        country: 'Italia',
        state: 'Trentino-Alto Adige',
        country_code: 'it',
      },
    };
    expect(extractHikingName(data)).toBeNull();
  });

  test('uses tourism field from address when no top-level name (with Bivacco abbreviation)', () => {
    const data = {
      address: { tourism: 'Bivacco Baroni', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('Biv. Baroni');
  });

  test('falls back to village from address', () => {
    const data = {
      address: { village: 'Casteldarne', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('Casteldarne');
  });

  test('falls back to hamlet from address', () => {
    const data = {
      address: { hamlet: 'Braies di Sopra', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('Braies di Sopra');
  });

  test('prefers peak over village in address priority', () => {
    const data = {
      address: { peak: 'Monte Sirente', village: 'Ovindoli', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('M.te Sirente');
  });

  test('handles mountain_pass in address', () => {
    const data = {
      address: { mountain_pass: 'Passo del Brennero', country: 'Italia' },
    };
    const result = extractHikingName(data);
    expect(result).toBe('Passo del Brennero');
  });

  test('falls through to address when name is empty string', () => {
    const data = {
      name: '',
      address: { peak: 'Monte Rosa', country: 'Italia' },
    };
    expect(extractHikingName(data)).toBe('M.te Rosa');
  });

  test('falls through to address when name is whitespace only', () => {
    const data = {
      name: '   ',
      address: { village: 'Gressoney', country: 'Italia' },
    };
    expect(extractHikingName(data)).toBe('Gressoney');
  });

  test('abbreviates then truncates for long names', () => {
    const data = {
      name: 'Rifugio della Madonna del Carmelo Superiore',
    };
    const result = extractHikingName(data);
    expect(result).not.toBeNull();
    // After abbreviation: "Rif. della Madonna del Carmelo Superiore" (41 chars) → truncated
    expect(result!.length).toBeLessThanOrEqual(31); // 30 + ellipsis
    expect(result).toContain('Rif.');
    expect(result).toContain('…');
  });
});

// ---------------------------------------------------------------------------
// reverseGeocode (integration with mocked fetch)
// ---------------------------------------------------------------------------
describe('reverseGeocode', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('returns name from successful Nominatim response', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          name: 'Rifugio Franchetti',
          address: { alpine_hut: 'Rifugio Franchetti', country: 'Italia' },
        }),
      } as Response)
    ) as typeof fetch;

    const result = await reverseGeocode(42.445, 13.567);
    expect(result).toBe('Rif. Franchetti');
  });

  test('returns null on network error', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('fail'))) as typeof fetch;
    const result = await reverseGeocode(42.0, 13.0);
    expect(result).toBeNull();
  });

  test('returns null on non-ok response', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500 } as Response)
    ) as typeof fetch;
    const result = await reverseGeocode(42.0, 13.0);
    expect(result).toBeNull();
  });

  test('returns null for non-finite coordinates', async () => {
    expect(await reverseGeocode(NaN, 13.0)).toBeNull();
    expect(await reverseGeocode(42.0, Infinity)).toBeNull();
  });

  test('includes correct URL params and headers', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ name: 'Test' }),
      } as Response)
    ) as typeof fetch;
    globalThis.fetch = mockFetch;

    await reverseGeocode(42.5, 13.5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (mockFetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('nominatim.openstreetmap.org/reverse');
    expect(url).toContain('zoom=18');
    expect(url).toContain('addressdetails=1');
    expect((opts.headers as Record<string, string>)['User-Agent']).toContain('TrekTrak');
  });
});
