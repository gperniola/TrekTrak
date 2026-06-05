import { describe, expect, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { PreviewElevationProfile } from '@/components/map/PreviewElevationProfile';
import type { Itinerary } from '@/lib/types';

describe('PreviewElevationProfile', () => {
  test('rende il grafico se ci sono dati di profilo', () => {
    const route = {
      id: 'r1', name: 'X', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [
        { id: 'l1', fromWaypointId: 'a', toWaypointId: 'b', distance: 2, elevationGain: 100, elevationLoss: 0, azimuth: 0,
          elevationProfile: [{ distance: 0, altitude: 100 }, { distance: 1, altitude: 180 }, { distance: 2, altitude: 200 }] },
      ],
    } as unknown as Itinerary;
    render(<PreviewElevationProfile route={route} />);
    expect(screen.getByText(/profilo altimetrico/i)).toBeInTheDocument();
    expect(screen.getByTestId('recharts-area-chart')).toBeInTheDocument();
  });

  test('placeholder se non ci sono dati di profilo', () => {
    const route = { id: 'r2', name: 'X', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [] } as unknown as Itinerary;
    render(<PreviewElevationProfile route={route} />);
    expect(screen.getByText(/non disponibile/i)).toBeInTheDocument();
  });
});
