// next/server importa API (Request/Response) assenti in jsdom: mock minimo,
// solo per questo file di test, senza toccare jest.config.
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

jest.mock('@/lib/fires-proxy', () => ({ fetchFiresUpstream: jest.fn() }));
jest.mock('@/lib/dpc-discovery', () => ({ discoverLatestBulletin: jest.fn() }));

import { fetchFiresUpstream } from '@/lib/fires-proxy';
import { discoverLatestBulletin } from '@/lib/dpc-discovery';

const firesRoute = require('@/app/api/fires/route');
const dpcRoute = require('@/app/api/dpc-alerts/route');

type JsonResponse = { body: unknown; status: number };

describe('route API emergenza — rendering dinamico forzato', () => {
  test('/api/fires esporta dynamic = force-dynamic', () => {
    expect(firesRoute.dynamic).toBe('force-dynamic');
  });
  test('/api/dpc-alerts esporta dynamic = force-dynamic', () => {
    expect(dpcRoute.dynamic).toBe('force-dynamic');
  });
});

/**
 * Prima l'unico test su queste route asseriva una costante (`dynamic`), quindi il
 * mapping degli handler non era coperto: invertire `result.data` con `result.error`,
 * o togliere `{ status: result.status }` trasformando ogni fallimento in un 200,
 * lasciava tutta la suite verde.
 */
describe('GET /api/fires', () => {
  beforeEach(() => (fetchFiresUpstream as jest.Mock).mockReset());

  test('200: restituisce i dati, non l\'errore', async () => {
    const data = { points: [{ lat: 42, lon: 13 }], fetchedAt: '2026-08-26T07:00:00Z' };
    (fetchFiresUpstream as jest.Mock).mockResolvedValue({ status: 200, data });
    const res = (await firesRoute.GET()) as JsonResponse;
    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });

  test('503 (chiave mancante): propaga status ed errore, senza nomi di variabili d\'ambiente', async () => {
    (fetchFiresUpstream as jest.Mock).mockResolvedValue({
      status: 503, error: 'Layer non disponibile su questa installazione',
    });
    const res = (await firesRoute.GET()) as JsonResponse;
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Layer non disponibile su questa installazione' });
    expect(JSON.stringify(res.body)).not.toMatch(/FIRMS_MAP_KEY/);
  });

  test('502 (upstream giù): propaga lo status, non un 200', async () => {
    (fetchFiresUpstream as jest.Mock).mockResolvedValue({ status: 502, error: 'FIRMS non raggiungibile' });
    const res = (await firesRoute.GET()) as JsonResponse;
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'FIRMS non raggiungibile' });
  });
});

describe('GET /api/dpc-alerts', () => {
  beforeEach(() => (discoverLatestBulletin as jest.Mock).mockReset());

  test('200: restituisce le informazioni del bollettino', async () => {
    const data = {
      bulletinId: '20260825_1415',
      topojsonToday: 'https://example.invalid/today.json',
      topojsonTomorrow: 'https://example.invalid/tomorrow.json',
    };
    (discoverLatestBulletin as jest.Mock).mockResolvedValue({ status: 200, data });
    const res = (await dpcRoute.GET()) as JsonResponse;
    expect(res.status).toBe(200);
    expect(res.body).toEqual(data);
  });

  test('502: propaga lo status e un messaggio in italiano', async () => {
    (discoverLatestBulletin as jest.Mock).mockResolvedValue({
      status: 502, error: 'Bollettino DPC non raggiungibile',
    });
    const res = (await dpcRoute.GET()) as JsonResponse;
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Bollettino DPC non raggiungibile' });
    expect(JSON.stringify(res.body)).not.toMatch(/HTTP|GitHub|abort|ENOTFOUND/i);
  });
});
