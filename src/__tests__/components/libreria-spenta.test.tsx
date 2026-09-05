import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { mostra } from '@/lib/profilo';
import { LIBRERIA_DISPONIBILE } from '@/lib/funzioni-spente';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useAuthStore } from '@/stores/authStore';
import { statoItinerario } from '../fixtures/itinerario';
import { BottomNav } from '@/components/panel/BottomNav';
import { ItineraryHeader } from '@/components/panel/ItineraryHeader';

/**
 * **La libreria condivisa è spenta** (`lib/funzioni-spente.ts`): il flusso di accesso non
 * funziona, e un pulsante che porta a una funzione rotta è peggio di nessun pulsante —
 * per un rilascio pubblico la promessa mancata è la prima impressione.
 *
 * Questi test documentano lo stato di OGGI: nessun ingresso visibile. Quelli dello stato
 * acceso restano nei loro file, con l'interruttore alzato via `jest.replaceProperty`.
 * Quando la libreria tornerà, questi test andranno rovesciati e la bandiera rimessa a
 * `true` — il primo test qui sotto è il promemoria che lo impone.
 */

beforeEach(() => {
  useUIStore.setState({ profilo: 'montagna' });
  useItineraryStore.setState(statoItinerario({ appMode: 'track' }));
  useAuthStore.setState({ member: { id: 'm1', username: 'giuseppe' } as never, session: {} as never, invited: true });
});

describe('la libreria e spenta, e non si vede da nessuna parte', () => {
  /** Il promemoria: quando l'interruttore torna `true`, questo file va rovesciato. */
  test('l interruttore e spento', () => {
    expect(LIBRERIA_DISPONIBILE).toBe(false);
    expect(mostra('libreria', 'montagna')).toBe(false);
    expect(mostra('libreria', 'imparo')).toBe(false);
  });

  test('la bottom nav ha tre destinazioni, senza Libreria', () => {
    render(<BottomNav />);
    expect(screen.queryByText('Libreria')).not.toBeInTheDocument();
    expect(screen.getByText('Mappa')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Altro')).toBeInTheDocument();
  });

  /**
   * Salva e Carica SONO la libreria condivisa: anche da membro autenticato non devono
   * comparire, e nemmeno la nota che li spiega — un testo che descrive pulsanti assenti
   * e' la classe di difetto della v0.11.8.
   */
  test('Salva, Carica e la loro nota spariscono anche da membro', () => {
    render(<ItineraryHeader />);
    expect(screen.queryByRole('button', { name: /Salva/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Carica/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/libreria condivisa/)).not.toBeInTheDocument();
  });

  test('«Nuovo» resta: non e la libreria, e il gesto che azzera il lavoro', () => {
    render(<ItineraryHeader />);
    expect(screen.getByRole('button', { name: /Nuovo/ })).toBeInTheDocument();
  });
});
