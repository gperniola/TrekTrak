import { test, expect, apriApp, perDueModelli } from './supporto';

/**
 * **Andata e ritorno nel pannello meteo** (segnalato l'11/09/2026).
 *
 * «Ho creato un percorso fino alla meta (waypoint 7), messo una pausa di un'ora e mezza e
 * cliccato il pulsante per il ritorno. Nell'editor i waypoint sono tutti; nel meteo su
 * percorso non vedo il waypoint 7 né nessun punto intermedio dovuto alla pausa.»
 *
 * La regola è nei test senza browser (`route-weather.test.ts`, `weather-api.test.ts`). Qui
 * si guarda quello che vede l'utente: la meta in tabella, con arrivo e ripartenza; e cosa
 * parte davvero verso il servizio — sette luoghi, non tredici.
 */

const ANDATA = Array.from({ length: 7 }, (_, i) => ({
  id: `w${i}`, name: `Waypoint ${i + 1}`, order: i,
  lat: 42.10 + i * 0.004, lon: 14.05 + i * 0.004, altitude: 1400 + i * 120,
}));
const RITORNO = ANDATA.slice(0, -1).reverse().map((w, k) => ({ ...w, id: `r${k}`, order: 7 + k }));
const WAYPOINTS = [...ANDATA.slice(0, 6), { ...ANDATA[6], pausaMin: 90 }, ...RITORNO];
const LEGS = WAYPOINTS.slice(1).map((w, i) => ({
  id: `l${i}`, fromWaypointId: WAYPOINTS[i].id, toWaypointId: w.id,
  distance: 0.6, azimuth: 45, elevationGain: 120, elevationLoss: 0, estimatedTime: 25,
}));
const IT = {
  v: 1, itineraryId: 'prova-ritorno', itineraryName: 'Anello a specchio',
  createdAt: '2026-09-11T06:00:00.000Z', appMode: 'track', waypoints: WAYPOINTS, legs: LEGS,
};

/** Tre giorni sereni, un elemento per luogo chiesto. */
function previsione(n: number) {
  const oggi = new Date();
  const giorni = [0, 1, 2].map((d) => new Date(oggi.getTime() + d * 86400000).toISOString().slice(0, 10));
  const time = giorni.flatMap((g) => Array.from({ length: 24 }, (_, h) => `${g}T${String(h).padStart(2, '0')}:00`));
  const serie = {
    time, cape: time.map(() => 10), weather_code: time.map(() => 0), wind_gusts_10m: time.map(() => 12),
    precipitation_probability: time.map(() => 0), temperature_2m: time.map(() => 15), precipitation: time.map(() => 0),
  };
  return Array.from({ length: n }, (_, i) => ({ elevation: 1400 + i * 120, hourly: perDueModelli(serie) }));
}

test.describe('meteo del percorso con il ritorno', () => {
  test.use({ viewport: { width: 412, height: 900 } });

  test('la meta con la sosta compare, e i luoghi si chiedono una volta sola', async ({ page }) => {
    const chiesti: string[] = [];
    page.on('request', (r) => { if (r.url().includes('open-meteo')) chiesti.push(r.url()); });
    await page.addInitScript((it) => {
      localStorage.setItem('trektrak_current_itinerary', JSON.stringify(it));
    }, IT);
    await apriApp(page);
    // Registrata DOPO `apriApp`, che finge Open-Meteo con un 503: vince l'ultima rotta.
    await page.route(/api\.open-meteo\.com/, (r) => {
      const n = (new URL(r.request().url()).searchParams.get('latitude') || '').split(',').length;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(previsione(n)) });
    });
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await page.getByRole('button', { name: /Quando partire/i }).click();
    const tabella = page.getByRole('table');
    await tabella.waitFor();

    // Sette luoghi nella richiesta, non tredici passaggi.
    expect(chiesti.length).toBeGreaterThan(0);
    const lat = new URL(chiesti[0]).searchParams.get('latitude') || '';
    expect(lat.split(',')).toHaveLength(7);

    // La meta c'è, due volte: arrivo con la sosta, e ripartenza.
    const righeMeta = tabella.getByRole('row').filter({ hasText: 'Waypoint 7' });
    await expect(righeMeta).toHaveCount(2);
    await expect(righeMeta.first()).toContainText(/arrivo · sosta/);
    await expect(righeMeta.last()).toContainText(/ripartenza/);

    // E ogni passaggio ha la sua riga: 13 waypoint + la riga in più della meta.
    const righe = tabella.getByRole('row').filter({ hasText: /Waypoint \d/ });
    await expect(righe).toHaveCount(14);
  });
});
