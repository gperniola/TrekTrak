import { render, screen, fireEvent } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';

/**
 * TASK-38. La guida era una finestra modale al centro, con un velo nero sopra tutto: al
 * secondo passo diceva «tocca la mappa per posizionare i waypoint» **coprendo la mappa e
 * impedendo di toccarla**. Ora è un pannello — a destra su schermo grande, un foglio in
 * basso su telefono — e la mappa dietro resta visibile e utilizzabile.
 */

beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({ profilo: 'imparo' });
});

const pannello = () => screen.getByRole('dialog');

describe('la guida non e piu una finestra modale', () => {
  test('non dichiara di essere modale', () => {
    render(<LearnTutorial />);
    expect(pannello().getAttribute('aria-modal')).toBeNull();
  });

  /** Il velo nero copriva tutto e intercettava i clic diretti alla mappa. */
  test('non c e nessun velo sopra la pagina', () => {
    const { container } = render(<LearnTutorial />);
    const veli = container.querySelectorAll('.fixed.inset-0');
    expect(veli).toHaveLength(0);
  });

  test('il pannello e ancorato, non centrato a tutto schermo', () => {
    render(<LearnTutorial />);
    const classi = pannello().className;
    expect(classi).toMatch(/lg:right-4/);      // a destra su schermo grande
    expect(classi).toMatch(/max-lg:bottom-/);  // foglio in basso su telefono
  });
});

describe('si chiude in tre modi', () => {
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

  test('chiudendo, non si riapre al prossimo avvio', () => {
    const { unmount } = render(<LearnTutorial />);
    fireEvent.keyDown(window, { key: 'Escape' });
    unmount();
    render(<LearnTutorial />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

/**
 * Il passo indica l'elemento di cui parla mettendogli un contorno verde: e' il pezzo che
 * rende utile avere la mappa visibile.
 */
describe('i passi indicano l elemento di cui parlano', () => {
  test('il passo sui waypoint evidenzia la mappa', () => {
    const mappa = document.createElement('div');
    mappa.setAttribute('data-guida', 'mappa');
    document.body.appendChild(mappa);

    render(<LearnTutorial />);
    expect(mappa.classList.contains('guida-evidenziata')).toBe(false);  // passo 0: benvenuto
    fireEvent.click(screen.getByText('Avanti'));
    expect(mappa.classList.contains('guida-evidenziata')).toBe(true);

    mappa.remove();
  });

  test('passando oltre, il contorno si sposta e non resta appiccicato', () => {
    const mappa = document.createElement('div');
    mappa.setAttribute('data-guida', 'mappa');
    const modi = document.createElement('div');
    modi.setAttribute('data-guida', 'modi');
    document.body.append(mappa, modi);

    render(<LearnTutorial />);
    fireEvent.click(screen.getByText('Avanti'));   // waypoint -> evidenzia mappa
    expect(mappa.classList.contains('guida-evidenziata')).toBe(true);
    fireEvent.click(screen.getByText('Avanti'));   // Learn/Track -> evidenzia i modi
    expect(mappa.classList.contains('guida-evidenziata')).toBe(false);
    expect(modi.classList.contains('guida-evidenziata')).toBe(true);

    mappa.remove();
    modi.remove();
  });

  test('chiudendo la guida non resta niente di evidenziato', () => {
    const mappa = document.createElement('div');
    mappa.setAttribute('data-guida', 'mappa');
    document.body.appendChild(mappa);

    render(<LearnTutorial />);
    fireEvent.click(screen.getByText('Avanti'));
    expect(mappa.classList.contains('guida-evidenziata')).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mappa.classList.contains('guida-evidenziata')).toBe(false);

    mappa.remove();
  });

  /** Un bersaglio che in questo momento non esiste non deve far esplodere niente. */
  test('se l elemento indicato non c e, la guida prosegue lo stesso', () => {
    render(<LearnTutorial />);
    expect(() => fireEvent.click(screen.getByText('Avanti'))).not.toThrow();
    expect(screen.getByText('Aggiungi waypoint')).toBeInTheDocument();
  });
});
