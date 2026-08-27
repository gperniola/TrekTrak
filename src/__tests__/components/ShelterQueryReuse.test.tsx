import { render, act } from '@testing-library/react';
import { EmergencyShelterLayer } from '@/components/map/emergency/EmergencyShelterLayer';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { __setMapZoom, __setMapBounds, __fireMapEvent } from './__mocks__/react-leaflet';
import type { BBox, Riparo } from '@/lib/shelters-api';

const fetchShelters = jest.fn();
jest.mock('@/lib/shelters-api', () => ({
  ...jest.requireActual('@/lib/shelters-api'),
  fetchShelters: (...a: unknown[]) => fetchShelters(...a),
}));

const riparo: Riparo = {
  id: 'n1', lat: 46.4, lon: 11.8, name: 'Rifugio', tipo: 'rifugio', capacity: null, phone: null,
};

beforeEach(() => {
  fetchShelters.mockReset().mockResolvedValue({ shelters: [riparo], troncato: false });
  __setMapZoom(13);
  __setMapBounds({ south: 46.3, west: 11.7, north: 46.5, east: 11.9 });
  useEmergencyStore.setState({
    shelters: null,
    layers: { ...useEmergencyStore.getState().layers, shelters: { status: 'loading', error: null, lastFetch: null } },
  });
});

const attendi = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

/**
 * Overpass è un servizio pubblico condiviso che durante la verifica ha risposto 504:
 * ogni richiesta evitata è un errore in meno mostrato all'utente, per gli stessi ripari.
 */
describe('ripari: le richieste non si ripetono inutilmente', () => {
  test('la prima volta scarica un\'area più larga della vista', async () => {
    render(<EmergencyShelterLayer shelters={null} />);
    await attendi();
    expect(fetchShelters).toHaveBeenCalledTimes(1);
    const b = fetchShelters.mock.calls[0][0] as BBox;
    // margine del 25% per lato: uno spostamento breve non deve costringere a richiedere
    expect(b.south).toBeLessThan(46.3);
    expect(b.north).toBeGreaterThan(46.5);
  });

  test('uno spostamento dentro l\'area già scaricata non richiede nulla', async () => {
    jest.useFakeTimers();
    render(<EmergencyShelterLayer shelters={[riparo]} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(fetchShelters).toHaveBeenCalledTimes(1);

    // piccolo pan: resta dentro l'area con margine
    __setMapBounds({ south: 46.32, west: 11.72, north: 46.48, east: 11.88 });
    act(() => { __fireMapEvent('moveend', {}); });
    act(() => { jest.advanceTimersByTime(1500); });
    expect(fetchShelters).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('uscendo dall\'area si richiede', async () => {
    jest.useFakeTimers();
    render(<EmergencyShelterLayer shelters={[riparo]} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    __setMapBounds({ south: 45.0, west: 10.0, north: 45.2, east: 10.2 });
    act(() => { __fireMapEvent('moveend', {}); });
    act(() => { jest.advanceTimersByTime(1500); });
    expect(fetchShelters).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  // Allontanandosi oltre la soglia l'area va dimenticata: altrimenti riavvicinandosi
  // si crederebbe di avere già i dati di una zona che non è stata mai scaricata.
  test('allontanandosi oltre la soglia l\'area scaricata si dimentica', async () => {
    jest.useFakeTimers();
    render(<EmergencyShelterLayer shelters={[riparo]} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(fetchShelters).toHaveBeenCalledTimes(1);

    __setMapZoom(8);
    act(() => { __fireMapEvent('zoomend', {}); });
    act(() => { jest.advanceTimersByTime(1500); });
    expect(useEmergencyStore.getState().layers.shelters.status).toBe('nodata');

    // si torna esattamente sulla vista iniziale: deve richiedere di nuovo
    __setMapZoom(13);
    act(() => { __fireMapEvent('zoomend', {}); });
    act(() => { jest.advanceTimersByTime(1500); });
    expect(fetchShelters).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
