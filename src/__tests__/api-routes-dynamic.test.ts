// next/server importa API (Request/Response) assenti in jsdom: mock minimo,
// solo per questo file di test, senza toccare jest.config.
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const firesRoute = require('@/app/api/fires/route');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dpcRoute = require('@/app/api/dpc-alerts/route');

describe('route API emergenza — rendering dinamico forzato', () => {
  test('/api/fires esporta dynamic = force-dynamic', () => {
    expect(firesRoute.dynamic).toBe('force-dynamic');
  });
  test('/api/dpc-alerts esporta dynamic = force-dynamic', () => {
    expect(dpcRoute.dynamic).toBe('force-dynamic');
  });
});
