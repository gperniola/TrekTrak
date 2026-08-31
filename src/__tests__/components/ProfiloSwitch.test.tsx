import { render, screen, fireEvent } from '@testing-library/react';
import { ProfiloSwitch } from '@/components/shared/ProfiloSwitch';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

/**
 * Funzioni nascoste sono funzioni non scoperte: l'interruttore sta in vista e dice il
 * profilo per nome, non sepolto nelle impostazioni. Un modo che nasconde funzioni deve
 * rendere evidente che esiste l'altro modo.
 */
describe('l interruttore del profilo', () => {
  beforeEach(() => useUIStore.setState({ profilo: 'montagna' }));

  test('dice il profilo corrente per nome', () => {
    render(<ProfiloSwitch />);
    expect(screen.getByRole('button', { name: /Vado in montagna/ })).toBeInTheDocument();
  });

  test('cambiarlo passa all altro profilo', () => {
    render(<ProfiloSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /Vado in montagna/ }));
    expect(useUIStore.getState().profilo).toBe('imparo');
  });

  test('e poi torna indietro', () => {
    render(<ProfiloSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /Vado in montagna/ }));
    fireEvent.click(screen.getByRole('button', { name: /Imparo/ }));
    expect(useUIStore.getState().profilo).toBe('montagna');
  });

  test('al cambio spiega cosa e comparso e cosa e sparito', () => {
    render(<ProfiloSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /Vado in montagna/ }));
    const spiegazione = screen.getByRole('status').textContent ?? '';
    expect(spiegazione).toMatch(/verifica|quiz|progress/i);
    expect(spiegazione).toMatch(/emergenza|meteo|libreria/i);
  });

  test('prima di toccarlo non spiega niente', () => {
    render(<ProfiloSwitch />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

/**
 * Trovato misurando a schermo: passando a Imparo, "Verifica" non compariva perche'
 * l'itinerario era rimasto in Track — Montagna lo forza — e il profilo da solo non lo
 * riportava indietro. Chi sceglie di imparare vuole l'esercizio.
 */
describe('passando a Imparo si torna in Learn', () => {
  test('un itinerario in Track torna in Learn', () => {
    useUIStore.setState({ profilo: 'montagna' });
    useItineraryStore.setState({ appMode: 'track' });
    render(<ProfiloSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /Vado in montagna/ }));
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  /**
   * Ma NON in modo continuo: in Imparo l'interruttore Learn/Track resta visibile di
   * proposito, e chi passa a Track per vedere i valori reali deve poterci restare.
   */
  test('chi e gia in Imparo puo restare in Track', () => {
    useUIStore.setState({ profilo: 'imparo' });
    useItineraryStore.setState({ appMode: 'track' });
    render(<ProfiloSwitch />);
    // nessun cambio di profilo: l'app non deve toccare il modo
    expect(useItineraryStore.getState().appMode).toBe('track');
  });
});
