import { render, screen, fireEvent, act } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';

/**
 * **La guida di primo avvio è un popup centrale.**
 *
 * La storia ha fatto un giro completo. Nasce modale; il task-38 la trasforma in un
 * pannello ancorato perché al passo «tocca la mappa» copriva la mappa; e il 2026-09-05
 * l'utente la riporta al centro: «i messaggi allo startup compaiono in un tiretto
 * scorrevole, ed è sbagliatissimo: devono essere un popup centrale». Il pannello, stretto
 * e scorrevole, tagliava il contenuto proprio al primo avvio — l'animazione e metà dei
 * testi stavano sotto la piega.
 *
 * Ora la guida si legge e si chiude, poi si tocca: da modale vera ha la trappola del
 * fuoco e il velo, e il contorno verde sugli elementi (`evidenzia`) è stato rimosso —
 * sotto un velo non aveva più niente da indicare.
 */

beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({ profilo: 'montagna' });
});

const dialogo = () => screen.getByRole('dialog');

describe('la guida e un popup centrale', () => {
  test('dichiara di essere modale', () => {
    render(<LearnTutorial />);
    expect(dialogo().getAttribute('aria-modal')).toBe('true');
  });

  test('ha il velo sopra la pagina, centrato', () => {
    const { container } = render(<LearnTutorial />);
    const velo = container.querySelector('.fixed.inset-0');
    expect(velo).not.toBeNull();
    expect(velo!.className).toMatch(/items-center/);
    expect(velo!.className).toMatch(/justify-center/);
  });

  test('all apertura il fuoco sta sul dialogo', () => {
    render(<LearnTutorial />);
    expect(document.activeElement).toBe(dialogo());
  });
});

describe('si chiude in quattro modi, e resta chiusa', () => {
  test('con la ✕', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi la guida' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('con Escape', () => {
    render(<LearnTutorial />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('con «Salta»', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByText('Salta'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /** Il clic sul velo vale come «Salta»: e' il gesto naturale per mandar via un popup. */
  test('col clic sul velo', () => {
    const { container } = render(<LearnTutorial />);
    fireEvent.click(container.querySelector('.fixed.inset-0')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /** E un clic DENTRO il dialogo non la chiude: il velo non deve rubare i tocchi al contenuto. */
  test('un clic dentro il dialogo non chiude', () => {
    render(<LearnTutorial />);
    fireEvent.click(dialogo());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('chiudendo, non si riapre al prossimo avvio', () => {
    const { unmount } = render(<LearnTutorial />);
    fireEvent.keyDown(window, { key: 'Escape' });
    unmount();
    render(<LearnTutorial />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/**
 * **Il popup parla col resto dell'app attraverso `uiStore.guidaAperta`**: il tasto
 * Indietro lo spegne per chiudere la guida invece di proporre l'uscita, e «Rivedi il
 * tutorial» nelle impostazioni lo accende per aprirla SUBITO — non «al prossimo avvio»,
 * che era la scusa di quando la guida era legata al montaggio della pagina.
 */
describe('la guida e il flag guidaAperta', () => {
  test('aprendosi al primo avvio, dichiara il flag', () => {
    render(<LearnTutorial />);
    expect(useUIStore.getState().guidaAperta).toBe(true);
  });

  test('spegnendo il flag da fuori (tasto Indietro), la guida si chiude e non torna', () => {
    const { unmount } = render(<LearnTutorial />);
    act(() => { useUIStore.getState().setGuidaAperta(false); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // e vale come vista: al prossimo avvio non si ripresenta
    unmount();
    render(<LearnTutorial />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('accendendo il flag da fuori (Rivedi il tutorial), la guida si apre subito', () => {
    localStorage.setItem('trektrak_tutorial_seen', '1');
    render(<LearnTutorial />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => { useUIStore.getState().setGuidaAperta(true); });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Benvenuto in TrekTrak!')).toBeInTheDocument();
  });

  test('chiudendo con la ✕, il flag si spegne', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi la guida' }));
    expect(useUIStore.getState().guidaAperta).toBe(false);
  });
});
