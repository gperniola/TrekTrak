import { describe, expect, test, beforeEach } from '@jest/globals';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

import { useRouteLibraryStore } from '../stores/routeLibraryStore';
import { saveItinerary } from '../lib/storage';
import type { Itinerary } from '../lib/types';

const mk = (id: string, name: string, sortIndex: number): Itinerary => ({
  id, name, createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [], sortIndex,
});

beforeEach(() => {
  localStorageMock.clear();
  useRouteLibraryStore.setState({ routes: [], selectedRouteId: null, sortMode: 'manual' });
});

describe('routeLibraryStore', () => {
  test('refresh loads routes sorted by sortIndex when sortMode=manual', () => {
    saveItinerary(mk('1', 'B', 1));
    saveItinerary(mk('2', 'A', 0));
    useRouteLibraryStore.getState().refresh();
    expect(useRouteLibraryStore.getState().routes.map((r) => r.id)).toEqual(['2', '1']);
  });

  test('select sets selectedRouteId', () => {
    saveItinerary(mk('1', 'A', 0));
    const s = useRouteLibraryStore.getState();
    s.refresh();
    s.select('1');
    expect(useRouteLibraryStore.getState().selectedRouteId).toBe('1');
  });

  test('remove deletes and clears selection if it was selected', () => {
    saveItinerary(mk('1', 'A', 0));
    const s = useRouteLibraryStore.getState();
    s.refresh();
    s.select('1');
    s.remove('1');
    expect(useRouteLibraryStore.getState().routes).toHaveLength(0);
    expect(useRouteLibraryStore.getState().selectedRouteId).toBeNull();
  });
});
