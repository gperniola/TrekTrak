import { apriApp, contaWaypoint, expect, test, tocca } from './supporto';

/**
 * I percorsi che una persona fa davvero, in un browser vero.
 *
 * Ogni scenario corrisponde a una voce del task-23, con due deviazioni dichiarate dove il
 * piano scritto mesi fa non regge più (vedi E2E-05 e E2E-06).
 */

test.describe('primo contatto', () => {
  /** E2E-01 */
  test('alla prima visita la guida accoglie, si salta, e la mappa resta', async ({ page }) => {
    await apriApp(page, { guidaDaVedere: true });

    const guida = page.getByRole('dialog', { name: /Guida iniziale/ });
    await expect(guida).toBeVisible();

    // La mappa e' visibile GIA' mentre la guida parla: dalla v0.16.x non e' piu' una
    // finestra modale col velo nero sopra tutto.
    await expect(page.locator('.leaflet-container')).toBeVisible();

    await page.getByText('Salta').click();
    await expect(guida).toBeHidden();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  /** E2E-01b: chiusa una volta, non torna. */
  test('la guida non si ripresenta al secondo avvio', async ({ page }) => {
    await apriApp(page, { guidaDaVedere: true });
    await page.getByText('Salta').click();
    await page.reload();
    await expect(page.getByRole('dialog', { name: /Guida iniziale/ })).toBeHidden();
  });
});

test.describe('costruire un itinerario', () => {
  /** E2E-02 */
  test('un tocco sulla mappa crea un waypoint, e il nome arriva dalla geocodifica', async ({ page }) => {
    await apriApp(page);
    expect(await contaWaypoint(page)).toBe(0);

    await tocca(page, -80, -60);
    await expect.poll(() => contaWaypoint(page)).toBe(1);

    // Il nome lo trova il servizio: nello stub e' «Colle di Prova».
    await expect(page.getByText('Colle di Prova')).toBeVisible();
  });

  /** E2E-03 */
  test('due waypoint fanno una tratta, con i suoi valori e il profilo', async ({ page }) => {
    await apriApp(page);
    await tocca(page, -80, -60);
    await expect.poll(() => contaWaypoint(page)).toBe(1);
    await tocca(page, 90, 70);
    await expect.poll(() => contaWaypoint(page)).toBe(2);

    // La riga della tratta in Track: distanza, azimut, dislivelli come TESTO.
    await expect(page.getByText(/km/).first()).toBeVisible();
    await expect(page.getByText(/°\s*(N|NE|E|SE|S|SO|O|NO)/).first()).toBeVisible();
  });

  /** E2E-02b: quello che si mette, si può togliere subito. */
  test('annulla toglie il waypoint appena messo, in un colpo solo', async ({ page }) => {
    await apriApp(page);
    await tocca(page, -60, -40);
    await expect.poll(() => contaWaypoint(page)).toBe(1);

    const annulla = page.getByRole('button', { name: /^Annulla:/ });
    await expect(annulla).toBeEnabled();
    // Il nome che arriva dal geocoder NON e' un passo a se': un colpo deve bastare.
    await annulla.click();
    await expect.poll(() => contaWaypoint(page)).toBe(0);
  });
});

test.describe('imparare', () => {
  /** E2E-04 */
  test('in Learn si scrivono i valori e la verifica li giudica', async ({ page }) => {
    await apriApp(page, { profilo: 'imparo' });
    await tocca(page, -80, -60);
    await expect.poll(() => contaWaypoint(page)).toBe(1);
    await tocca(page, 90, 70);
    await expect.poll(() => contaWaypoint(page)).toBe(2);

    await page.getByRole('tab', { name: 'Learn' }).click();

    // In Learn i campi si compilano a mano: qui compaiono, in Track non c'erano.
    const distanza = page.getByLabel('Dist (km)').first();
    await expect(distanza).toBeVisible();
    await distanza.fill('2,5');

    await expect(page.getByRole('button', { name: 'Verifica' })).toBeEnabled();
  });

  /**
   * E2E-04b: la virgola decimale. È il difetto che questo progetto ha corretto tre volte
   * in punti diversi — il campo, il quiz, la tolleranza — e vale la pena che un test lo
   * guardi da fuori, dove l'utente lo vive.
   */
  test('la virgola italiana vale come il punto', async ({ page }) => {
    await apriApp(page, { profilo: 'imparo' });
    await tocca(page, -80, -60);
    await tocca(page, 90, 70);
    await expect.poll(() => contaWaypoint(page)).toBe(2);

    await page.getByRole('tab', { name: 'Learn' }).click();
    const distanza = page.getByLabel('Dist (km)').first();
    await distanza.fill('2,5');
    await expect(distanza).toHaveValue('2,5');
  });
});

test.describe('il lavoro non si perde', () => {
  /**
   * E2E-05, **riscritto rispetto al piano**. Diceva «salva → nuovo → carica», ma dalla
   * v0.9.0 salvare significa mettere il percorso nella libreria condivisa su Supabase, che
   * richiede un invito e una sessione: in un test end-to-end offline non è riproducibile.
   *
   * Quello che conta davvero per chi usa l'app è l'altra cosa, ed è verificabile: **una
   * ricarica non deve far perdere il lavoro**. Era il difetto grave della v0.11.8, e
   * l'avviso di aggiornamento della PWA invita proprio a ricaricare.
   */
  test('ricaricando, l itinerario in lavorazione torna', async ({ page }) => {
    await apriApp(page);
    await tocca(page, -80, -60);
    await tocca(page, 90, 70);
    await expect.poll(() => contaWaypoint(page)).toBe(2);

    await page.reload();
    await page.locator('.leaflet-container').waitFor({ state: 'visible' });
    await expect.poll(() => contaWaypoint(page), { timeout: 15_000 }).toBe(2);
  });

  /** E2E-07: il link condiviso porta con sé l'itinerario. */
  test('un link condiviso ricostruisce l itinerario', async ({ page, browser }) => {
    await apriApp(page);
    await tocca(page, -80, -60);
    await tocca(page, 90, 70);
    await expect.poll(() => contaWaypoint(page)).toBe(2);

    await page.getByRole('button', { name: /Copia link/ }).click();
    // Si legge cio' che l'app ha scritto negli appunti, intercettato in `supporto`.
    await expect.poll(() => page.evaluate(() => (window as unknown as { __ultimoLink: string }).__ultimoLink))
      .toContain('#');
    const url = await page.evaluate(() => (window as unknown as { __ultimoLink: string }).__ultimoLink);

    /*
     * Un CONTESTO nuovo, non una scheda nuova: le schede condividono lo storage, quindi
     * l'app avrebbe trovato un itinerario autosalvato *e* un link da importare, e avrebbe
     * chiesto conferma — un dialogo che copre tutto. E' anche il caso vero: chi riceve un
     * link e' un'altra persona, con il suo browser vuoto.
     */
    const altroContesto = await browser.newContext();
    const altra = await altroContesto.newPage();
    await apriApp(altra, { hash: new URL(url).hash });
    await expect.poll(() => contaWaypoint(altra), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await altroContesto.close();
  });
});

test.describe('i pannelli non creano waypoint sotto di sé', () => {
  /**
   * Non è nel piano del task, ma è la classe di difetto **già arrivata due volte in
   * produzione**: un pannello sopra la mappa il cui tocco attraversa e diventa «aggiungi
   * waypoint» (il pannello dei layer nella v0.11.0, il mirino GPS nella v0.11.7, il popup
   * dei focolai nella v0.11.1). Una guardia unitaria c'è già; questa la guarda col dito.
   */
  test('toccare il pannello dei layer non aggiunge punti alla mappa', async ({ page }) => {
    await apriApp(page);
    const prima = await contaWaypoint(page);

    await page.getByRole('button', { name: /Layer di emergenza/ }).click();
    const pannello = page.getByText('Rifugi e ricoveri').first();
    await expect(pannello).toBeVisible();
    await pannello.click();

    await page.waitForTimeout(600);
    expect(await contaWaypoint(page)).toBe(prima);
  });
});
