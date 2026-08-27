import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyLocationButton } from '@/components/map/MyLocationButton';
import { LocationSearch } from '@/components/map/LocationSearch';
import { RulerTool } from '@/components/map/RulerTool';
import { __resetDomEvent, __isClickDisabled, __isScrollGuarded } from './__mocks__/leaflet';
import { __fireMapEvent } from './__mocks__/react-leaflet';

jest.mock('@/lib/elevation-api', () => ({
  fetchElevation: jest.fn().mockResolvedValue(120),
  fetchElevationProfile: jest.fn(),
}));

jest.mock('@/lib/geocoding-api', () => ({ searchLocation: jest.fn().mockResolvedValue([]) }));

/**
 * Regressione riportata dall'utente: il tocco sul mirino del GPS, in basso a destra,
 * piazzava un waypoint. Gli overlay React vivono DENTRO `MapContainer`, quindi un
 * click che risale arriva a `.leaflet-container`, Leaflet non trova un layer bersaglio
 * e spara il `click` della mappa — che `MapEvents` interpreta come "aggiungi waypoint".
 *
 * Il pulsante di emergenza e il cestino avevano già la guardia; il mirino, la ricerca,
 * il righello e la bussola no. Il difetto non è di un componente: è di **ogni** overlay
 * che venga aggiunto senza la guardia, ed è la ragione per cui questi test coprono
 * l'elenco invece di un caso solo.
 */
describe('guardia di propagazione: ogni overlay sopra la mappa', () => {
  beforeEach(() => {
    __resetDomEvent();
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 44.5, longitude: 11.3, accuracy: 12 } } as GeolocationPosition),
      },
      configurable: true,
    });
  });

  test('mirino GPS: Leaflet scarta il click, quindi nessun waypoint', () => {
    render(<MyLocationButton />);
    expect(__isClickDisabled(screen.getByRole('button', { name: /la mia posizione/i }))).toBe(true);
  });

  // L'altra metà dell'invariante: la guardia non deve rendere il pulsante inerte.
  // Fermare la propagazione DOM del click soddisferebbe il test sopra e romperebbe
  // questo, perché React 18 ascolta in delega su un antenato della mappa.
  test('mirino GPS: resta cliccabile per React', async () => {
    render(<MyLocationButton />);
    fireEvent.click(screen.getByRole('button', { name: /la mia posizione/i }));
    // La posizione arriva subito dal mock: compare il riquadro con le coordinate.
    await waitFor(() => expect(screen.getByText(/LA MIA POSIZIONE/)).toBeInTheDocument());
  });

  test('riquadro delle coordinate: guardato anche lui', async () => {
    render(<MyLocationButton />);
    fireEvent.click(screen.getByRole('button', { name: /la mia posizione/i }));
    const etichetta = await screen.findByText(/LA MIA POSIZIONE/);
    // Il riquadro è l'antenato con la guardia: Leaflet risale gli antenati del
    // bersaglio, quindi coprirlo copre anche "Chiudi" e "Copia coordinate".
    const riquadro = etichetta.closest('div[aria-live]');
    expect(__isClickDisabled(riquadro as HTMLElement)).toBe(true);
    expect(__isClickDisabled(screen.getByRole('button', { name: /chiudi/i }))).toBe(true);
    expect(__isClickDisabled(screen.getByRole('button', { name: /copia coordinate/i }))).toBe(true);
  });

  test('ricerca località: guardata, e la rotellina non zooma la mappa', () => {
    const { container } = render(<LocationSearch />);
    const overlay = container.firstElementChild as HTMLElement;
    expect(__isClickDisabled(overlay)).toBe(true);
    expect(__isScrollGuarded(overlay)).toBe(true);
  });

  // La ref della ricerca fa due cose (guardia + rilevamento del click fuori):
  // se la combinazione si rompesse, il campo resterebbe senza guardia.
  test('ricerca località: il campo resta digitabile', () => {
    render(<LocationSearch mobileSearchOpen />);
    const campo = screen.getByRole('combobox');
    fireEvent.change(campo, { target: { value: 'Corno Grande' } });
    expect((campo as HTMLInputElement).value).toBe('Corno Grande');
  });

  test('righello: il riquadro delle misure non lascia passare il click', async () => {
    render(<RulerTool active onDeactivate={() => {}} />);
    // Il riquadro compare col primo punto ("Clicca il secondo punto").
    __fireMapEvent('click', { latlng: { lat: 44.5, lng: 11.3 } });
    const riquadro = await screen.findByText(/Clicca il secondo punto/);
    expect(__isClickDisabled(riquadro)).toBe(true);
  });
});
