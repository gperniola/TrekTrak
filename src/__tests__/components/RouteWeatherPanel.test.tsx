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
  const temperature_2m: number[] = [];
  for (let h = 0; h < 24; h++) {
    time.push(`${giorno}T${String(h).padStart(2, '0')}:00`);
    const pomeriggio = h >= 12 && h <= 18;
    cape.push(pomeriggio ? 1400 : 50);
    weather_code.push(pomeriggio ? 95 : 0);
    wind_gusts_10m.push(pomeriggio ? 65 : 12);
    precipitation_probability.push(pomeriggio ? 80 : 5);
    temperature_2m.push(pomeriggio ? 28 : 11);
  }
  return { time, cape, weather_code, wind_gusts_10m, precipitation_probability, temperature_2m };
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
      temperature_2m: [...oggi.temperature_2m, ...domani.temperature_2m],
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

/**
 * **L'iconcina del cielo per ogni waypoint**, chiesta il 2026-09-02: «per ogni waypoint
 * appaia anche la previsione per quel punto per quell'ora».
 *
 * Il dato c'era gia' — il codice WMO serviva a riconoscere i temporali — e non arrivava
 * mai a schermo: l'utente vedeva tre colonne di numeri e doveva immaginarsi il cielo.
 */
describe('il cielo di ogni punto', () => {
  const giornoUTC = (scarto: number) => {
    const d = new Date();
    d.setDate(d.getDate() + scarto);
    return d.toISOString().slice(0, 10);
  };
  const serieDelGiorno = (codice: number, temp: number) => {
    const time: string[] = [];
    const cape: number[] = [];
    const weather_code: number[] = [];
    const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    const temperature_2m: number[] = [];
    for (const giorno of [giornoUTC(0), giornoUTC(1)]) {
      for (let h = 0; h < 24; h++) {
        time.push(`${giorno}T${String(h).padStart(2, '0')}:00`);
        cape.push(0); wind_gusts_10m.push(5); precipitation_probability.push(0);
        weather_code.push(codice); temperature_2m.push(temp);
      }
    }
    return { time, cape, weather_code, wind_gusts_10m, precipitation_probability, temperature_2m };
  };

  test('mostra la parola del cielo e la temperatura di quell ora', async () => {
    const serie = serieDelGiorno(3, 11.4); // coperto, 11,4 gradi
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [2000, 2200, 2400] });
    render(<RouteWeatherPanel />);
    // La parola c'e' per i lettori di schermo: l'emoji da sola verrebbe letta come
    // "sun behind cloud", che non e' una previsione.
    await waitFor(() => expect(screen.getAllByText('coperto').length).toBeGreaterThan(0));
    expect(screen.getAllByText('11°').length).toBeGreaterThan(0);
  });

  /**
   * Un codice che non si conosce si scrive **n/d**. Il difetto da evitare e' il sole
   * disegnato di default: questo progetto lo ha gia' corretto in altre forme, e qui
   * significherebbe far partire qualcuno col brutto tempo.
   */
  test('un codice che non si conosce diventa n/d, non sereno', async () => {
    const serie = serieDelGiorno(4, Number.NaN); // 4 non esiste nella WMO 4677
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getAllByText('n/d').length).toBeGreaterThan(0));
    expect(screen.queryByText('sereno')).not.toBeInTheDocument();
  });

  test('la legenda spiega solo le icone che si vedono', async () => {
    const serie = serieDelGiorno(0, 15); // tutto sereno
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getAllByText('sereno').length).toBeGreaterThan(0));
    // "coperto" non compare da nessuna parte: la legenda non e' un manuale della WMO.
    expect(screen.queryByText('coperto')).not.toBeInTheDocument();
  });

  /**
   * **Quando la previsione non e' della quota del punto, si dichiara.**
   *
   * MISURATO il 2026-09-02: la maglia di Cima delle Murelle (2596 m) sta a 1257 m, che
   * fa sei gradi e mezzo di differenza. Succede quando all'itinerario mancano le quote,
   * perche' allora non si possono chiedere al servizio.
   */
  test('dichiara quando il modello ha risposto per un altra quota', async () => {
    const serie = serieDelGiorno(0, 26);
    // I waypoint stanno a 2000-2400 m; il modello risponde per 1257 m.
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [1257, 1257, 1257] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getByText(/più\s+in basso del punto/i)).toBeInTheDocument());
    expect(screen.getByText(/1\.143 m/)).toBeInTheDocument();
  });

  test('se le quote coincidono non avvisa di niente', async () => {
    const serie = serieDelGiorno(0, 15);
    fetchRouteForecast.mockResolvedValue({ serie: [serie, serie, serie], elevations: [2000, 2200, 2400] });
    render(<RouteWeatherPanel />);
    await waitFor(() => expect(screen.getAllByText('sereno').length).toBeGreaterThan(0));
    expect(screen.queryByText(/in basso del punto/i)).not.toBeInTheDocument();
  });
});
