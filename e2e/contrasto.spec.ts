import { test, expect, apriApp, tocca, contaWaypoint } from './supporto';
import type { Page } from '@playwright/test';

/**
 * Il contrasto **misurato sul DOM vero**, nei due temi.
 *
 * ## Perché questo scenario esiste
 *
 * Il colore è la parte dell'interfaccia che nessuno strumento guardava:
 *
 * - **Lighthouse dà 100** e non serve, perché esamina solo ciò che è a schermo in quel
 *   momento. Quasi tutto il testo dell'app vive in pannelli chiusi, schede non aperte,
 *   stati non raggiunti.
 * - I **test unitari** verificano i token del tema fra loro, cioè le coppie che qualcuno si
 *   è ricordato di elencare. Non sanno quale fondo stia davvero sotto quale testo.
 *
 * Nel divario fra i due, il 2026-09-02, stavano: novantasei usi di una classe a 3,67:1, un
 * testo a **1,94:1** nel pannello Progresso, un segnaposto a 2,35:1, tre maniglie a 2,35:1
 * e il pulsante di un avviso a 4,28:1. Un audit scritto a mano nella console del browser li
 * ha trovati in dieci minuti — e poi è stato buttato. Questo file è quell'audit, tenuto.
 *
 * ## Come misura
 *
 * Per ogni elemento che contiene testo proprio: il colore calcolato, il **fondo composto**
 * risalendo gli antenati (componendo l'alfa: `bg-black/20` sopra il verde non è nero), e il
 * rapporto WCAG. Soglia 4,5:1, che scende a 3:1 solo per il testo grande — 24px, o 18,66px
 * in grassetto.
 *
 * ## Cosa scarta, e perché non è un buco
 *
 * Il testo dipinto da un **gradiente** (`bg-clip-text`) ha `color: transparent`: il colore
 * visibile non sta in nessuna proprietà interrogabile, quindi non è giudicabile qui.
 * Le **emoji** portano i propri colori nel font e ignorano `color`, quindi un rapporto
 * calcolato su di esse non dice nulla di ciò che si vede.
 *
 * ## Una trappola che ha morso davvero
 *
 * Il service worker può servire la **CSS di un build precedente**, e allora l'audit misura
 * il vecchio design con valori stabili e credibili. Qui la suite gira su `next dev`, dove
 * il worker è disattivato, e non capita. Misurando a mano su una build di produzione va
 * disiscritto prima.
 */

/** La formula WCAG e la composizione dell'alfa, iniettate nella pagina. */
const AUDIT = `
  (() => {
    const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const L = (a) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
    const rap = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const parti = (s) => { const n = (s.match(/[\\d.]+/g) || []).map(Number); return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 }; };
    const sopra = (f, d) => f.rgb.map((c, i) => Math.round(c * f.a + d[i] * (1 - f.a)));

    const fondoDi = (el) => {
      const liv = [];
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const p = parti(getComputedStyle(e).backgroundColor);
        if (p.a === 0) continue;
        liv.push(p);
        if (p.a === 1) break;
      }
      let b = [255, 255, 255];
      for (let i = liv.length - 1; i >= 0; i--) b = sopra(liv[i], b);
      return b;
    };

    /* Le emoji si colorano dal font e ignorano \`color\`: un rapporto su di esse non
       descrive nulla di cio' che si vede. */
    const soloEmoji = (t) => t.length > 0 && !/[\\p{L}\\p{N}]/u.test(t);

    const guasti = [];
    for (const el of document.querySelectorAll('*')) {
      const propri = [];
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && (n.textContent || '').trim().length > 1) propri.push(n.textContent.trim());
      }
      if (propri.length === 0) continue;
      const testo = propri.join(' ');
      if (soloEmoji(testo)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.opacity === '0') continue;
      const col = parti(st.color);
      /* Colore trasparente = testo dipinto da un gradiente: non giudicabile. */
      if (col.a === 0) continue;
      const px = parseFloat(st.fontSize);
      const soglia = (px >= 24 || (px >= 18.66 && Number(st.fontWeight) >= 700)) ? 3 : 4.5;
      const fondo = fondoDi(el);
      const c = rap(sopra(col, fondo), fondo);
      if (c < soglia) {
        guasti.push({
          testo: testo.slice(0, 40), rapporto: Number(c.toFixed(2)), serve: soglia,
          px: Math.round(px), classi: String(el.className || '').slice(0, 60),
        });
      }
    }
    return guasti;
  })()
`;

interface Guasto {
  testo: string;
  rapporto: number;
  serve: number;
  px: number;
  classi: string;
}

async function guasti(page: Page): Promise<Guasto[]> {
  return page.evaluate(AUDIT) as Promise<Guasto[]>;
}

/**
 * Il tema si impone sull'elemento radice, com'è fatto in `lib/useTema.ts`.
 *
 * L'attesa dopo non è superstizione: le classi hanno `transition-colors`, e misurare a
 * transizione in corso restituisce il colore **interpolato** — un numero plausibile e
 * falso.
 */
async function conTema(page: Page, tema: 'scuro' | 'chiaro'): Promise<void> {
  await page.evaluate((t) => document.documentElement.setAttribute('data-tema', t), tema);
  await page.waitForTimeout(1200);
}

/** Un messaggio che dice cosa correggere, invece del solo «1 non è 0». */
const racconta = (g: Guasto[]): string =>
  g.length === 0 ? 'nessun guasto' : g
    .map((x) => `«${x.testo}» ${x.rapporto}:1 (serve ${x.serve}) ${x.px}px — ${x.classi}`)
    .join('\n');

test.describe('il contrasto di cio che si vede', () => {
  for (const tema of ['scuro', 'chiaro'] as const) {
    test(`le viste principali nel tema ${tema}`, async ({ page }) => {
      await apriApp(page);
      await conTema(page, tema);

      const trovati: Guasto[] = [];
      trovati.push(...await guasti(page));

      for (const scheda of ['Editor', 'Libreria', 'Altro'] as const) {
        const b = page.getByRole('button', { name: scheda, exact: true });
        if (await b.isVisible().catch(() => false)) {
          await b.click();
          await page.waitForTimeout(1200);
          trovati.push(...await guasti(page));
        }
      }

      const mappa = page.getByRole('button', { name: 'Mappa', exact: true });
      if (await mappa.isVisible().catch(() => false)) await mappa.click();
      await page.locator('[aria-label="Impostazioni mappa"]:visible').first().click();
      await page.waitForTimeout(1200);
      trovati.push(...await guasti(page));

      expect(racconta(trovati)).toBe('nessun guasto');
    });
  }

  /**
   * **I popup, aperti** (TASK-63).
   *
   * Erano il caso peggiore e il più nascosto: Leaflet dà loro un fondo bianco per la sua
   * CSS, e il tema chiaro funziona **rovesciando la scala grigia**. Un fondo che non si
   * rovescia sotto colori che si rovesciano regge in un tema e crolla nell'altro — misurato
   * prima della correzione: `text-gray-600` in un popup faceva 7,56:1 nel tema scuro e
   * **1,54:1** nel chiaro, cioè invisibile.
   *
   * Nessun controllo statico poteva vederlo, perché dipende da una CSS di terze parti; e
   * nessun audit delle viste, perché un popup si apre solo toccando un marker.
   */
  for (const tema of ['scuro', 'chiaro'] as const) {
    test(`il popup di un waypoint nel tema ${tema}`, async ({ page }) => {
      await apriApp(page);
      await conTema(page, tema);

      await tocca(page, -60, -40);
      await expect.poll(() => contaWaypoint(page), { timeout: 15_000 }).toBe(1);

      await page.locator('.leaflet-marker-icon', { hasText: /Waypoint \d+/ }).first().click();
      await page.locator('.leaflet-popup-content').waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(1000);

      // Il popup deve esserci davvero, altrimenti questo scenario non guarda niente.
      await expect(page.locator('.leaflet-popup-content')).toBeVisible();
      expect(racconta(await guasti(page))).toBe('nessun guasto');
    });
  }

  /**
   * Che il popup abbia il fondo **dell'app** e non il bianco di Leaflet: è la correzione
   * del TASK-63, e senza questo controllo tornerebbe silenziosamente al bianco alla prima
   * volta che qualcuno aggiorna Leaflet o riordina la CSS.
   */
  test('il popup usa una superficie dell app, non il bianco di Leaflet', async ({ page }) => {
    await apriApp(page);
    await tocca(page, -60, -40);
    await expect.poll(() => contaWaypoint(page), { timeout: 15_000 }).toBe(1);
    await page.locator('.leaflet-marker-icon', { hasText: /Waypoint \d+/ }).first().click();
    await page.locator('.leaflet-popup-content-wrapper').waitFor({ state: 'visible', timeout: 10_000 });

    const fondo = await page.evaluate(() => {
      const w = document.querySelector('.leaflet-popup-content-wrapper')!;
      const atteso = getComputedStyle(document.documentElement).getPropertyValue('--grigio-800').trim();
      return { effettivo: getComputedStyle(w).backgroundColor, token: atteso };
    });
    const [r, g, b] = fondo.token.split(/\s+/).map(Number);
    expect(fondo.effettivo).toBe(`rgb(${r}, ${g}, ${b})`);
  });
});
