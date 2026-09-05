import { render, screen, fireEvent, act } from '@testing-library/react';
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

  test('una riga per layer e nessuna intestazione di categoria come riga a se', () => {
    render(<EmergencyLayersPanel />);
    expect(screen.getAllByRole('switch')).toHaveLength(EMERGENCY_LAYERS.length);
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

  /**
   * **Accendere ora ESPANDE la riga** — regola cambiata su richiesta dell'utente il
   * 2026-09-04: «quando attivo un layer, fai aprire in automatico anche la tendina della
   * legenda; quando la disattivo, se e' aperta falla chiudere».
   *
   * Nella v0.14.0 questo test diceva il contrario, e la ragione era buona: i due bersagli
   * sulla riga sono distinti, e l'uno non deve fare il lavoro dell'altro. Ma la simmetria
   * fra i due gesti non e' vera: **espandere** e' una richiesta di leggere, **accendere**
   * e' una richiesta di vedere qualcosa sulla mappa — e i colori di questi layer non si
   * spiegano da soli (quattro classi di recenza per le aree bruciate, cinque di pericolo
   * per il FWI, e per l'instabilita' una scala che va al contrario del CAPE). Il momento
   * in cui la legenda serve e' esattamente quello in cui il layer compare.
   *
   * Il gesto opposto resta asimmetrico, ed e' giusto cosi': espandere **non** accende
   * (vedi il test sopra). Il dettaglio del comportamento sta in
   * `LegendaSegueInterruttore.test.tsx`.
   */
  test('accendere espande la riga, spegnere la richiude', async () => {
    render(<EmergencyLayersPanel />);
    const nome = () => screen.getByRole('button', { name: /Focolai attivi \(24h\)/ });
    const interruttore = () => screen.getByRole('switch', { name: 'Focolai attivi (24h)' });
    expect(nome()).toHaveAttribute('aria-expanded', 'false');
    await act(async () => { fireEvent.click(interruttore()); });
    expect(nome()).toHaveAttribute('aria-expanded', 'true');
    await act(async () => { fireEvent.click(interruttore()); });
    expect(nome()).toHaveAttribute('aria-expanded', 'false');
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

/**
 * "Aggiornato alle 09:29" era l'ora in cui avevamo chiesto NOI, non quella in cui e'
 * passato il satellite: due orari che possono distare ore, perche' il satellite passa
 * due volte al giorno. Segnalato da chi usa l'app.
 */
describe('l eta vera dei dati satellitari', () => {
  const TUTTI_2 = EMERGENCY_LAYERS.map((l) => l.id);

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
    TUTTI_2.forEach((id) => useEmergencyStore.getState().stopLayer(id));
    useEmergencyStore.setState({ fires: null, dpc: null, dpcSelectedDate: null });
  });

  afterEach(() => {
    TUTTI_2.forEach((id) => useEmergencyStore.getState().stopLayer(id));
  });

  const conFocolai = (acquisizioni: string[]) => {
    useEmergencyStore.setState({
      fires: {
        points: acquisizioni.map((acquiredAt) => ({
          lat: 41.9, lon: 12.5, frp: 3, confidence: 'nominal' as const, acquiredAt, satellite: 'N',
        })),
        fetchedAt: new Date().toISOString(),
      },
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-hotspots': { status: 'ready', error: null, lastFetch: Date.now() },
      },
      nowTick: Date.now(),
    });
  };
  const oreFa = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

  test('il dettaglio dice la finestra dei passaggi e l eta del piu recente', () => {
    attiva('fires-hotspots');
    conFocolai([oreFa(11), oreFa(2)]);
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Focolai attivi \(24h\)/ }));
    expect(screen.getByText(/Passaggi satellite/)).toBeInTheDocument();
    expect(screen.getByText(/2 h fa/)).toBeInTheDocument();
  });

  /** La distinzione e' il punto: uno e' quando abbiamo chiesto, l altro quando ha guardato. */
  test('l ora del download si chiama "Scaricato", non "Aggiornato"', () => {
    attiva('fires-hotspots');
    conFocolai([oreFa(2)]);
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Focolai attivi \(24h\)/ }));
    expect(screen.getByText(/Scaricato alle/)).toBeInTheDocument();
    expect(screen.queryByText(/Aggiornato alle/)).not.toBeInTheDocument();
  });

  test('dati freschi: nessun avviso a riga chiusa', () => {
    attiva('fires-hotspots');
    conFocolai([oreFa(2)]);
    render(<EmergencyLayersPanel />);
    expect(screen.queryByText(/ultimo passaggio del satellite/)).not.toBeInTheDocument();
  });

  /** Oltre le sei ore l'eta' qualifica il dato, quindi si dice senza aprire nulla. */
  test('oltre le sei ore lo dice a riga chiusa', () => {
    attiva('fires-hotspots');
    conFocolai([oreFa(9)]);
    render(<EmergencyLayersPanel />);
    expect(screen.getByText(/ultimo passaggio del satellite.*9 h fa/)).toBeInTheDocument();
  });

  test('gli altri layer non parlano di passaggi satellite', () => {
    attiva('dpc-alerts');
    conFocolai([oreFa(9)]);
    render(<EmergencyLayersPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Allerte meteo-idro \(DPC\)/ }));
    expect(screen.queryByText(/Passaggi satellite/)).not.toBeInTheDocument();
  });
});
