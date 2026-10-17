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

function composito(giorno: string, sensore: 'terra' | 'aqua'): CompositoMattonella {
  const riassunto: RiassuntoMattonella = {
    giorni: [giorno], sensori: [sensore], dati: 1, nessunDato: 0, nonPubblicati: 0, errori: 0,
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
    // jsdom non ha la tela 2D ne' `ImageData`: si finge quel tanto che basta per contare i disegni.
    HTMLCanvasElement.prototype.getContext = (() => ({ putImageData })) as unknown as typeof getContextOriginale;
    (globalThis as { ImageData?: unknown }).ImageData = class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = getContextOriginale;
    (globalThis as { ImageData?: unknown }).ImageData = imageDataOriginale;
  });

  beforeEach(() => {
    __resetGridLayers();
    putImageData.mockClear();
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
