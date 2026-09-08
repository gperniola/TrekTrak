import { render, screen, act } from '@testing-library/react';
import { UpdateBanner } from '@/components/shared/UpdateBanner';

/**
 * L'avviso di nuova versione. Col service worker in `skipWaiting`+`clientsClaim`, il SW
 * nuovo si attiva in silenzio: il segnale affidabile è `controllerchange` (il controller
 * della pagina è cambiato), non lo stato `installing`/`waiting` che spesso è già passato.
 */

interface FakeReg {
  waiting: unknown;
  installing: unknown;
  addEventListener: jest.Mock;
  update: jest.Mock;
}

function mockServiceWorker(controller: object | null) {
  const listeners: Record<string, Array<() => void>> = {};
  const reg: FakeReg = {
    waiting: null,
    installing: null,
    addEventListener: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const sw = {
    controller,
    addEventListener: (type: string, cb: () => void) => { (listeners[type] ||= []).push(cb); },
    removeEventListener: jest.fn(),
    getRegistration: jest.fn().mockResolvedValue(reg),
    fire: (type: string) => { (listeners[type] || []).forEach((cb) => cb()); },
    reg,
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
  return sw;
}

afterEach(() => {
  try { Reflect.deleteProperty(navigator, 'serviceWorker'); } catch { /* ignora */ }
});

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('UpdateBanner', () => {
  test('cambio di controller con uno già presente = aggiornamento → avvisa', async () => {
    const sw = mockServiceWorker({}); // c'era già un controller al montaggio
    render(<UpdateBanner />);
    await settle();
    expect(screen.queryByText(/nuova versione/i)).not.toBeInTheDocument();
    await act(async () => { sw.fire('controllerchange'); });
    expect(screen.getByText(/nuova versione/i)).toBeInTheDocument();
  });

  test('primissima installazione (nessun controller): il cambio di controller NON avvisa', async () => {
    const sw = mockServiceWorker(null);
    render(<UpdateBanner />);
    await settle();
    await act(async () => { sw.fire('controllerchange'); });
    expect(screen.queryByText(/nuova versione/i)).not.toBeInTheDocument();
  });

  test('chiede al browser di controllare gli aggiornamenti all’avvio', async () => {
    const sw = mockServiceWorker({});
    render(<UpdateBanner />);
    await settle();
    expect(sw.reg.update).toHaveBeenCalled();
  });
});
