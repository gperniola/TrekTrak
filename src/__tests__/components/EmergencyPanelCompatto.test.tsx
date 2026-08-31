import { render, screen, fireEvent } from '@testing-library/react';
import { EmergencyLayersPanel } from '@/components/map/emergency/EmergencyLayersPanel';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_LAYERS } from '@/lib/emergency-layers';

jest.mock('@/stores/notificationStore', () => ({
  ...jest.requireActual('@/stores/notificationStore'),
  confirm: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn().mockResolvedValue({ points: [], fetchedAt: '2026-08-25T10:00:00Z' }),
  fetchDpcClient: jest.fn().mockResolvedValue({ bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [] }),
}));

/**
 * Il pannello era diventato illeggibile man mano che lo si usava: ogni layer acceso si
 * portava dietro per sempre la propria documentazione (descrizione, 2-6 voci di
 * legenda, riga di stato, comandi specifici).
 *
 * Misurato prima della modifica, su un telefono da 412x823 con cinque layer accesi:
 * **1044 px di contenuto in una finestra di 494 px**, 52 righe di testo, quattro
 * interruttori visibili su sette. Il pannello puniva chi lo usava.
 *
 * Ora e' un quadro di comando: sette righe, e il resto a richiesta. La regola che
 * decide cosa resta visibile a riga chiusa non e' "poco spazio" ma **"c'e' qualcosa da
 * sapere sull'attendibilita' del dato"**: errori, offline, dati parziali, assenza di
 * dati e dati non aggiornati restano; la legenda e l'orario di un layer che funziona
 * si comprimono.
 */
describe('pannello layer compatto', () => {
  const TUTTI = EMERGENCY_LAYERS.map((l) => l.id);

  const attiva = (...ids: string[]) => {
    const settings = useItineraryStore.getState().settings;
    useItineraryStore.setState({
      settings: { ...settings, mapDisplay: { ...settings.mapDisplay, emergencyLayers: ids as never } },
    });
  };

  beforeEach(() => {
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    useUIStore.setState({ emergencyPanelOpen: true });
    attiva();
    TUTTI.forEach((id) => useEmergencyStore.getState().stopLayer(id));
    useEmergencyStore.setState({ fires: null, dpc: null, dpcSelectedDate: null });
  });

  afterEach(() => {
    TUTTI.forEach((id) => useEmergencyStore.getState().stopLayer(id));
  });

  test('sette righe e nessuna intestazione di categoria come riga a se', () => {
    render(<EmergencyLayersPanel />);
    expect(screen.getAllByRole('switch')).toHaveLength(7);
    // le categorie non occupano piu' una riga ciascuna: l'emoji sta sulla riga
    expect(screen.queryByText(/^🔥 Incendi$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^🏠 Dove ripararsi$/)).not.toBeInTheDocument();
  });

  test('a riga chiusa la legenda non e nel DOM', () => {
    attiva('fires-hotspots');
    render(<EmergencyLayersPanel />);
    expect(screen.getByRole('switch', { name: 'Focolai attivi (24h)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Rilevato nelle ultime 6 ore')).not.toBeInTheDocument();
    expect(screen.queryByText(/Anomalie termiche/)).not.toBeInTheDocument();
  });

  test('toccando la riga si apre il dettaglio con legenda e descrizione', () => {
    attiva('fires-hotspots');
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Focolai attivi \(24h\)/ }));
    expect(screen.getByText('Rilevato nelle ultime 6 ore')).toBeInTheDocument();
    expect(screen.getByText(/Anomalie termiche/)).toBeInTheDocument();
  });

  test('una sola riga aperta per volta', () => {
    attiva('fires-hotspots', 'dpc-alerts');
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Focolai attivi \(24h\)/ }));
    expect(screen.getByText('Rilevato nelle ultime 6 ore')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Allerte meteo-idro \(DPC\)/ }));
    expect(screen.getByText('Allerta gialla')).toBeInTheDocument();
    expect(screen.queryByText('Rilevato nelle ultime 6 ore')).not.toBeInTheDocument();
  });

  test('un secondo tocco richiude la riga', () => {
    attiva('fires-hotspots');
    render(<EmergencyLayersPanel />);
    const riga = screen.getByRole('button', { name: /Focolai attivi \(24h\)/ });
    fireEvent.click(riga);
    expect(screen.getByText('Rilevato nelle ultime 6 ore')).toBeInTheDocument();
    fireEvent.click(riga);
    expect(screen.queryByText('Rilevato nelle ultime 6 ore')).not.toBeInTheDocument();
  });

  test('la riga dichiara se e aperta', () => {
    render(<EmergencyLayersPanel />);
    const riga = screen.getByRole('button', { name: /Focolai attivi \(24h\)/ });
    expect(riga).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(riga);
    expect(riga).toHaveAttribute('aria-expanded', 'true');
  });

  /** Due bersagli distinti sulla stessa riga: l'uno non deve fare il lavoro dell'altro. */
  test('espandere non accende il layer', () => {
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Focolai attivi \(24h\)/ }));
    expect(screen.getByRole('switch', { name: 'Focolai attivi (24h)' })).toHaveAttribute('aria-checked', 'false');
  });

  test('accendere non espande la riga', () => {
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getByRole('switch', { name: 'Focolai attivi (24h)' }));
    expect(screen.getByRole('button', { name: /Focolai attivi \(24h\)/ })).toHaveAttribute('aria-expanded', 'false');
  });

  /**
   * Il dettaglio si comprime quando tutto va bene, non quando c'e' qualcosa da sapere.
   * Un pallino rosso che non spiega niente e' l'errore che avevamo appena corretto
   * nella tabella del meteo.
   */
  describe('cio che qualifica il dato resta visibile a riga chiusa', () => {
    test('errore e Riprova', () => {
      attiva('fires-hotspots');
      useEmergencyStore.setState({
        layers: {
          ...useEmergencyStore.getState().layers,
          'fires-hotspots': { status: 'error', error: 'FIRMS non raggiungibile', lastFetch: null },
        },
      });
      render(<EmergencyLayersPanel />);
      expect(screen.getByText(/FIRMS non raggiungibile/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /riprova/i })).toBeInTheDocument();
      // e la legenda resta comunque compressa
      expect(screen.queryByText('Rilevato nelle ultime 6 ore')).not.toBeInTheDocument();
    });

    test('assenza di dati', () => {
      attiva('fires-hotspots');
      useEmergencyStore.setState({
        layers: {
          ...useEmergencyStore.getState().layers,
          'fires-hotspots': { status: 'nodata', error: 'nessun focolaio', lastFetch: Date.now() },
        },
      });
      render(<EmergencyLayersPanel />);
      expect(screen.getByText(/Nessun dato disponibile/)).toBeInTheDocument();
    });

    test('dati parziali', () => {
      attiva('fires-hotspots');
      useEmergencyStore.setState({
        layers: {
          ...useEmergencyStore.getState().layers,
          'fires-hotspots': { status: 'ready', error: null, lastFetch: Date.now(), partial: true },
        },
      });
      render(<EmergencyLayersPanel />);
      // il testo intero: /dati parziali/ da solo trova anche la parola di stato nel
      // nome accessibile della riga, che e' li' di proposito
      expect(screen.getByText(/dati parziali: alcune fonti non hanno risposto/)).toBeInTheDocument();
    });
  });

  /** L'orario di un layer che funziona e' materiale di consultazione: sta nel dettaglio. */
  test('l orario di aggiornamento sta nel dettaglio, non sulla riga chiusa', () => {
    attiva('fires-hotspots');
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-hotspots': { status: 'ready', error: null, lastFetch: Date.now() },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.queryByText(/Aggiornato alle/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Focolai attivi \(24h\)/ }));
    expect(screen.getByText(/Aggiornato alle/)).toBeInTheDocument();
  });

  /**
   * Il pallino di stato non puo' essere l'unico portatore dell'informazione: e' la
   * lezione del pallino `aria-hidden` nella tabella del meteo, di due giorni prima.
   */
  test('lo stato e nel nome accessibile della riga, non solo nel colore', () => {
    attiva('fires-hotspots');
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-hotspots': { status: 'error', error: 'FIRMS non raggiungibile', lastFetch: null },
      },
    });
    render(<EmergencyLayersPanel />);
    expect(screen.getByRole('button', { name: /Focolai attivi \(24h\).*errore/i })).toBeInTheDocument();
  });

  test('un layer spento non annuncia nessuno stato', () => {
    render(<EmergencyLayersPanel />);
    const riga = screen.getByRole('button', { name: /Focolai attivi \(24h\)/ });
    expect(riga.getAttribute('aria-label') ?? riga.textContent ?? '').not.toMatch(/aggiornato|errore|caricamento/i);
  });

  /**
   * L'icona di categoria porta il raggruppamento che prima facevano le intestazioni: se
   * l'ordine non e' raggruppato, l'icona non racconta niente. Nell'array le categorie
   * sono interlacciate — i ripari stanno fra due layer dei temporali — quindi
   * renderizzarlo cosi' com'e' spezzava i gruppi. Difetto trovato guardando lo schermo.
   */
  test('i layer della stessa categoria restano adiacenti', () => {
    render(<EmergencyLayersPanel />);
    const nomi = screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'));
    const categoriaDi = new Map(EMERGENCY_LAYERS.map((l) => [l.label, l.category]));
    const sequenza = nomi.map((n) => categoriaDi.get(n ?? ''));
    // ogni categoria compare in un solo blocco contiguo
    const blocchi = sequenza.filter((c, i) => c !== sequenza[i - 1]);
    expect(blocchi).toHaveLength(new Set(sequenza).size);
  });

  /** Avvertenza e fonti: due paragrafi in fondo, ora dietro una riga sola. */
  test('avvertenza e fonti sono richiudibili', () => {
    attiva('fires-hotspots');
    render(<EmergencyLayersPanel />);
    expect(screen.queryByText(/chiama il 112/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fonti e avvertenze/i }));
    expect(screen.getByText(/chiama il 112/)).toBeInTheDocument();
    expect(screen.getByText(/NASA FIRMS/)).toBeInTheDocument();
  });
});
