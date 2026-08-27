import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { asyncMock } from './support/jest-mocks';

const mockFetch = asyncMock();
// Gli argomenti sono dichiarati perché i test li asseriscono.
const mockDelete = jest.fn(async (_id: string) => {});
const mockReorder = jest.fn(async (_ids: string[]) => {});
jest.mock('@/lib/sync', () => ({
  fetchRoutes: () => mockFetch(),
  deleteRoute: (id: string) => mockDelete(id),
  reorderRoutes: (ids: string[]) => mockReorder(ids),
  updateRouteNotes: jest.fn(async () => {}),
  saveRouteToCloud: jest.fn(async () => 'r1'),
  addCompletion: jest.fn(async () => {}),
  updateCompletion: jest.fn(async () => {}),
  deleteCompletion: jest.fn(async () => {}),
}));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ member: { id: 'm1' } }) } }));

import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import type { Itinerary } from '@/lib/types';

const mk = (id: string, name: string, sortIndex: number, completions: Itinerary['completions'] = []): Itinerary => ({
  id, name, createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [], sortIndex, completions,
});

beforeEach(() => {
  mockFetch.mockReset(); mockDelete.mockClear(); mockReorder.mockClear();
  useRouteLibraryStore.setState({ routes: [], selectedRouteId: null, sortMode: 'manual' });
});

describe('routeLibraryStore (cloud)', () => {
  test('refresh carica da fetchRoutes ordinato per sortIndex', async () => {
    mockFetch.mockResolvedValue([mk('1', 'B', 1), mk('2', 'A', 0)]);
    await useRouteLibraryStore.getState().refresh();
    expect(useRouteLibraryStore.getState().routes.map((r) => r.id)).toEqual(['2', '1']);
  });

  test('remove chiama deleteRoute, ricarica, azzera selezione', async () => {
    mockFetch.mockResolvedValue([]);
    useRouteLibraryStore.setState({ selectedRouteId: '1' });
    await useRouteLibraryStore.getState().remove('1');
    expect(mockDelete).toHaveBeenCalledWith('1');
    expect(useRouteLibraryStore.getState().selectedRouteId).toBeNull();
  });

  test('reorder chiama reorderRoutes e ricarica', async () => {
    mockFetch.mockResolvedValue([]);
    await useRouteLibraryStore.getState().reorder(['2', '1']);
    expect(mockReorder).toHaveBeenCalledWith(['2', '1']);
  });

});
