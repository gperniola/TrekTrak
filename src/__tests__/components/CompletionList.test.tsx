import { jest } from '@jest/globals';
import { asyncMock } from '../support/jest-mocks';

const mockConfirm = asyncMock();
jest.mock('@/stores/notificationStore', () => ({
  confirm: (...a: unknown[]) => mockConfirm(...a),
  toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

import { describe, expect, test, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompletionList } from '@/components/panel/CompletionList';
import { useAuthStore } from '@/stores/authStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import type { Itinerary } from '@/lib/types';

const routeWith = (completions: Itinerary['completions']): Itinerary => ({
  id: 'r1', name: 'X', createdAt: 'x', updatedAt: 'x', waypoints: [], legs: [], completions,
});

beforeEach(() => {
  useAuthStore.setState({ member: { id: 'me', username: 'gio', role: 'member' } });
  mockConfirm.mockReset();
});

describe('CompletionList permessi e meteo', () => {
  test('mostra modifica/elimina per un completamento PROPRIO', () => {
    render(<CompletionList route={routeWith([
      { id: 'c1', personName: 'gio', date: '2026-05-01', notes: '', createdBy: 'me' },
    ])} />);
    expect(screen.getByRole('button', { name: /modifica completamento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /elimina completamento/i })).toBeInTheDocument();
  });

  test('NON mostra modifica/elimina per un completamento ALTRUI', () => {
    render(<CompletionList route={routeWith([
      { id: 'c2', personName: 'anna', date: '2026-05-01', notes: '', createdBy: 'someone-else' },
    ])} />);
    expect(screen.queryByRole('button', { name: /modifica completamento/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /elimina completamento/i })).toBeNull();
  });

  test('admin vede modifica/elimina anche su completamenti altrui', () => {
    useAuthStore.setState({ member: { id: 'me', username: 'gio', role: 'admin' } });
    render(<CompletionList route={routeWith([
      { id: 'c3', personName: 'anna', date: '2026-05-01', notes: '', createdBy: 'someone-else' },
    ])} />);
    expect(screen.getByRole('button', { name: /elimina completamento/i })).toBeInTheDocument();
  });

  test('mostra il meteo (icona + parola)', () => {
    render(<CompletionList route={routeWith([
      { id: 'c4', personName: 'gio', date: '2026-05-01', notes: '', createdBy: 'me', weather: 'pioggia' },
    ])} />);
    expect(screen.getByText(/pioggia/i)).toBeInTheDocument();
  });
});

describe('CompletionList — conferma eliminazione (TASK-49)', () => {
  test('annullando la conferma NON elimina', async () => {
    const del = jest.fn(async (_routeId: string, _completionId: string) => {});
    useRouteLibraryStore.setState({ deleteCompletion: del as never });
    mockConfirm.mockResolvedValue(false);
    render(<CompletionList route={routeWith([
      { id: 'c1', personName: 'gio', date: '2026-05-01', notes: '', createdBy: 'me' },
    ])} />);
    fireEvent.click(screen.getByRole('button', { name: /elimina completamento/i }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(del).not.toHaveBeenCalled();
  });

  test('confermando elimina il completamento', async () => {
    const del = jest.fn(async (_routeId: string, _completionId: string) => {});
    useRouteLibraryStore.setState({ deleteCompletion: del as never });
    mockConfirm.mockResolvedValue(true);
    render(<CompletionList route={routeWith([
      { id: 'c1', personName: 'gio', date: '2026-05-01', notes: '', createdBy: 'me' },
    ])} />);
    fireEvent.click(screen.getByRole('button', { name: /elimina completamento/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('r1', 'c1'));
  });
});
