import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSwitch } from '@/components/panel/ModeSwitch';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';

/**
 * **I due modi si chiamano «Impara» e «Pianificazione».**
 *
 * Rinominati il 2026-09-03. Il rischio di una rinomina non è sbagliare i nomi: è
 * **dimenticarne un pezzo**, e restare con un'app che chiama la stessa cosa in due modi.
 * È quello che stava succedendo — due testi su otto mi erano sfuggiti al primo giro, e li
 * hanno trovati i test di altri componenti per caso, non un controllo.
 *
 * Qui il controllo c'è: si guarda il testo **reso a schermo** dei due punti dove i modi si
 * nominano, e non deve contenere le parole vecchie. Gli identificatori interni restano
 * `learn` e `track` di proposito (sono scritti in ogni itinerario salvato), e questo test
 * non li guarda: guarda cosa legge una persona.
 *
 * ## Perché la ricerca non usa il confine di parola
 *
 * `textContent` **incolla** i testi di elementi adiacenti: due bottoni vicini diventano
 * `ImparaTrack`, senza spazio in mezzo. Cercando con il confine di parola non c'è nessun confine fra la `a` e la `T`, quindi la parola vecchia non veniva trovata: la prima versione di questo guardiano
 * passava anche con «Track» ancora a schermo — un test che certificava esattamente il
 * difetto che esiste per impedire. Verificato rimettendo il nome vecchio su un bottone.
 */
describe('i nomi dei due modi', () => {
  beforeEach(() => {
    useUIStore.setState({ profilo: 'imparo' });
  });

  test('l interruttore mostra Impara e Pianificazione', () => {
    render(<ModeSwitch />);
    expect(screen.getByRole('tab', { name: 'Impara' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pianificazione' })).toBeInTheDocument();
  });

  test('nell interruttore non resta nessuna parola inglese', () => {
    const { container } = render(<ModeSwitch />);
    expect(container.textContent).not.toMatch(/Learn|Track/);
  });

  /**
   * La guida è il posto dove i modi si spiegano: se qui restasse il nome vecchio, chi
   * impara leggerebbe di un interruttore che non esiste.
   */
  test('nella guida non resta nessuna parola inglese, in nessun passo', () => {
    const { container } = render(<LearnTutorial />);
    // Si scorrono tutti i passi: il nome vecchio poteva restare in uno solo.
    for (let i = 0; i < 12; i++) {
      expect(container.textContent).not.toMatch(/Learn|Track/);
      const avanti = screen.queryByRole('button', { name: /Avanti|Altre funzionalit/ });
      if (avanti == null) break;
      fireEvent.click(avanti);
    }
  });

  /**
   * Il riscontro dopo la scelta del livello nomina la modalità attiva: era il testo che
   * mi era sfuggito, e diceva «Modalità Learn attiva» sotto un interruttore che intanto
   * si chiamava «Impara».
   */
  test('la conferma della scelta nomina il modo col nome nuovo', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /sto imparando/i }));
    expect(screen.getByText(/Modalità «Impara» attiva/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sono esperto/i }));
    expect(screen.getByText(/Modalità «Pianificazione» attiva/)).toBeInTheDocument();
  });

  /**
   * Due controlli che si chiamano entrambi "modalità" — il profilo («Modalità: Imparo») e
   * questo — erano indistinguibili per chi naviga a voce. Il nome accessibile di questo
   * dice cosa decide davvero.
   */
  test('il gruppo dei modi ha un nome che non si confonde col profilo', () => {
    render(<ModeSwitch />);
    const gruppo = screen.getByRole('tablist');
    expect(gruppo.getAttribute('aria-label')).not.toMatch(/^Modalità app$/);
    expect(gruppo.getAttribute('aria-label')).toMatch(/valori/i);
  });
});
