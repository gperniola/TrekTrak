import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { ItineraryState } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/lib/types';

// Mock all the map sub-components that use real leaflet/useMap
jest.mock('@/components/map/GeolocateOnMount', () => ({
  GeolocateOnMount: () => null,
  DEFAULT_CENTER: [42.351, 14.168],
  DEFAULT_ZOOM: 13,
  MAX_ZOOM: 19,
}));
jest.mock('@/components/map/TrackModeAutoFill', () => ({
  TrackModeAutoFill: () => null,
}));
jest.mock('@/components/map/MapEvents', () => ({
  MapEvents: () => null,
}));
jest.mock('@/components/map/LegPolylines', () => ({
  LegPolylines: () => null,
  LegPolylineHoverEvents: () => null,
}));
jest.mock('@/components/map/ProfileHoverMarker', () => ({
  ProfileHoverMarker: () => null,
}));
jest.mock('@/components/map/QuizBoundsSync', () => ({
  QuizBoundsSync: () => null,
}));
jest.mock('@/components/map/LocationSearch', () => ({
  LocationSearch: () => null,
}));
jest.mock('@/components/map/CompassTool', () => ({
  CompassOverlay: () => null,
}));
jest.mock('@/components/map/RulerTool', () => ({
  RulerTool: () => null,
}));
jest.mock('@/components/map/CoordinateGrid', () => ({
  CoordinateGrid: () => null,
}));
jest.mock('@/components/map/MyLocationButton', () => ({
  MyLocationButton: () => null,
}));
jest.mock('@/lib/auto-fill', () => ({
  autoFillTrackData: jest.fn(),
}));

import { InteractiveMap } from '@/components/map/InteractiveMap';
import { statoItinerario, statoUI } from '../fixtures/itinerario';


beforeEach(() => {
  useItineraryStore.setState(statoItinerario({ itineraryName: '' }));
  useUIStore.setState(statoUI());
});

describe('InteractiveMap', () => {
  test('renders map container (data-testid="map-container")', () => {
    render(<InteractiveMap />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('renders tile layer (data-testid="tile-layer")', () => {
    render(<InteractiveMap />);
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  test('renders markers for waypoints with coordinates', () => {
    useItineraryStore.setState({
      ...statoItinerario({ itineraryName: '' }),
      waypoints: [
        { id: 'wp1', order: 0, name: 'A', lat: 45.0, lon: 10.0, altitude: null },
        { id: 'wp2', order: 1, name: 'B', lat: 45.1, lon: 10.1, altitude: null },
        { id: 'wp3', order: 2, name: 'C', lat: null, lon: null, altitude: null }, // no coords — not rendered
      ],
    });
    render(<InteractiveMap />);
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2); // only the two with coordinates
  });
});
