import { describe, expect, test } from '@jest/globals';
import { validateItinerarySchema } from '../lib/export-json';

const validItinerary = {
  id: 'test-1',
  name: 'Test Route',
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
  waypoints: [
    { id: 'wp1', name: 'Start', lat: 46.0, lon: 11.0, altitude: 1000, order: 0 },
    { id: 'wp2', name: 'End', lat: 46.01, lon: 11.01, altitude: 1200, order: 1 },
  ],
  legs: [
    { id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', distance: 1.5, elevationGain: 200, elevationLoss: 0, azimuth: 45 },
  ],
};

describe('validateItinerarySchema', () => {
  test('accepts valid itinerary', () => {
    expect(validateItinerarySchema(validItinerary)).toBe(true);
  });

  test('accepts itinerary with null optional fields', () => {
    const it = {
      ...validItinerary,
      waypoints: [
        { id: 'wp1', name: 'A', lat: null, lon: null, altitude: null, order: 0 },
      ],
      legs: [],
    };
    expect(validateItinerarySchema(it)).toBe(true);
  });

  test('accepts empty waypoints and legs', () => {
    const it = { ...validItinerary, waypoints: [], legs: [] };
    expect(validateItinerarySchema(it)).toBe(true);
  });

  test('rejects null input', () => {
    expect(validateItinerarySchema(null)).toBe(false);
  });

  test('rejects non-object input', () => {
    expect(validateItinerarySchema('string')).toBe(false);
    expect(validateItinerarySchema(42)).toBe(false);
  });

  test('rejects missing id', () => {
    const { id, ...rest } = validItinerary;
    expect(validateItinerarySchema(rest)).toBe(false);
  });

  test('rejects missing name', () => {
    const { name, ...rest } = validItinerary;
    expect(validateItinerarySchema(rest)).toBe(false);
  });

  test('rejects missing createdAt', () => {
    const { createdAt, ...rest } = validItinerary;
    expect(validateItinerarySchema(rest)).toBe(false);
  });

  test('rejects missing updatedAt', () => {
    const { updatedAt, ...rest } = validItinerary;
    expect(validateItinerarySchema(rest)).toBe(false);
  });

  test('rejects non-array waypoints', () => {
    expect(validateItinerarySchema({ ...validItinerary, waypoints: 'not-array' })).toBe(false);
  });

  test('rejects non-array legs', () => {
    expect(validateItinerarySchema({ ...validItinerary, legs: 'not-array' })).toBe(false);
  });

  test('rejects duplicate waypoint ids', () => {
    const it = {
      ...validItinerary,
      waypoints: [
        { id: 'wp1', name: 'A', lat: null, lon: null, altitude: null, order: 0 },
        { id: 'wp1', name: 'B', lat: null, lon: null, altitude: null, order: 1 },
      ],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects duplicate leg ids', () => {
    const it = {
      ...validItinerary,
      legs: [
        { id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2' },
        { id: 'leg1', fromWaypointId: 'wp2', toWaypointId: 'wp1' },
      ],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects lat out of range', () => {
    const it = {
      ...validItinerary,
      waypoints: [{ id: 'wp1', name: 'A', lat: 91, lon: 11, altitude: null, order: 0 }],
      legs: [],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects lon out of range', () => {
    const it = {
      ...validItinerary,
      waypoints: [{ id: 'wp1', name: 'A', lat: 46, lon: 181, altitude: null, order: 0 }],
      legs: [],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects NaN altitude', () => {
    const it = {
      ...validItinerary,
      waypoints: [{ id: 'wp1', name: 'A', lat: null, lon: null, altitude: NaN, order: 0 }],
      legs: [],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects negative distance', () => {
    const it = {
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', distance: -5 }],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects azimuth >= 360', () => {
    expect(validateItinerarySchema({
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', azimuth: 361 }],
    })).toBe(false);
    expect(validateItinerarySchema({
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', azimuth: 360 }],
    })).toBe(false);
  });

  test('accepts azimuth at boundary values 0 and 359.9', () => {
    expect(validateItinerarySchema({
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', azimuth: 0 }],
    })).toBe(true);
    expect(validateItinerarySchema({
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', azimuth: 359.9 }],
    })).toBe(true);
  });

  test('rejects NaN order', () => {
    const it = {
      ...validItinerary,
      waypoints: [{ id: 'wp1', name: 'A', lat: null, lon: null, altitude: null, order: NaN }],
      legs: [],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects waypoint with non-string name', () => {
    const it = {
      ...validItinerary,
      waypoints: [{ id: 'wp1', name: 123, lat: null, lon: null, altitude: null, order: 0 }],
      legs: [],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects leg missing fromWaypointId', () => {
    const it = {
      ...validItinerary,
      legs: [{ id: 'leg1', toWaypointId: 'wp2' }],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects leg referencing non-existent waypoint', () => {
    const it = {
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp-nonexistent' }],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects leg with fromWaypointId not in waypoints array', () => {
    const it = {
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp-missing', toWaypointId: 'wp2' }],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects negative elevationGain', () => {
    const it = {
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', elevationGain: -10 }],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });

  test('rejects Infinity distance', () => {
    const it = {
      ...validItinerary,
      legs: [{ id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', distance: Infinity }],
    };
    expect(validateItinerarySchema(it)).toBe(false);
  });
});
