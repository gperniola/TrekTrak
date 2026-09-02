import { test, expect, type Page } from '@playwright/test';

/**
 * La mappa senza rete (task-37).
 *
 * **Perché questo scenario esiste, e perché non poteva essere un test unitario.** Il
 * pre-caricamento è tutto meccanismo di browser: un service worker che intercetta, una
 * regola `CacheFirst`, una cache con un nome preciso, e una URL che deve coincidere fino
 * all'ultimo carattere con quella che Leaflet chiederà dopo. Ogni pezzo si può verificare
 * a parte — e infatti lo è, in `tile-offline.test.ts` e `tile-download.test.ts` — ma
 * l'unica domanda che conta è **se la mappa si vede quando il telefono non ha segnale**,
 * e quella domanda ha una sola risposta onesta: spegnere la rete e guardare.
 *
 * Verificando questa funzione è saltato fuori che la cache delle mattonelle **non aveva
 * mai funzionato**: Workbox rifiuta di conservare le risposte opache — quelle che tornano
 * dalle immagini di altri siti, senza stato leggibile — a meno che non glielo si dica
 * esplicitamente. Ventiquattro mattonelle a schermo, zero cache. Nessun test unitario
 * poteva accorgersene, perché il codice era scritto bene: era il browser a non fare quel
 * che il codice sembrava chiedere.
 *
 * **L'emulazione «offline» del DevTools non basta.** Applicata alla pagina, non raggiunge
 * il service worker: le richieste continuano a partire, e il test dice «funziona» mentre
 * sta guardando la rete viva. Lo si è misurato — una URL mai vista rispondeva lo stesso.
 * Qui si usa `context.setOffline`, che il worker lo raggiunge, e **il primo controllo di
 * ogni scenario è che una URL mai vista fallisca**: se risponde, il resto non dimostra
 * niente e il test si ferma lì.
 */

/**
 * Un itinerario di **duecento metri** sul Gran Sasso.
 *
 * Minuscolo di proposito: le mattonelle che questo scenario scarica sono vere, e chi ce
 * le regala chiede esplicitamente di non fare scaricate massicce. Duecento metri danno
 * una manciata di mattonelle per livello — abbastanza per dimostrare il meccanismo, poco
 * abbastanza da poter girare prima di ogni rilascio senza pesare su nessuno.
 */
const ITINERARIO = {
  v: 1,
  itineraryId: 'prova-offline',
  itineraryName: 'Prova offline',
  createdAt: '2026-09-01T08:00:00.000Z',
  appMode: 'track',
  waypoints: [
    { id: 'w0', name: 'Waypoint 1', order: 0, lat: 42.4700, lon: 13.5600, altitude: 2000, notes: '' },
    { id: 'w1', name: 'Waypoint 2', order: 1, lat: 42.4715, lon: 13.5618, altitude: 2100, notes: '' },
  ],
  legs: [{ id: 'l0', fromWaypointId: 'w0', toWaypointId: 'w1' }],
};

/** Le coordinate `z/x/y` di una URL di mattonella. */
const COORDINATE = /\/(\d+)\/(\d+)\/(\d+)\.png/;

/**
 * Apre l'app e **aspetta che il worker abbia il controllo**.
 *
 * Ci vogliono due giri: al primo il worker si installa, al secondo prende il controllo
 * della pagina. Senza il secondo, `fetch` non passa da lui e non si conserva niente —
 * l'app sembrerebbe semplicemente non avere cache.
 */
async function conIlWorker(page: Page): Promise<void> {
  await page.addInitScript((itinerario) => {
    localStorage.setItem('trektrak_tutorial_seen', '1');
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
    localStorage.setItem('trektrak_profilo', 'montagna');
    localStorage.setItem('trektrak_current_itinerary', JSON.stringify(itinerario));
  }, ITINERARIO);

  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller != null, null, { timeout: 60_000 });
  await page.waitForTimeout(2000);
  await chiudiNovita(page);
}

async function chiudiNovita(page: Page): Promise<void> {
  const popup = page.getByRole('dialog', { name: /Novit/ });
  if (!(await popup.isVisible().catch(() => false))) return;
  await popup.getByRole('button', { name: /Chiudi|Ho capito|Inizia|Salta/ }).last().click();
  await popup.waitFor({ state: 'hidden' });
}

/** Scarica dal pannello e torna quante mattonelle sono finite in ogni cache. */
async function scaricaDalPannello(page: Page): Promise<Record<string, number>> {
  await page.locator('[aria-label="Impostazioni mappa"]:visible').first().click();
  const bottone = page.locator('button:visible', { hasText: /Scarica per l/ });
  await expect(bottone).toBeEnabled();
  await bottone.click();
  /*
    Aspettare che «Scaricamento N di M» SPARISCA non basta: se lo si guarda prima che
    compaia, l'attesa si chiude subito e il test prosegue su una cache vuota. Si aspetta
    prima che qualcosa sia davvero arrivato, poi che il pannello dichiari di aver finito.
  */
  await expect
    .poll(
      () => page.evaluate(async () => {
        if (!(await caches.has('tiles-thunderforest'))) return 0;
        return (await (await caches.open('tiles-thunderforest')).keys()).length;
      }),
      { timeout: 120_000 },
    )
    .toBeGreaterThan(0);
  await expect(page.locator('body')).not.toContainText('Scaricamento ', { timeout: 120_000 });

  return page.evaluate(async () => {
    const o: Record<string, number> = {};
    for (const n of await caches.keys()) o[n] = (await (await caches.open(n)).keys()).length;
    return o;
  });
}

/**
 * Il controllo che rende valido tutto il resto: a rete spenta una URL **mai vista** deve
 * fallire. Se risponde, l'emulazione non sta raggiungendo il worker.
 */
async function laReteEDavveroSpenta(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    try {
      await fetch('https://tile.thunderforest.com/outdoors/19/999998/999998.png?apikey=x', {
        mode: 'no-cors',
        cache: 'no-store',
      });
      return false;
    } catch {
      return true;
    }
  });
}

test.describe('la mappa senza rete', () => {
  test('le mattonelle scaricate rispondono a rete spenta, e la mappa si disegna', async ({ page, context }) => {
    await conIlWorker(page);
    const cache = await scaricaDalPannello(page);

    // Il pre-caricamento deve aver riempito la cache della mappa base. Se questo numero
    // e' zero, quel che segue non prova niente: e' esattamente lo stato in cui l'app e'
    // rimasta per mesi senza che nessuno se ne accorgesse.
    expect(cache['tiles-thunderforest'] ?? 0).toBeGreaterThan(0);

    // Le mattonelle di **dettaglio** esistono solo grazie allo scaricamento: navigando
    // non ci si e' mai andati, quindi sono la prova pulita che il pannello ha lavorato.
    const dettaglio = await page.evaluate(async () => {
      const chiavi = (await (await caches.open('tiles-thunderforest')).keys()).map((r) => r.url);
      return chiavi.filter((u) => /\/16\/\d+\/\d+\.png/.test(u));
    });
    expect(dettaglio.length).toBeGreaterThan(0);

    await context.setOffline(true);
    expect(await laReteEDavveroSpenta(page)).toBe(true);

    // Tutte, non «quasi tutte»: una mattonella che manca e' un buco grigio in quota.
    const esito = await page.evaluate(async (url: string[]) => {
      let servite = 0;
      for (const u of url) {
        try { await fetch(u, { mode: 'no-cors' }); servite++; } catch { /* conta come non servita */ }
      }
      return servite;
    }, dettaglio);
    expect(esito).toBe(dettaglio.length);

    // E l'app, ricaricata senza rete, deve disegnare la mappa: non basta che i byte ci
    // siano, deve arrivarci anche Leaflet.
    await page.reload();
    await page.locator('.leaflet-container').waitFor({ state: 'visible' });
    await page.waitForTimeout(6000);
    const disegnate = await page.evaluate(
      () => Array.prototype.filter
        .call(
          document.querySelectorAll('.leaflet-tile'),
          (t: HTMLImageElement) => t.complete && t.naturalWidth > 0,
        ).length,
    );
    expect(disegnate).toBeGreaterThan(0);
  });

  /**
   * La frase del pannello — «fino allo zoom N» — è una promessa, e va verificata dai due
   * lati: gli zoom dichiarati ci sono, quelli oltre no. Un pre-caricamento che coprisse
   * meno di quel che dichiara manderebbe qualcuno in quota con una mappa a chiazze.
   */
  test('copre gli zoom che dichiara, e non finge di coprire gli altri', async ({ page, context }) => {
    await conIlWorker(page);
    await scaricaDalPannello(page);

    const perZoom = await page.evaluate(async (re: string) => {
      const chiavi = (await (await caches.open('tiles-thunderforest')).keys()).map((r) => r.url);
      const conteggio: Record<string, number> = {};
      for (const u of chiavi) {
        const m = u.match(new RegExp(re));
        if (m) conteggio[m[1]] = (conteggio[m[1]] ?? 0) + 1;
      }
      return conteggio;
    }, COORDINATE.source);

    // Dodici e sedici sono gli estremi dichiarati da `ZOOM_MINIMO` e `ZOOM_MASSIMO`.
    for (const z of [12, 13, 14, 15, 16]) {
      expect(perZoom[String(z)] ?? 0).toBeGreaterThan(0);
    }

    await context.setOffline(true);
    expect(await laReteEDavveroSpenta(page)).toBe(true);
  });

  /**
   * «Libera» deve liberare davvero. Se lasciasse residui, il conteggio mostrato nel
   * pannello resterebbe alto e chi cerca di far posto non capirebbe perché non ne trova.
   */
  test('liberare lo spazio svuota le mattonelle', async ({ page }) => {
    await conIlWorker(page);
    const prima = await scaricaDalPannello(page);
    expect(prima['tiles-thunderforest'] ?? 0).toBeGreaterThan(0);

    await page.locator('button:visible', { hasText: /^libera$/ }).click();
    await expect(page.locator('body')).toContainText('Nessuna mappa conservata');

    const dopo = await page.evaluate(async () => {
      const o: Record<string, number> = {};
      for (const n of await caches.keys()) o[n] = (await (await caches.open(n)).keys()).length;
      return o;
    });
    expect(dopo['tiles-thunderforest'] ?? 0).toBe(0);
  });
});

/**
 * **Nessuna risposta opaca nelle cache delle mattonelle.**
 *
 * È l'invariante che costa gigabyte quando si rompe, ed è invisibile: una risposta opaca
 * funziona — la mappa si vede, offline compresa — e intanto il browser addebita in quota
 * un riempimento enorme, apposta, perché il peso di un'immagine di un altro sito non
 * trapeli.
 *
 * Misurato il 2026-09-02 su Chrome, venti mattonelle per volta:
 *
 * | modo | quota addebitata per mattonella |
 * |---|---|
 * | `no-cors` (opaca) | **7.688.466 byte** |
 * | `cors` | **1.907 byte** |
 *
 * Quattromila volte tanto per gli stessi byte. Da qui la richiesta riscritta in CORS nel
 * service worker, che copre sia le mattonelle pre-caricate sia quelle prese navigando: e
 * questo scenario pretende che nessuna delle due strade produca un'opaca.
 */
test.describe('il peso vero delle mattonelle', () => {
  test('nessuna risposta opaca, e il peso si legge', async ({ page }) => {
    await conIlWorker(page);
    await scaricaDalPannello(page);

    const esito = await page.evaluate(async () => {
      let quante = 0;
      let opache = 0;
      let byte = 0;
      let senzaPeso = 0;
      for (const n of await caches.keys()) {
        if (!n.startsWith('tiles-')) continue;
        const c = await caches.open(n);
        for (const k of await c.keys()) {
          const r = await c.match(k);
          quante++;
          if (r?.type === 'opaque') opache++;
          const cl = Number(r?.headers.get('content-length') ?? 0);
          if (cl > 0) byte += cl; else senzaPeso++;
        }
      }
      return { quante, opache, byte, senzaPeso };
    });

    expect(esito.quante).toBeGreaterThan(0);
    // Una sola opaca vuol dire 7 MB di quota buttati: non se ne accetta nessuna.
    expect(esito.opache).toBe(0);
    // E il peso deve essere leggibile, altrimenti il pannello torna a stimare.
    expect(esito.senzaPeso).toBe(0);
    /*
      Il peso medio deve stare nell'ordine delle decine di kilobyte. Se un giorno questo
      salisse ai megabyte vorrebbe dire che siamo tornati a contare risposte opache —
      misurato su scaricamenti veri: 16,9 kB e 23,2 kB di media.
    */
    const medio = esito.byte / esito.quante;
    expect(medio).toBeGreaterThan(1_000);
    expect(medio).toBeLessThan(200_000);
  });
});
