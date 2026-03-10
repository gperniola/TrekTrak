import { describe, expect, test } from '@jest/globals';
import { generateGPX } from '../lib/export-gpx';
import type { Waypoint } from '../lib/types';

const waypoints: Waypoint[] = [
  { id: '1', name: 'Rifugio', lat: 46.123, lon: 11.456, altitude: 1450, order: 0 },
  { id: '2', name: 'Passo', lat: 46.098, lon: 11.432, altitude: 1870, order: 1 },
];

describe('generateGPX', () => {
  test('generates valid GPX 1.1 XML', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
  });

  test('includes waypoints with wpt tags', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<wpt lat="46.123" lon="11.456">');
    expect(gpx).toContain('<name>Rifugio</name>');
    expect(gpx).toContain('<ele>1450</ele>');
  });

  test('includes track with trkseg', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<trk>');
    expect(gpx).toContain('<trkseg>');
    expect(gpx).toContain('<trkpt lat="46.123" lon="11.456">');
  });

  test('includes metadata with name', () => {
    const gpx = generateGPX('Test Route', waypoints);
    expect(gpx).toContain('<metadata>');
    expect(gpx).toContain('<name>Test Route</name>');
  });

  test('handles waypoints without altitude', () => {
    const wps: Waypoint[] = [
      { id: '1', name: 'A', lat: 46.0, lon: 11.0, altitude: null, order: 0 },
    ];
    const gpx = generateGPX('Test', wps);
    expect(gpx).not.toContain('<ele>');
  });
});
