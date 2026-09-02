import { render, screen, fireEvent, act } from '@testing-library/react';
import { EmergencyRadarLayer } from '@/components/map/emergency/EmergencyRadarLayer';
import { useEmergencyStore } from '@/stores/emergencyStore';
import type { RadarIndex } from '@/lib/radar-api';

const indice: RadarIndex = {
  host: 'https://tilecache.test',
  frames: [
    { timeISO: '2026-08-27T15:00:00.000Z', path: '/f1' },
    { timeISO: '2026-08-27T15:10:00.000Z', path: '/f2' },
    { timeISO: '2026-08-27T15:20:00.000Z', path: '/f3' },
  ],
};

beforeEach(() => {
  useEmergencyStore.setState({ radar: indice, radarFrame: -1, radarPlaying: false });
});

const urlTile = () => screen.getByTestId('tile-layer').getAttribute('data-url');

/** Gli strati a schermo, come li vedrebbe l'occhio: URL e opacita'. */
const strati = () => screen.queryAllByTestId('tile-layer').map((el) => ({
  url: el.getAttribute('data-url') ?? '',
  opacita: Number(el.getAttribute('data-opacity') ?? '0'),
}));

/** Gli strati che si VEDONO: opacita' sopra zero. */
const visibili = () => strati().filter((s) => s.opacita > 0);

/**
 * Fa passare il tempo **a passettini**.
 *
 * Un unico `advanceTimersByTime` grosso esegue tutti i timer di fila senza che React
 * riesca a rendere in mezzo: gli effetti che partono da un timer (qui: la richiesta dei
 * tile del fotogramma nuovo) restano in coda fino alla fine del salto, e si misurerebbe
 * un'animazione ferma che nel browser scorre. Il browser alterna timer e rendering, e
 * questo lo imita.
 */
const avanza = (ms: number) => {
  for (let t = 0; t < ms; t += 25) act(() => { jest.advanceTimersByTime(25); });
};

/**
 * Il radar gratuito mostra **il passato**: `nowcast` è vuoto (misurato). Il valore sta
 * nell'animazione — da dove arriva la cella e dove va — e nell'orario, che deve essere
 * sempre leggibile perché nessuno creda di guardare "adesso".
 */
describe('layer radar', () => {
  test('parte dal fotogramma più recente', () => {
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toContain('/f3/');
  });

  test('un indice scelto a mano viene rispettato', () => {
    useEmergencyStore.setState({ radarFrame: 0 });
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toContain('/f1/');
  });

  // Un indice oltre la fine (l'indice si accorcia fra due aggiornamenti) non deve
  // produrre un URL con `undefined` dentro.
  test('un indice fuori scala non rompe l\'URL', () => {
    useEmergencyStore.setState({ radarFrame: 99 });
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toContain('/f3/');
    expect(urlTile()).not.toMatch(/undefined/);
  });

  test('l\'URL porta i segnaposto dei tile e il pane dedicato', () => {
    render(<EmergencyRadarLayer radar={indice} />);
    expect(urlTile()).toMatch(/\{z\}\/\{x\}\/\{y\}/);
    expect(screen.getByTestId('tile-layer').getAttribute('data-pane')).toBe('emergency');
  });

  test('in riproduzione avanza di un fotogramma e riparte da capo', () => {
    jest.useFakeTimers();
    useEmergencyStore.setState({ radarFrame: 1, radarPlaying: true });
    render(<EmergencyRadarLayer radar={indice} />);
    avanza(700);
    expect(useEmergencyStore.getState().radarFrame).toBe(2);
    // Il passo successivo arriva solo **dopo** che il fotogramma chiesto ha caricato:
    // e' quello che tiene la pioggia continua, e il mock del layer emette `load` come
    // Leaflet, cioe' poco dopo la richiesta.
    avanza(700);
    expect(useEmergencyStore.getState().radarFrame).toBe(0);
    jest.useRealTimers();
  });

  /**
   * **La pioggia non deve sparire fra un fotogramma e l'altro.**
   *
   * Segnalato il 2026-09-02: «tra un frame e l'altro c'è l'effetto che la zona di pioggia
   * sparisce e riappare». Qui si guarda la cosa esatta di cui si lamentava l'occhio: quanti
   * strati sono visibili, a ogni istante dell'animazione.
   */
  describe('la pioggia non lampeggia', () => {
    test('mentre il fotogramma nuovo carica, quello vecchio resta a schermo', () => {
      jest.useFakeTimers();
      useEmergencyStore.setState({ radarFrame: 1, radarPlaying: true });
      render(<EmergencyRadarLayer radar={indice} />);
      // Un istante dopo la richiesta del fotogramma nuovo, prima che abbia caricato.
      avanza(700 + 25);
      expect(useEmergencyStore.getState().radarFrame).toBe(2);
      const mostrati = visibili();
      expect(mostrati).toHaveLength(1);
      // Ed e' ancora il VECCHIO: il nuovo si carica invisibile.
      expect(mostrati[0].url).toContain('/f2/');
      expect(strati().some((s) => s.url.includes('/f3/') && s.opacita === 0)).toBe(true);
      jest.useRealTimers();
    });

    test('a caricamento finito si scambia, e non restano due strati sovrapposti', () => {
      jest.useFakeTimers();
      useEmergencyStore.setState({ radarFrame: 1, radarPlaying: true });
      render(<EmergencyRadarLayer radar={indice} />);
      avanza(700 + 100);
      const mostrati = visibili();
      expect(mostrati).toHaveLength(1);
      expect(mostrati[0].url).toContain('/f3/');
      jest.useRealTimers();
    });

    /**
     * Il difetto vero era un **istante** senza niente a schermo, non uno stato finale
     * sbagliato: si vedeva solo guardando la mappa. Qui l'animazione si percorre a
     * passettini e si pretende che a ogni passo ci sia sempre esattamente uno strato
     * visibile — mai zero (il lampeggio), mai due (la sovrapposizione).
     */
    test('a ogni istante di un giro completo si vede uno e un solo strato', () => {
      jest.useFakeTimers();
      useEmergencyStore.setState({ radarFrame: 0, radarPlaying: true });
      render(<EmergencyRadarLayer radar={indice} />);
      const conteggi = new Set<number>();
      const passati = new Set<string>();
      for (let t = 0; t < 4000; t += 25) {
        act(() => { jest.advanceTimersByTime(25); });
        conteggi.add(visibili().length);
        visibili().forEach((s) => passati.add(s.url));
      }
      expect(Array.from(conteggi)).toEqual([1]);
      // E l'animazione ha girato per davvero: tutti e tre i fotogrammi sono passati a
      // schermo. Senza questa riga il test passerebbe anche con l'animazione ferma.
      expect(passati.size).toBe(3);
      jest.useRealTimers();
    });

    /**
     * **Uno strato non si smonta per cambiare fotogramma.** Era la causa del lampeggio:
     * con `key` legata al fotogramma, React distruggeva il layer e Leaflet lo ricreava
     * vuoto. Gli strati sono due e restano due — cambia solo il loro URL.
     */
    test('gli strati non vengono ricreati a ogni fotogramma', () => {
      jest.useFakeTimers();
      useEmergencyStore.setState({ radarFrame: 0, radarPlaying: true });
      render(<EmergencyRadarLayer radar={indice} />);
      avanza(3000);
      // Due, non uno per fotogramma passato.
      expect(strati()).toHaveLength(2);
      jest.useRealTimers();
    });
  });

  test('fermata l\'animazione, il timer non resta acceso', () => {
    jest.useFakeTimers();
    useEmergencyStore.setState({ radarFrame: 0, radarPlaying: true });
    const { unmount } = render(<EmergencyRadarLayer radar={indice} />);
    unmount();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(useEmergencyStore.getState().radarFrame).toBe(0);
    jest.useRealTimers();
  });
});

/**
 * Trascinare lo slider mentre l'animazione scorre rende il controllo inutilizzabile:
 * il fotogramma cambia sotto le dita.
 */
describe('controllo dei fotogrammi', () => {
  test('scegliere un fotogramma ferma l\'animazione', () => {
    useEmergencyStore.setState({ radarPlaying: true });
    useEmergencyStore.getState().setRadarFrame(1);
    expect(useEmergencyStore.getState().radarPlaying).toBe(false);
    expect(useEmergencyStore.getState().radarFrame).toBe(1);
  });

  test('gli indici restano dentro i limiti', () => {
    useEmergencyStore.getState().setRadarFrame(-5);
    expect(useEmergencyStore.getState().radarFrame).toBe(0);
    useEmergencyStore.getState().setRadarFrame(50);
    expect(useEmergencyStore.getState().radarFrame).toBe(2);
  });

  test('senza fotogrammi non si sposta nulla', () => {
    useEmergencyStore.setState({ radar: null, radarFrame: -1 });
    useEmergencyStore.getState().setRadarFrame(2);
    expect(useEmergencyStore.getState().radarFrame).toBe(-1);
  });
});
