import { describe, expect, test } from '@jest/globals';
import { buildMeteoUrl } from '../lib/meteo';
import type { Waypoint } from '../lib/types';

function wp(lat: number | null, lon: number | null, order: number): Waypoint {
  return { id: `wp${order}`, name: `WP${order}`, lat, lon, altitude: null, order };
}

describe('buildMeteoUrl', () => {
  test('returns null with 0 waypoints', () => {
    expect(buildMeteoUrl([])).toBeNull();
  });

  test('returns null with 1 valid waypoint', () => {
    expect(buildMeteoUrl([wp(42.0, 14.0, 0)])).toBeNull();
  });

  test('returns null when less than 2 have valid coordinates', () => {
    expect(buildMeteoUrl([wp(42.0, 14.0, 0), wp(null, null, 1)])).toBeNull();
  });

  test('returns URL with centroid of 2 waypoints', () => {
    const url = buildMeteoUrl([wp(42.0, 14.0, 0), wp(44.0, 16.0, 1)]);
    expect(url).toContain('meteoblue.com');
    expect(url).toContain('43.0000');
    expect(url).toContain('15.0000');
  });

  test('returns URL with centroid of 3 waypoints, ignoring null coords', () => {
    const url = buildMeteoUrl([wp(42.0, 14.0, 0), wp(null, null, 1), wp(44.0, 16.0, 2)]);
    expect(url).toContain('43.0000');
    expect(url).toContain('15.0000');
  });

  test('URL format matches Meteoblue pattern', () => {
    const url = buildMeteoUrl([wp(46.5, 11.3, 0), wp(46.7, 11.5, 1)])!;
    expect(url).toMatch(/^https:\/\/www\.meteoblue\.com\/it\/tempo\/settimana\/\d+\.\d+N\d+\.\d+E$/);
  });
});
