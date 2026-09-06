import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * **La stessa suite e2e, sul motore di Safari.**
 *
 * Non è un iPhone: è il motore WebKit vero (lo stesso di Safari) che gira in locale.
 * Copre la classe di difetti che questo progetto ha già pagato — WebKit che risponde
 * `prompt` a permesso concesso (v0.11.5) era un difetto del MOTORE, non di iOS — e non
 * copre quello che è solo di iOS: l'installazione della PWA da «Aggiungi a Home», il
 * comportamento in standalone, le safe area del notch, i prompt di sistema. Quelle
 * quattro cose si provano solo su un dispositivo vero (o su un servizio di device cloud).
 *
 * Config separata e non un secondo project nella base: girare due motori a ogni `test:e2e`
 * raddoppierebbe il tempo di ogni giro quotidiano, mentre questo è un controllo da
 * pre-rilascio. Si lancia con `npm run test:e2e:webkit`.
 */
export default defineConfig({
  ...base,
  projects: [
    {
      name: 'webkit',
      /*
        Desktop Safari, NON il profilo iPhone: il profilo iPhone forza il viewport mobile
        su TUTTA la suite, e i test scritti per il layout desktop trovavano gli elementi
        «presenti ma nascosti» dentro il foglio chiuso (provato: 9 rossi, tutti per
        questo). Il valore di questa config e' il MOTORE di Safari; i test dei layout
        mobili impostano gia' il loro viewport con `test.use`, e sotto questo project
        girano comunque sul motore WebKit.
      */
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } },
    },
  ],
});
