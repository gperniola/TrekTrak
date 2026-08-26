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
  mapInstance.attributionControl.addAttribution.mockClear();
  mapInstance.attributionControl.removeAttribution.mockClear();
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

export const CircleMarker = ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
  React.useEffect(() => {
    recordPaneAtMount(props.pane);
  }, [props.pane]);
  const handlers = props.eventHandlers as { click?: (e: unknown) => void } | undefined;
  return (
    <div
      data-testid="circle-marker"
      data-pathoptions={JSON.stringify(props.pathOptions ?? {})}
      data-pane={String(props.pane ?? '')}
      data-renderer={String((props.renderer as { __renderer?: string } | undefined)?.__renderer ?? '')}
      data-bubbling={String(props.bubblingMouseEvents)}
      onClick={() => handlers?.click?.({ latlng: props.center })}
    >
      {children}
    </div>
  );
};

export const GeoJSON = (props: Record<string, unknown>) => {
  React.useEffect(() => {
    recordPaneAtMount(props.pane);
  }, [props.pane]);
  // Leaflet reale invoca onEachFeature una volta PER feature, non sulla collection.
  const data = props.data as { type?: string; features?: Array<Record<string, unknown>> } | undefined;
  const features = data?.type === 'FeatureCollection' ? (data.features ?? []) : data ? [data] : [];
  const popups: string[] = [];
  const onEach = props.onEachFeature as
    | ((f: unknown, layer: { bindPopup: (html: string) => void }) => void)
    | undefined;
  features.forEach((f) => {
    onEach?.(f, { bindPopup: (html: string) => { popups.push(html); } });
  });
  const styleFn = props.style as ((f: unknown) => Record<string, unknown>) | undefined;
  return (
    <div
      data-testid="geojson-layer"
      data-features={String(features.length)}
      data-pane={String(props.pane ?? '')}
      data-popup={popups[0] ?? ''}
      data-popups={JSON.stringify(popups)}
      data-styles={JSON.stringify(features.map((f) => styleFn?.(f) ?? {}))}
    />
  );
};

/**
 * Istanza SINGLETON, come il `useMap()` reale che restituisce la mappa dal context.
 * Prima il mock ne costruiva una nuova a ogni chiamata: ogni effetto con deps `[map]`
 * si smontava e rimontava a ogni render, quindi nessun test poteva cogliere un bug
 * nelle dipendenze — e le jest.fn() dell'attribution, ricreate ogni volta, erano
 * impossibili da asserire.
 */
const mapInstance = {
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
};

export function __mapInstance() {
  return mapInstance;
}

export const useMap = () => mapInstance;

export const useMapEvents = (_handlers: Record<string, unknown>) => null;
