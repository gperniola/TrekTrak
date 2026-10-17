import { test, expect, apriApp } from './supporto';
import type { Page } from '@playwright/test';
import { leggiFixture, pngRgba } from '../src/__tests__/fixtures/gibs/png-sintetico';

/**
 * **Il layer della neve sullo schermo vero**, con un GIBS finto ma fedele.
 *
 * Le regole stanno nei test unitari (rete, composito, disegno, riassunto), e passano tutte
 * senza un browser. Quello che nessuno di loro puo' dire e' se i pezzi, montati, fanno la
 * cosa giusta in un motore vero: un `fetch` cross-origin che legge un header solo se il
 * server lo espone, il PNG decompresso con `DecompressionStream` (su WebKit e' il motivo di
 * `npm run test:e2e:webkit`), i pixel scritti su una tela di Leaflet, la riga del pannello,
 * il popup della pressione lunga.
 *
 * Il GIBS finto risponde come quello vero:
 * - Terra del 16/10 sulla mattonella `8/94/138` -> nubi su Monte Amaro (passaggio vero);
 * - Terra del 15/10 sulla stessa mattonella -> la neve del 13/10 (passaggio vero, il giorno
 *   e' finto: serve una giornata di sole dentro la finestra);
 * - tutto il resto -> **200 senza header**, con un PNG rosso pieno. E' cosi' che GIBS dice
 *   «nessun passaggio»: un 200 con un corpo che e' rumore. La regola che questo file prova
 *   e' che il rumore non arrivi mai a schermo.
 */

/** Mezzogiorno UTC: «oggi» per GIBS e' il 16, in qualunque fuso giri il test. */
const ADESSO = new Date('2026-10-16T12:00:00Z');

/** Il centro della mattonella `8/94/138`: a 1280×900 resta tutta a schermo. */
const VISTA_MATTONELLA = { lat: 42.565, lng: 14.766, z: 8 };
/** Monte Amaro, la vetta della Majella: nella neve del 13/10 il suo pixel vale 82. */
const AMARO = { lat: 42.0858, lng: 14.0858 };
const VISTA_AMARO = { ...AMARO, z: 10 };

const NUBE = Buffer.from(leggiFixture('terra-2026-10-16-8-94-138.png'));
const NEVE = Buffer.from(leggiFixture('terra-2026-10-13-8-94-138.png'));
/** Il rumore dei «nessun dato»: rosso pieno, cosi' una sua traccia a schermo non si confonde. */
const RUMORE = Buffer.from(pngRgba(256, 256, [255, 0, 0, 255]));

/*
  Il GIBS vero manda `access-control-allow-origin: *` su ogni risposta, 404 compresi. Senza,
  il browser trasformerebbe il rumore in un errore di rete — cioe' in «errore», riprovato —
  e lo scenario non proverebbe piu' la regola del 200 senza header. L'header che dice
  «passaggio vero» si legge solo se e' esposto, e GIBS lo espone.
*/
const CORS = { 'access-control-allow-origin': '*' };
const CON_DATI = {
  ...CORS,
  'access-control-expose-headers': 'layer-identifier-actual',
  'layer-identifier-actual': 'MODIS_Terra_NDSI_Snow_Cover_v6.1_STD',
};

const TERRA = '/MODIS_Terra_NDSI_Snow_Cover/default/';
/** Nell'URL di GIBS la `y` viene prima della `x`: z/y/x. */
const MATTONELLA = '/GoogleMapsCompatible_Level8/8/94/138.png';

async function gibsFinto(page: Page): Promise<void> {
  await page.route(/gibs\.earthdata\.nasa\.gov/, (r) => {
    const url = r.request().url();
    const terraQui = url.includes(TERRA) && url.endsWith(MATTONELLA);
    const corpo = terraQui && url.includes('/2026-10-16/') ? NUBE
      : terraQui && url.includes('/2026-10-15/') ? NEVE
        : null;
    return corpo
      ? r.fulfill({ status: 200, contentType: 'image/png', headers: CON_DATI, body: corpo })
      : r.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: RUMORE });
  });
}

/** Ogni passaggio «non pubblicato»: e' un guasto da dire, non un cielo vuoto. */
async function gibsTutto404(page: Page): Promise<void> {
  await page.route(/gibs\.earthdata\.nasa\.gov/, (r) =>
    r.fulfill({ status: 404, contentType: 'text/plain', headers: CORS, body: 'Not Found' }),
  );
}

async function apriConNeve(
  page: Page,
  vista: { lat: number; lng: number; z: number },
  rete: (page: Page) => Promise<void> = gibsFinto,
): Promise<void> {
  /*
    `setSystemTime` e non `setFixedTime`: si parte dal 16 a mezzogiorno, ma il tempo scorre.
    Con l'orologio fermo Leaflet non finisce mai la dissolvenza delle mattonelle (l'opacita'
    e' `(adesso - caricata) / 200 ms`, e con `Date` bloccato resta 0): le tele avrebbero i
    pixel giusti e lo schermo resterebbe vuoto — misurato, 12 mattonelle su 12 a opacita' 0.
    Il test durerebbe verde su una mappa che nessuno vede. I pochi secondi di uno scenario
    non spostano il giorno di GIBS.
  */
  await page.clock.setSystemTime(ADESSO);
  await page.addInitScript((v) => {
    localStorage.setItem('trektrak_settings', JSON.stringify({
      tolerances: {}, mapDisplay: { emergencyLayers: ['snow-cover'] },
    }));
    sessionStorage.setItem('tt_map_view', JSON.stringify(v));
  }, vista);
  await apriApp(page, { rete });
}

interface Conteggio {
  tele: number;
  composte: number;
  neve: number;
  /** Pixel di neve su tele davvero a schermo: opacita' piena, loro e del layer. */
  neveAVista: number;
  velo: number;
  rosso: number;
}

/**
 * I pixel delle tele della neve, letti dentro la pagina.
 *
 * La tela conserva i colori **premoltiplicati** per l'alfa: un `putImageData` di
 * `[71,85,105,115]` si rilegge con `getImageData` come `[71,84,104,115]` (misurato su
 * Chromium), perche' il colore passa da una moltiplicazione e da una divisione arrotondate.
 * Un confronto esatto fallirebbe su un velo giusto. Per questo R, G e B del velo hanno un
 * margine di ±2, mentre l'alfa — che non si arrotonda — si confronta esatta: 115 il velo,
 * 235 la neve.
 */
function contaPixel(page: Page): Promise<Conteggio> {
  return page.evaluate(() => {
    const tele = Array.from(document.querySelectorAll<HTMLCanvasElement>('.strato-neve canvas'));
    const c = { tele: tele.length, composte: 0, neve: 0, neveAVista: 0, velo: 0, rosso: 0 };
    for (const t of tele) {
      // Leaflet mette la classe quando il layer chiama `done` senza errore: composta.
      if (t.classList.contains('leaflet-tile-loaded')) c.composte++;
      const piena = (e: Element | null) => e != null && getComputedStyle(e).opacity === '1';
      const aVista = piena(t) && piena(t.parentElement) && piena(t.closest('.strato-neve'));
      const d = t.getContext('2d')?.getImageData(0, 0, t.width, t.height).data;
      if (!d) continue;
      for (let i = 0; i < d.length; i += 4) {
        const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]];
        if (a === 235) {
          c.neve++;
          if (aVista) c.neveAVista++;
        }
        if (a === 115 && Math.abs(r - 71) <= 2 && Math.abs(g - 85) <= 2 && Math.abs(b - 105) <= 2) c.velo++;
        if (a > 0 && r > 200 && g < 50 && b < 50) c.rosso++;
      }
    }
    return c;
  });
}

/** Coordinate nel mondo Web Mercator, in pixel, allo zoom `z` (le stesse di Leaflet e GIBS). */
function pixelDelMondo(lat: number, lng: number, z: number): { x: number; y: number } {
  const lato = 256 * 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * lato,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * lato,
  };
}

const pannello = (page: Page) => page.getByRole('dialog', { name: 'Layer di emergenza' });

async function apriPannello(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Layer di emergenza/ }).click();
  await expect(page.getByRole('switch', { name: 'Copertura nevosa (satellite)' }))
    .toHaveAttribute('aria-checked', 'true');
}

test.describe('il layer neve sullo schermo', () => {
  test('la neve si vede, le nubi hanno il velo, il rumore non lascia segni', async ({ page }) => {
    await apriConNeve(page, VISTA_MATTONELLA);

    /*
      Si aspetta che **tutte** le mattonelle a schermo siano composte, non solo quella con
      la neve: le altre sono fatte solo di rumore, e controllare il rosso prima che abbiano
      finito non proverebbe niente.
    */
    await expect.poll(async () => {
      const c = await contaPixel(page);
      return c.tele > 0 && c.composte === c.tele && c.neveAVista > 0;
    }, { timeout: 20_000 }).toBe(true);

    const c = await contaPixel(page);
    expect(c.neveAVista, 'pixel di neve (alfa 235) su una tela a schermo').toBeGreaterThan(0);
    expect(c.velo, 'pixel col velo «non visto»').toBeGreaterThan(0);
    /*
      Nella tavolozza di GIBS l'NDSI 100 e' rosso puro anche lui: qui il valore piu' alto
      della neve e' 86, quindi un rosso pieno a schermo puo' venire solo dal rumore.
    */
    expect(c.rosso, 'pixel rossi del rumore').toBe(0);
  });

  test('il pannello dice di che giorni sono le viste', async ({ page }) => {
    await apriConNeve(page, VISTA_MATTONELLA);
    await apriPannello(page);

    await expect(pannello(page)).toContainText('Viste dal 15 al 16 ottobre · MODIS Terra', { timeout: 20_000 });
  });

  test('la pressione lunga sulla vetta dice neve, e quando', async ({ page }) => {
    await apriConNeve(page, VISTA_AMARO);
    /*
      Prima si aspetta di **vedere** la neve, come chi preme sulla vetta. Non e' cortesia:
      i layer salvati nelle impostazioni si riaccendono un istante dopo la comparsa della
      mappa, e una pressione in quell'istante non trova ancora nessun layer da interrogare
      (misurato: 6 giri su 6 senza popup, col clic subito dopo l'apertura).
    */
    await expect.poll(async () => (await contaPixel(page)).neveAVista, { timeout: 20_000 }).toBeGreaterThan(0);

    /*
      Si mira al **centro del pixel GIBS** che contiene la vetta, non al centro dello
      schermo. La vetta cade a 0,05 pixel sorgente dal bordo superiore del suo pixel: a
      zoom 10 un pixel sorgente e' largo 4 pixel di schermo, quindi il centro esatto sta a
      0,2 pixel dal vicino di sopra (che vale 83), e l'arrotondamento dell'origine di
      Leaflet o del clic lo farebbe cadere da una parte o dall'altra a caso. Lo spostamento
      e' di un paio di pixel: e' sempre la vetta.
    */
    const centro = pixelDelMondo(AMARO.lat, AMARO.lng, 10);
    const sorgente = pixelDelMondo(AMARO.lat, AMARO.lng, 8);
    const scala = 2 ** (10 - 8);
    const dx = (Math.floor(sorgente.x) + 0.5) * scala - centro.x;
    const dy = (Math.floor(sorgente.y) + 0.5) * scala - centro.y;

    const mappa = (await page.locator('.leaflet-container').boundingBox())!;
    await page.mouse.click(mappa.x + mappa.width / 2 + dx, mappa.y + mappa.height / 2 + dy, { button: 'right' });

    await expect(page.locator('.emergency-featureinfo-popup'))
      .toContainText('Neve (indice 82) · vista il 15 ottobre da MODIS Terra', { timeout: 20_000 });
  });

  test('tutto 404: errore con Riprova, non nessun dato', async ({ page }) => {
    await apriConNeve(page, VISTA_MATTONELLA, gibsTutto404);
    await apriPannello(page);

    await expect(pannello(page).getByRole('button', { name: 'Riprova' })).toBeVisible({ timeout: 20_000 });
    await expect(pannello(page)).not.toContainText('Nessun dato disponibile');
  });
});
