import { useEmergencyStore } from '@/stores/emergencyStore';

jest.mock('@/lib/emergency-api', () => ({
  fetchFiresClient: jest.fn(),
  fetchDpcClient: jest.fn(),
}));
import { fetchFiresClient, fetchDpcClient } from '@/lib/emergency-api';

jest.mock('@/stores/notificationStore', () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));
import { toast } from '@/stores/notificationStore';

const firesOk = { points: [{ lat: 42, lon: 13, frp: 5, confidence: 'nominal', acquiredAt: '2026-08-25T09:00:00Z', satellite: 'N20' }], fetchedAt: '2026-08-25T10:00:00Z' };
const dpcOk = { bulletinId: '20260825_1415', issuedLabel: '25/08 14:15', days: [{ date: '2026-08-25', zones: [] }, { date: '2026-08-26', zones: [] }] };

// helper: attende i micro-task pendenti con i fake timers attivi
const flush = () => new Promise((r) => { setTimeout(r, 0); jest.advanceTimersByTime(0); });

describe('emergencyStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (fetchFiresClient as jest.Mock).mockReset().mockResolvedValue(firesOk);
    (fetchDpcClient as jest.Mock).mockReset().mockResolvedValue(dpcOk);
    (toast.error as jest.Mock).mockClear();
    // reset stato tra i test (stopLayer riporta i layer a idle; qui azzeriamo anche i dati
    // top-level, altrimenti dpc/dpcSelectedDate/fires di un test "sopravvivono" al successivo)
    const s = useEmergencyStore.getState();
    (['fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts'] as const).forEach((id) => s.stopLayer(id));
    useEmergencyStore.setState({ fires: null, dpc: null, dpcSelectedDate: null });
  });
  afterEach(() => jest.useRealTimers());

  test('startLayer(points): loading → ready con dati', async () => {
    useEmergencyStore.getState().startLayer('fires-hotspots');
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).toBe('loading');
    await flush();
    const st = useEmergencyStore.getState();
    expect(st.layers['fires-hotspots'].status).toBe('ready');
    expect(st.fires?.points).toHaveLength(1);
  });

  test('startLayer è idempotente (secondo start non rifetcha)', async () => {
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    await flush();
    s.startLayer('fires-hotspots');
    await flush();
    expect(fetchFiresClient).toHaveBeenCalledTimes(1);
  });

  test('layer wms: ready immediato senza fetch', () => {
    useEmergencyStore.getState().startLayer('fires-fwi');
    expect(useEmergencyStore.getState().layers['fires-fwi'].status).toBe('ready');
    expect(fetchFiresClient).not.toHaveBeenCalled();
  });

  test('auto-refresh: dopo refreshMinutes rifetcha', async () => {
    useEmergencyStore.getState().startLayer('fires-hotspots');
    await flush();
    jest.advanceTimersByTime(15 * 60 * 1000 + 100);
    await flush();
    expect(fetchFiresClient).toHaveBeenCalledTimes(2);
  });

  test('stopLayer ferma il refresh', async () => {
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    await flush();
    s.stopLayer('fires-hotspots');
    jest.advanceTimersByTime(60 * 60 * 1000);
    await flush();
    expect(fetchFiresClient).toHaveBeenCalledTimes(1);
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).toBe('idle');
  });

  test('errore al refresh con dati presenti: dati mantenuti + status error', async () => {
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    await flush();
    (fetchFiresClient as jest.Mock).mockRejectedValue(new Error('rete giù'));
    await s.refreshLayer('fires-hotspots');
    const st = useEmergencyStore.getState();
    expect(st.layers['fires-hotspots'].status).toBe('error');
    expect(st.layers['fires-hotspots'].error).toBe('rete giù');
    expect(st.fires?.points).toHaveLength(1);
  });

  test('dpc: imposta dpcSelectedDate col default e non lo sovrascrive se valido', async () => {
    jest.setSystemTime(new Date('2026-08-25T10:00:00'));
    const s = useEmergencyStore.getState();
    s.startLayer('dpc-alerts');
    await flush();
    expect(useEmergencyStore.getState().dpcSelectedDate).toBe('2026-08-25');
    s.setDpcSelectedDate('2026-08-26');
    await s.refreshLayer('dpc-alerts');
    expect(useEmergencyStore.getState().dpcSelectedDate).toBe('2026-08-26');
  });

  test('isStale: true oltre 2× refreshMinutes', async () => {
    useEmergencyStore.getState().startLayer('fires-hotspots');
    await flush();
    expect(useEmergencyStore.getState().isStale('fires-hotspots')).toBe(false);
    (fetchFiresClient as jest.Mock).mockRejectedValue(new Error('giù'));
    jest.advanceTimersByTime(31 * 60 * 1000);
    expect(useEmergencyStore.getState().isStale('fires-hotspots')).toBe(true);
  });

  test('refresh in volo: stopLayer prima del resolve scarta il risultato tardivo', async () => {
    let resolveFetch!: (v: typeof firesOk) => void;
    (fetchFiresClient as jest.Mock).mockImplementation(
      () => new Promise((res) => { resolveFetch = res; })
    );
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).toBe('loading');

    s.stopLayer('fires-hotspots');
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).toBe('idle');

    resolveFetch(firesOk); // il fetch in volo risolve DOPO lo stop
    await flush();

    const st = useEmergencyStore.getState();
    expect(st.layers['fires-hotspots'].status).toBe('idle'); // non riportato a 'ready' dal risultato tardivo
    expect(st.fires).toBeNull();
  });

  test('refresh in volo che fallisce dopo stopLayer: nessun toast e stato resta idle', async () => {
    let rejectFetch!: (e: Error) => void;
    (fetchFiresClient as jest.Mock).mockImplementation(
      () => new Promise((_res, rej) => { rejectFetch = rej; })
    );
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    s.stopLayer('fires-hotspots');

    rejectFetch(new Error('rete giù')); // fallisce DOPO lo stop
    await flush();

    expect(toast.error).not.toHaveBeenCalled();
    expect(useEmergencyStore.getState().layers['fires-hotspots'].status).toBe('idle');
  });

  test('errore al refresh: toast.error una sola volta anche su fallimenti consecutivi', async () => {
    const s = useEmergencyStore.getState();
    s.startLayer('fires-hotspots');
    await flush();
    (fetchFiresClient as jest.Mock).mockRejectedValue(new Error('rete giù'));
    await s.refreshLayer('fires-hotspots');
    await s.refreshLayer('fires-hotspots');
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  test('dpc: errore al refresh mantiene dpc e dpcSelectedDate invariati', async () => {
    jest.setSystemTime(new Date('2026-08-25T10:00:00'));
    const s = useEmergencyStore.getState();
    s.startLayer('dpc-alerts');
    await flush();
    const before = useEmergencyStore.getState();
    expect(before.dpc).toEqual(dpcOk);
    expect(before.dpcSelectedDate).toBe('2026-08-25');

    (fetchDpcClient as jest.Mock).mockRejectedValue(new Error('bollettino giù'));
    await s.refreshLayer('dpc-alerts');

    const st = useEmergencyStore.getState();
    expect(st.layers['dpc-alerts'].status).toBe('error');
    expect(st.layers['dpc-alerts'].error).toBe('bollettino giù');
    expect(st.dpc).toEqual(dpcOk);
    expect(st.dpcSelectedDate).toBe('2026-08-25');
  });
});
