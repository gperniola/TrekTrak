import { describe, expect, test } from '@jest/globals';
import { encodeItinerary, decodeItinerary } from '../lib/share-url';
import type { Waypoint, Leg } from '../lib/types';

function wp(id: string, name: string, lat: number | null, lon: number | null, alt: number | null, order: number): Waypoint {
  return { id, name, lat, lon, altitude: alt, order };
}

function leg(id: string, fromId: string, toId: string, dist: number | null, gain: number | null, loss: number | null, az: number | null): Leg {
  return { id, fromWaypointId: fromId, toWaypointId: toId, distance: dist, elevationGain: gain, elevationLoss: loss, azimuth: az };
}

const sampleWps: Waypoint[] = [
  wp('a', 'Partenza', 46.5, 11.3, 1200, 0),
  wp('b', 'Rifugio', 46.6, 11.4, 1800, 1),
  wp('c', 'Vetta', 46.7, 11.5, 2400, 2),
];

const sampleLegs: Leg[] = [
  leg('l1', 'a', 'b', 3.5, 600, 0, 45),
  leg('l2', 'b', 'c', 2.1, 600, 0, 90),
];

describe('encodeItinerary', () => {
  test('produces a string starting with #data= for valid input', () => {
    const result = encodeItinerary('Test', sampleWps, sampleLegs);
    expect(result).not.toBeNull();
    expect(result!).toMatch(/^#data=.+/);
  });

  test('returns null for >15 waypoints', () => {
    const manyWps = Array.from({ length: 16 }, (_, i) => wp(`w${i}`, `WP${i}`, 46 + i * 0.01, 11, null, i));
    const manyLegs = Array.from({ length: 15 }, (_, i) => leg(`l${i}`, `w${i}`, `w${i + 1}`, null, null, null, null));
    expect(encodeItinerary('Big', manyWps, manyLegs)).toBeNull();
  });
});

describe('decodeItinerary', () => {
  test('returns null for empty string', () => {
    expect(decodeItinerary('')).toBeNull();
  });

  test('returns null for invalid hash', () => {
    expect(decodeItinerary('#data=INVALID_GARBAGE')).toBeNull();
  });

  test('returns null for valid lz-string but bad JSON structure', () => {
    const LZString = require('lz-string');
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify({ foo: 'bar' }));
    expect(decodeItinerary(`#data=${compressed}`)).toBeNull();
  });

  test('returns null for waypoint name that is not a string', () => {
    const LZString = require('lz-string');
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify({
      n: 'test', w: [123, 46.0, 11.0, null, 'ok', 46.1, 11.1, null], l: [1, 0, 0, 90],
    }));
    expect(decodeItinerary(`#data=${compressed}`)).toBeNull();
  });

  test('returns null for itinerary name exceeding 200 chars', () => {
    const LZString = require('lz-string');
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify({
      n: 'x'.repeat(201), w: ['A', 46, 11, null, 'B', 46.1, 11.1, null], l: [1, 0, 0, 90],
    }));
    expect(decodeItinerary(`#data=${compressed}`)).toBeNull();
  });
});

describe('roundtrip', () => {
  test('encode then decode preserves all fields', () => {
    const encoded = encodeItinerary('Giro Dolomiti', sampleWps, sampleLegs)!;
    const decoded = decodeItinerary(encoded)!;
    expect(decoded).not.toBeNull();
    expect(decoded.name).toBe('Giro Dolomiti');
    expect(decoded.waypoints).toHaveLength(3);
    expect(decoded.legs).toHaveLength(2);

    expect(decoded.waypoints[0].name).toBe('Partenza');
    expect(decoded.waypoints[0].lat).toBe(46.5);
    expect(decoded.waypoints[0].lon).toBe(11.3);
    expect(decoded.waypoints[0].altitude).toBe(1200);

    expect(decoded.legs[0].distance).toBe(3.5);
    expect(decoded.legs[0].elevationGain).toBe(600);
    expect(decoded.legs[0].azimuth).toBe(45);
  });

  test('preserves null fields correctly', () => {
    const wps = [wp('a', 'Start', 46.5, 11.3, null, 0), wp('b', 'End', null, null, null, 1)];
    const lgs = [leg('l1', 'a', 'b', null, null, null, null)];
    const encoded = encodeItinerary('Null Test', wps, lgs)!;
    const decoded = decodeItinerary(encoded)!;
    expect(decoded.waypoints[0].altitude).toBeNull();
    expect(decoded.waypoints[1].lat).toBeNull();
    expect(decoded.legs[0].distance).toBeNull();
  });
});
