import { test, expect, apriApp, contaWaypoint, tocca } from './supporto';
import type { Page } from '@playwright/test';

/**
 * Cosa guarda la mappa quando si apre (task-61).
 *
 * Il difetto: si scaricavano le mattonelle del proprio itinerario e poi, riaprendo l'app,
 * la mappa mostrava il centro predefinito — Chieti — mentre il percorso era sul Gran
 * Sasso, cinquanta chilometri più in là. Con il GPS acceso non si notava; senza segnale e
 * senza posizione, che è **la situazione per cui esiste il pre-caricamento**, bisognava
 * trascinare la mappa a mano fino a incontrare il proprio percorso, attraversando aree
 * mai scaricate.
 *
 * Le regole sono verificate senza browser in `vista-iniziale.test.ts`. Qui si guarda che
 * arrivino a schermo — perché è il passaggio dove in questo progetto si perdono.
 */

/** Il Gran Sasso, lontano dal centro predefinito (Chieti, 42.351 / 14.168). */
const ITINERARIO = {
  v: 1,
  itineraryId: 'prova-vista',
  itineraryName: 'Prova vista',
  createdAt: '2026-09-01T08:00:00.000Z',
  appMode: 'track',
  waypoints: [
    { id: 'w0', name: 'Waypoint 1', order: 0, lat: 42.4700, lon: 13.5600, altitude: 2000, notes: '' },
    { id: 'w1', name: 'Waypoint 2', order: 1, lat: 42.4850, lon: 13.5750, altitude: 2300, notes: '' },
  ],
  legs: [{ id: 'l0', fromWaypointId: 'w0', toWaypointId: 'w1' }],
};

const CENTRO_ITINERARIO = { lat: 42.4775, lon: 13.5675 };

async function conItinerarioSalvato(page: Page): Promise<void> {
  await page.addInitScript((it) => {
    localStorage.setItem('trektrak_current_itinerary', JSON.stringify(it));
  }, ITINERARIO);
}

/**
 * Dove sta guardando la mappa, secondo **l'app stessa**.
 *
 * `GeolocateOnMount` scrive centro e zoom in `sessionStorage` a ogni spostamento, per
 * poterli ripristinare. Leggere quello invece di inventare una sonda significa misurare
 * ciò che l'app crede, che è esattamente la cosa in discussione.
 */
async function doveGuarda(page: Page): Promise<{ lat: number; lng: number; z: number } | null> {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem('tt_map_view');
    return raw ? (JSON.parse(raw) as { lat: number; lng: number; z: number }) : null;
  });
}

test.describe('la mappa si apre sull itinerario', () => {
  /**
   * Il criterio del task, alla lettera: riapro con un itinerario ripristinato e **i
   * waypoint sono a schermo**. Senza permesso di geolocalizzazione, che è il caso in cui
   * il difetto mordeva.
   */
  test('senza posizione, i waypoint dell itinerario ripristinato sono a schermo', async ({ page }) => {
    await conItinerarioSalvato(page);
    await apriApp(page);

    await expect.poll(() => contaWaypoint(page), { timeout: 15_000 }).toBe(2);
    const marker = page.locator('.leaflet-marker-icon', { hasText: /Waypoint \d+/ }).first();
    await expect(marker).toBeInViewport();

    /*
      E l'inquadramento **non** deve finire fra le viste salvate. `tt_map_view` non
      registra dove sta la mappa: registra dove l'utente ha scelto di guardare, ed e'
      anche il segnale che fa saltare la geolocalizzazione. Scriverci dentro
      l'inquadramento automatico spegnerebbe il GPS per il resto della sessione — e' il
      difetto in cui sono caduto scrivendo questo task, trovato solo con una sonda.
    */
    expect(await doveGuarda(page)).toBeNull();
  });

  /**
   * **Il caso che ha dettato la regola.** Si prepara la gita da casa: la mappa inquadra
   * il percorso, poi arriva il GPS e dice «Roma». Seguirlo sbalzerebbe via dal percorso
   * proprio la persona che lo sta guardando.
   */
  test('la posizione lontana non porta via dal percorso', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 41.9028, longitude: 12.4964 }); // Roma
    await conItinerarioSalvato(page);
    await apriApp(page);

    await expect.poll(() => contaWaypoint(page), { timeout: 15_000 }).toBe(2);
    // Il tempo che un `flyTo` avrebbe avuto per portarci via (dura 1,5 s).
    await page.waitForTimeout(3000);

    /*
      Il controllo di non-vacuita' di questo scenario e' quello successivo: li' la stessa
      impalcatura, con una posizione VICINA, sposta davvero la mappa. Se la
      geolocalizzazione non funzionasse in prova, quello fallirebbe — e questo non
      starebbe dimostrando niente.
    */
    await expect(page.locator('.leaflet-marker-icon', { hasText: /Waypoint \d+/ }).first())
      .toBeInViewport();
    // nessuno spostamento verso Roma: niente e' stato registrato come vista scelta
    expect(await doveGuarda(page)).toBeNull();
  });

  /**
   * L'altra faccia: se sei **sul posto**, il GPS deve continuare a comandare come ha
   * sempre fatto. Tre chilometri a nord del percorso è la distanza fra un parcheggio e
   * l'attacco di un sentiero.
   */
  test('la posizione vicina viene seguita, come prima', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 42.512, longitude: 13.5675 });
    await conItinerarioSalvato(page);
    await apriApp(page);

    await expect.poll(async () => (await doveGuarda(page))?.lat ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(42.50);
  });

  /**
   * La promessa che c'era già: dentro una sessione, una ricarica non sposta la mappa da
   * dove la si stava guardando. Un itinerario ripristinato non è una buona ragione per
   * romperla — se stai guardando lì, ci sei andato apposta.
   */
  test('una vista scelta a mano sopravvive alla ricarica', async ({ page }) => {
    await conItinerarioSalvato(page);
    await apriApp(page);
    await expect.poll(() => contaWaypoint(page), { timeout: 15_000 }).toBe(2);

    // Ci si sposta a mano, ben lontano dall'itinerario.
    await page.evaluate(() => {
      sessionStorage.setItem('tt_map_view', JSON.stringify({ lat: 45.07, lng: 7.69, z: 12 }));
    });
    await page.reload();
    await page.locator('.leaflet-container').waitFor({ state: 'visible' });
    await page.waitForTimeout(2500);

    const vista = await doveGuarda(page);
    expect(vista!.lat).toBeCloseTo(45.07, 1);
  });

  /**
   * **La regressione che questa funzione poteva introdurre**, e che per poco non
   * introduceva.
   *
   * La prima stesura inquadrava l'itinerario ascoltando i **waypoint**. Sembra la stessa
   * cosa e non lo è: i waypoint cambiano anche quando l'utente ne sta mettendo uno, e la
   * mappa sarebbe saltata sotto le dita di chi tocca per creare il primo punto — un
   * inquadramento centrato su quel singolo punto, allo zoom 15, nel momento peggiore.
   *
   * Ora si ascolta il conteggio dei ripristini, che dice esattamente «è tornato un
   * itinerario da prima». Qui si verifica che l'altra strada resti chiusa: si tocca in un
   * angolo, e il marker deve restare **dove è stato messo**, non finire al centro.
   */
  test('creare il primo waypoint a mano non sposta la mappa', async ({ page }) => {
    await apriApp(page);
    const mappa = page.locator('.leaflet-container');
    const riquadro = (await mappa.boundingBox())!;
    const centroX = riquadro.x + riquadro.width / 2;

    await tocca(page, -180, -120);
    await expect.poll(() => contaWaypoint(page), { timeout: 15_000 }).toBe(1);
    await page.waitForTimeout(1500);

    const marker = page.locator('.leaflet-marker-icon', { hasText: /Waypoint \d+/ }).first();
    const m = (await marker.boundingBox())!;
    // Il marker e' stato messo 180 px a sinistra del centro: se la mappa si fosse
    // reinquadrata su di lui, ci si troverebbe ora praticamente sopra.
    expect(m.x + m.width / 2).toBeLessThan(centroX - 100);
  });
});
