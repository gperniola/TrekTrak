// Conserva le opzioni: l'html di un divIcon è ciò da cui si calcola il nome
// accessibile del marker, quindi i test devono poterlo ispezionare.
const divIcon = jest.fn((options: Record<string, unknown> = {}) => ({ options, createIcon: jest.fn() }));
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
  // Registrato PER RIFERIMENTO: un popup reale cambia contenuto dopo l'apertura
  // (apertura immediata con "attendere", poi il risultato della query). Con una copia
  // i test vedevano per sempre il primo contenuto.
  const state: { content: string; latlng: unknown } = { content: '', latlng: null };
  let opened = false;
  const api = {
    setLatLng(latlng: unknown) { state.latlng = latlng; return api; },
    setContent(content: string) { state.content = content; return api; },
    openOn() {
      if (!opened) { openedPopups.push(state); opened = true; }
      return api;
    },
  };
  return api;
});

/**
 * `GridLayer` minimo, per il layer della neve: `extend` tiene `createTile`, e il test fa
 * da Leaflet decidendo quali mattonelle entrano ed escono dallo schermo (`__crea`,
 * `__togli`). Riproduce le due cose del `GridLayer.js` vero su cui il layer conta:
 * `tileunload` con l'elemento della mattonella, e `remove()`/`redraw()` che tolgono
 * **tutte** le mattonelle a schermo, nell'ordine in cui sono state create, sparando
 * `tileunload` per ciascuna. Il layer non usa piu' `redraw()` (l'aggiornamento orario e'
 * sul posto): resta perche' rimetterlo nel layer deve far diventare rosso il suo test.
 */
type Gestore = (e: Record<string, unknown>) => void;
interface Coordinate { x: number; y: number; z: number }
type Fatto = (errore?: Error, tile?: HTMLElement) => void;

const gridLayers: GridLayer[] = [];

/** I `GridLayer` aggiunti alla mappa, dal primo. */
export function __gridLayers(): ReadonlyArray<GridLayer> {
  return gridLayers;
}

export function __resetGridLayers(): void {
  gridLayers.length = 0;
}

class GridLayer {
  options: Record<string, unknown>;
  /** Le mattonelle a schermo, nell'ordine di creazione. */
  mattonelle: Array<{ tile: HTMLElement; coords: Coordinate }> = [];
  private gestori = new Map<string, Gestore[]>();

  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
  }

  static extend(props: Record<string, unknown>) {
    const Sotto = class extends GridLayer {};
    Object.assign(Sotto.prototype, props);
    return Sotto;
  }

  on(type: string, fn: Gestore) {
    this.gestori.set(type, [...(this.gestori.get(type) ?? []), fn]);
    return this;
  }

  off(type: string, fn?: Gestore) {
    this.gestori.set(type, fn ? (this.gestori.get(type) ?? []).filter((g) => g !== fn) : []);
    return this;
  }

  fire(type: string, dati: Record<string, unknown> = {}) {
    (this.gestori.get(type) ?? []).slice().forEach((fn) => fn({ type, target: this, ...dati }));
    return this;
  }

  addTo() {
    gridLayers.push(this);
    return this;
  }

  /** Come `_addTile`: Leaflet chiede la mattonella per una coordinata a schermo. */
  __crea(coords: Coordinate, done: Fatto = () => {}): HTMLElement {
    const crea = (this as unknown as { createTile(c: Coordinate, d: Fatto): HTMLElement }).createTile;
    const tile = crea.call(this, coords, done);
    this.mattonelle.push({ tile, coords });
    return tile;
  }

  /** Come `_removeTile`: la mattonella esce dallo schermo. */
  __togli(tile: HTMLElement): void {
    const i = this.mattonelle.findIndex((m) => m.tile === tile);
    if (i < 0) return;
    const [m] = this.mattonelle.splice(i, 1);
    this.fire('tileunload', { tile: m.tile, coords: m.coords });
  }

  redraw() {
    const prima = this.mattonelle.slice();
    prima.forEach((m) => this.__togli(m.tile));
    prima.forEach((m) => this.__crea(m.coords));
    return this;
  }

  remove() {
    this.mattonelle.slice().forEach((m) => this.__togli(m.tile));
    const i = gridLayers.indexOf(this);
    if (i >= 0) gridLayers.splice(i, 1);
    return this;
  }
}

const L = {
  divIcon,
  icon,
  DivIcon,
  latLngBounds,
  DomEvent,
  canvas,
  popup,
  GridLayer,
};

export default L;
export { divIcon, icon, DivIcon, latLngBounds, DomEvent, canvas, popup, GridLayer };
