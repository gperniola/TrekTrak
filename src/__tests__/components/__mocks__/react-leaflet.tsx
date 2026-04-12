import React from 'react';

export const MapContainer = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="map-container">{children}</div>
);

export const TileLayer = () => <div data-testid="tile-layer" />;

export const Marker = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="marker">{children}</div>
);

export const Polyline = () => <div data-testid="polyline" />;

export const useMap = () => ({
  getCenter: () => ({ lat: 45, lng: 10 }),
  getZoom: () => 12,
  getBounds: () => ({
    getNorth: () => 46,
    getSouth: () => 44,
    getEast: () => 11,
    getWest: () => 9,
  }),
  flyTo: jest.fn(),
  setView: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
});

export const useMapEvents = (_handlers: Record<string, unknown>) => null;
