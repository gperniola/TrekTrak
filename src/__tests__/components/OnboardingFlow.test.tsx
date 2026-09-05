import { render, screen, fireEvent } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { WhatsNew, CURRENT_WHATSNEW_VERSION } from '@/components/tutorial/WhatsNew';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import { KEYS } from '@/lib/storage';

beforeEach(() => {
  localStorage.clear();
  useItineraryStore.setState({ appMode: 'track' });
  // La navigazione fino alla carta conta i passi di Montagna, che e' il default vero.
  useUIStore.setState({ profilo: 'montagna' });
});

/**
 * Chi apre l'app per la prima volta faceva il tutorial e, al secondo avvio, si
 * ritrovava il popup delle novità: gli si raccontavano come "novità" funzioni che non
 * aveva mai conosciuto diversamente. Le note di rilascio servono a chi c'era prima.
 */
describe('primo avvio: il tutorial spegne le note di rilascio', () => {
  test('finito il tutorial, la versione risulta già vista', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /salta/i }));
    expect(localStorage.getItem(KEYS.whatsNewVersion)).toBe(CURRENT_WHATSNEW_VERSION);
  });

  test('e quindi il popup delle novità non compare', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /salta/i }));
    const { container } = render(<WhatsNew />);
    expect(container.firstChild).toBeNull();
  });

  // Chi ha già usato l'app (tutorial visto in passato, nessuna versione registrata)
  // deve invece vederle: e' il caso di un aggiornamento.
  test('a chi aveva già visto il tutorial le novità compaiono', () => {
    localStorage.setItem(KEYS.tutorialSeen, '1');
    render(<WhatsNew />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/**
 * La scelta iniziale del livello non esiste più (2026-09-05): l'app parte da
 * Montagna/Pianificazione e la palestra si accende dalla carta nelle «Altre
 * funzionalità». Qui si verifica che quel percorso faccia tutto il mestiere della
 * vecchia scelta: modalità, persistenza, e il riscontro visibile.
 */
describe('la carta «Attiva Impara» nelle altre funzionalita', () => {
  function vaiAllaCarta() {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText(/Altre funzionalità/));
  }

  test('attivandola si passa alla modalita Learn', () => {
    vaiAllaCarta();
    fireEvent.click(screen.getByRole('button', { name: /Attiva la modalità «Impara»/ }));
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  test('la scelta viene ricordata per i prossimi avvii', () => {
    vaiAllaCarta();
    fireEvent.click(screen.getByRole('button', { name: /Attiva la modalità «Impara»/ }));
    expect(localStorage.getItem(KEYS.userLevel)).toBe('beginner');
  });
});
