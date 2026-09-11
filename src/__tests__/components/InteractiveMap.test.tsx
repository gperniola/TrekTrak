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

/**
 * **Cambiare mappa di base e tornare indietro spegneva i sentieri.** Segnalato
 * dall'utente l'11/09/2026: overlay attivo, ma invisibile finché non lo si rispegneva e
 * riaccendeva. La base è un `TileLayer` con `key={baseMapId}`: al cambio si smonta e si
 * rimonta, e Leaflet appende il contenitore nuovo IN CODA al `tilePane`. I due layer
 * avevano lo stesso `zIndex` (1, il predefinito), quindi vinceva l'ordine nel DOM: la
 * base rimontata copriva i sentieri. Riaccendere l'overlay lo rimetteva in coda, e
 * «funzionava». La regola va detta a Leaflet, non lasciata all'ordine di montaggio.
 */
describe('ordine dei tile layer', () => {
  test('i sentieri hanno uno zIndex esplicito sopra la mappa di base', () => {
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, showHikingTrails: true } },
    });
    render(<InteractiveMap />);
    const layers = screen.getAllByTestId('tile-layer');
    const base = layers.find((l) => !l.getAttribute('data-url')?.includes('waymarkedtrails'));
    const sentieri = layers.find((l) => l.getAttribute('data-url')?.includes('waymarkedtrails'));
    expect(base).toBeDefined();
    expect(sentieri).toBeDefined();
    const z = (l: HTMLElement | undefined) => Number(l?.getAttribute('data-zindex') || 1);
    expect(z(sentieri)).toBeGreaterThan(z(base));
  });
});
