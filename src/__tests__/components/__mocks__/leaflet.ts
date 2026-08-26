const divIcon = jest.fn(() => ({ options: {}, createIcon: jest.fn() }));
const icon = jest.fn(() => ({ options: {} }));
const latLngBounds = jest.fn((pts: unknown) => ({ pts, isValid: () => true }));

class DivIcon {
  options: Record<string, unknown>;
  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
  }
}

/**
 * `DomEvent` con stato, per verificare la guardia degli overlay dentro MapContainer.
 * Modella i due meccanismi che Leaflet usa davvero: il flag `_leaflet_disable_click`
 * risalito dagli antenati (`Map._isClickDisabled`) e i listener DOM sui gesti.
 */
const scrollGuarded = new Set<HTMLElement>();
const listeners: Array<{ el: HTMLElement; type: string }> = [];

export function __resetDomEvent(): void {
  scrollGuarded.clear();
  listeners.length = 0;
}

/**
 * Replica `Map._isClickDisabled` (leaflet-src.js:4494): risale gli antenati di `el`
 * in cerca di `_leaflet_disable_click`. Se è true, Leaflet scarta il click e la
 * mappa non aggiunge waypoint.
 */
export function __isClickDisabled(el: HTMLElement | null): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if ((n as unknown as Record<string, boolean>)['_leaflet_disable_click']) return true;
  }
  return false;
}

export function __isScrollGuarded(el: HTMLElement | null): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (scrollGuarded.has(n)) return true;
  }
  return false;
}

/** Tipi di gesto fermati su `el` o su un suo antenato. */
export function __guardedGestures(el: HTMLElement | null): string[] {
  const types: string[] = [];
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    listeners.filter((l) => l.el === n).forEach((l) => types.push(l.type));
  }
  return types;
}

/** Listener DOM ancora registrati: serve a cogliere le guardie non ripulite. */
export function __activeListeners(): ReadonlyArray<{ el: HTMLElement; type: string }> {
  return listeners;
}

const DomEvent = {
  disableScrollPropagation: (el: HTMLElement) => { scrollGuarded.add(el); },
  stopPropagation: (e: Event) => { e.stopPropagation(); },
  on: (el: HTMLElement, type: string, fn: EventListener) => {
    listeners.push({ el, type });
    el.addEventListener(type, fn);
  },
  off: (el: HTMLElement, type: string, fn: EventListener) => {
    const i = listeners.findIndex((l) => l.el === el && l.type === type);
    if (i >= 0) listeners.splice(i, 1);
    el.removeEventListener(type, fn);
  },
};

/** Renderer canvas: nel mock basta un oggetto riconoscibile con le sue opzioni. */
const canvas = jest.fn((options: Record<string, unknown> = {}) => ({ __renderer: 'canvas', options }));

/**
 * Popup costruito su richiesta (i focolai lo aprono al click invece di montarne uno
 * per punto). Registra contenuto e posizione così i test possono verificarli.
 */
const openedPopups: Array<{ content: string; latlng: unknown }> = [];

export function __openedPopups(): ReadonlyArray<{ content: string; latlng: unknown }> {
  return openedPopups;
}

export function __resetPopups(): void {
  openedPopups.length = 0;
}

const popup = jest.fn(() => {
  const state: { content: string; latlng: unknown } = { content: '', latlng: null };
  const api = {
    setLatLng(latlng: unknown) { state.latlng = latlng; return api; },
    setContent(content: string) { state.content = content; return api; },
    openOn() { openedPopups.push({ ...state }); return api; },
  };
  return api;
});

const L = {
  divIcon,
  icon,
  DivIcon,
  latLngBounds,
  DomEvent,
  canvas,
  popup,
};

export default L;
export { divIcon, icon, DivIcon, latLngBounds, DomEvent, canvas, popup };
