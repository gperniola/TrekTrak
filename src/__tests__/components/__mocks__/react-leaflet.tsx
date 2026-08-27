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

export const TileLayer = (props: Record<string, unknown>) => (
  <div data-testid="tile-layer" data-url={String(props.url ?? '')} data-pane={String(props.pane ?? '')} />
);

export const Marker = ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
  <div
    data-testid="marker"
    // Leaflet mette role="button" e tabIndex=0 sull'icona quando `keyboard` è true, che
    // è il default e NON dipende da `interactive`: i test devono poter distinguere un
    // marker decorativo da uno operabile.
    data-keyboard={String(props.keyboard !== false)}
    data-interactive={String(props.interactive !== false)}
  >
    {children}
  </div>
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
/**
 * Zoom pilotabile dai test: il layer dei ripari si comporta in modo diverso sopra e
 * sotto una soglia, e senza poterlo cambiare quella logica non e' verificabile.
 */
let zoomCorrente = 12;
export function __setMapZoom(z: number) { zoomCorrente = z; }

const mapInstance = {
  getCenter: () => ({ lat: 45, lng: 10 }),
  getZoom: () => zoomCorrente,
  getBounds: () => ({
    getNorth: () => 46,
    getSouth: () => 44,
    getEast: () => 11,
    getWest: () => 9,
    getSouthWest: () => ({ lat: 44, lng: 9 }),
    getNorthEast: () => ({ lat: 46, lng: 11 }),
  }),
  getSize: () => ({ x: 500, y: 635 }),
  latLngToContainerPoint: () => ({ x: 250, y: 318 }),
  // Proiezione Web Mercator, come il CRS di default: serve al GetFeatureInfo, che
  // interroga in EPSG:3857 per avere una corrispondenza pixel↔coordinata lineare.
  options: {
    crs: {
      project: ({ lat, lng }: { lat: number; lng: number }) => ({
        x: (lng * 20037508.34) / 180,
        y: (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (20037508.34 / 180),
      }),
    },
  },
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

/**
 * Handler registrati con `useMapEvents`, per tipo di evento: i test possono farli
 * scattare come farebbe Leaflet. Prima venivano ignorati, quindi nessun test poteva
 * verificare cosa succede a un evento della mappa.
 */
const mapEventHandlers = new Map<string, Array<(e: unknown) => void>>();

export function __fireMapEvent(type: string, e: unknown): void {
  (mapEventHandlers.get(type) ?? []).forEach((fn) => fn(e));
}

export function __resetMapEvents(): void {
  mapEventHandlers.clear();
}

export const useMapEvents = (handlers: Record<string, (e: unknown) => void>) => {
  React.useEffect(() => {
    const entries = Object.entries(handlers);
    entries.forEach(([type, fn]) => {
      const list = mapEventHandlers.get(type) ?? [];
      list.push(fn);
      mapEventHandlers.set(type, list);
    });
    return () => {
      entries.forEach(([type, fn]) => {
        const list = (mapEventHandlers.get(type) ?? []).filter((h) => h !== fn);
        mapEventHandlers.set(type, list);
      });
    };
  });
  return null;
};
