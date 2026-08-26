import React from 'react';

// Leaflet reale: `createPane` registra il pane e `getPane` lo restituisce; agganciare un
// layer a un pane inesistente fa `getPane(pane).appendChild(...)` → TypeError. Il mock
// modella il registro e annota, nell'effetto del layer (lo stesso istante in cui Leaflet
// farebbe l'appendChild), se il pane c'era: cosi' i test possono cogliere l'ordine sbagliato.
const panes = new Map<string, { style: Record<string, string> }>();
const paneAtLayerMount: Array<{ pane: string; existed: boolean }> = [];

export const __paneAtLayerMount = paneAtLayerMount;

export function __resetPanes(): void {
  panes.clear();
  paneAtLayerMount.length = 0;
}

function recordPaneAtMount(pane: unknown): void {
  const name = pane == null ? '' : String(pane);
  paneAtLayerMount.push({ pane: name, existed: name === '' || panes.has(name) });
}

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

export const WMSTileLayer = (props: Record<string, unknown>) => {
  React.useEffect(() => {
    recordPaneAtMount(props.pane);
  }, [props.pane]);
  return (
    <div
      data-testid="wms-tile-layer"
      data-params={JSON.stringify(props.params ?? {})}
      data-opacity={String(props.opacity ?? '')}
      data-pane={String(props.pane ?? '')}
    />
  );
};

export const CircleMarker = ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
  <div data-testid="circle-marker" data-pathoptions={JSON.stringify(props.pathOptions ?? {})}>{children}</div>
);

export const GeoJSON = (props: Record<string, unknown>) => {
  let captured = '';
  const stubLayer = {
    bindPopup: (html: string) => {
      captured = html;
    },
  };
  props.onEachFeature?.(props.data, stubLayer);
  return (
    <div
      data-testid="geojson-layer"
      data-features={JSON.stringify((props.data as { features?: unknown[] })?.features?.length ?? 0)}
      data-pane={String(props.pane ?? '')}
      data-popup={captured}
    />
  );
};

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
  getPane: (name: string) => panes.get(name),
  createPane: (name: string) => {
    const el = { style: {} as Record<string, string> };
    panes.set(name, el);
    return el;
  },
  attributionControl: { addAttribution: jest.fn(), removeAttribution: jest.fn() },
});

export const useMapEvents = (_handlers: Record<string, unknown>) => null;
