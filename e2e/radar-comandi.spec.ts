import { test, expect, apriApp } from './supporto';
import type { Page } from '@playwright/test';

/**
 * I comandi del radar **sulla mappa** (segnalato il 2026-09-02).
 *
 * «I controlli con lo slider che avanza devono apparire non solo nel menu ma anche sulla
 * mappa, preferibilmente in basso, quando questa è attivata, altrimenti l'utente non si
 * rende conto di cosa sta succedendo.»
 *
 * ## Perché serve un test che guarda lo schermo
 *
 * Le regole dell'animazione sono verificate senza browser (`radar-anim.test.ts`), e la
 * barra rendeva correttamente nei test di componente. Quello che nessuno dei due poteva
 * dire è **dove finisce sulla mappa**: alla prima stesura il bordo sinistro cadeva sopra
 * il pulsante tondo degli strumenti e la didascalia tagliava la riga delle attribuzioni.
 * L'ho visto guardando lo schermo, ed è il modo in cui in questo progetto si trovano
 * quasi tutti i difetti di questa famiglia. Da qui in avanti lo trova questo file.
 */

/** Tre fotogrammi finti: la barra compare da due in su, e non serve la rete vera. */
const INDICE_RADAR = {
  version: '2.0',
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1756800000, path: '/v2/radar/1756800000' },
      { time: 1756800600, path: '/v2/radar/1756800600' },
      { time: 1756801200, path: '/v2/radar/1756801200' },
    ],
    nowcast: [],
  },
};

async function conRadarAcceso(page: Page): Promise<void> {
  await page.route(/api\.rainviewer\.com/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDICE_RADAR) }),
  );
  await page.addInitScript(() => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { emergencyLayers: ['rain-radar'] },
    }));
  });
}

const barra = (page: Page) => page.getByRole('group', { name: /Animazione radar/i });

/** Due rettangoli si sovrappongono? */
function siSovrappongono(a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.describe('comandi del radar sulla mappa', () => {
  // La misura che conta e' su schermo di telefono: su scrivania lo spazio non manca.
  test.use({ viewport: { width: 412, height: 823 } });

  test('col radar acceso i comandi sono in basso sulla mappa, dentro lo schermo', async ({ page }) => {
    await conRadarAcceso(page);
    await apriApp(page);

    const b = barra(page);
    await expect(b).toBeVisible();
    // Tutta dentro: `ratio: 1`, perche' il valore di default accetta una sovrapposizione
    // qualunque e una barra tagliata a metà passerebbe.
    await expect(b).toBeInViewport({ ratio: 1 });

    // In basso: sotto la metà della mappa.
    const mappa = (await page.locator('.leaflet-container').boundingBox())!;
    const rett = (await b.boundingBox())!;
    expect(rett.y).toBeGreaterThan(mappa.y + mappa.height / 2);
  });

  /**
   * **Il difetto vero**: la barra sopra i comandi che c'erano già. Non e' un dettaglio
   * estetico — un pulsante coperto non si puo' premere, e il tocco finisce sulla barra.
   */
  test('non copre nessuno dei comandi della mappa', async ({ page }) => {
    await conRadarAcceso(page);
    await apriApp(page);

    const rett = (await barra(page).boundingBox())!;
    const nomi = [/Apri strumenti mappa/i, /La mia posizione/i, /Layer di emergenza/i];
    for (const nome of nomi) {
      const pulsante = page.getByRole('button', { name: nome });
      if (!(await pulsante.isVisible().catch(() => false))) continue;
      const suo = (await pulsante.boundingBox())!;
      expect(siSovrappongono(rett, suo), `la barra copre ${nome}`).toBe(false);
    }
  });

  /**
   * Le attribuzioni vanno lasciate leggibili: e' la condizione d'uso delle mappe e dei
   * dati radar, non una gentilezza.
   */
  test('non copre la riga delle attribuzioni', async ({ page }) => {
    await conRadarAcceso(page);
    await apriApp(page);

    const rett = (await barra(page).boundingBox())!;
    const attr = (await page.locator('.leaflet-control-attribution').boundingBox())!;
    expect(siSovrappongono(rett, attr)).toBe(false);
  });

  /** L'orario e la natura del dato devono stare a schermo: e' pioggia già caduta. */
  test('dice l orario del fotogramma e che non e una previsione', async ({ page }) => {
    await conRadarAcceso(page);
    await apriApp(page);

    const b = barra(page);
    await expect(b.getByText(/Pioggia già caduta/i)).toBeVisible();
    await expect(b.getByText(/[0-9]{2}:[0-9]{2}/)).toBeVisible();
  });

  test('senza il radar acceso non c e nessuna barra', async ({ page }) => {
    await apriApp(page);
    await expect(barra(page)).toHaveCount(0);
  });
});
