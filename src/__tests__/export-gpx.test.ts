import { describe, expect, test } from '@jest/globals';
import { generateGPX } from '../lib/export-gpx';
import type { Waypoint, Leg } from '../lib/types';

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

  test('escapes XML special characters in name', () => {
    const wps: Waypoint[] = [
      { id: '1', name: 'A & B <test>', lat: 46.0, lon: 11.0, altitude: null, order: 0 },
    ];
    const gpx = generateGPX('Route & "quotes"', wps);
    expect(gpx).toContain('Route &amp; &quot;quotes&quot;');
    expect(gpx).toContain('A &amp; B &lt;test&gt;');
  });

  test('filters out waypoints with null coordinates', () => {
    const wps: Waypoint[] = [
      { id: '1', name: 'Valid', lat: 46.0, lon: 11.0, altitude: 1000, order: 0 },
      { id: '2', name: 'No coords', lat: null, lon: null, altitude: null, order: 1 },
      { id: '3', name: 'Also valid', lat: 46.01, lon: 11.01, altitude: 1100, order: 2 },
    ];
    const gpx = generateGPX('Test', wps);
    expect(gpx).toContain('<wpt lat="46" lon="11">');
    expect(gpx).toContain('<wpt lat="46.01" lon="11.01">');
    expect(gpx).not.toContain('No coords');
  });

  test('uses default name when empty', () => {
    const gpx = generateGPX('', waypoints);
    expect(gpx).toContain('<name>TrekTrak Route</name>');
  });

  test('omits trk section when fewer than 2 valid waypoints', () => {
    const wps: Waypoint[] = [
      { id: '1', name: 'Solo', lat: 46.0, lon: 11.0, altitude: 1000, order: 0 },
    ];
    const gpx = generateGPX('Test', wps);
    expect(gpx).toContain('<wpt');
    expect(gpx).not.toContain('<trk>');
    expect(gpx).not.toContain('<trkseg>');
  });

  test('omits trk section when no valid waypoints', () => {
    const gpx = generateGPX('Empty', []);
    expect(gpx).toContain('<gpx');
    expect(gpx).not.toContain('<trk>');
  });
});

describe('generateGPX with routeGeometry', () => {
  test('includes trail geometry points between waypoints', () => {
    const legs: Leg[] = [
      {
        id: 'leg1',
        fromWaypointId: '1',
        toWaypointId: '2',
        distance: 3.2,
        elevationGain: 420,
        elevationLoss: 0,
        azimuth: 200,
        routeGeometry: [
          [46.123, 11.456],  // same as from waypoint
          [46.115, 11.450],  // intermediate
          [46.110, 11.445],  // intermediate
          [46.098, 11.432],  // same as to waypoint
        ],
      },
    ];
    const gpx = generateGPX('Trail Route', waypoints, legs);

    // Should contain intermediate trail points (not first, not last of geometry)
    expect(gpx).toContain('trkpt lat="46.115" lon="11.45"');
    expect(gpx).toContain('trkpt lat="46.11" lon="11.445"');
  });

  test('falls back to waypoints only when no routeGeometry', () => {
    const legs: Leg[] = [
      {
        id: 'leg1',
        fromWaypointId: '1',
        toWaypointId: '2',
        distance: 3.2,
        elevationGain: 420,
        elevationLoss: 0,
        azimuth: 200,
      },
    ];
    const gpx = generateGPX('Simple Route', waypoints, legs);

    // Should still have waypoint trkpts
    expect(gpx).toContain('trkpt lat="46.123" lon="11.456"');
    expect(gpx).toContain('trkpt lat="46.098" lon="11.432"');
  });

  test('handles mixed legs: some with routeGeometry, some without', () => {
    const wps: Waypoint[] = [
      { id: '1', name: 'A', lat: 46.0, lon: 11.0, altitude: 1000, order: 0 },
      { id: '2', name: 'B', lat: 46.1, lon: 11.1, altitude: 1200, order: 1 },
      { id: '3', name: 'C', lat: 46.2, lon: 11.2, altitude: 1100, order: 2 },
    ];
    const legs: Leg[] = [
      {
        id: 'leg1', fromWaypointId: '1', toWaypointId: '2',
        distance: 2, elevationGain: 200, elevationLoss: 0, azimuth: 45,
        routeGeometry: [[46.0, 11.0], [46.05, 11.05], [46.1, 11.1]],
      },
      {
        id: 'leg2', fromWaypointId: '2', toWaypointId: '3',
        distance: 1.5, elevationGain: 0, elevationLoss: 100, azimuth: 90,
        // no routeGeometry
      },
    ];
    const gpx = generateGPX('Mixed', wps, legs);

    // Leg 1: intermediate trail point present
    expect(gpx).toContain('trkpt lat="46.05" lon="11.05"');
    // Leg 2: only waypoint trkpts (B and C), no intermediate
    expect(gpx).toContain('trkpt lat="46.1" lon="11.1"');
    expect(gpx).toContain('trkpt lat="46.2" lon="11.2"');
  });

  test('skips routeGeometry with fewer than 2 points', () => {
    const legs: Leg[] = [
      {
        id: 'leg1',
        fromWaypointId: '1',
        toWaypointId: '2',
        distance: 3.2,
        elevationGain: 420,
        elevationLoss: 0,
        azimuth: 200,
        routeGeometry: [[46.123, 11.456]],
      },
    ];
    const gpx = generateGPX('Short Route', waypoints, legs);

    // Should still contain waypoint trkpts but no extra intermediate points
    expect(gpx).toContain('trkpt lat="46.123" lon="11.456"');
    expect(gpx).toContain('trkpt lat="46.098" lon="11.432"');
  });
});
