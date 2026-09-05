import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

// La libreria carica i dati via lib/sync al passaggio di vista: mock per non toccare la rete.
jest.mock('@/lib/sync', () => ({ fetchRoutes: jest.fn(() => Promise.resolve([])) }));

import { MainViewSwitch } from '@/components/panel/MainViewSwitch';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

/*
  Questi test documentano la libreria ACCESA: l'interruttore temporaneo (vedi
  `lib/funzioni-spente.ts`) si alza qui, cosi' quando la funzione tornera' non ci sara'
  niente da riscrivere. Lo stato SPENTO ha i suoi test in `libreria-spenta.test.tsx`.
*/
import * as funzioniSpente from '@/lib/funzioni-spente';
beforeEach(() => {
  jest.replaceProperty(funzioniSpente, 'LIBRERIA_DISPONIBILE', true);
});
afterEach(() => {
  jest.restoreAllMocks();
});


beforeEach(() => {
  useUIStore.setState({ mainView: 'editor' });
  useAuthStore.setState({ invited: false, member: null, session: null });
});

describe('MainViewSwitch gating', () => {
  test('tab Libreria assente per anonimo non invitato', () => {
    render(<MainViewSwitch />);
    expect(screen.queryByRole('tab', { name: /libreria/i })).toBeNull();
    expect(screen.getByRole('tab', { name: /editor/i })).toBeInTheDocument();
  });

  test('tab Libreria presente se invitato', () => {
    useAuthStore.setState({ invited: true, member: null });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });

  test('tab Libreria presente se membro', () => {
    useAuthStore.setState({ invited: false, member: { id: 'u', username: 'g', role: 'member' } });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });

  test('tab Libreria presente con sola sessione attiva (ritorno magic-link)', () => {
    useAuthStore.setState({ invited: false, member: null, session: { user: { id: 'u' } } as never });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: /libreria/i })).toBeInTheDocument();
  });
});

describe('MainViewSwitch default view', () => {
  test('anonimo non invitato: resta sull\'editor', () => {
    render(<MainViewSwitch />);
    expect(useUIStore.getState().mainView).toBe('editor');
  });

  test('membro autenticato: la vista di default diventa la Libreria', async () => {
    useAuthStore.setState({ member: { id: 'u', username: 'g', role: 'member' }, session: { user: { id: 'u' } } as never });
    render(<MainViewSwitch />);
    await waitFor(() => expect(useUIStore.getState().mainView).toBe('library'));
  });

  test('sola sessione attiva (onboarding): default Libreria per scegliere lo username', async () => {
    useAuthStore.setState({ member: null, session: { user: { id: 'u' } } as never });
    render(<MainViewSwitch />);
    await waitFor(() => expect(useUIStore.getState().mainView).toBe('library'));
  });

  test('solo invitato (non loggato): resta sull\'editor', () => {
    useAuthStore.setState({ invited: true, member: null, session: null });
    render(<MainViewSwitch />);
    expect(useUIStore.getState().mainView).toBe('editor');
  });
});
