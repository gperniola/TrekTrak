import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/panel/BottomNav';
import { useUIStore } from '@/stores/uiStore';

/** La Libreria e' la libreria CONDIVISA dei percorsi: roba da gita vera. */
describe('la libreria per profilo', () => {
  test('in Montagna la Libreria e una destinazione', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: /Libreria/ })).toBeInTheDocument();
  });

  test('in Imparo non c e', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<BottomNav />);
    expect(screen.queryByRole('button', { name: /Libreria/ })).not.toBeInTheDocument();
  });

  /** Togliere una voce non deve rompere la barra: le altre restano. */
  test('Mappa, Editor e Altro restano in entrambi i profili', () => {
    for (const p of ['imparo', 'montagna'] as const) {
      useUIStore.setState({ profilo: p });
      const { unmount } = render(<BottomNav />);
      expect(screen.getByRole('button', { name: /Mappa/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Editor/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Altro/ })).toBeInTheDocument();
      unmount();
    }
  });

  /**
   * Chi era in Libreria e passa a Imparo non deve restare su una vista che non esiste
   * piu': la scheda torna alla mappa.
   */
  test('passando a Imparo mentre si e in Libreria si torna alla mappa', () => {
    useUIStore.setState({ profilo: 'montagna', mobileTab: 'library', mainView: 'library' });
    useUIStore.getState().setProfilo('imparo');
    expect(useUIStore.getState().mobileTab).toBe('map');
    expect(useUIStore.getState().mainView).toBe('editor');
  });
});

/**
 * I pulsanti spariscono, ma il testo che li spiega deve sparire con loro: la nota parla
 * di "Salva", della libreria condivisa e dell'export in JSON o GPX, e in Imparo non
 * esiste nessuna delle tre cose. Trovato provando il giro a mano.
 */
describe('la nota sulla libreria segue i pulsanti', () => {
  test('in Montagna senza accesso la nota c e', async () => {
    const { ItineraryHeader } = await import('@/components/panel/ItineraryHeader');
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.setState({ member: null });
    useUIStore.setState({ profilo: 'montagna' });
    render(<ItineraryHeader />);
    expect(screen.getByText(/esportarlo in JSON o GPX/)).toBeInTheDocument();
  });

  test('in Imparo non c e, perche non ci sono ne libreria ne JSON ne GPX', async () => {
    const { ItineraryHeader } = await import('@/components/panel/ItineraryHeader');
    const { useAuthStore } = await import('@/stores/authStore');
    useAuthStore.setState({ member: null });
    useUIStore.setState({ profilo: 'imparo' });
    render(<ItineraryHeader />);
    expect(screen.queryByText(/esportarlo in JSON o GPX/)).not.toBeInTheDocument();
  });
});
