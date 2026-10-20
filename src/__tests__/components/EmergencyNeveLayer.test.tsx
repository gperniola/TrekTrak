import { render, act } from '@testing-library/react';
import { EmergencyNeveLayer } from '@/components/map/emergency/EmergencyNeveLayer';
import { useEmergencyStore } from '@/stores/emergencyStore';
import type { CompositoMattonella, RiassuntoMattonella } from '@/lib/neve-composito';
import type { SorgenteNeve } from '@/lib/neve-sorgente';
import { SENZA_NEVE } from '@/lib/snow-cover';
import { __gridLayers, __resetGridLayers, type GridLayer } from './__mocks__/leaflet';

/**
 * Il pannello descrive **solo le mattonelle a schermo** (Review Focus 5), e un layer
 * spento o rimontato non scrive piu' niente (Review Focus 2).
 *
 * La sorgente qui e' finta e **non rispetta l'annullo**: le promesse le risolve il test.
 * E' la corsa che la sorgente vera non esclude — la composizione z8 e' condivisa fra le
 * mattonelle, quindi puo' essere gia' risolta quando una mattonella esce dallo schermo, e
 * la continuazione della mattonella arriva dopo il suo `tileunload`. Senza la guardia,
 * quella mattonella entrerebbe nel riassunto DOPO esserne uscita e ci resterebbe fino al
 * ridisegno: il pannello descriverebbe una mattonella che non si vede.
 */

interface Attesa { risolvi: (c: CompositoMattonella) => void }

function sorgenteFinta() {
  const attese = new Map<string, Attesa>();
  const sorgente: SorgenteNeve = {
    mattonella: (z, x, y) => new Promise<CompositoMattonella>((risolvi) => {
      attese.set(`${z}/${x}/${y}`, { risolvi });
    }),
    punto: () => Promise.reject(new Error('non usato')),
    rinnova: jest.fn(),
    dimensioneCache: () => 0,
  };
  return { sorgente, risolvi: (chiave: string, c: CompositoMattonella) => attese.get(chiave)!.risolvi(c) };
}

/** Quando si e' guardato GIBS per comporre le mattonelle del test. */
const COMPOSTA_ALLE = Date.parse('2026-10-16T06:00:00Z');

function composito(giorno: string, sensore: 'terra' | 'aqua', alle = COMPOSTA_ALLE): CompositoMattonella {
  const riassunto: RiassuntoMattonella = {
    giorni: [giorno], sensori: [sensore], dati: 1, nessunDato: 0, nonPubblicati: 0, errori: 0, alle,
  };
  return {
    codici: new Int8Array(256 * 256).fill(SENZA_NEVE),
    origine: new Int8Array(256 * 256).fill(0),
    passaggi: [],
    colori: new Uint8Array(101 * 3),
    riassunto,
  };
}

// Due mattonelle z8 (sotto lo zoom 9 il ritaglio e' la mattonella stessa), con giorni e
// sensori diversi: dal riassunto nello store si capisce quali mattonelle descrive.
const A = { z: 8, x: 137, y: 94 };
const B = { z: 8, x: 138, y: 94 };
const DI_A = () => composito('2026-10-14', 'terra');
const DI_B = () => composito('2026-10-16', 'aqua');

/** Lascia girare le continuazioni delle promesse risolte. */
const svuota = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const strato = (): GridLayer => {
  const l = __gridLayers();
  expect(l).toHaveLength(1);
  return l[0];
};

describe('il layer neve sulla mappa', () => {
  const putImageData = jest.fn();
  const getContextOriginale = HTMLCanvasElement.prototype.getContext;
  const imageDataOriginale = (globalThis as { ImageData?: unknown }).ImageData;

  beforeAll(() => {
    // jsdom non ha la tela 2D ne' `ImageData`: si finge quel tanto che basta per contare i
    // disegni, e per sapere su quale tela (`canvas`, come nel contesto vero).
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
      return { canvas: this, putImageData };
    } as unknown as typeof getContextOriginale;
    (globalThis as { ImageData?: unknown }).ImageData = class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = getContextOriginale;
    (globalThis as { ImageData?: unknown }).ImageData = imageDataOriginale;
  });

  /** La tela su cui e' stato fatto l'i-esimo disegno. */
  const telaDelDisegno = (i: number) => (putImageData.mock.contexts[i] as { canvas: HTMLCanvasElement }).canvas;

  beforeEach(() => {
    __resetGridLayers();
    putImageData.mockReset();
    const s = useEmergencyStore.getState();
    s.stopLayer('snow-cover');
    s.startLayer('snow-cover');
  });

  afterEach(() => {
    useEmergencyStore.getState().stopLayer('snow-cover');
  });

  // Il controllo che la prova funziona: senza questo, i due test sotto passerebbero
  // anche con un layer che non riferisce mai niente.
  test('una mattonella composta finisce nel riassunto del pannello', async () => {
    const f = sorgenteFinta();
    render(<EmergencyNeveLayer sorgente={f.sorgente} />);
    act(() => { strato().__crea(B); });

    f.risolvi('8/138/94', DI_B());
    await svuota();

    const st = useEmergencyStore.getState();
    expect(st.layers['snow-cover'].status).toBe('ready');
    expect(st.neve).toMatchObject({ da: '2026-10-16', a: '2026-10-16', sensori: ['aqua'] });
    expect(putImageData).toHaveBeenCalledTimes(1);
  });

  test('una mattonella uscita dallo schermo esce anche dal riassunto', async () => {
    const f = sorgenteFinta();
    render(<EmergencyNeveLayer sorgente={f.sorgente} />);
    let tileA: HTMLElement;
    act(() => { tileA = strato().__crea(A); strato().__crea(B); });
    f.risolvi('8/137/94', DI_A());
    f.risolvi('8/138/94', DI_B());
    await svuota();
    expect(useEmergencyStore.getState().neve).toMatchObject({ da: '2026-10-14', a: '2026-10-16' });

    act(() => { strato().__togli(tileA); });

    expect(useEmergencyStore.getState().neve).toMatchObject({ da: '2026-10-16', a: '2026-10-16', sensori: ['aqua'] });
  });

  /**
   * Ogni uscita riferisce di nuovo il riassunto: se lo store ci scrivesse `Date.now()`, dopo
   * il risveglio del telefono uno spostamento della mappa direbbe «Aggiornato alle <adesso>»
   * su mattonelle composte ore prima, e il layer non diventerebbe mai «vecchio».
   */
  test('una mattonella che esce non porta «Aggiornato alle» ad adesso', async () => {
    const ora = jest.spyOn(Date, 'now');
    try {
      const f = sorgenteFinta();
      render(<EmergencyNeveLayer sorgente={f.sorgente} />);
      let tileA: HTMLElement;
      act(() => { strato().__crea(B); tileA = strato().__crea(A); });
      f.risolvi('8/138/94', DI_B());
      await svuota();
      expect(useEmergencyStore.getState().layers['snow-cover'].lastFetch).toBe(COMPOSTA_ALLE);

      ora.mockReturnValue(COMPOSTA_ALLE + 3 * 3_600_000);
      act(() => { strato().__togli(tileA); }); // A carica ancora: lo spostamento la toglie

      expect(useEmergencyStore.getState().layers['snow-cover'].lastFetch).toBe(COMPOSTA_ALLE);
    } finally {
      ora.mockRestore();
    }
  });

  /** Review Focus 5: uscita **durante il caricamento**. */
  test('una mattonella che esce mentre carica non entra nel riassunto, e non si disegna', async () => {
    const f = sorgenteFinta();
    render(<EmergencyNeveLayer sorgente={f.sorgente} />);
    let tileA: HTMLElement;
    act(() => { tileA = strato().__crea(A); strato().__crea(B); });

    act(() => { strato().__togli(tileA); });
    // La composizione condivisa arriva lo stesso, dopo che la mattonella e' uscita.
    f.risolvi('8/137/94', DI_A());
    f.risolvi('8/138/94', DI_B());
    await svuota();

    const neve = useEmergencyStore.getState().neve;
    expect(neve).toMatchObject({ da: '2026-10-16', a: '2026-10-16', sensori: ['aqua'] });
    // Disegnata solo B: la tela di A non e' piu' a schermo.
    expect(putImageData).toHaveBeenCalledTimes(1);
  });

  /**
   * Se il disegno lancia (una tela persa, memoria finita), Leaflet deve saperlo lo stesso:
   * senza `done` aspetterebbe questa mattonella per sempre.
   */
  test('se il disegno lancia, Leaflet riceve comunque done con l errore', async () => {
    const f = sorgenteFinta();
    render(<EmergencyNeveLayer sorgente={f.sorgente} />);
    const done = jest.fn();
    let tile: HTMLElement;
    act(() => { tile = strato().__crea(B, done); });
    putImageData.mockImplementationOnce(() => { throw new Error('tela persa'); });

    f.risolvi('8/138/94', DI_B());
    await svuota();

    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(expect.any(Error), tile!);
  });

  /**
   * L'aggiornamento orario si fa **sul posto**. Con `redraw()` Leaflet toglieva tutte le tele
   * insieme e le nuove restavano nascoste fino al loro `done`: ogni ora la neve spariva
   * dalla mappa per secondi (decine, su una rete di montagna) col pannello che diceva «pronto».
   */
  describe('aggiornamento orario', () => {
    const ORA = 60 * 60 * 1000;
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { jest.useRealTimers(); });

    test('ridipinge le stesse tele senza toglierle, dopo aver chiesto dati nuovi', async () => {
      const f = sorgenteFinta();
      render(<EmergencyNeveLayer sorgente={f.sorgente} />);
      let tileB: HTMLElement;
      act(() => { tileB = strato().__crea(B); });
      f.risolvi('8/138/94', DI_B());
      await svuota();
      expect(putImageData).toHaveBeenCalledTimes(1);
      const scaricate = jest.fn();
      strato().on('tileunload', scaricate);

      act(() => { jest.advanceTimersByTime(ORA); });
      expect(f.sorgente.rinnova).toHaveBeenCalledTimes(1);
      // Prima di ricomporre: le tele restano a schermo col disegno di prima.
      expect(scaricate).not.toHaveBeenCalled();

      const piuTardi = COMPOSTA_ALLE + ORA;
      f.risolvi('8/138/94', composito('2026-10-17', 'terra', piuTardi));
      await svuota();

      expect(scaricate).not.toHaveBeenCalled();
      expect(strato().mattonelle.map((m) => m.tile)).toEqual([tileB!]);
      expect(putImageData).toHaveBeenCalledTimes(2);
      expect(telaDelDisegno(1)).toBe(tileB!);
      // Il riassunto si aggiorna con la stessa chiave: descrive la mattonella una volta sola.
      const st = useEmergencyStore.getState();
      expect(st.neve).toMatchObject({ da: '2026-10-17', a: '2026-10-17', sensori: ['terra'], alle: piuTardi });
      expect(st.layers['snow-cover'].lastFetch).toBe(piuTardi);
    });

    test('una mattonella che esce durante l aggiornamento non si ridipinge e non rientra nel riassunto', async () => {
      const f = sorgenteFinta();
      render(<EmergencyNeveLayer sorgente={f.sorgente} />);
      let tileA: HTMLElement;
      act(() => { tileA = strato().__crea(A); strato().__crea(B); });
      f.risolvi('8/137/94', DI_A());
      f.risolvi('8/138/94', DI_B());
      await svuota();
      expect(putImageData).toHaveBeenCalledTimes(2);

      act(() => { jest.advanceTimersByTime(ORA); });
      act(() => { strato().__togli(tileA); });
      // La composizione condivisa arriva lo stesso, dopo che la mattonella e' uscita.
      f.risolvi('8/137/94', DI_A());
      f.risolvi('8/138/94', DI_B());
      await svuota();

      expect(putImageData).toHaveBeenCalledTimes(3);
      expect(telaDelDisegno(2)).not.toBe(tileA!);
      expect(useEmergencyStore.getState().neve).toMatchObject({ da: '2026-10-16', a: '2026-10-16', sensori: ['aqua'] });
    });
  });

  /**
   * Review Focus 2, al livello del componente. Il «Riprova» spegne e riaccende il layer
   * (stato 'loading', riassunto vuoto) e poi React smonta il layer vecchio: lo sgombero
   * delle sue mattonelle e una composizione che arriva dopo non devono dichiararlo pronto
   * con le date di prima.
   */
  test('smontato dopo il Riprova, il layer vecchio non scrive piu nello store', async () => {
    const f = sorgenteFinta();
    const { unmount } = render(<EmergencyNeveLayer sorgente={f.sorgente} />);
    // A per prima e ancora in caricamento, B composta: togliendo A, B resterebbe a schermo.
    act(() => { strato().__crea(A); strato().__crea(B); });
    f.risolvi('8/138/94', DI_B());
    await svuota();
    expect(useEmergencyStore.getState().layers['snow-cover'].status).toBe('ready');

    act(() => { useEmergencyStore.getState().retryLayer('snow-cover'); });
    unmount();
    f.risolvi('8/137/94', DI_A());
    await svuota();

    const st = useEmergencyStore.getState();
    expect(st.layers['snow-cover'].status).toBe('loading');
    expect(st.neve).toBeNull();
  });
});
