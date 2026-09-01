import type { StateCreator } from 'zustand';
import type { Waypoint } from '../../lib/types';
import type { ItineraryState } from './tipi';
import { catenaTratte, createEmptyLeg, generateId } from './helpers';

/** Oltre questo numero l'itinerario smette di essere leggibile, e la mappa pure. */
const MASSIMO_WAYPOINT = 50;

export type SliceWaypoints = Pick<
  ItineraryState,
  | 'waypoints'
  | 'addWaypoint'
  | 'addWaypointAtPosition'
  | 'removeWaypoint'
  | 'clearWaypoints'
  | 'updateWaypoint'
  | 'updateWaypointPosition'
  | 'reorderWaypoints'
>;

/**
 * I waypoint. Le azioni toccano anche le tratte, ed è giusto così: una tratta esiste
 * *fra* due waypoint consecutivi, quindi aggiungere o togliere un punto è per forza
 * anche un fatto della catena. Tenere le due cose in slice separate avrebbe prodotto due
 * pezzi che si chiamano a vicenda a ogni gesto, cioè peggio di uno.
 */
export const creaSliceWaypoints: StateCreator<ItineraryState, [], [], SliceWaypoints> = (set, get) => ({
  waypoints: [],

  addWaypoint: () => {
    const { waypoints, legs } = get();
    if (waypoints.length >= MASSIMO_WAYPOINT) return;
    const nuovo: Waypoint = {
      id: generateId(),
      name: `Waypoint ${waypoints.length + 1}`,
      lat: null,
      lon: null,
      altitude: null,
      order: waypoints.length,
    };
    const tratte = [...legs];
    if (waypoints.length > 0) {
      tratte.push(createEmptyLeg(waypoints[waypoints.length - 1].id, nuovo.id));
    }
    set({ waypoints: [...waypoints, nuovo], legs: tratte });
    get().registraGesto('aggiunta del waypoint');
  },

  addWaypointAtPosition: (lat, lon) => {
    const { waypoints, legs } = get();
    if (waypoints.length >= MASSIMO_WAYPOINT) return;
    const nuovo: Waypoint = {
      id: generateId(),
      name: `Waypoint ${waypoints.length + 1}`,
      lat,
      lon,
      altitude: null,
      order: waypoints.length,
    };
    const tratte = [...legs];
    if (waypoints.length > 0) {
      tratte.push(createEmptyLeg(waypoints[waypoints.length - 1].id, nuovo.id));
    }
    set({ waypoints: [...waypoints, nuovo], legs: tratte });
    get().registraGesto('aggiunta del waypoint');
  },

  removeWaypoint: (id) => {
    const { waypoints, legs } = get();
    const rimasti = waypoints.filter((wp) => wp.id !== id).map((wp, i) => ({ ...wp, order: i }));
    set({ waypoints: rimasti, legs: catenaTratte(rimasti, legs) });
    get().registraGesto('rimozione del waypoint');
  },

  clearWaypoints: () => {
    // `profileHover`/`profileFlyTo` puntano a waypoint: lasciarli farebbe riferire il
    // profilo altimetrico a punti che non esistono più.
    set({ waypoints: [], legs: [], profileHover: null, profileFlyTo: null });
    get().registraGesto('cancellazione dei waypoint');
  },

  updateWaypoint: (id, data, opzioni) => {
    set({
      waypoints: get().waypoints.map((wp) => {
        if (wp.id !== id) return wp;
        const aggiornato = { ...wp, ...data };
        // Se cambia un valore giudicato, il giudizio precedente non vale piu'.
        if (!('validationState' in data) && wp.validationState) {
          if ('altitude' in data || 'lat' in data || 'lon' in data) {
            aggiornato.validationState = undefined;
          }
        }
        return aggiornato;
      }),
    });
    // Un giudizio scritto dalla verifica non e' un gesto, e nemmeno un valore calcolato
    // dall'app in Track: nessuno dei due entra nella storia.
    const soloValidazione = Object.keys(data).every((k) => k === 'validationState');
    if (!opzioni?.calcolata && !soloValidazione) get().registraGesto('modifica del waypoint');
  },

  updateWaypointPosition: (id, lat, lon) => {
    set({
      waypoints: get().waypoints.map((wp) =>
        wp.id === id ? { ...wp, lat, lon, validationState: undefined } : wp,
      ),
    });
    get().registraGesto('spostamento del waypoint');
  },

  reorderWaypoints: (nuovoOrdine) => {
    const { waypoints, legs } = get();
    // Un ordine che non e' una permutazione dei waypoint attuali si ignora: applicarlo
    // a meta' lascerebbe l'itinerario in uno stato che nessuno ha chiesto.
    if (nuovoOrdine.length !== waypoints.length) return;
    if (nuovoOrdine.some((i) => i < 0 || i >= waypoints.length)) return;
    if (new Set(nuovoOrdine).size !== nuovoOrdine.length) return;

    const riordinati = nuovoOrdine.map((vecchio, nuovo) => ({ ...waypoints[vecchio], order: nuovo }));
    set({ waypoints: riordinati, legs: catenaTratte(riordinati, legs) });
    get().registraGesto('riordino dei waypoint');
  },
});
