import { readFileSync } from 'fs';
import { join } from 'path';
import { ENDPOINT_OVERPASS } from '@/lib/overpass';

/**
 * Nelle regole del service worker **vince la prima che corrisponde**, e
 * `...defaultCache` finisce con un acchiappatutto per qualunque richiesta
 * cross-origin. Tutto cio' che sta dopo quello spread e' codice morto: sembra
 * configurato e non viene mai raggiunto.
 *
 * E' successo davvero, e per mesi:
 * - i cinque cache dei tile non esistevano nel browser (misurato: le uniche cache
 *   erano `serwist-precache` e `cross-origin`, con 32 mattonelle dentro), quindi la
 *   mappa offline aveva 32 voci per un'ora invece di 1000 per trenta giorni;
 * - la richiesta dei ripari veniva troncata a 10 secondi e tornava un 504 sintetico,
 *   mentre la stessa URL da riga di comando rispondeva 200.
 *
 * Nessuna delle due cose si vede leggendo il file: le regole ci sono, sono scritte
 * bene, e sono irraggiungibili.
 */
const sorgente = readFileSync(join(process.cwd(), 'src', 'app', 'sw.ts'), 'utf8');

/** Elenco `runtimeCaching`, riga per riga, senza commenti. */
function righeRegole(): string[] {
  const inizio = sorgente.indexOf('runtimeCaching: [');
  expect(inizio).toBeGreaterThan(-1);
  const fine = sorgente.indexOf('\n  ],', inizio);
  return sorgente
    .slice(inizio, fine)
    .split('\n')
    .filter((r) => !r.trim().startsWith('*') && !r.trim().startsWith('//') && !r.trim().startsWith('/*'));
}

describe('ordine delle regole del service worker', () => {
  test('`...defaultCache` e la ultima regola dell elenco', () => {
    const righe = righeRegole();
    const iDefault = righe.findIndex((r) => r.includes('...defaultCache'));
    expect(iDefault).toBeGreaterThan(-1);

    const dopo = righe.slice(iDefault + 1).filter((r) => /matcher:/.test(r));
    expect(dopo).toEqual([]);
  });

  test('le mattonelle hanno una regola PRIMA dell acchiappatutto', () => {
    const righe = righeRegole();
    const iDefault = righe.findIndex((r) => r.includes('...defaultCache'));
    const prima = righe.slice(0, iDefault).join('\n');
    for (const cache of ['tiles-osm', 'tiles-opentopomap', 'tiles-thunderforest', 'tiles-cyclosm', 'tiles-waymarked']) {
      expect(prima).toContain(cache);
    }
  });

  test('i servizi che non tollerano il taglio a 10 secondi stanno prima', () => {
    const righe = righeRegole();
    const iDefault = righe.findIndex((r) => r.includes('...defaultCache'));
    const prima = righe.slice(0, iDefault).join('\n');
    // Overpass mette in coda e la nostra query gli concede 20 secondi. La regola non
    // nomina piu' un host: si ricava dall'elenco delle porte (vedi il test sotto).
    expect(prima).toMatch(/hostOverpass/);
    // i dati di emergenza non vanno mai serviti da cache
    expect(prima).toMatch(/fires\|dpc-alerts/);
    expect(prima).toMatch(/rainviewer/);
    expect(prima).toMatch(/open-meteo/);
    expect(prima).toMatch(/eumetsat/);
    expect(prima).toMatch(/effis/i);
    expect(prima).toMatch(/pcm-dpc/);
  });

  /**
   * Le porte di Overpass sono un elenco (`lib/overpass.ts`) perche' su una normale rete
   * domestica italiana `overpass-api.de` viene risolto a 127.0.0.1. La regola del worker
   * si RICAVA da quell'elenco: se nominasse gli host a mano, una porta aggiunta domani
   * cadrebbe nel `defaultCache` con un'ora di cache.
   */
  test('la regola del worker copre tutte le porte Overpass, non un host scritto a mano', () => {
    const sw = readFileSync(join(process.cwd(), 'src', 'app', 'sw.ts'), 'utf8');
    expect(sw).toContain('const hostOverpass = new Set(ENDPOINT_OVERPASS.map');
    expect(sw).toContain('matcher: ({ url }) => hostOverpass.has(url.hostname)');
    for (const e of ENDPOINT_OVERPASS) {
      expect(sw).not.toContain(new URL(e).hostname);
    }
  });

  test('la query dei ripari e il worker sono d accordo sul tempo concesso', () => {
    const ripari = readFileSync(join(process.cwd(), 'src', 'lib', 'shelters-api.ts'), 'utf8');
    // la query dichiara un timeout a Overpass: il worker non deve tagliarlo prima
    expect(ripari).toMatch(/\[timeout:20\]/);
    const righe = righeRegole();
    const rigaOverpass = righe.find((r) => /hostOverpass/.test(r)) ?? '';
    expect(rigaOverpass).toContain('NetworkOnly');
  });
});
