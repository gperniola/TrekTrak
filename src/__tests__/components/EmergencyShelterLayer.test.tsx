import { render, screen, act } from '@testing-library/react';
import { EmergencyShelterLayer } from '@/components/map/emergency/EmergencyShelterLayer';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { __setMapZoom } from './__mocks__/react-leaflet';
import type { Riparo } from '@/lib/shelters-api';

const fetchShelters = jest.fn();
jest.mock('@/lib/shelters-api', () => ({
  ...jest.requireActual('@/lib/shelters-api'),
  fetchShelters: (...a: unknown[]) => fetchShelters(...a),
}));

const riparo = (id: string, over: Partial<Riparo> = {}): Riparo => ({
  id, lat: 46.4, lon: 11.8, name: `Rifugio ${id}`, tipo: 'rifugio', capacity: null, phone: null, ...over,
});

beforeEach(() => {
  fetchShelters.mockReset().mockResolvedValue({ shelters: [riparo('a')], troncato: false });
  useEmergencyStore.setState({
    shelters: null,
    layers: { ...useEmergencyStore.getState().layers, shelters: { status: 'loading', error: null, lastFetch: null } },
  });
  __setMapZoom(13);
});

/**
 * Overpass non regge una query nazionale, e durante la verifica ha risposto 504 due
 * volte su tre: il layer si interroga sull'area inquadrata e deve dire cosa succede,
 * perché "nessun riparo" e "servizio occupato" sono due cose diversissime per chi sta
 * cercando dove ripararsi.
 */
describe('layer dei ripari', () => {
  test('a zoom utile interroga la vista e riporta i ripari', async () => {
    render(<EmergencyShelterLayer shelters={null} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetchShelters).toHaveBeenCalledTimes(1);
    const bbox = fetchShelters.mock.calls[0][0] as { south: number; north: number };
    expect(bbox.south).toBeLessThan(bbox.north);
    expect(useEmergencyStore.getState().shelters).toHaveLength(1);
    expect(useEmergencyStore.getState().layers.shelters.status).toBe('ready');
  });

  // "Avvicinati" non è un errore: la fonte non è stata nemmeno interrogata, e dirlo
  // evita di far credere che in zona non ci sia nulla.
  test('a zoom troppo largo non interroga e lo dice', async () => {
    __setMapZoom(8);
    render(<EmergencyShelterLayer shelters={null} />);
    await act(async () => { await Promise.resolve(); });
    expect(fetchShelters).not.toHaveBeenCalled();
    const l = useEmergencyStore.getState().layers.shelters;
    expect(l.status).toBe('nodata');
    expect(l.error).toMatch(/avvicinati/i);
  });

  test('un servizio occupato diventa un messaggio, non un layer vuoto', async () => {
    fetchShelters.mockRejectedValue(new Error('Il servizio dei ripari è occupato: riprova fra poco'));
    render(<EmergencyShelterLayer shelters={null} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const l = useEmergencyStore.getState().layers.shelters;
    expect(l.status).toBe('error');
    expect(l.error).toMatch(/occupato/i);
  });

  test('disegna un marker per riparo', () => {
    render(<EmergencyShelterLayer shelters={[riparo('a'), riparo('b', { tipo: 'bivacco' })]} />);
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
  });

  test('il popup dice il tipo e avverte che OSM non garantisce apertura', () => {
    render(<EmergencyShelterLayer shelters={[riparo('a', { capacity: 40, phone: '+39 000' })]} />);
    expect(screen.getByText(/40 posti/)).toBeInTheDocument();
    expect(screen.getByText(/non sono verificati/i)).toBeInTheDocument();
  });

  test('senza nome mostra il tipo, non un nome inventato', () => {
    render(<EmergencyShelterLayer shelters={[riparo('a', { name: null, tipo: 'ricovero' })]} />);
    // Il tipo compare due volte: come titolo (al posto del nome mancante) e come
    // sottotitolo. Quello che conta e' che il titolo NON sia un nome inventato.
    const titolo = screen.getByText('Ricovero', { selector: '.font-bold' });
    expect(titolo).toBeInTheDocument();
  });

  test('smontando non resta una richiesta che scrive nello store', async () => {
    let risolvi: (v: { shelters: Riparo[]; troncato: boolean }) => void = () => {};
    fetchShelters.mockReturnValue(new Promise<{ shelters: Riparo[]; troncato: boolean }>((r) => { risolvi = r; }));
    const { unmount } = render(<EmergencyShelterLayer shelters={null} />);
    unmount();
    await act(async () => { risolvi({ shelters: [riparo('tardivo')], troncato: false }); await Promise.resolve(); });
    expect(useEmergencyStore.getState().shelters).toBeNull();
  });
});
