import { test, expect, apriApp } from './supporto';
import type { Page } from '@playwright/test';

/**
 * **La legenda segue l'interruttore** (segnalato il 2026-09-04).
 *
 * «Quando nel layer delle emergenze attivo un layer, fai aprire in automatico anche la
 * tendina della legenda; quando la disattivo, se è aperta falla chiudere in automatico.»
 *
 * ## Perché serve un test che guarda lo schermo
 *
 * La regola è verificata senza browser (`riga-aperta.ts` e i test di componente), e quella
 * è la parte facile. Quello che nessuno dei due può dire è se **la legenda si legge
 * davvero**: fra il tocco e la comparsa c'è il disclaimer al primo uso, che è un dialogo
 * modale, e il pannello è un foglio che scorre — al primo tentativo il dettaglio si apriva
 * ma restava sotto il bordo inferiore, quindi a schermo non era cambiato niente.
 *
 * È la lezione ripetuta di questo progetto: la campagna di review guarda il codice, non il
 * comportamento a dito sullo schermo.
 */

const apriPannello = async (page: Page) => {
  await page.getByRole('button', { name: /Layer di emergenza/ }).click();
  await expect(page.getByRole('switch', { name: 'Rifugi e ricoveri' })).toBeVisible();
};

/**
 * `Rifugi e ricoveri` è il layer di prova: la sua legenda ha voci con un testo stabile e
 * non dipende da una risposta di rete per comparire.
 */
const LEGENDA_RIPARI = /Rifugio|Bivacco|Ricovero/i;

test.describe('la legenda segue l interruttore', () => {
  test.use({ viewport: { width: 412, height: 823 } });

  test('accendendo un layer, la sua legenda compare e si legge', async ({ page }) => {
    await apriApp(page); // il disclaimer risulta gia' accettato: lo fa `apriApp`
    await apriPannello(page);

    const riga = page.getByRole('button', { name: /Rifugi e ricoveri/ });
    await expect(riga).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('switch', { name: 'Rifugi e ricoveri' }).click();

    await expect(riga).toHaveAttribute('aria-expanded', 'true');
    // **Visibile**, non solo presente: e' la differenza fra il DOM e lo schermo.
    const voce = page.getByText(LEGENDA_RIPARI).first();
    await expect(voce).toBeVisible();
    const riquadro = await voce.boundingBox();
    expect(riquadro).not.toBeNull();
    // E dentro lo schermo: un dettaglio che si apre sotto il bordo non e' comparso.
    expect(riquadro!.y).toBeGreaterThanOrEqual(0);
    expect(riquadro!.y + riquadro!.height).toBeLessThanOrEqual(823);
  });

  test('spegnendolo, la legenda se ne va', async ({ page }) => {
    await apriApp(page); // il disclaimer risulta gia' accettato: lo fa `apriApp`
    await apriPannello(page);

    const interruttore = page.getByRole('switch', { name: 'Rifugi e ricoveri' });
    await interruttore.click();
    await expect(page.getByText(LEGENDA_RIPARI).first()).toBeVisible();

    await interruttore.click();
    await expect(page.getByRole('button', { name: /Rifugi e ricoveri/ }))
      .toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText(LEGENDA_RIPARI)).toHaveCount(0);
  });

  /**
   * **Il disclaimer al primo uso vince sull'apertura automatica.** Se lo si annulla, il
   * layer non si accende — e quindi la legenda non deve comparire. È il motivo per cui il
   * dettaglio reagisce allo stato del layer e non al tocco.
   */
  test('annullando il disclaimer, la legenda non compare', async ({ page }) => {
    await apriApp(page);
    /*
      `apriApp` accetta il disclaimer per tutti gli scenari — e' un dialogo che
      altrimenti si mette di mezzo in ogni test. Qui serve, quindi si toglie la chiave a
      pagina aperta: `useAccendiLayer` la rilegge al momento del tocco, percio' non
      serve ricaricare (e ricaricando la rimetterebbe lo script di avvio).
    */
    await page.evaluate(() => localStorage.removeItem('trektrak_emergency_disclaimer_seen'));
    await apriPannello(page);

    await page.getByRole('switch', { name: 'Rifugi e ricoveri' }).click();
    // Il pannello dei layer e' anch'esso un `dialog`: si cerca il pulsante, non il ruolo.
    await page.getByRole('button', { name: 'Annulla' }).click();

    await expect(page.getByRole('switch', { name: 'Rifugi e ricoveri' }))
      .toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('button', { name: /Rifugi e ricoveri/ }))
      .toHaveAttribute('aria-expanded', 'false');
  });

  /** Il tocco sul nome continua a funzionare: l'automatismo si aggiunge, non sostituisce. */
  test('toccare il nome apre la legenda senza accendere il layer', async ({ page }) => {
    await apriApp(page); // il disclaimer risulta gia' accettato: lo fa `apriApp`
    await apriPannello(page);

    await page.getByRole('button', { name: /Rifugi e ricoveri/ }).click();
    await expect(page.getByText(LEGENDA_RIPARI).first()).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Rifugi e ricoveri' }))
      .toHaveAttribute('aria-checked', 'false');
  });
});
