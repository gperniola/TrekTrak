import { test as base, expect, type Page } from '@playwright/test';

/**
 * Impalcatura comune agli scenari end-to-end.
 *
 * **Perché la rete si finge tutta.** Questi test devono dire se l'app funziona, non se
 * oggi Nominatim risponde: senza stub sarebbero lenti, incostanti, e fallirebbero per
 * ragioni che non riguardano il codice. Il progetto ha già imparato quanto costa
 * confondere «il servizio non risponde» con «l'app è rotta» — un layer è stato dato per
 * guasto per giorni mentre il problema era un nome DNS che si risolveva a 127.0.0.1.
 */

/** Un PNG trasparente 1×1, al posto delle mattonelle della mappa. */
const TILE_VUOTA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export async function fingiLaRete(page: Page): Promise<void> {
  // Mattonelle: un pixel trasparente. La mappa funziona lo stesso — Leaflet non ha
  // bisogno di vedere il terreno per calcolare coordinate e zoom.
  await page.route(/tile\.(thunderforest|opentopomap|openstreetmap|waymarkedtrails)|tile-cyclosm|tilecache\.rainviewer/, (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: TILE_VUOTA }),
  );

  // Geocodifica inversa: il nome che l'app dà a un waypoint appena messo.
  await page.route(/nominatim\.openstreetmap\.org\/reverse/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Colle di Prova', address: { peak: 'Colle di Prova' } }),
    }),
  );

  // Ricerca di località.
  await page.route(/nominatim\.openstreetmap\.org\/search/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ display_name: 'Campo Imperatore, Abruzzo', lat: '42.4419', lon: '13.5595' }]),
    }),
  );

  // Quote: la nostra route interna, che a sua volta chiama OpenTopoData.
  await page.route(/\/api\/elevation/, (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ elevation: 2130 }, { elevation: 2335 }] }),
    }),
  );

  // Percorso su sentiero: senza stub ogni tratta aspetterebbe OpenRouteService.
  await page.route(/openrouteservice\.org/, (r) =>
    r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );

  // Overpass (rifugi e punti del quiz) e i layer di emergenza: fuori dai casi in prova.
  await page.route(/overpass|firms|effis|eumetsat|pcm-dpc|open-meteo/, (r) =>
    r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
}

/** Stato di partenza: guida già vista, nessun popup, profilo scelto. */
export async function apriApp(
  page: Page,
  opzioni: { profilo?: 'imparo' | 'montagna'; guidaDaVedere?: boolean; hash?: string } = {},
): Promise<void> {
  const { profilo = 'montagna', guidaDaVedere = false, hash = '' } = opzioni;
  await fingiLaRete(page);
  await page.addInitScript(
    ({ profilo, guidaDaVedere }) => {
      /*
       * Gli appunti in headless non sono affidabili: `writeText` puo' restare appesa
       * anche con i permessi concessi, e un test bloccato li' direbbe «il link non
       * funziona» quando il problema e' il browser senza finestra. Si intercetta la
       * scrittura — che e' esattamente cio' che fa l'app — e si legge da qui.
       */
      const originale = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      Object.defineProperty(window, '__ultimoLink', { value: '', writable: true });
      if (navigator.clipboard) {
        navigator.clipboard.writeText = async (t: string) => {
          (window as unknown as { __ultimoLink: string }).__ultimoLink = t;
          try { await originale?.(t); } catch { /* in headless puo' fallire: non importa */ }
        };
      }
      if (!guidaDaVedere) localStorage.setItem('trektrak_tutorial_seen', '1');
      localStorage.setItem('trektrak_whatsnew_version', '99.0.0');
      localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
      localStorage.setItem('trektrak_profilo', profilo);
    },
    { profilo, guidaDaVedere },
  );
  await page.goto(`/${hash}`);
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  if (!guidaDaVedere) await chiudiNovita(page);
}

/**
 * Chiude il popup delle novita', se c'e'.
 *
 * Non basta scrivere una versione qualunque in `trektrak_whatsnew_version`: il popup
 * compare quando il valore salvato **e' diverso** da quello dell'ultimo rilascio, quindi
 * un numero inventato lo fa apparire invece di zittirlo. Al primo giro questo ha fatto
 * fallire sette scenari su dieci — la finestra si prendeva i clic diretti alla mappa, e
 * i test dicevano «il waypoint non nasce» quando il problema era il velo davanti.
 *
 * Si chiude quello che c'e' invece di indovinare la versione: cosi' non va aggiornato a
 * ogni rilascio.
 */
export async function chiudiNovita(page: Page): Promise<void> {
  const popup = page.getByRole('dialog', { name: /Novit/ });
  if (!(await popup.isVisible().catch(() => false))) return;
  await popup.getByRole('button', { name: /Chiudi|Ho capito|Inizia|Salta/ }).last().click();
  await popup.waitFor({ state: 'hidden' });
}

/**
 * Un tocco sulla mappa, alle coordinate in pixel indicate dal centro.
 *
 * Il clic va sul contenitore di Leaflet e non su un elemento qualunque: e' cosi' che
 * nasce un waypoint, ed e' anche il gesto che due volte in questo progetto ha creato
 * waypoint indesiderati sotto i pannelli.
 */
export async function tocca(page: Page, dx: number, dy: number): Promise<void> {
  const mappa = page.locator('.leaflet-container');
  const r = (await mappa.boundingBox())!;
  await page.mouse.click(r.x + r.width / 2 + dx, r.y + r.height / 2 + dy);
}

/**
 * Quanti waypoint ci sono sulla mappa.
 *
 * Si contano i marker che **dichiarano di essere waypoint**, non tutti i
 * `.leaflet-marker-icon`: sulla mappa vivono anche altri marker, e al primo giro questo
 * conteggio dava «2» su un itinerario vuoto. L'icona di un waypoint porta il suo nome
 * accessibile («Waypoint 1»), che e' anche cio' che sente chi non vede.
 */
export async function contaWaypoint(page: Page): Promise<number> {
  return page.locator('.leaflet-marker-icon', { hasText: /Waypoint \d+/ }).count();
}

/**
 * Il pannello dell'editor.
 *
 * A larghezza da scrivania e' sempre a schermo; sotto `lg` bisogna aprirlo dalla barra in
 * basso. Questi test girano a 1280 px, quindi non c'e' niente da aprire — la funzione
 * esiste per dirlo una volta invece di lasciarlo implicito in ogni scenario.
 */
export async function apriEditor(page: Page): Promise<void> {
  const scheda = page.getByRole('button', { name: 'Editor', exact: true });
  if (await scheda.isVisible().catch(() => false)) await scheda.click();
}

export const test = base;
export { expect };
