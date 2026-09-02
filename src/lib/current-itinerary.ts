import type { Waypoint, Leg, AppMode } from './types';

/**
 * Autosalvataggio dell'itinerario **in lavorazione**.
 *
 * Prima non esisteva: l'itinerario viveva solo nella memoria dello store, quindi una
 * ricarica lo cancellava — e la ricarica è proprio il gesto che l'avviso di
 * aggiornamento della PWA invita a fare. Per chi non è nella libreria condivisa il
 * pulsante "Salva" è disabilitato, quindi non c'era nessun modo di conservare il
 * lavoro: si ricominciava da zero.
 *
 * È deliberatamente separato dalla libreria: la libreria è dove metti gli itinerari
 * che vuoi ritrovare, questo è il tavolo su cui stai lavorando adesso. Uno solo, senza
 * nome obbligatorio, sovrascritto a ogni modifica.
 */

export const CURRENT_KEY = 'trektrak_current_itinerary';

const VERSIONE = 1;

export interface CurrentItinerary {
  itineraryId: string;
  itineraryName: string;
  createdAt: string;
  appMode: AppMode;
  waypoints: Waypoint[];
  legs: Leg[];
  /** true quando geometria e profilo sono stati buttati per far stare il resto. */
  slim?: boolean;
  savedAt?: string;
}

const MODI: AppMode[] = ['learn', 'track'];

function waypointValido(v: unknown): boolean {
  if (v == null || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'string'
    && typeof r.name === 'string'
    && typeof r.order === 'number'
    && (r.lat === null || typeof r.lat === 'number')
    && (r.lon === null || typeof r.lon === 'number')
    && (r.altitude === null || typeof r.altitude === 'number');
}

function legValido(v: unknown): boolean {
  if (v == null || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'string'
    && typeof r.fromWaypointId === 'string'
    && typeof r.toWaypointId === 'string';
}

/**
 * Togliere geometria e profilo: sono le uniche parti grosse, e sono anche le uniche
 * che si riottengono dalla rete. Ciò che l'utente ha scritto a mano non si può
 * ricalcolare, quindi resta.
 */
function senzaPesi(legs: Leg[]): Leg[] {
  return legs.map((leg) => {
    const { routeGeometry: _g, elevationProfile: _p, trackValues, ...resto } = leg;
    if (trackValues == null) return resto as Leg;
    const { routeGeometry: _tg, elevationProfile: _tp, ...trackLeggero } = trackValues;
    return { ...resto, trackValues: trackLeggero } as Leg;
  });
}

function scrivi(payload: CurrentItinerary): void {
  localStorage.setItem(CURRENT_KEY, JSON.stringify({ v: VERSIONE, ...payload }));
}

export function saveCurrent(stato: {
  itineraryId: string;
  itineraryName: string;
  createdAt: string;
  appMode: AppMode;
  waypoints: Waypoint[];
  legs: Leg[];
}): void {
  try {
    /*
      Uno stato vuoto non scrive **e non cancella**: salvare non deve poter distruggere.
      Prima qui c'era una `removeItem`, e siccome l'autosalvataggio salva anche quando la
      pagina viene nascosta, bastava aprire l'app in una seconda scheda — che parte sempre
      vuota — e cambiare scheda per cancellare il lavoro salvato dalla prima.
      Chi vuole cancellare chiama `clearCurrent`, che e' l'unico modo di dirlo.
    */
    if (stato.waypoints.length === 0) return;
    const savedAt = new Date().toISOString();
    try {
      scrivi({ ...stato, savedAt });
    } catch {
      // Spazio esaurito: meglio conservare i valori dell'utente che niente.
      try {
        scrivi({ ...stato, legs: senzaPesi(stato.legs), slim: true, savedAt });
      } catch {
        // Anche il ripiego non passa: si rinuncia in silenzio. Un autosalvataggio non
        // deve mettersi davanti a chi sta lavorando.
      }
    }
  } catch {
    // localStorage non disponibile (finestra privata, storage bloccato).
  }
}

export function loadCurrent(): CurrentItinerary | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d == null || typeof d !== 'object' || Array.isArray(d)) return null;
    if (d.v !== VERSIONE) return null;
    if (typeof d.itineraryId !== 'string' || typeof d.itineraryName !== 'string') return null;
    if (typeof d.createdAt !== 'string') return null;
    if (!MODI.includes(d.appMode as AppMode)) return null;
    if (!Array.isArray(d.waypoints) || !d.waypoints.every(waypointValido)) return null;
    if (!Array.isArray(d.legs) || !d.legs.every(legValido)) return null;
    if (d.waypoints.length === 0) return null;
    return {
      itineraryId: d.itineraryId,
      itineraryName: d.itineraryName,
      createdAt: d.createdAt,
      appMode: d.appMode as AppMode,
      waypoints: d.waypoints as Waypoint[],
      legs: d.legs as Leg[],
      slim: d.slim === true,
      savedAt: typeof d.savedAt === 'string' ? d.savedAt : undefined,
    };
  } catch {
    // Qualunque forma inattesa vale "non lo so": si parte da un itinerario vuoto,
    // non da uno a metà che poi si comporta in modo strano.
    return null;
  }
}

export function clearCurrent(): void {
  try {
    localStorage.removeItem(CURRENT_KEY);
  } catch {
    // niente da fare
  }
}
