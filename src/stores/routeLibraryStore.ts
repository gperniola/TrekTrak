import { create } from 'zustand';
import type { Itinerary, RouteCompletion } from '../lib/types';
import {
  loadItineraries,
  deleteItinerary,
  updateSavedItinerary,
  reorderSavedItineraries,
  addCompletion as storageAddCompletion,
  updateCompletion as storageUpdateCompletion,
  deleteCompletion as storageDeleteCompletion,
} from '../lib/storage';

export type SortMode = 'manual' | 'name' | 'distance' | 'gain' | 'updated' | 'completions';

function sortRoutes(routes: Itinerary[], mode: SortMode): Itinerary[] {
  const r = [...routes];
  switch (mode) {
    case 'name': return r.sort((a, b) => a.name.localeCompare(b.name, 'it'));
    case 'distance': return r.sort((a, b) => (b.metrics?.distanceKm ?? 0) - (a.metrics?.distanceKm ?? 0));
    case 'gain': return r.sort((a, b) => (b.metrics?.elevationGain ?? 0) - (a.metrics?.elevationGain ?? 0));
    case 'updated': return r.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    case 'completions': return r.sort((a, b) => (b.completions?.length ?? 0) - (a.completions?.length ?? 0));
    case 'manual':
    default: return r.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
  }
}

interface RouteLibraryState {
  routes: Itinerary[];
  selectedRouteId: string | null;
  sortMode: SortMode;
  refresh: () => void;
  select: (id: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  reorder: (orderedIds: string[]) => void;
  remove: (id: string) => void;
  updateNotes: (id: string, notes: string) => void;
  addCompletion: (routeId: string, c: Omit<RouteCompletion, 'id'>) => void;
  updateCompletion: (routeId: string, completionId: string, patch: Partial<RouteCompletion>) => void;
  deleteCompletion: (routeId: string, completionId: string) => void;
}

export const useRouteLibraryStore = create<RouteLibraryState>((set, get) => ({
  routes: [],
  selectedRouteId: null,
  sortMode: 'manual',

  refresh: () => set({ routes: sortRoutes(loadItineraries(), get().sortMode) }),

  select: (id) => set({ selectedRouteId: id }),

  setSortMode: (mode) => set({ sortMode: mode, routes: sortRoutes(get().routes, mode) }),

  reorder: (orderedIds) => {
    reorderSavedItineraries(orderedIds);
    set({ routes: sortRoutes(loadItineraries(), 'manual'), sortMode: 'manual' });
  },

  remove: (id) => {
    deleteItinerary(id);
    set((s) => ({
      routes: sortRoutes(loadItineraries(), s.sortMode),
      selectedRouteId: s.selectedRouteId === id ? null : s.selectedRouteId,
    }));
  },

  updateNotes: (id, notes) => {
    updateSavedItinerary(id, { notes });
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },

  addCompletion: (routeId, c) => {
    storageAddCompletion(routeId, c);
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },

  updateCompletion: (routeId, completionId, patch) => {
    storageUpdateCompletion(routeId, completionId, patch);
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },

  deleteCompletion: (routeId, completionId) => {
    storageDeleteCompletion(routeId, completionId);
    set((s) => ({ routes: sortRoutes(loadItineraries(), s.sortMode) }));
  },
}));
