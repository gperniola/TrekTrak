import { render, screen, fireEvent } from '@testing-library/react';
import { ValidationBadge } from '@/components/validation/ValidationBadge';
import { buildRouteWeather, type PuntoInterrogato, type SerieOraria } from '@/lib/route-weather';
import type { Waypoint, Leg } from '@/lib/types';
import type { ValidationResult } from '@/lib/types';
import { useUIStore } from '@/stores/uiStore';

const mockFetchRouteForecast = jest.fn();
jest.mock('@/lib/weather-api', () => ({
  ATTRIBUZIONE_METEO: 'Previsione: Open-Meteo',
  fetchRouteForecast: (...a: unknown[]) => mockFetchRouteForecast(...a),
}));

/**
 * Tre modi in cui l'app diceva qualcosa di diverso da quello che sapeva. Non sono
 * difetti di calcolo: i numeri erano giusti, era la **frase** a essere sbagliata.
 * Trovati provando l'app a mano dopo la 0.13.2.
 */
/*
 * Profilo Imparo: dalla v0.15 la validazione e' un'area del profilo didattico, e col
 * profilo Montagna i badge non si montano affatto (i valori li calcola l'app, non c'e'
 * nulla da verificare). Questi test parlano dei badge, quindi vivono in Imparo.
 */
beforeEach(() => {
  useUIStore.setState({ profilo: 'imparo' });
});

describe('il dettaglio di validazione parla italiano', () => {
  const risultato = (over: Partial<ValidationResult> = {}): ValidationResult => ({
    status: 'error',
    realValue: 3.161,
    userValue: 2.4,
    delta: 0.761,
    tolerance: { strict: 0.05, loose: 0.1 },
    ...over,
  });

  /**
   * Era `Calcolato: 3.161 km`, che in italiano si legge 3161 km. La stessa stringa,
   * battuta in un campo in metri, l'app la interpreta proprio come 3161.
   */
  test('una distanza calcolata usa la virgola, non il punto', () => {
    render(<ValidationBadge result={risultato()} fieldType="distance" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/3,161 km/)).toBeInTheDocument();
    expect(screen.queryByText(/3\.161 km/)).not.toBeInTheDocument();
  });

  test('lo scarto di una distanza si legge in metri', () => {
    render(<ValidationBadge result={risultato()} fieldType="distance" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/761 m/)).toBeInTheDocument();
  });

  test('una quota oltre il migliaio ha il punto delle migliaia', () => {
    render(<ValidationBadge result={risultato({ realValue: 1500, userValue: 1200, delta: 300 })} fieldType="altitude" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/1\.500 m/)).toBeInTheDocument();
  });

  /**
   * Il nome accessibile diceva la parola interna dello stato: chi usa un lettore di
   * schermo si sentiva leggere "Dettaglio validazione: error".
   */
  test.each([
    ['error', /valore sbagliato/i],
    ['warning', /quasi corretto/i],
    ['valid', /valore corretto/i],
  ])('lo stato %s si annuncia in italiano', (stato, atteso) => {
    render(<ValidationBadge result={risultato({ status: stato as ValidationResult['status'] })} fieldType="distance" />);
    expect(screen.getByRole('button', { name: atteso })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /error|warning|valid/ })).not.toBeInTheDocument();
  });
});

/**
 * La fine di una finestra critica e' esclusiva: una fascia che comprende l'ultima ora
 * della giornata finisce a mezzanotte, e veniva scritta "00:00". "12:00-00:00" si legge
 * come un intervallo al contrario. Qui si controlla la FRASE mostrata, non il dato.
 */
describe('una fascia che arriva a fine giornata', () => {
  const serieCritica = (giorno: string, daOraUTC: number): SerieOraria => {
    const time: string[] = [];
    const cape: number[] = [];
    const weather_code: number[] = [];
    const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    for (let h = 0; h < 24; h++) {
      time.push(`${giorno}T${String(h).padStart(2, '0')}:00`);
      const critica = h >= daOraUTC;
      cape.push(critica ? 2500 : 30);
      weather_code.push(critica ? 95 : 0);
      wind_gusts_10m.push(critica ? 80 : 10);
      precipitation_probability.push(critica ? 90 : 0);
    }
    return { time, cape, weather_code, wind_gusts_10m, precipitation_probability };
  };

  const giorno = '2026-08-28';
  const waypoints: Waypoint[] = [
    { id: 'a', name: 'Rifugio', lat: 46.4, lon: 11.8, altitude: 2000, order: 0 },
    { id: 'b', name: 'Cima', lat: 46.5, lon: 11.9, altitude: 2400, order: 1 },
  ];
  /*
   * Senza tempo stimato: e' il caso in cui il pannello elenca le fasce critiche della
   * giornata, ed e' esattamente la frase vista a schermo ("Ore instabili nella
   * giornata: 12:00-00:00") che ha fatto scoprire il difetto.
   */
  const legs: Leg[] = [{
    id: 'l', fromWaypointId: 'a', toWaypointId: 'b',
    distance: null, azimuth: null, elevationGain: null, elevationLoss: null,
  }];
  const punti: PuntoInterrogato[] = [
    { waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Rifugio' },
    { waypointIndex: 1, lat: 46.5, lon: 11.9, name: 'Cima' },
  ];

  /** In estate l'Italia e' UTC+2: le 22:00Z sono la mezzanotte italiana. */
  const rapporto = () => {
    const serie = serieCritica(giorno, 8);
    return buildRouteWeather({
      waypoints, legs,
      departure: new Date(`${giorno}T05:00:00Z`),
      punti,
      serie: [serie, serie],
    });
  };

  test('la finestra arriva davvero a mezzanotte italiana', () => {
    const r = rapporto();
    const ultima = r.windows[r.windows.length - 1];
    expect(
      new Date(ultima.toISO).toLocaleTimeString('it-IT', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
      })
    ).toBe('00:00');
  });

  test('ma la frase mostrata dice 24:00, non 00:00', () => {
    const r = rapporto();
    expect(r.verdict.message).toMatch(/24:00/);
    expect(r.verdict.message).not.toMatch(/00:00/);
  });
});

/**
 * La stessa riga la stampa anche il pannello, con un suo formattatore locale: quando la
 * correzione stava solo nella lib, a schermo si continuava a leggere "15:00-00:00".
 * Questo test guarda il punto in cui il difetto si vedeva davvero.
 */
describe('anche il pannello scrive la fascia per intero', () => {
  test('la riga delle ore instabili non finisce con 00:00', async () => {
    const { render: renderPanel, screen: schermo, waitFor: attendi } = await import('@testing-library/react');
    const { useUIStore } = await import('@/stores/uiStore');
    const { useItineraryStore } = await import('@/stores/itineraryStore');
    const { RouteWeatherPanel } = await import('@/components/weather/RouteWeatherPanel');

    /** Un giorno con criticita' dalle 08Z a fine giornata: in Italia 10:00 -> mezzanotte. */
    const giornoCritico = (giorno: string) => {
      const t: string[] = [], c: number[] = [], w: number[] = [], g: number[] = [], pr: number[] = [];
      for (let h = 0; h < 24; h++) {
        t.push(`${giorno}T${String(h).padStart(2, '0')}:00`);
        const critica = h >= 8;
        c.push(critica ? 2500 : 20);
        w.push(critica ? 95 : 0);
        g.push(critica ? 85 : 8);
        pr.push(critica ? 95 : 0);
      }
      return { time: t, cape: c, weather_code: w, wind_gusts_10m: g, precipitation_probability: pr };
    };
    const giornoUTC = (scarto: number) => {
      const d = new Date();
      d.setDate(d.getDate() + scarto);
      return d.toISOString().slice(0, 10);
    };
    // due giorni, come la partenza predefinita richiede a qualunque ora del giorno
    const a = giornoCritico(giornoUTC(0));
    const b = giornoCritico(giornoUTC(1));
    const serie = {
      time: [...a.time, ...b.time],
      cape: [...a.cape, ...b.cape],
      weather_code: [...a.weather_code, ...b.weather_code],
      wind_gusts_10m: [...a.wind_gusts_10m, ...b.wind_gusts_10m],
      precipitation_probability: [...a.precipitation_probability, ...b.precipitation_probability],
    };
    mockFetchRouteForecast.mockResolvedValue({ serie: [serie, serie], elevations: [] });

    useUIStore.setState({ weatherOpen: true });
    useItineraryStore.setState({
      waypoints: [
        { id: 'a', name: 'Rifugio', lat: 46.4, lon: 11.8, altitude: 2000, order: 0 },
        { id: 'b', name: 'Cima', lat: 46.5, lon: 11.9, altitude: 2400, order: 1 },
      ],
      // senza tempi: e' il caso in cui il pannello elenca le fasce della giornata
      legs: [{
        id: 'l', fromWaypointId: 'a', toWaypointId: 'b',
        distance: null, azimuth: null, elevationGain: null, elevationLoss: null,
      }],
    });

    renderPanel(<RouteWeatherPanel />);
    // la riga dedicata e' quella che spiega "da qualche parte", non il verdetto in cima
    await attendi(() => expect(schermo.getByText(/da qualche parte/)).toBeInTheDocument());
    // il testo cercato sta in un <em> dentro il paragrafo: serve il paragrafo intero
    const riga = schermo.getByText(/da qualche parte/).closest('p')?.textContent || '';
    expect(riga).toMatch(/24:00/);
    expect(riga).not.toMatch(/-\s*00:00/);
  });
});

/**
 * Il pallino colorato accanto al punto diceva "qui c'e' qualcosa" ma non cosa: per
 * capirlo bisognava incrociare da soli tre colonne di numeri e conoscere le soglie.
 * Il motivo `classifyHour` lo scrive gia' in italiano, non arrivava a schermo.
 */
describe('la tabella dice perche un punto e problematico', () => {
  const serieCon = (giorno: string, valori: { cape: number; gusts: number; code: number; pioggia: number }) => {
    const t: string[] = [], c: number[] = [], w: number[] = [], g: number[] = [], pr: number[] = [];
    for (let h = 0; h < 24; h++) {
      t.push(`${giorno}T${String(h).padStart(2, '0')}:00`);
      c.push(valori.cape); w.push(valori.code); g.push(valori.gusts); pr.push(valori.pioggia);
    }
    return { time: t, cape: c, weather_code: w, wind_gusts_10m: g, precipitation_probability: pr };
  };

  test('scrive le raffiche e l instabilita, non solo un pallino', async () => {
    const { render: renderPanel, screen: schermo, waitFor: attendi } = await import('@testing-library/react');
    const { useUIStore } = await import('@/stores/uiStore');
    const { useItineraryStore } = await import('@/stores/itineraryStore');
    const { RouteWeatherPanel } = await import('@/components/weather/RouteWeatherPanel');

    const giornoUTC = (s: number) => {
      const d = new Date();
      d.setDate(d.getDate() + s);
      return d.toISOString().slice(0, 10);
    };
    const dati = { cape: 2600, gusts: 85, code: 95, pioggia: 90 };
    const a = serieCon(giornoUTC(0), dati);
    const b = serieCon(giornoUTC(1), dati);
    const serie = {
      time: [...a.time, ...b.time],
      cape: [...a.cape, ...b.cape],
      weather_code: [...a.weather_code, ...b.weather_code],
      wind_gusts_10m: [...a.wind_gusts_10m, ...b.wind_gusts_10m],
      precipitation_probability: [...a.precipitation_probability, ...b.precipitation_probability],
    };
    mockFetchRouteForecast.mockResolvedValue({ serie: [serie, serie], elevations: [] });

    useUIStore.setState({ weatherOpen: true });
    useItineraryStore.setState({
      waypoints: [
        { id: 'a', name: 'Rifugio', lat: 46.4, lon: 11.8, altitude: 2000, order: 0 },
        { id: 'b', name: 'Cima', lat: 46.5, lon: 11.9, altitude: 2400, order: 1 },
      ],
      legs: [{
        id: 'l', fromWaypointId: 'a', toWaypointId: 'b',
        distance: 4, azimuth: 90, elevationGain: 400, elevationLoss: 0, estimatedTime: 120,
      }],
    });

    renderPanel(<RouteWeatherPanel />);
    await attendi(() => expect(schermo.getAllByText(/raffiche 85 km\/h/).length).toBeGreaterThan(0));
    expect(schermo.getAllByText(/instabilit/i).length).toBeGreaterThan(0);
    // e il motivo e' scritto in rosso, come il pallino
    const motivo = schermo.getAllByText(/raffiche 85 km\/h/)[0];
    expect(motivo.className).toMatch(/text-red-400/);
  });
});
