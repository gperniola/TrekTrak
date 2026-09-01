import type { StateCreator } from 'zustand';
import type { ItineraryState } from './tipi';
import { catenaTratte, generateId } from './helpers';

export type SliceDocumento = Pick<
  ItineraryState,
  | 'itineraryId'
  | 'itineraryName'
  | 'createdAt'
  | 'setItineraryName'
  | 'setItineraryId'
  | 'resetItinerary'
  | 'loadItinerary'
  | 'hydrateCurrent'
>;

/** Massimo imposto anche in importazione: un file di fuori non deve poterlo aggirare. */
const MASSIMO_WAYPOINT = 50;

/**
 * L'itinerario **come documento**: la sua identità (id, nome, data) e i tre modi in cui
 * viene rimpiazzato per intero — azzerato, caricato da fuori, ripreso dall'autosalvataggio.
 */
export const creaSliceDocumento: StateCreator<ItineraryState, [], [], SliceDocumento> = (set, get) => ({
  itineraryId: generateId(),
  itineraryName: '',
  createdAt: new Date().toISOString(),

  setItineraryName: (name) => set({ itineraryName: name }),
  setItineraryId: (id) => set({ itineraryId: id }),

  resetItinerary: () => {
    // Impostazioni e modo sopravvivono: sono preferenze della persona, non dell'itinerario.
    const { appMode, settings } = get();
    set({
      itineraryId: generateId(),
      itineraryName: '',
      createdAt: new Date().toISOString(),
      waypoints: [],
      legs: [],
      settings,
      appMode,
      profileHover: null,
      profileFlyTo: null,
    });
  },

  loadItinerary: (id, name, waypoints, legs, createdAt) => {
    // Si ordina per `order` prima di rinumerare, cosi' un file che arriva da fuori
    // conserva la sua sequenza. `NaN` va in fondo invece di far collassare l'ordinamento.
    const ordinati = [...waypoints].sort((a, b) => {
      const oa = Number.isFinite(a.order) ? a.order : Infinity;
      const ob = Number.isFinite(b.order) ? b.order : Infinity;
      return oa - ob;
    });
    const puliti = ordinati.slice(0, MASSIMO_WAYPOINT).map(({ validationState, ...wp }, i) => {
      void validationState;
      return { ...wp, order: i };
    });
    set({
      itineraryId: id,
      itineraryName: name,
      createdAt: createdAt ?? new Date().toISOString(),
      waypoints: puliti,
      legs: catenaTratte(puliti, legs, { ricalcolaCon: get().settings.pace?.factor ?? 1 }),
      profileHover: null,
      profileFlyTo: null,
    });
  },

  hydrateCurrent: (saved) => {
    set({
      itineraryId: saved.itineraryId,
      itineraryName: saved.itineraryName,
      createdAt: saved.createdAt,
      appMode: saved.appMode,
      waypoints: saved.waypoints,
      legs: saved.legs,
      profileHover: null,
      profileFlyTo: null,
    });
  },
});
