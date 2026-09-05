import { render, screen, fireEvent } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

/**
 * **Niente più bivio all'ingresso** (richiesta utente, 2026-09-05): l'app è prima di
 * tutto da trekking, parte in Montagna/Pianificazione, e chiedere «sto imparando o sono
 * esperto» a chi vuole solo preparare una gita era una domanda prima ancora di aver visto
 * la mappa. La palestra di cartografia si attiva dal passo «Impara la cartografia» nelle
 * «Altre funzionalità» — o quando si vuole da «Modalità» in cima all'Editor.
 */
describe('l onboarding non chiede piu il livello', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ profilo: 'montagna' });
    useItineraryStore.setState({ appMode: 'track' });
  });

  test('al passo di benvenuto non ci sono carte da scegliere', () => {
    render(<LearnTutorial />);
    expect(screen.queryByRole('button', { name: /Sto imparando/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sono esperto/ })).not.toBeInTheDocument();
  });

  /** Fino al passo avanzato: Avanti, Avanti, «Altre funzionalità» -> «Impara la cartografia». */
  function vaiAllaCarta() {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText(/Altre funzionalità/));
    expect(screen.getByText('Impara la cartografia')).toBeInTheDocument();
  }

  test('la carta nelle altre funzionalita attiva Imparo e la modalita Learn', () => {
    vaiAllaCarta();
    fireEvent.click(screen.getByRole('button', { name: /Attiva la modalità «Impara»/ }));
    expect(useUIStore.getState().profilo).toBe('imparo');
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  /** La chiave storica del livello resta scritta: migrazione e ripristino la leggono. */
  test('il livello continua a essere salvato', () => {
    vaiAllaCarta();
    fireEvent.click(screen.getByRole('button', { name: /Attiva la modalità «Impara»/ }));
    expect(localStorage.getItem('trektrak_user_level')).toBe('beginner');
  });

  /**
   * **Attivando Imparo, la guida resta sul passo che si sta leggendo.** Il cambio di
   * profilo cambia l'elenco dei passi sotto i piedi — in Imparo entrano «Impara e
   * Pianificazione» e «Verifica» prima della carta — e senza l'aggancio per titolo
   * l'indice corrente finiva su un ALTRO passo a metà del gesto.
   */
  test('attivando, si resta sul passo della carta', () => {
    vaiAllaCarta();
    fireEvent.click(screen.getByRole('button', { name: /Attiva la modalità «Impara»/ }));
    expect(screen.getByText('Impara la cartografia')).toBeInTheDocument();
  });

  /** Il riscontro della v0.11.8: la scelta fatta resta leggibile, non sparisce. */
  test('dopo l attivazione la carta mostra lo stato, a parole', () => {
    vaiAllaCarta();
    const carta = screen.getByRole('button', { name: /Attiva la modalità «Impara»/ });
    expect(carta).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(carta);
    expect(screen.getByRole('button', { name: /Attiva la modalità «Impara»/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Modalità «Impara» attiva/)).toBeInTheDocument();
    expect(screen.getByText(/La cambi quando vuoi/)).toBeInTheDocument();
  });
});
