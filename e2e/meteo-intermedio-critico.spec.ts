import { test, expect, apriApp, perDueModelli } from './supporto';
import type { Page } from '@playwright/test';

/**
 * **Il buco fra due waypoint distanti si vede a schermo, se lì il tempo è brutto.**
 *
 * Verifica chiesta dall'utente: con due punti lontani e un temporale IN MEZZO, in tabella
 * deve comparire una riga in più. Le regole stanno nei test unitari (`route-weather.test.ts`,
 * `TabellaPuntiMeteo.test.tsx`); qui si prova la catena intera nel browser — campionamento,
 * chiamata multi-punto, filtro di presentazione — perché è il punto in cui il progetto ha
 * già pagato: una funzione giusta che nessuno chiamava.
 */

/** Due waypoint a ~15 km: `SPAZIO_MAX_KM` è 5, quindi in mezzo ne nascono tre. */
const IT = {
  v: 1, itineraryId: 'prova-mezzo', itineraryName: 'Traversata lunga',
  createdAt: '2026-09-09T06:00:00.000Z', appMode: 'track',
  waypoints: [
    { id: 'w0', name: 'Passo Lanciano', order: 0, lat: 42.20, lon: 14.10, altitude: 1300 },
    { id: 'w1', name: 'Blockhaus', order: 1, lat: 42.20, lon: 14.28, altitude: 2100 },
  ],
  legs: [
    {
      id: 'l0', fromWaypointId: 'w0', toWaypointId: 'w1',
      distance: 15, azimuth: 90, elevationGain: 800, elevationLoss: 0, estimatedTime: 300,
    },
  ],
};

/** Una giornata finta per `n` punti: sereno, tranne dove dice `critico`. */
function previsione(n: number, critico: number, quote: number[]) {
  const oggi = new Date();
  const giorni = [0, 1, 2].map((d) => new Date(oggi.getTime() + d * 86400000).toISOString().slice(0, 10));
  const serie = (brutto: boolean) => {
    const time: string[] = [];
    const cape: number[] = [];
    const weather_code: number[] = [];
    const wind_gusts_10m: number[] = [];
    const precipitation_probability: number[] = [];
    const temperature_2m: number[] = [];
    for (const g of giorni) {
      for (let h = 0; h < 24; h++) {
        time.push(`${g}T${String(h).padStart(2, '0')}:00`);
        cape.push(brutto ? 1500 : 20);
        weather_code.push(brutto ? 95 : 0);
        wind_gusts_10m.push(brutto ? 60 : 10);
        precipitation_probability.push(brutto ? 80 : 0);
        temperature_2m.push(brutto ? 12 : 18);
      }
    }
    return { time, cape, weather_code, wind_gusts_10m, precipitation_probability, temperature_2m,
      precipitation: time.map(() => (brutto ? 4.2 : 0)) };
  };
  return Array.from({ length: n }, (_, i) => ({
    elevation: quote[i] ?? 1257,
    hourly: perDueModelli(serie(i === critico)),
  }));
}

/** Apre il pannello meteo; `critico` è l'indice del punto brutto (-1 = tutto sereno). */
async function apriIlMeteo(page: Page, critico: number): Promise<string[]> {
  const chiesti: string[] = [];
  page.on('request', (r) => { if (r.url().includes('open-meteo')) chiesti.push(r.url()); });
  await page.addInitScript((it) => {
    localStorage.setItem('trektrak_current_itinerary', JSON.stringify(it));
  }, IT);
  await apriApp(page);
  // Dopo `apriApp`: in Playwright vince la rotta registrata per ultima (là c'è un 503).
  await page.route(/api\.open-meteo\.com/, (r) => {
    const q = new URL(r.request().url()).searchParams;
    const punti = (q.get('latitude') || '').split(',').filter((x) => x.length > 0).length;
    const quote = (q.get('elevation') || '').split(',').filter((x) => x.length > 0).map(Number);
    return r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(previsione(punti, critico, quote)),
    });
  });
  await page.getByRole('button', { name: 'Editor', exact: true }).click();
  await page.getByRole('button', { name: /Quando partire/i }).click();
  await page.getByRole('table').waitFor();
  return chiesti;
}

test.describe('punti in mezzo a due waypoint distanti', () => {
  test.use({ viewport: { width: 412, height: 900 } });

  test('la previsione si chiede anche in mezzo, non solo ai due estremi', async ({ page }) => {
    const chiesti = await apriIlMeteo(page, 2);
    const q = new URL(chiesti[0]);
    const lat = (q.searchParams.get('latitude') || '').split(',');
    // 15 km / soglia 5 km: due estremi più tre punti inseriti.
    expect(lat).toHaveLength(5);
    // Le quote degli intermedi sono interpolate, non inventate a zero.
    expect(decodeURIComponent(q.searchParams.get('elevation') || ''))
      .toBe('1300,1500,1700,1900,2100');
  });

  test('col temporale in mezzo compare una riga in più, «in mezzo» fra i due punti', async ({ page }) => {
    await apriIlMeteo(page, 2);
    const righe = page.getByRole('table').getByRole('row');
    /*
      Si contano i PUNTI, non le righe della tabella: un punto critico si porta dietro la
      sua riga di motivi, e contare le righe legherebbe questo test a una scelta di layout
      che non c'entra niente con quello che sta verificando.
    */
    const punti = righe.filter({ has: page.getByRole('button', { name: /Altre azioni/i }) });
    // i 2 waypoint piu' 1 punto in mezzo (gli altri due in mezzo sono sereni e restano nascosti)
    await expect(punti).toHaveCount(3);
    const mezzo = punti.filter({ hasText: 'in mezzo' });
    await expect(mezzo).toHaveCount(1);
    await expect(mezzo).toContainText('tra «Passo Lanciano» e «Blockhaus»');
    await expect(mezzo).toContainText('temporale');
    // A metà di una tratta di 5 ore partendo alle 7: verso le 09:30.
    await expect(mezzo.getByRole('cell').nth(1)).toContainText('09:30');
  });

  test('se in mezzo è sereno, nessuna riga in più: la tabella non si intasa', async ({ page }) => {
    await apriIlMeteo(page, -1);
    const righe = page.getByRole('table').getByRole('row');
    const punti = righe.filter({ has: page.getByRole('button', { name: /Altre azioni/i }) });
    await expect(punti).toHaveCount(2); // solo i due waypoint
    await expect(righe.filter({ hasText: 'in mezzo' })).toHaveCount(0);
  });
});
