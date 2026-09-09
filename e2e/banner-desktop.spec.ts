import { test, expect, apriApp } from './supporto';

/**
 * I banner «in flusso» (offline, e l'allerta DPC alla posizione) devono essere fasce a
 * tutta larghezza **in alto**, non colonne a tutta altezza.
 *
 * Il difetto, segnalato su desktop: `<main>` era `flex-col lg:flex-row`, e un banner
 * `shrink-0` in flusso, su desktop (riga), non è una fascia in alto ma una **colonna a
 * tutta altezza** — con dentro un testo lungo diventa larga, e copre la mappa. Su mobile
 * (colonna) era una fascia in alto e si vedeva bene, e per questo il difetto era invisibile
 * lì. Qui si guarda su desktop (1280×900 dal config), dov'è dove si rompeva.
 *
 * Si prova con l'**OfflineBanner**: ha la stessa collocazione (figlio di `<main>`) e le
 * stesse classi di fascia (`shrink-0`) del `DpcPositionWarning`, ma è banale da innescare
 * (`context.setOffline`), mentre l'allerta DPC richiede posizione + bollettino veri.
 */
test('desktop: il banner offline è una fascia in alto, non una colonna che copre la mappa', async ({ page }) => {
  await apriApp(page);

  const vp = page.viewportSize()!;
  await page.context().setOffline(true);

  const banner = page.getByText(/Modalità offline/i);
  await banner.waitFor({ state: 'visible' });
  const box = (await banner.boundingBox())!;

  // Fascia: larga quasi quanto la finestra, bassa, attaccata in alto.
  expect(box.width).toBeGreaterThan(vp.width * 0.8);
  expect(box.height).toBeLessThan(120);
  expect(box.y).toBeLessThan(80);

  // E la mappa resta ampia sotto, non coperta né schiacciata a una colonna.
  const mappa = (await page.locator('.leaflet-container').boundingBox())!;
  expect(mappa.width).toBeGreaterThan(vp.width * 0.5);
  expect(mappa.height).toBeGreaterThan(vp.height * 0.4);
});
