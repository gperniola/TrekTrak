import { render, screen, act } from '@testing-library/react';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { mostra } from '@/lib/profilo';

/**
 * Primo giro di review sul profilo d'uso. Il difetto cercato e' sempre lo stesso, quello
 * che questo lavoro esisteva per evitare: **un'area chiusa in un ingresso e aperta in un
 * altro**. La tabella e la guardia del Task 12 controllano che un'area sia applicata
 * *almeno una volta*; non che sia applicata in *tutti* i suoi ingressi.
 */
describe('review 1: i secondi ingressi delle aree', () => {
  beforeEach(() => {
    const s = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...s, mapDisplay: { ...s.mapDisplay, emergencyLayers: ['rain-radar'] } },
    });
    useUIStore.setState({
      profilo: 'montagna',
      quizActive: false, progressOpen: false, weatherOpen: false, emergencyPanelOpen: false,
    });
  });

  /**
   * I layer sulla mappa sono il TERZO ingresso dei layer di emergenza, dopo il pulsante e
   * il pannello. Verificato a schermo prima della correzione: in Imparo il tile del radar
   * era ancora disegnato, l'attribuzione citava ancora RainViewer, e il pulsante per
   * spegnerlo non c'era piu' — un layer che scarica e che non si puo' togliere.
   */
  test('in Imparo i layer di emergenza non si montano sulla mappa', () => {
    useUIStore.setState({ profilo: 'imparo' });
    expect(mostra('layerEmergenza', useUIStore.getState().profilo)).toBe(false);
  });

  /**
   * Cambiando profilo, gli overlay che il nuovo profilo non prevede devono CHIUDERSI, non
   * solo smettere di disegnarsi: `backDepth` in page.tsx conta `quizActive`,
   * `progressOpen`, `weatherOpen` e `emergencyPanelOpen` per decidere quanti passi di
   * cronologia servono al tasto Indietro. Uno stato acceso e invisibile darebbe un passo
   * fantasma — la classe di difetto che costo' sei versioni (v0.10.5-v0.10.10).
   */
  test('passando a Montagna si chiudono quiz e progresso', () => {
    useUIStore.setState({ profilo: 'imparo', quizActive: true, progressOpen: true });
    act(() => useUIStore.getState().setProfilo('montagna'));
    expect(useUIStore.getState().quizActive).toBe(false);
    expect(useUIStore.getState().progressOpen).toBe(false);
  });

  test('passando a Imparo si chiudono meteo e pannello layer', () => {
    useUIStore.setState({ profilo: 'montagna', weatherOpen: true, emergencyPanelOpen: true });
    act(() => useUIStore.getState().setProfilo('imparo'));
    expect(useUIStore.getState().weatherOpen).toBe(false);
    expect(useUIStore.getState().emergencyPanelOpen).toBe(false);
  });

  test('quello che il profilo prevede resta aperto', () => {
    useUIStore.setState({ profilo: 'imparo', quizActive: true });
    act(() => useUIStore.getState().setProfilo('imparo'));
    expect(useUIStore.getState().quizActive).toBe(true);
  });

  /** L'avviso di allerta non deve nemmeno provare a scaricare in Imparo. */
  test('in Imparo l avviso di allerta non scarica', async () => {
    const manifest = jest.fn().mockResolvedValue({ giorni: [] });
    jest.doMock('@/lib/emergency-api', () => ({
      fetchDpcManifest: manifest,
      fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '1', issuedLabel: '', days: [] }),
      fetchFiresClient: jest.fn().mockResolvedValue({ points: [], fetchedAt: '' }),
    }));
    const { DpcPositionWarning } = await import('@/components/shared/DpcPositionWarning');
    const { usePositionStore } = await import('@/stores/positionStore');
    usePositionStore.setState({ lastKnown: { lat: 42, lon: 12, at: Date.now(), accuracy: 20 } });
    useUIStore.setState({ profilo: 'imparo' });
    render(<DpcPositionWarning />);
    await new Promise((r) => setTimeout(r, 50));
    expect(manifest).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
