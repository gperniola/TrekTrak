import { test, expect, apriApp } from './supporto';

/**
 * **Cambiare mappa di base e tornare a quella prima spegneva i sentieri** (segnalato
 * l'11/09/2026): l'interruttore restava acceso, l'overlay non si vedeva più finché non lo
 * si spegneva e riaccendeva.
 *
 * ## Perché serve il browser vero
 *
 * Il difetto sta in Leaflet, non nel codice dell'app: base e sentieri stanno nello stesso
 * `tilePane`, e a pari `zIndex` vince l'ordine nel DOM. La base ha `key={baseMapId}`, al
 * cambio si rimonta e Leaflet la appende IN CODA — sopra i sentieri. Il test di componente
 * controlla solo che l'app *dichiari* gli zIndex; qui si controlla che, dopo il gesto
 * dell'utente, il contenitore dei sentieri stia davvero sopra quello della base.
 */

interface Strato { indice: number; zIndex: number; sentieri: boolean; }

/** Gli strati di mattonelle nel pane, nell'ordine del DOM, con lo zIndex applicato. */
const strati = (page: import('@playwright/test').Page) =>
  page.evaluate((): Strato[] => {
    const nodi = Array.from(document.querySelectorAll<HTMLElement>('.leaflet-tile-pane .leaflet-layer'));
    return nodi.map((n, indice) => ({
      indice,
      zIndex: Number(n.style.zIndex || 0),
      sentieri: n.querySelector('img[src*="waymarkedtrails"]') != null,
    }));
  });

/** Vero se, per come Leaflet impila gli strati, i sentieri si vedono sopra la base. */
const sentieriSopraLaBase = (s: Strato[]): boolean => {
  const sentieri = s.find((x) => x.sentieri);
  const basi = s.filter((x) => !x.sentieri);
  if (sentieri == null || basi.length === 0) return false;
  return basi.every((b) => sentieri.zIndex > b.zIndex || (sentieri.zIndex === b.zIndex && sentieri.indice > b.indice));
};

test('i sentieri restano visibili dopo aver cambiato mappa e rimesso quella prima', async ({ page }) => {
  await apriApp(page);
  await page.locator('[aria-label="Impostazioni mappa"]:visible').first().click();

  const interruttore = page.getByRole('switch', { name: 'Sentieri escursionistici' });
  await expect(interruttore).toBeVisible();
  if ((await interruttore.getAttribute('aria-checked')) !== 'true') await interruttore.click();
  await expect(interruttore).toHaveAttribute('aria-checked', 'true');

  // Le mattonelle dei sentieri devono essere state chieste: solo così lo strato è riconoscibile.
  await expect.poll(async () => (await strati(page)).some((s) => s.sentieri)).toBe(true);
  expect(sentieriSopraLaBase(await strati(page))).toBe(true);

  // Il gesto dell'utente: un'altra mappa, poi di nuovo quella di prima.
  // Gli id si leggono PRIMA di cliccare: un locatore su `:checked` si rivaluta a ogni uso.
  const idIniziale = await page.locator('input[name="baseMap"]:checked').getAttribute('value');
  const idAltra = await page.locator('input[name="baseMap"]:enabled:not(:checked)').first().getAttribute('value');
  const radio = (id: string | null) => page.locator(`input[name="baseMap"][value="${id}"]`);
  await radio(idAltra).check();
  await expect(radio(idAltra)).toBeChecked();
  await radio(idIniziale).check();
  await expect(radio(idIniziale)).toBeChecked();

  // La base rimontata ha mattonelle nuove: si aspetta che ci siano, poi si guarda l'ordine.
  await expect.poll(async () => (await strati(page)).filter((s) => !s.sentieri).length).toBeGreaterThan(0);
  await expect.poll(async () => sentieriSopraLaBase(await strati(page))).toBe(true);
});
