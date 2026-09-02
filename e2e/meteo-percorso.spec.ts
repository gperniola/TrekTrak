import { test, expect, apriApp } from './supporto';
import type { Page } from '@playwright/test';

/**
 * Il pannello **«Quando partire»** dalla parte dell'utente (segnalato il 2026-09-02).
 *
 * «Sarebbe carino che quando si apre quella schermata, per ogni waypoint appaia anche la
 * previsione per quel punto per quell'ora (la classica iconcina che indica sereno,
 * nuvoloso, ecc.)».
 *
 * Le regole stanno nei test senza browser (`cielo.test.ts`, `route-weather.test.ts`) e la
 * tabella nei test di componente. Qui si verificano le due cose che solo lo schermo e la
 * rete possono dire: **cosa parte davvero** verso il servizio — cioè che la previsione
 * venga chiesta alla quota dei punti — e che la tabella con una colonna in più resti
 * leggibile su un telefono, senza scorrimento laterale della pagina.
 */

const IT = {
  v: 1, itineraryId: 'prova-meteo', itineraryName: 'Murelle',
  createdAt: '2026-09-02T06:00:00.000Z', appMode: 'track',
  waypoints: [
    { id: 'w0', name: 'Fonte Tari', order: 0, lat: 42.105, lon: 14.05, altitude: 1350 },
    { id: 'w1', name: 'Bivacco Fusco', order: 1, lat: 42.09, lon: 14.02, altitude: 2455 },
    { id: 'w2', name: 'Cima delle Murelle', order: 2, lat: 42.0847, lon: 14.0139, altitude: 2596 },
  ],
  legs: [
    { id: 'l0', fromWaypointId: 'w0', toWaypointId: 'w1', distance: 5.2, azimuth: 210, elevationGain: 1105, elevationLoss: 0, estimatedTime: 195 },
    { id: 'l1', fromWaypointId: 'w1', toWaypointId: 'w2', distance: 0.9, azimuth: 200, elevationGain: 141, elevationLoss: 0, estimatedTime: 30 },
  ],
};

/** Una giornata finta: sereno, coperto e temporale, uno per punto. */
function previsione(quote: number[]) {
  const oggi = new Date();
  const giorni = [0, 1, 2].map((d) => {
    const x = new Date(oggi.getTime() + d * 86400000);
    return x.toISOString().slice(0, 10);
  });
  const serie = (codice: number, temp: number) => {
    const time: string[] = [];
    const cape: number[] = [];
    const weather_code: number[] = [];
    const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    const temperature_2m: number[] = [];
    for (const g of giorni) {
      for (let h = 0; h < 24; h++) {
        time.push(`${g}T${String(h).padStart(2, '0')}:00`);
        cape.push(10); weather_code.push(codice); wind_gusts_10m.push(12);
        precipitation_probability.push(0); temperature_2m.push(temp);
      }
    }
    return { time, cape, weather_code, wind_gusts_10m, precipitation_probability, temperature_2m };
  };
  const codici = [0, 3, 95];
  const temperature = [16, 9, 8];
  return quote.map((q, i) => ({ elevation: q, hourly: serie(codici[i], temperature[i]) }));
}

async function apriIlMeteo(page: Page, itinerario: unknown = IT): Promise<string[]> {
  const chiesti: string[] = [];
  page.on('request', (r) => { if (r.url().includes('open-meteo')) chiesti.push(r.url()); });
  await page.addInitScript((it) => {
    localStorage.setItem('trektrak_current_itinerary', JSON.stringify(it));
  }, itinerario);
  await apriApp(page);
  /*
    La risposta finta si registra **dopo** `apriApp`: quella funzione finge tutta la rete,
    compreso Open-Meteo con un 503, e in Playwright vince la rotta registrata per ultima.
    Registrandola prima si otteneva il 503 — cioe' il pannello in errore, senza tabella.

    Risponde con le quote che le sono state chieste: e' cosi' che si riconosce se l'app le
    ha mandate, senza dover leggere l'URL dentro le asserzioni.
  */
  await page.route(/api\.open-meteo\.com/, (r) => {
    const quote = (new URL(r.request().url()).searchParams.get('elevation') || '')
      .split(',').filter((x) => x.length > 0).map(Number);
    const usate = quote.length === 3 ? quote : [1257, 1257, 1257]; // la maglia, se non le abbiamo mandate
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(previsione(usate)) });
  });
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await page.getByRole('button', { name: /Quando partire/i }).click();
  await page.getByRole('table').waitFor();
  return chiesti;
}

test.describe('meteo del percorso', () => {
  test.use({ viewport: { width: 412, height: 900 } });

  /**
   * **La previsione si chiede alla quota dei punti.**
   *
   * MISURATO il 2026-09-02 sui dati veri: per Cima delle Murelle (2596 m) la maglia del
   * modello sta a 1257 m, e senza `elevation` risponde 26,1 gradi contro 19,5 — il meteo
   * del fondovalle presentato come quello di vetta.
   */
  test('chiede la previsione alla quota di ogni punto', async ({ page }) => {
    const chiesti = await apriIlMeteo(page);
    expect(chiesti.length).toBeGreaterThan(0);
    expect(decodeURIComponent(chiesti[0])).toContain('elevation=1350,2455,2596');
  });

  test('ogni punto mostra il suo cielo, con la parola e la temperatura', async ({ page }) => {
    await apriIlMeteo(page);
    const tabella = page.getByRole('table');
    await expect(tabella.getByText('sereno', { exact: true })).toBeVisible();
    await expect(tabella.getByText('coperto', { exact: true })).toBeVisible();
    await expect(tabella.getByText('temporale', { exact: true })).toBeVisible();
    await expect(tabella.getByText('16°')).toBeVisible();
    await expect(tabella.getByText('9°')).toBeVisible();
  });

  /** La legenda spiega le icone presenti: al tocco non esiste nessun `title` da leggere. */
  test('la legenda elenca le icone di questa tabella, e solo quelle', async ({ page }) => {
    await apriIlMeteo(page);
    const legenda = page.getByRole('note', { name: /icone del cielo/i });
    await expect(legenda).toBeVisible();
    const testo = await legenda.innerText();
    expect(testo).toContain('sereno');
    expect(testo).toContain('coperto');
    expect(testo).toContain('temporale');
    // Nessuna voce inventata: la legenda non e' il manuale della WMO.
    expect(testo).not.toContain('nebbia');
    expect(testo).not.toContain('neve');
  });

  /**
   * Una colonna in più non deve rendere la tabella inservibile sul telefono: la pagina
   * non scorre di lato (la tabella, se serve, scorre dentro il suo contenitore).
   */
  test('su telefono la pagina non scorre di lato', async ({ page }) => {
    await apriIlMeteo(page);
    const laterale = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(laterale).toBeLessThanOrEqual(1);
  });

  /**
   * Senza le quote non si possono chiedere (il servizio pretende una lista completa):
   * allora il modello risponde per la sua maglia, e la cosa **si dichiara** invece di
   * far passare la temperatura del fondovalle per quella della vetta.
   */
  test('se manca una quota, lo dichiara invece di far finta', async ({ page }) => {
    const senzaQuota = {
      ...IT,
      waypoints: IT.waypoints.map((w, i) => (i === 1 ? { ...w, altitude: null } : w)),
    };
    const chiesti = await apriIlMeteo(page, senzaQuota);
    expect(decodeURIComponent(chiesti[0])).not.toContain('elevation=');
    await expect(page.getByText(/maglia/i)).toBeVisible();
    await expect(page.getByText(/in basso del punto/i)).toBeVisible();
  });
});
