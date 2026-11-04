import { test, expect, type Page } from '@playwright/test';
import { buildQuakesUrl } from '../src/lib/quakes-api';

/**
 * **I dati di emergenza non si servono da cache, nemmeno senza rete.**
 *
 * Il test unitario (`service-worker-ordine.test.ts`) legge le regole del worker; questo
 * guarda cosa fa il worker vero. Le due cose possono divergere, ed è già successo: per
 * mesi le regole delle mattonelle erano scritte bene e irraggiungibili.
 *
 * Il difetto che questo scenario impedisce: una richiesta che nessuna regola nostra prende
 * cade in `defaultCache` di Serwist, che la conserva — 24 ore per le route `/api/*`, un'ora
 * per gli altri siti — e la restituisce quando la rete manca o il servizio tarda più di 10
 * secondi. Fino alla v0.33.1, a rete spenta, il pannello delle valanghe mostrava il
 * bollettino conservato, come appena arrivato, invece di dire che la rete non c'è. I
 * terremoti finivano in cache anche loro, ma da lì non tornavano: la loro URL cambia a
 * ogni secondo. Qui si controllano tutte e due le cose, sulla stessa URL.
 *
 * Usa i servizi veri (il bollettino EAWS passa dalla nostra route, INGV si chiama
 * dal browser): due richieste, nessun carico per nessuno. Se uno dei due non risponde 200
 * la prova non si può fare, e il test lo dice al primo controllo.
 */

/** Una vista di montagna dentro i limiti della route (Gran Sasso). */
const VALANGHE = '/api/avalanche?south=42.3000&west=13.3000&north=42.6000&east=13.8000&zoom=10';

/** Al primo giro il worker si installa, al secondo prende il controllo della pagina. */
async function conIlWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('trektrak_tutorial_seen', '1');
    localStorage.setItem('trektrak_emergency_disclaimer_seen', '1');
  });
  await page.goto('/');
  await page.locator('.leaflet-container').waitFor({ state: 'visible' });
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller != null, null, { timeout: 60_000 });
}

/** Lo stato HTTP, o `null` se la richiesta non è proprio partita (rete spenta). */
async function stato(page: Page, url: string, cache: RequestCache = 'default'): Promise<number | null> {
  return page.evaluate(async ([u, c]) => {
    try {
      return (await fetch(u, { cache: c as RequestCache })).status;
    } catch {
      return null;
    }
  }, [url, cache] as const);
}

/** Le URL conservate in tutte le cache del worker che contengono `pezzo`. */
async function inCache(page: Page, pezzo: string): Promise<string[]> {
  return page.evaluate(async (p) => {
    const trovate: string[] = [];
    for (const n of await caches.keys()) {
      for (const k of await (await caches.open(n)).keys()) if (k.url.includes(p)) trovate.push(`${n}: ${k.url}`);
    }
    return trovate;
  }, pezzo);
}

test.describe('i dati di emergenza senza rete', () => {
  for (const [nome, url, pezzo] of [
    ['valanghe', VALANGHE, '/api/avalanche'],
    // La URL che chiede l'app, costruita dalla stessa funzione.
    ['terremoti', buildQuakesUrl(new Date()), 'webservices.ingv.it'],
  ] as const) {
    test(`${nome}: non restano in cache, e a rete spenta la richiesta fallisce`, async ({ page, context }) => {
      await conIlWorker(page);

      // Senza una risposta buona non c'è niente che una cache potrebbe conservare, e il
      // resto non dimostrerebbe nulla.
      expect(
        await stato(page, url),
        `${nome}: il servizio a monte non ha risposto 200, la prova non si può fare (non è il worker)`,
      ).toBe(200);
      // Il worker scrive in cache dopo aver risposto: si lascia il tempo di farlo. «Soft»
      // perché, se fallisce, conta vedere anche il passo dopo: che cosa arriva senza rete.
      await page.waitForTimeout(1000);
      expect.soft(await inCache(page, pezzo)).toEqual([]);

      /*
        `no-store` scavalca la cache HTTP del browser, non quella del worker (`caches.match`
        non guarda il modo della richiesta): se il worker conservasse la risposta, qui
        tornerebbe 200. Serve perché INGV dichiara `max-age=60` e la URL si chiede di nuovo
        dopo pochi secondi; nell'app non succede, perché la URL dei terremoti cambia a ogni
        secondo (`starttime`).
      */
      await context.setOffline(true);
      expect(await stato(page, url, 'no-store')).toBeNull();
    });
  }
});
