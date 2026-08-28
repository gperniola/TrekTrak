import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouteWeatherPanel } from '@/components/weather/RouteWeatherPanel';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Waypoint, Leg } from '@/lib/types';

const fetchRouteForecast = jest.fn();
jest.mock('@/lib/weather-api', () => ({
  ATTRIBUZIONE_METEO: 'Previsione: Open-Meteo',
  fetchRouteForecast: (...a: unknown[]) => fetchRouteForecast(...a),
}));

const wp = (i: number): Waypoint => ({
  id: `w${i}`, name: `Punto ${i}`, lat: 46.4 + i / 100, lon: 11.8 + i / 100,
  altitude: 2000 + i * 200, order: i,
});
const leg = (i: number, minuti: number): Leg => ({
  id: `l${i}`, fromWaypointId: `w${i}`, toWaypointId: `w${i + 1}`,
  distance: 3, azimuth: 90, elevationGain: 400, elevationLoss: 0, estimatedTime: minuti,
});

/** 24 ore con CAPE alto dalle 12 alle 18 UTC. */
function serieConTemporalePomeridiano(giorno: string) {
  const time: string[] = [];
  const cape: number[] = [];
  const weather_code: number[] = [];
  const wind_gusts_10m: number[] = [];
  const precipitation_probability: number[] = [];
  for (let h = 0; h < 24; h++) {
    time.push(`${giorno}T${String(h).padStart(2, '0')}:00`);
    const pomeriggio = h >= 12 && h <= 18;
    cape.push(pomeriggio ? 1400 : 50);
    weather_code.push(pomeriggio ? 95 : 0);
    wind_gusts_10m.push(pomeriggio ? 65 : 12);
    precipitation_probability.push(pomeriggio ? 80 : 5);
  }
  return { time, cape, weather_code, wind_gusts_10m, precipitation_probability };
}

beforeEach(() => {
  fetchRouteForecast.mockReset();
  useUIStore.setState({ weatherOpen: true });
  useItineraryStore.setState({ waypoints: [wp(0), wp(1), wp(2)], legs: [leg(0, 180), leg(1, 240)] });
});

/**
 * Il pannello risponde alla domanda che nessuna app meteo può fare: **cosa incontro, e
 * a che ora**. Perché sia utile deve incrociare la previsione con gli orari stimati,
 * non limitarsi a mostrare il meteo del posto.
 */
describe('Meteo del percorso', () => {
  /**
   * La previsione finta copre **oggi e domani**, non solo domani.
   *
   * `defaultDeparture` sceglie oggi prima delle 10 e domani dalle 10 in poi: con la
   * sola giornata di domani questi test erano verdi il pomeriggio e **rossi ogni
   * mattina**, con il pannello che diceva "Previsione non disponibile" invece del
   * verdetto. Trovato eseguendo `npm run check` alle 09:55.
   *
   * Coprendo entrambi i giorni l'orario di partenza cade sempre dentro la serie,
   * qualunque sia l'ora dell'esecuzione, e il temporale pomeridiano resta davanti
   * alla partenza in tutti e due i casi.
   */
  const giornoUTC = (scarto: number) => {
    const d = new Date();
    d.setDate(d.getDate() + scarto);
    return d.toISOString().slice(0, 10);
  };
  const serieOggiEDomani = () => {
    const oggi = serieConTemporalePomeridiano(giornoUTC(0));
    const domani = serieConTemporalePomeridiano(giornoUTC(1));
    return {
      time: [...oggi.time, ...domani.time],
      cape: [...oggi.cape, ...domani.cape],
      weather_code: [...oggi.weather_code, ...domani.weather_code],
      wind_gusts_10m: [...oggi.wind_gusts_10m, ...domani.wind_gusts_10m],
      precipitation_probability: [
        ...oggi.precipitation_probability,
        ...domani.precipitation_probability,
      ],
    };
  };

  test('chiede la previsione per i punti del percorso e mostra una riga per punto', async () => {
    const serie = serieOggiEDomani();
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [2000, 2200, 2400] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(fetchRouteForecast).toHaveBeenCalled());
    const punti = fetchRouteForecast.mock.calls[0][0] as { lat: number }[];
    expect(punti).toHaveLength(3);
    await waitFor(() => expect(screen.getByText(/1\. Punto 0/)).toBeInTheDocument());
    expect(screen.getByText(/3\. Punto 2/)).toBeInTheDocument();
  });

  test('il verdetto dice dove sei quando la previsione peggiora', async () => {
    const serie = serieOggiEDomani();
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    const verdetto = screen.getByRole('status').textContent || '';
    expect(verdetto).toMatch(/Attenzione|Rischio/i);
    expect(verdetto).toMatch(/Punto \d/);
  });

  // Il numero dei punti interrogati va dichiarato: altrimenti si crede che il dato sia
  // stato calcolato per ogni waypoint, e non e' vero.
  test('dichiara su quanti punti è campionata e che le pause non sono contate', async () => {
    const serie = serieOggiEDomani();
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getByText(/campionata su 3 punti/i)).toBeInTheDocument());
    expect(screen.getByText(/non\s+contano le pause/i)).toBeInTheDocument();
  });

  test('cambiare ora di partenza ricalcola', async () => {
    const serie = serieOggiEDomani();
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(fetchRouteForecast).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/ora di partenza/i), { target: { value: '5' } });
    await waitFor(() => expect(fetchRouteForecast.mock.calls.length).toBeGreaterThan(1));
    // gli orari mostrati seguono la nuova partenza: si guarda la cella della tabella,
    // non l'opzione del menu a tendina che porta lo stesso testo
    await waitFor(() => {
      const celle = screen.getAllByRole('cell').map((c) => c.textContent);
      expect(celle).toContain('05:00');
    });
  });

  test('alba, tramonto e buio sono sempre presenti (calcolo locale, nessuna rete)', async () => {
    fetchRouteForecast.mockResolvedValue({ serie: [], elevations: [] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getByText(/Tramonto/)).toBeInTheDocument());
    expect(screen.getByText(/Alba/)).toBeInTheDocument();
    expect(screen.getByText(/Buio/)).toBeInTheDocument();
  });

  test('un errore di rete si dice, e non si finge una previsione', async () => {
    fetchRouteForecast.mockRejectedValue(new Error('Previsione non disponibile in questo momento'));
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/non disponibile/i));
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('senza waypoint con coordinate lo dice invece di chiamare la rete', async () => {
    useItineraryStore.setState({ waypoints: [{ ...wp(0), lat: null, lon: null }], legs: [] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getByText(/Aggiungi almeno un waypoint con coordinate/i)).toBeInTheDocument());
    expect(fetchRouteForecast).not.toHaveBeenCalled();
  });

  test('la parte didattica spiega il CAPE e la regola 30/30', async () => {
    fetchRouteForecast.mockResolvedValue({ serie: [], elevations: [] });
    render(<RouteWeatherPanel />);
    fireEvent.click(screen.getByRole('button', { name: /come si legge/i }));
    expect(screen.getByText(/energia disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/30\/30/)).toBeInTheDocument();
  });

  test('dice che è una previsione e non sostituisce i canali ufficiali', async () => {
    fetchRouteForecast.mockResolvedValue({ serie: [], elevations: [] });
    render(<RouteWeatherPanel />);
    expect(screen.getByText(/non sostituisce i canali ufficiali/i)).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo/)).toBeInTheDocument();
  });

  test('chiudendo si azzera il flag nello store', async () => {
    fetchRouteForecast.mockResolvedValue({ serie: [], elevations: [] });
    render(<RouteWeatherPanel />);
    fireEvent.click(screen.getByRole('button', { name: /chiudi meteo/i }));
    expect(useUIStore.getState().weatherOpen).toBe(false);
  });
});
