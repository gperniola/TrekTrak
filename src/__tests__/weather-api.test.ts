import { buildForecastUrl, fetchRouteForecast, leggiRisposta } from '@/lib/weather-api';

const punti = [
  { waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Rifugio', alt: null },
  { waypointIndex: 3, lat: 46.45, lon: 11.86, name: 'Forcella', alt: null },
];

const serie = (base = 0) => ({
  time: ['2026-08-28T05:00', '2026-08-28T06:00'],
  cape: [10 + base, 20 + base],
  weather_code: [0, 3],
  precipitation_probability: [0, 5],
  wind_gusts_10m: [12, 18],
  temperature_2m: [14, 15],
  precipitation: [0, 0.4],
});

/**
 * La forma vera della risposta con più modelli: ogni variabile è **suffissa** col nome
 * del modello, mentre `time` resta unico. Verificato sulla risposta di Open-Meteo il
 * 2026-09-09.
 */
const conModelli = (ecmwf: ReturnType<typeof serie>, icon = ecmwf) => {
  const { time, ...resto } = ecmwf;
  const suffissa = (s: Record<string, unknown>, api: string) =>
    Object.fromEntries(Object.entries(s).map(([k, v]) => [`${k}_${api}`, v]));
  const { time: _t, ...restoIcon } = icon;
  return { time, ...suffissa(resto, 'ecmwf_ifs'), ...suffissa(restoIcon, 'icon_seamless') };
};

describe('URL della previsione', () => {
  const url = buildForecastUrl(punti, 2);

  test('un solo giro per tutti i punti', () => {
    expect(url).toContain('latitude=46.4%2C46.45');
    expect(url).toContain('longitude=11.8%2C11.86');
  });

  test('chiede le variabili che servono, e solo quelle', () => {
    const orarie = decodeURIComponent(new URL(url).searchParams.get('hourly') || '');
    expect(orarie.split(',').sort()).toEqual(
      ['cape', 'precipitation', 'precipitation_probability', 'temperature_2m', 'weather_code', 'wind_gusts_10m']
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

  /**
   * Due modelli in una richiesta sola: averli entrambi in mano permette di cambiare
   * modello dalla tendina **senza rifare la rete**. Misurato: ~17 KB.
   */
  test('chiede ECMWF e ICON insieme', () => {
    expect(decodeURIComponent(url)).toContain('models=ecmwf_ifs,icon_seamless');
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
    rispondi([
      { elevation: 2100, hourly: conModelli(serie(0)) },
      { elevation: 2600, hourly: conModelli(serie(100)) },
    ]);
    const r = await fetchRouteForecast(punti, 2);
    expect(r.serie.ecmwf).toHaveLength(2);
    expect(r.serie.ecmwf[0].cape[0]).toBe(10);
    expect(r.serie.ecmwf[1].cape[0]).toBe(110);
    expect(r.elevations).toEqual([2100, 2600]);
  });

  /**
   * **Le serie dei due modelli non si mescolano.** È la regola della funzione: il modello
   * scelto possiede tutta la riga, e un valore dell'uno accanto a un valore dell'altro
   * mostrerebbe una previsione che nessuno dei due ha mai fatto.
   */
  test('ogni modello tiene i suoi numeri', () => {
    const r = leggiRisposta([{
      elevation: 2100,
      hourly: conModelli(serie(0), { ...serie(0), weather_code: [95, 95] }),
    }]);
    expect(r.serie.ecmwf[0].weather_code[0]).toBe(0);
    expect(r.serie.icon[0].weather_code[0]).toBe(95);
  });

  // Con un solo punto Open-Meteo restituisce un oggetto, non un array: se non lo si
  // gestisce, il pannello resta vuoto proprio nel caso più semplice.
  test('un punto solo → oggetto, non array', async () => {
    rispondi({ elevation: 2100, hourly: conModelli(serie()) });
    const r = await fetchRouteForecast([punti[0]], 1);
    expect(r.serie.ecmwf).toHaveLength(1);
    expect(r.serie.ecmwf[0].time[0]).toBe('2026-08-28T05:00');
  });

  /**
   * **Se un modello sparisce, resta l'altro.**
   *
   * Gli identificativi di Open-Meteo non sono stabili — `ecmwf_ifs_hres` non esiste,
   * `ecmwf_ifs04` risponde senza dati — e prima bastava che un blocco mancasse per far
   * fallire TUTTA la lettura: il pannello mostrava un errore anche quando la serie del
   * modello scelto era arrivata intatta. Ora il modello che non parla resta vuoto e
   * l'altro continua a funzionare.
   */
  test('un modello che non risponde non porta giu anche l altro', () => {
    const soloIcon = { ...conModelli(serie(0)) };
    for (const k of Object.keys(soloIcon)) if (k.endsWith('_ecmwf_ifs')) delete (soloIcon as Record<string, unknown>)[k];
    const r = leggiRisposta([{ elevation: 2100, hourly: soloIcon }]);
    expect(r.serie.icon).toHaveLength(1);
    expect(r.serie.ecmwf).toEqual([]);
  });

  /**
   * Un modello che parla per un punto e tace per un altro NON si tiene a meta': gli indici
   * delle serie devono corrispondere uno a uno ai punti chiesti, e una serie in meno
   * significherebbe attribuire a un punto il meteo di un altro — la classe di difetto piu'
   * pericolosa di questo progetto.
   */
  test('un modello parziale si scarta tutto, invece di disallineare i punti', () => {
    const monco = { ...conModelli(serie(0)) };
    for (const k of Object.keys(monco)) if (k.endsWith('_ecmwf_ifs')) delete (monco as Record<string, unknown>)[k];
    const r = leggiRisposta([
      { elevation: 2100, hourly: conModelli(serie(0)) },
      { elevation: 2600, hourly: monco },
    ]);
    expect(r.serie.ecmwf).toEqual([]);
    expect(r.serie.icon).toHaveLength(2);
  });

  test('se non parla NESSUN modello, allora si dichiara l errore', () => {
    expect(() => leggiRisposta([{ elevation: 2100, hourly: { time: ['x'] } }]))
      .toThrow(/previsione/i);
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
    expect(r.serie.ecmwf).toEqual([]);
    expect(r.serie.icon).toEqual([]);
  });
});

/**
 * **La previsione si chiede alla quota del punto.**
 *
 * MISURATO il 2026-09-02 su Cima delle Murelle (2596 m): senza `elevation` il modello
 * risponde per una maglia a 1257 m — 26,1 gradi e raffiche a 47,5 km/h alle 12 — mentre
 * con `elevation=2596` da' 19,5 gradi e 40,3 km/h. Sei gradi e mezzo, cioe' il meteo del
 * fondovalle presentato come quello di vetta.
 */
describe('la quota nella richiesta', () => {
  const conQuota = [
    { waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Rifugio', alt: 2100 },
    { waypointIndex: 3, lat: 46.45, lon: 11.86, name: 'Forcella', alt: 2596.4 },
  ];

  test('con tutte le quote note, le chiede al modello', () => {
    const q = new URL(buildForecastUrl(conQuota, 2)).searchParams.get('elevation');
    // Arrotondate: il servizio vuole numeri, e il decimetro non cambia una previsione.
    expect(q).toBe('2100,2596');
  });

  /**
   * Il servizio pretende **tanti elementi quante le coordinate** (verificato: con
   * `elevation=2596,` risponde con un errore esplicito) e non ha un modo per dire
   * "questo lascialo al valore di default". Inventare la quota mancante sarebbe peggio
   * del difetto che si vuole correggere: meglio nessuna quota e dichiararlo a schermo.
   */
  test('se a un punto manca la quota, non ne chiede nessuna', () => {
    const misto = [conQuota[0], { ...conQuota[1], alt: null }];
    expect(new URL(buildForecastUrl(misto, 2)).searchParams.has('elevation')).toBe(false);
  });

  test('una quota non finita conta come mancante', () => {
    const rotto = [conQuota[0], { ...conQuota[1], alt: Number.NaN }];
    expect(new URL(buildForecastUrl(rotto, 2)).searchParams.has('elevation')).toBe(false);
  });

  test('senza quote la richiesta resta quella di prima', () => {
    expect(new URL(buildForecastUrl(punti, 2)).searchParams.has('elevation')).toBe(false);
  });
});

/**
 * **Lo stesso posto si chiede una volta sola.** Con il ritorno per la stessa strada i
 * punti del percorso si ripetono (stesse coordinate, stessa quota): chiederli due volte
 * costa il doppio senza dire niente di nuovo. La risposta si **riespande** sui punti
 * chiesti, cosi' chi legge `serie[k]` per il punto k non deve sapere niente della
 * deduplicazione — e i due passaggi da uno stesso posto leggono la stessa serie.
 */
describe('punti ripetuti (andata e ritorno)', () => {
  const vero = global.fetch;
  afterEach(() => { global.fetch = vero; });

  const A = { waypointIndex: 0, lat: 46.4, lon: 11.8, name: 'Rifugio', alt: 2100 };
  const B = { waypointIndex: 1, lat: 46.45, lon: 11.86, name: 'Forcella', alt: 2600 };
  const ritornoA = { ...A, waypointIndex: 2 };
  const andataRitorno = [A, B, ritornoA];

  test('nell\'URL ogni luogo compare una volta, con la sua quota', () => {
    const u = new URL(buildForecastUrl(andataRitorno, 2));
    expect(u.searchParams.get('latitude')).toBe('46.4,46.45');
    expect(u.searchParams.get('longitude')).toBe('11.8,11.86');
    expect(u.searchParams.get('elevation')).toBe('2100,2600');
  });

  test('la risposta si riespande: una serie per punto chiesto, nell\'ordine dei punti', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true, status: 200, json: async () => [
        { elevation: 2100, hourly: conModelli(serie(0)) },
        { elevation: 2600, hourly: conModelli(serie(100)) },
      ],
    })) as unknown as typeof global.fetch;
    const r = await fetchRouteForecast(andataRitorno, 2);
    expect(r.serie.ecmwf).toHaveLength(3);
    expect(r.serie.ecmwf.map((s) => s.cape[0])).toEqual([10, 110, 10]);
    expect(r.serie.icon).toHaveLength(3);
    expect(r.elevations).toEqual([2100, 2600, 2100]);
  });

  test('stesse coordinate ma quota diversa: sono due domande diverse', () => {
    const u = new URL(buildForecastUrl([A, { ...A, waypointIndex: 1, alt: 2300 }], 2));
    expect(u.searchParams.get('latitude')).toBe('46.4,46.4');
    expect(u.searchParams.get('elevation')).toBe('2100,2300');
  });
});
