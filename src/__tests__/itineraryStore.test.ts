import { describe, expect, test, beforeEach } from '@jest/globals';
import { useItineraryStore } from '../stores/itineraryStore';

beforeEach(() => {
  useItineraryStore.setState({
    itineraryId: 'test-id',
    itineraryName: '',
    waypoints: [],
    legs: [],
    settings: { tolerances: { altitude: 20, coordinates: 0.001, distance: 10, azimuth: 5, elevationDelta: 15 } },
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

  test('removes a waypoint and its connected legs', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const wpId = useItineraryStore.getState().waypoints[1].id;
    useItineraryStore.getState().removeWaypoint(wpId);
    expect(useItineraryStore.getState().waypoints).toHaveLength(2);
    expect(useItineraryStore.getState().legs).toHaveLength(1);
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
  test('reordering resets leg data', () => {
    useItineraryStore.getState().addWaypoint();
    useItineraryStore.getState().addWaypoint();
    const legId = useItineraryStore.getState().legs[0].id;
    useItineraryStore.getState().updateLeg(legId, { distance: 5 });
    useItineraryStore.getState().reorderWaypoints([1, 0]);
    expect(useItineraryStore.getState().legs[0].distance).toBeNull();
  });
});

describe('itinerary name', () => {
  test('sets itinerary name', () => {
    useItineraryStore.getState().setItineraryName('Monte Rosa');
    expect(useItineraryStore.getState().itineraryName).toBe('Monte Rosa');
  });
});
