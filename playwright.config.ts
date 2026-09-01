import { defineConfig, devices } from '@playwright/test';

/**
 * Test end-to-end (task-23).
 *
 * Esistono per una ragione che questo progetto ha imparato a sue spese: **i difetti che
 * contano stanno nel divario fra «i test passano» e «cosa si vede a schermo»**. La suite
 * unitaria è arrivata a millequattrocento casi verdi mentre l'app mostrava ventiquattro
 * caselle in cui non si poteva scrivere, prometteva nella guida funzioni appena nascoste,
 * e dichiarava un errore su un layer il cui unico problema era un nome DNS. Nessuno di
 * quei difetti era invisibile: erano invisibili *ai test*.
 *
 * Un browser vero, quindi, con Chromium soltanto: girano in locale, e tre motori
 * triplicherebbero il tempo per coprire differenze che questa app non sfrutta.
 */
export default defineConfig({
  testDir: './e2e',
  // Il criterio del task: tutti gli scenari sotto i 90 secondi.
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3210',
    // Solo quando serve: le tracce costano tempo e spazio a ogni giro.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `dev` e non `build && start`: il giro di build costa piu' dell'avvio a freddo, e
    // qui interessa il comportamento, non il bundle di produzione.
    command: 'npx next dev -p 3210',
    url: 'http://127.0.0.1:3210',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
