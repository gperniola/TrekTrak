import { describe, expect, test, beforeEach } from '@jest/globals';
import { useItineraryStore } from '../stores/itineraryStore';
import type { AppMode } from '../lib/types';

beforeEach(() => {
  useItineraryStore.setState({
    itineraryId: 'test-id',
    itineraryName: '',
    waypoints: [],
    legs: [],
    settings: { tolerances: { altitude: 50, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 }, mapDisplay: { coloredPath: false, trailRouting: false } },
    appMode: 'learn' as AppMode,
  });
});

describe('waypoint management', () => {
  test('adds a waypoint', () => {
    useItineraryStore.getState().addWaypoint();
    expect(useItineraryStore.getState().waypoints).toHaveLength(1);
    expect(useItineraryStore.getState().waypoints[0].order).toBe(0);
  });

  test('adds second waypoint and creates a leg', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    expect(useItineraryStore.getState().legs).toHaveLength(1);
  });

  test('removes a middle waypoint and reconnects legs', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[1].id;
    useItineraryStore.getState().removeWaypoint(wpId);
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    expect(useItineraryStore.getState().legs).toHaveLength(1);
  });

  test('removes the first waypoint', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const firstId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().removeWaypoint(firstId);
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    expect(useItineraryStore.getState().waypoints[0].order).toBe(0);
    expect(useItineraryStore.getState().waypoints[1].order).toBe(1);
    expect(useItineraryStore.getState().legs).toHaveLength(1);
  });

  test('removes the last waypoint', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const lastId = useItineraryStore.getState().waypoints[2].id;
    useItineraryStore.getState().removeWaypoint(lastId);
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    expect(useItineraryStore.getState().legs).toHaveLength(1);
  });

  test('removes the only waypoint', () => {
    useItineraryStore.getState().addWaypoint();
    const onlyId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().removeWaypoint(onlyId);
    expect(useItineraryStore.getState().waypoints).toHaveLength(0);
    expect(useItineraryStore.getState().legs).toHaveLength(0);
  });

  test('updates waypoint fields', () => {
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, { name: 'Rifugio', altitude: 1450 });
    expect(useItineraryStore.getState().waypoints[0].name).toBe('Rifugio');
    expect(useItineraryStore.getState().waypoints[0].altitude).toBe(1450);
  });

  test('updates waypoint lat/lon from map click', () => {
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypointPosition(wpId, 46.0, 11.0);
    expect(useItineraryStore.getState().waypoints[0].lat).toBe(46.0);
    expect(useItineraryStore.getState().waypoints[0].lon).toBe(11.0);
    expect(useItineraryStore.getState().waypoints[0].altitude).toBeNull();
  });
});

describe('leg management', () => {
  test('updates leg fields', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, { distance: 3.2, azimuth: 245 });
    expect(useItineraryStore.getState().legs[0].distance).toBe(3.2);
    expect(useItineraryStore.getState().legs[0].azimuth).toBe(245);
  });

  test('auto-calculates estimated time when leg data is complete', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      distance: 4,
      elevationGain: 0,
      elevationLoss: 0,
    });
    expect(useItineraryStore.getState().legs[0].estimatedTime).toBe(60);
  });
});

describe('reorder waypoints', () => {
  test('reordering with reversed pair creates new empty leg', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, { distance: 5 });
    useItineraryStore.getState().reorderWaypoints([1, 0]);
    expect(useItineraryStore.getState().legs[0].distance).toBeNull();
  });

  test('rejects wrong length array', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().reorderWaypoints([0]);
    // Should be unchanged - still 2 waypoints with original order
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    expect(useItineraryStore.getState().waypoints[0].order).toBe(0);
  });

  test('rejects out-of-range indices', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().reorderWaypoints([0, 5]);
    expect(useItineraryStore.getState().waypoints[0].order).toBe(0);
    expect(useItineraryStore.getState().waypoints[1].order).toBe(1);
  });

  test('rejects duplicate indices', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().reorderWaypoints([0, 0]);
    expect(useItineraryStore.getState().waypoints[0].order).toBe(0);
    expect(useItineraryStore.getState().waypoints[1].order).toBe(1);
  });
});

describe('itinerary name', () => {
  test('sets itinerary name', () => {
    useItineraryStore.getState().setItineraryName('Monte Rosa');
    expect(useItineraryStore.getState().itineraryName).toBe('Monte Rosa');
  });
});

describe('appMode', () => {
  test('defaults to learn', () => {
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  test('switches to track mode', () => {
    useItineraryStore.getState().setAppMode('track');
    expect(useItineraryStore.getState().appMode).toBe('track');
  });

  test('no-op when setting same mode', () => {
    useItineraryStore.getState().setAppMode('learn');
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  test('clears validation when switching modes', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, {
      validationState: { altitude: { status: 'valid', userValue: 1450, realValue: 1455, delta: 5, tolerance: { strict: 50, loose: 100 } } },
    });
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      validationState: { distance: { status: 'valid', userValue: 3.2, realValue: 3.3, delta: 0.1, tolerance: { strict: 0.32, loose: 0.64 } } },
    });

    useItineraryStore.getState().setAppMode('track');

    expect(useItineraryStore.getState().waypoints[0].validationState).toBeUndefined();
    expect(useItineraryStore.getState().legs[0].validationState).toBeUndefined();
  });

  test('clears routeGeometry when switching to learn', () => {
    useItineraryStore.getState().setAppMode('track');
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      routeGeometry: [[46.0, 11.0], [46.01, 11.01]],
    });
    expect(useItineraryStore.getState().legs[0].routeGeometry).toBeDefined();

    useItineraryStore.getState().setAppMode('learn');

    expect(useItineraryStore.getState().legs[0].routeGeometry).toBeUndefined();
  });

  test('switching to learn clears altitude and all leg computed fields', () => {
    useItineraryStore.getState().setAppMode('track');
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, { altitude: 1450 });
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      distance: 3.2, azimuth: 245, elevationGain: 200, elevationLoss: 50,
    });

    useItineraryStore.getState().setAppMode('learn');

    expect(useItineraryStore.getState().waypoints[0].altitude).toBeNull();
    const leg = useItineraryStore.getState().legs[0];
    expect(leg.distance).toBeNull();
    expect(leg.azimuth).toBeNull();
    expect(leg.elevationGain).toBeNull();
    expect(leg.elevationLoss).toBeNull();
    expect(leg.estimatedTime).toBeUndefined();
    expect(leg.slope).toBeUndefined();
  });
});

describe('routeGeometry cleanup on structural changes', () => {
  test('removeWaypoint strips routeGeometry from preserved legs', () => {
    // Setup: 3 waypoints, 2 legs
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();

    // Add route geometry to first leg
    const leg0Id = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(leg0Id, {
      routeGeometry: [[46.0, 11.0], [46.005, 11.005], [46.01, 11.01]],
    });

    // Remove middle waypoint - first leg should be recreated, but if preserved it should lose routeGeometry
    const middleWpId = useItineraryStore.getState().waypoints[1].id;
    useItineraryStore.getState().removeWaypoint(middleWpId);

    const remainingLegs = useItineraryStore.getState().legs;
    expect(remainingLegs).toHaveLength(1);
    expect(remainingLegs[0].routeGeometry).toBeUndefined();
  });

  test('reorderWaypoints strips routeGeometry from preserved legs', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();

    const leg0Id = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(leg0Id, {
      routeGeometry: [[46.0, 11.0], [46.01, 11.01]],
      distance: 1.5,
    });

    // Reverse order: [0,1,2] -> [2,1,0]
    useItineraryStore.getState().reorderWaypoints([2, 1, 0]);

    // All legs should have no routeGeometry
    for (const leg of useItineraryStore.getState().legs) {
      expect(leg.routeGeometry).toBeUndefined();
    }
  });
});

describe('clearAllValidation', () => {
  test('clears all waypoint and leg validation', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();

    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, {
      validationState: { altitude: { status: 'error', userValue: 1400, realValue: 1450, delta: 50, tolerance: { strict: 50, loose: 100 } } },
    });
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      validationState: { distance: { status: 'warning', userValue: 3.2, realValue: 3.7, delta: 0.5, tolerance: { strict: 0.32, loose: 0.64 } } },
    });

    useItineraryStore.getState().clearAllValidation();

    expect(useItineraryStore.getState().waypoints[0].validationState).toBeUndefined();
    expect(useItineraryStore.getState().legs[0].validationState).toBeUndefined();
  });
});

describe('addWaypointAtPosition', () => {
  test('adds waypoint with lat/lon and creates leg', () => {
    useItineraryStore.getState().addWaypointAtPosition(46.0, 11.0);
    useItineraryStore.getState().addWaypointAtPosition(46.01, 11.01);

    const wps = useItineraryStore.getState().waypoints;
    expect(wps).toHaveLength(2);
    expect(wps[0].lat).toBe(46.0);
    expect(wps[0].lon).toBe(11.0);
    expect(wps[1].lat).toBe(46.01);
    expect(wps[1].lon).toBe(11.01);
    expect(useItineraryStore.getState().legs).toHaveLength(1);
  });
});

describe('updateWaypoint clears stale validation on field edit', () => {
  test('editing altitude clears waypoint validation', () => {
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, {
      validationState: { altitude: { status: 'valid', userValue: 1450, realValue: 1455, delta: 5, tolerance: { strict: 50, loose: 100 } } },
    });
    expect(useItineraryStore.getState().waypoints[0].validationState).toBeDefined();

    // Edit altitude - should clear validation
    useItineraryStore.getState().updateWaypoint(wpId, { altitude: 1500 });
    expect(useItineraryStore.getState().waypoints[0].validationState).toBeUndefined();
  });

  test('editing lat clears waypoint validation', () => {
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, {
      validationState: { altitude: { status: 'valid', userValue: 1450, realValue: 1455, delta: 5, tolerance: { strict: 50, loose: 100 } } },
    });

    useItineraryStore.getState().updateWaypoint(wpId, { lat: 46.5 });
    expect(useItineraryStore.getState().waypoints[0].validationState).toBeUndefined();
  });

  test('editing name does NOT clear waypoint validation', () => {
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[0].id;
    useItineraryStore.getState().updateWaypoint(wpId, {
      validationState: { altitude: { status: 'valid', userValue: 1450, realValue: 1455, delta: 5, tolerance: { strict: 50, loose: 100 } } },
    });

    useItineraryStore.getState().updateWaypoint(wpId, { name: 'New Name' });
    expect(useItineraryStore.getState().waypoints[0].validationState).toBeDefined();
  });
});

describe('updateLeg clears stale validation', () => {
  test('editing distance clears distance validation but keeps others', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;

    useItineraryStore.getState().updateLeg(legId, {
      validationState: {
        distance: { status: 'valid', userValue: 3.2, realValue: 3.3, delta: 0.1, tolerance: { strict: 0.32, loose: 0.64 } },
        azimuth: { status: 'valid', userValue: 245, realValue: 247, delta: 2, tolerance: { strict: 5, loose: 10 } },
      },
    });

    // Edit distance - should clear distance validation but keep azimuth
    useItineraryStore.getState().updateLeg(legId, { distance: 4.0 });

    const leg = useItineraryStore.getState().legs[0];
    expect(leg.validationState?.azimuth).toBeDefined();
    expect(leg.validationState?.distance).toBeUndefined();
  });
});

describe('resetItinerary', () => {
  test('resets all state', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().setItineraryName('Test');
    useItineraryStore.getState().setAppMode('track');
    useItineraryStore.getState().resetItinerary();

    expect(useItineraryStore.getState().waypoints).toHaveLength(0);
    expect(useItineraryStore.getState().legs).toHaveLength(0);
    expect(useItineraryStore.getState().itineraryName).toBe('');
    // Mode and settings are preserved on reset
    expect(useItineraryStore.getState().appMode).toBe('track');
    expect(useItineraryStore.getState().settings.tolerances.altitude).toBe(50);
    expect(useItineraryStore.getState().settings.mapDisplay.coloredPath).toBe(false);
  });
});

describe('loadItinerary', () => {
  test('loads itinerary and strips validation state', () => {
    const waypoints = [
      { id: 'wp1', name: 'A', lat: 46.0, lon: 11.0, altitude: 1000, order: 0, validationState: { altitude: { status: 'valid' as const, userValue: 1000, realValue: 1005, delta: 5, tolerance: { strict: 50, loose: 100 } } } },
      { id: 'wp2', name: 'B', lat: 46.01, lon: 11.01, altitude: 1200, order: 1 },
    ];
    const legs = [
      { id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', distance: 1.5, elevationGain: 200, elevationLoss: 0, azimuth: null },
    ];

    useItineraryStore.getState().loadItinerary('new-id', 'New Route', waypoints, legs);

    const state = useItineraryStore.getState();
    expect(state.itineraryId).toBe('new-id');
    expect(state.itineraryName).toBe('New Route');
    expect(state.waypoints).toHaveLength(2);
    expect(state.waypoints[0].validationState).toBeUndefined();
    expect(state.legs).toHaveLength(1);
  });

  test('recalculates estimatedTime and slope on load', () => {
    const waypoints = [
      { id: 'wp1', name: 'A', lat: 46.0, lon: 11.0, altitude: 1000, order: 0 },
      { id: 'wp2', name: 'B', lat: 46.01, lon: 11.01, altitude: 1200, order: 1 },
    ];
    const legs = [
      { id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', distance: 4, elevationGain: 200, elevationLoss: 0, azimuth: 45 },
    ];

    useItineraryStore.getState().loadItinerary('id', 'Route', waypoints, legs);

    const leg = useItineraryStore.getState().legs[0];
    expect(leg.estimatedTime).toBeGreaterThan(0);
    expect(leg.slope).toBeGreaterThan(0);
  });

  test('sorts waypoints by order field before re-indexing', () => {
    const waypoints = [
      { id: 'wp3', name: 'C', lat: null, lon: null, altitude: null, order: 2 },
      { id: 'wp1', name: 'A', lat: null, lon: null, altitude: null, order: 0 },
      { id: 'wp2', name: 'B', lat: null, lon: null, altitude: null, order: 1 },
    ];

    useItineraryStore.getState().loadItinerary('id', 'Route', waypoints, []);

    const wps = useItineraryStore.getState().waypoints;
    expect(wps[0].id).toBe('wp1');
    expect(wps[1].id).toBe('wp2');
    expect(wps[2].id).toBe('wp3');
    expect(wps[0].order).toBe(0);
    expect(wps[1].order).toBe(1);
    expect(wps[2].order).toBe(2);
  });

  test('preserves routeGeometry from imported legs', () => {
    const waypoints = [
      { id: 'wp1', name: 'A', lat: 46.0, lon: 11.0, altitude: 1000, order: 0 },
      { id: 'wp2', name: 'B', lat: 46.1, lon: 11.1, altitude: 1200, order: 1 },
    ];
    const geometry: [number, number][] = [[46.0, 11.0], [46.05, 11.05], [46.1, 11.1]];
    const legs = [
      { id: 'leg1', fromWaypointId: 'wp1', toWaypointId: 'wp2', distance: 2, elevationGain: 200, elevationLoss: 0, azimuth: 45, routeGeometry: geometry },
    ];

    useItineraryStore.getState().loadItinerary('id', 'Route', waypoints, legs);

    const leg = useItineraryStore.getState().legs[0];
    expect(leg.routeGeometry).toEqual(geometry);
  });

  test('handles duplicate order values deterministically', () => {
    const waypoints = [
      { id: 'wp1', name: 'A', lat: null, lon: null, altitude: null, order: 0 },
      { id: 'wp2', name: 'B', lat: null, lon: null, altitude: null, order: 0 },
    ];

    useItineraryStore.getState().loadItinerary('id', 'Route', waypoints, []);

    const wps = useItineraryStore.getState().waypoints;
    expect(wps).toHaveLength(2);
    expect(wps[0].order).toBe(0);
    expect(wps[1].order).toBe(1);
  });

  test('caps waypoints at 50 on import', () => {
    const waypoints = Array.from({ length: 60 }, (_, i) => ({
      id: `wp${i}`, name: `WP${i}`, lat: null, lon: null, altitude: null, order: i,
    }));

    useItineraryStore.getState().loadItinerary('id', 'Route', waypoints, []);

    const wps = useItineraryStore.getState().waypoints;
    expect(wps).toHaveLength(50);
    expect(wps[49].order).toBe(49);
  });
});

describe('elevationProfile clearing', () => {
  function setupWithProfile() {
    useItineraryStore.getState().setAppMode('track');
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      elevationProfile: [
        { distance: 0, altitude: 1000 },
        { distance: 1, altitude: 1100 },
      ],
    });
    expect(useItineraryStore.getState().legs[0].elevationProfile).toBeDefined();
  }

  test('setAppMode to learn clears elevationProfile', () => {
    setupWithProfile();
    useItineraryStore.getState().setAppMode('learn');
    expect(useItineraryStore.getState().legs[0].elevationProfile).toBeUndefined();
  });

  test('removeWaypoint clears elevationProfile from preserved legs', () => {
    useItineraryStore.getState().setAppMode('track');
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, {
      elevationProfile: [{ distance: 0, altitude: 1000 }, { distance: 1, altitude: 1100 }],
    });
    const middleWpId = useItineraryStore.getState().waypoints[1].id;
    useItineraryStore.getState().removeWaypoint(middleWpId);
    for (const leg of useItineraryStore.getState().legs) {
      expect(leg.elevationProfile).toBeUndefined();
    }
  });
});
