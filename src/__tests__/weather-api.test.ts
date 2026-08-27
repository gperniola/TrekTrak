import { buildForecastUrl, fetchRouteForecast } from '@/lib/weather-api';

const punti = [
  { waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Rifugio' },
  { waypointIndex: 3, lat: 46.45, lon: 11.86, name: 'Forcella' },
];

const serie = (base = 0) => ({
  time: ['2026-08-28T05:00', '2026-08-28T06:00'],
  cape: [10 + base, 20 + base],
  weather_code: [0, 3],
  precipitation_probability: [0, 5],
  wind_gusts_10m: [12, 18],
});

describe('URL della previsione', () => {
  const url = buildForecastUrl(punti, 2);

  test('un solo giro per tutti i punti', () => {
    expect(url).toContain('latitude=46.4%2C46.45');
    expect(url).toContain('longitude=11.8%2C11.86');
  });

  test('chiede le variabili che servono, e solo quelle', () => {
    const orarie = decodeURIComponent(new URL(url).searchParams.get('hourly') || '');
    expect(orarie.split(',').sort()).toEqual(
      ['cape', 'precipitation_probability', 'weather_code', 'wind_gusts_10m']
    );
  });

  /**
   * In UTC, non in ora locale: il fuso lo si applica solo quando si scrive un orario a
   * schermo. Chiedere `timezone=auto` significherebbe ricevere stringhe senza offset e
   * doverle interpretare, che è il modo classico di sbagliare di un'ora.
   */
  test('orari in UTC', () => {
    expect(new URL(url).searchParams.get('timezone')).toBe('UTC');
  });

  test('nessuna chiave da gestire', () => {
    expect(url).not.toMatch(/key|token|apikey/i);
  });

  test('i giorni richiesti restano nei limiti del servizio', () => {
    expect(new URL(buildForecastUrl(punti, 99)).searchParams.get('forecast_days')).toBe('7');
    expect(new URL(buildForecastUrl(punti, 0)).searchParams.get('forecast_days')).toBe('1');
  });
});

describe('lettura della risposta', () => {
  const vero = global.fetch;
  afterEach(() => { global.fetch = vero; });

  const rispondi = (body: unknown, ok = true, status = 200) => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok, status, json: async () => body,
    })) as unknown as typeof global.fetch;
  };

  test('più punti → un elemento per punto, nell\'ordine chiesto', async () => {
    rispondi([{ elevation: 2100, hourly: serie(0) }, { elevation: 2600, hourly: serie(100) }]);
    const r = await fetchRouteForecast(punti, 2);
    expect(r.serie).toHaveLength(2);
    expect(r.serie[0].cape[0]).toBe(10);
    expect(r.serie[1].cape[0]).toBe(110);
    expect(r.elevations).toEqual([2100, 2600]);
  });

  // Con un solo punto Open-Meteo restituisce un oggetto, non un array: se non lo si
  // gestisce, il pannello resta vuoto proprio nel caso più semplice.
  test('un punto solo → oggetto, non array', async () => {
    rispondi({ elevation: 2100, hourly: serie() });
    const r = await fetchRouteForecast([punti[0]], 1);
    expect(r.serie).toHaveLength(1);
    expect(r.serie[0].time[0]).toBe('2026-08-28T05:00');
  });

  test('risposta non ok → errore in italiano', async () => {
    rispondi({}, false, 503);
    await expect(fetchRouteForecast(punti, 2)).rejects.toThrow(/previsione/i);
  });

  test('forma inattesa → errore, non dati a metà', async () => {
    rispondi([{ hourly: { time: 'non un array' } }]);
    await expect(fetchRouteForecast(punti, 2)).rejects.toThrow(/previsione/i);
  });

  test('nessun punto → non si chiama la rete', async () => {
    const spia = jest.fn();
    global.fetch = spia as unknown as typeof global.fetch;
    const r = await fetchRouteForecast([], 2);
    expect(spia).not.toHaveBeenCalled();
    expect(r.serie).toEqual([]);
  });
});
