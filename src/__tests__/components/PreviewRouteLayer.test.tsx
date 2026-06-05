import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { PreviewRouteLayer } from '@/components/map/PreviewRouteLayer';
import type { Itinerary } from '@/lib/types';

const wp = (id: string, lat: number, lon: number) => ({ id, name: id, lat, lon, altitude: null, order: 0 });

describe('PreviewRouteLayer', () => {
  test('disegna una polilinea per ogni leg (geometria o retta) + un marker per waypoint', () => {
    const route = {
      id: 'r1', name: 'X', createdAt: 'x', updatedAt: 'x',
      waypoints: [wp('a', 45, 9), wp('b', 45.1, 9.1), wp('c', 45.2, 9.2)],
      legs: [
        { id: 'l1', fromWaypointId: 'a', toWaypointId: 'b', distance: 1, elevationGain: 0, elevationLoss: 0, azimuth: 0, routeGeometry: [[45, 9], [45.05, 9.05], [45.1, 9.1]] },
        { id: 'l2', fromWaypointId: 'b', toWaypointId: 'c', distance: 1, elevationGain: 0, elevationLoss: 0, azimuth: 0 },
      ],
    } as unknown as Itinerary;
    render(<PreviewRouteLayer route={route} />);
    expect(screen.getAllByTestId('polyline')).toHaveLength(2);
    expect(screen.getAllByTestId('marker')).toHaveLength(3);
  });

  test('nessun waypoint con coordinate → non renderizza nulla', () => {
    const route = { id: 'r2', name: 'X', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [] } as unknown as Itinerary;
    const { container } = render(<PreviewRouteLayer route={route} />);
    expect(container).toBeEmptyDOMElement();
  });
});
