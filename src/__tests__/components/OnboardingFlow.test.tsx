import { render, screen, fireEvent } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { WhatsNew, CURRENT_WHATSNEW_VERSION } from '@/components/tutorial/WhatsNew';
import { useItineraryStore } from '@/stores/itineraryStore';
import { KEYS } from '@/lib/storage';

beforeEach(() => {
  localStorage.clear();
  useItineraryStore.setState({ appMode: 'track' });
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
 * La scelta iniziale del livello decideva la modalità e poi spariva senza dire nulla:
 * le due carte si toglievano dallo schermo e restava il testo di benvenuto, quindi non
 * si sapeva cosa fosse stato scelto né come cambiarlo.
 */
describe('scelta del livello: riscontro e ripensamento', () => {
  test('la scelta imposta la modalità', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /sto imparando/i }));
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  test('dopo la scelta si vede quale è stata scelta', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /sto imparando/i }));
    const scelta = screen.getByRole('button', { name: /sto imparando/i });
    expect(scelta).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /sono esperto/i })).toHaveAttribute('aria-pressed', 'false');
    // e lo dice anche a parole, non solo col colore: la riga di conferma nomina la
    // modalità attiva e ricorda che si può cambiare
    expect(screen.getByText(/Modalità Learn attiva/)).toBeInTheDocument();
    expect(screen.getByText(/cambi quando vuoi/)).toBeInTheDocument();
  });

  test('si può cambiare idea senza ricominciare', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /sto imparando/i }));
    fireEvent.click(screen.getByRole('button', { name: /sono esperto/i }));
    expect(useItineraryStore.getState().appMode).toBe('track');
    expect(screen.getByRole('button', { name: /sono esperto/i })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem(KEYS.userLevel)).toBe('expert');
  });

  test('la scelta viene ricordata per i prossimi avvii', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /sto imparando/i }));
    expect(localStorage.getItem(KEYS.userLevel)).toBe('beginner');
  });
});
