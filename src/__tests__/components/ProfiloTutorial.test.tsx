import { render, screen, fireEvent } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

/**
 * TERZO giro di review, il rilievo peggiore per posizione: **la guida di primo avvio
 * raccontava funzioni che il profilo appena scelto aveva nascosto**.
 *
 * La scelta del livello ("Sto imparando" / "Sono esperto") sta al passo 0 di questa
 * stessa guida e decide il profilo. Chi rispondeva «sono esperto» si vedeva subito
 * spiegare, nei due schermi successivi, l'interruttore Learn/Track e il pulsante
 * «Verifica» — le due cose che l'app gli aveva appena tolto — e piu' avanti il Quiz.
 * Simmetricamente, a chi imparava la guida prometteva «Copia link», che in Imparo non c'e'.
 *
 * I primi quattro schermi dell'app erano il posto in assoluto peggiore per l'esatta
 * confusione che questo lavoro esisteva per togliere.
 */
describe('review 3: la guida segue il profilo', () => {
  beforeEach(() => {
    localStorage.clear();
    useItineraryStore.setState({ appMode: 'learn' });
    useUIStore.setState({ profilo: 'montagna' });
  });

  /** Percorre tutta la guida, continuazione opzionale compresa, e raccoglie il testo. */
  function tuttoIlTesto(): string {
    let testo = '';
    for (;;) {
      testo += ' ' + (document.body.textContent ?? '');
      const altre = screen.queryByText(/Altre funzionalità/);
      if (altre) { fireEvent.click(altre); continue; }
      const avanti = screen.queryByText('Avanti');
      if (!avanti || screen.queryByText('Inizia!')) {
        testo += ' ' + (document.body.textContent ?? '');
        return testo;
      }
      fireEvent.click(avanti);
    }
  }

  /*
    Il profilo si fissa nello store: la scelta all'ingresso non esiste piu' (2026-09-05),
    il default e' Montagna e la palestra si attiva dalla carta nelle altre funzionalita'.
  */
  test('in Montagna la guida non parla di Verifica, Learn/Track e Quiz', () => {
    render(<LearnTutorial />);
    const testo = tuttoIlTesto();
    expect(testo).not.toMatch(/Verifica e feedback/);
    expect(testo).not.toMatch(/Learn e Track/);
    expect(testo).not.toMatch(/Il Quiz/);
    // e al loro posto racconta le funzioni che quel profilo ha davvero
    expect(testo).toMatch(/Pronto per la gita/);
  });

  test('in Imparo la guida non promette Copia link', () => {
    useUIStore.setState({ profilo: 'imparo' });
    useItineraryStore.setState({ appMode: 'learn' });
    render(<LearnTutorial />);
    const testo = tuttoIlTesto();
    expect(testo).not.toMatch(/Copia link/);
    expect(testo).not.toMatch(/Pronto per la gita/);
    // e le sue funzioni ci sono tutte
    expect(testo).toMatch(/Impara e Pianificazione/);
    expect(testo).toMatch(/Verifica e feedback/);
    expect(testo).toMatch(/Il Quiz/);
  });

  /**
   * Il primo contatto e' la sequenza iniziale dei passi essenziali del profilo, non un
   * numero fisso: quattro in Imparo (benvenuto, waypoint, Learn/Track, Verifica), tre in
   * Montagna (benvenuto, waypoint, «Pronto per la gita»).
   */
  test('i passi del primo contatto contano solo quelli del profilo', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<LearnTutorial />);
    expect(screen.getByText(/Passo 1 di 4/)).toBeInTheDocument();
  });

  test('in Montagna sono tre, e il terzo e quello della gita', () => {
    render(<LearnTutorial />);
    expect(screen.getByText(/Passo 1 di 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    expect(screen.getByText('Pronto per la gita')).toBeInTheDocument();
    // ultimo essenziale: compare la continuazione opzionale
    expect(screen.getByText(/Altre funzionalità/)).toBeInTheDocument();
  });

  /**
   * Il disegnino della barra strumenti mostrava sempre quiz e interruttore Learn/Track:
   * in Montagna era il disegno di una barra che non esiste.
   */
  test('il disegnino della barra non mostra quiz e modi in Montagna', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText('Avanti'));
    fireEvent.click(screen.getByText(/Altre funzionalità/));
    // Il primo passo avanzato ora e' la palestra: gli strumenti sono quello dopo.
    fireEvent.click(screen.getByText('Avanti'));
    expect(screen.getByText('Strumenti mappa')).toBeInTheDocument();
    expect(screen.queryByText('Impara')).not.toBeInTheDocument();
    expect(screen.queryByText('Pianificazione')).not.toBeInTheDocument();
  });
});
