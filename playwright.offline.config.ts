import { defineConfig, devices } from '@playwright/test';

/**
 * Lo scenario dell'uso **senza rete** (task-37), a parte dagli altri.
 *
 * Due ragioni per una configurazione tutta sua, e nessuna delle due è di comodo:
 *
 * 1. **Il service worker è spento in `dev`** (`disable: NODE_ENV === 'development'` in
 *    `next.config.mjs`). La suite normale gira su `next dev` perché è più veloce, ma lì
 *    non esiste nessuna cache: un test dell'offline scritto in quella suite passerebbe o
 *    fallirebbe per ragioni che non c'entrano con l'offline. Qui si costruisce e si serve
 *    per davvero.
 *
 * 2. **Le mattonelle non si possono fingere.** `page.route` non intercetta le richieste
 *    fatte dal service worker: gli stub di `e2e/supporto.ts` non lo raggiungono. Quindi
 *    questo scenario scarica mattonelle vere — poche, da un itinerario di duecento metri
 *    — e per questo non sta nel giro che si lancia a ogni modifica.
 *
 * Si lancia con `npm run test:e2e:offline`, prima di un rilascio che tocchi la cache o il
 * service worker.
 */
export default defineConfig({
  testDir: './e2e-offline',
  // La costruzione è già fuori dal conteggio (sta in `webServer`), ma lo scaricamento
  // delle mattonelle vere e i due giri di installazione del worker non sono istantanei.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3211',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `build && start`: è il punto di tutto il file. Su `next dev` non c'è worker.
    command: 'npm run build && npx next start -p 3211',
    url: 'http://127.0.0.1:3211',
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
