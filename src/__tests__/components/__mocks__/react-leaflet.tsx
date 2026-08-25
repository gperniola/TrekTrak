import React from 'react';

export const MapContainer = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="map-container">{children}</div>
);

export const TileLayer = () => <div data-testid="tile-layer" />;

export const Marker = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="marker">{children}</div>
);

export const Popup = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="popup">{children}</div>
);

export const Polyline = () => <div data-testid="polyline" />;

export const WMSTileLayer = (props: Record<string, unknown>) => (
  <div data-testid="wms-tile-layer" data-params={JSON.stringify(props.params ?? {})} data-opacity={String(props.opacity ?? '')} />
);

export const CircleMarker = ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
  <div data-testid="circle-marker" data-pathoptions={JSON.stringify(props.pathOptions ?? {})}>{children}</div>
);

export const GeoJSON = (props: Record<string, unknown>) => (
  <div data-testid="geojson-layer" data-features={JSON.stringify((props.data as { features?: unknown[] })?.features?.length ?? 0)} />
);

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
  fitBounds: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  getPane: (_name: string) => undefined,
  createPane: jest.fn(() => ({ style: {} })),
  attributionControl: { addAttribution: jest.fn(), removeAttribution: jest.fn() },
});

export const useMapEvents = (_handlers: Record<string, unknown>) => null;
