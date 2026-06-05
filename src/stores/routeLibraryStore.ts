import { create } from 'zustand';
import type { Itinerary, RouteCompletion } from '../lib/types';
import {
  fetchRoutes, deleteRoute, reorderRoutes, updateRouteNotes,
  addCompletion as syncAddCompletion,
  updateCompletion as syncUpdateCompletion,
  deleteCompletion as syncDeleteCompletion,
} from '../lib/sync';
import { useAuthStore } from './authStore';

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
  loading: boolean;
  refresh: () => Promise<void>;
  select: (id: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  reorder: (orderedIds: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  updateNotes: (id: string, notes: string) => Promise<void>;
  addCompletion: (routeId: string, c: Omit<RouteCompletion, 'id'>) => Promise<void>;
  updateCompletion: (routeId: string, completionId: string, patch: Partial<RouteCompletion>) => Promise<void>;
  deleteCompletion: (routeId: string, completionId: string) => Promise<void>;
}

export const useRouteLibraryStore = create<RouteLibraryState>((set, get) => ({
  routes: [],
  selectedRouteId: null,
  sortMode: 'manual',
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const routes = await fetchRoutes();
      set({ routes: sortRoutes(routes, get().sortMode) });
    } finally {
      set({ loading: false });
    }
  },

  select: (id) => set({ selectedRouteId: id }),
  setSortMode: (mode) => set({ sortMode: mode, routes: sortRoutes(get().routes, mode) }),

  reorder: async (orderedIds) => {
    await reorderRoutes(orderedIds);
    set({ sortMode: 'manual' });
    await get().refresh();
  },

  remove: async (id) => {
    await deleteRoute(id);
    set((s) => ({ selectedRouteId: s.selectedRouteId === id ? null : s.selectedRouteId }));
    await get().refresh();
  },

  updateNotes: async (id, notes) => { await updateRouteNotes(id, notes); await get().refresh(); },

  addCompletion: async (routeId, c) => {
    const memberId = useAuthStore.getState().member?.id;
    if (!memberId) throw new Error('not_member');
    await syncAddCompletion(routeId, memberId, c);
    await get().refresh();
  },
  updateCompletion: async (_routeId, completionId, patch) => { await syncUpdateCompletion(completionId, patch); await get().refresh(); },
  deleteCompletion: async (_routeId, completionId) => { await syncDeleteCompletion(completionId); await get().refresh(); },
}));
