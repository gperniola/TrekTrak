import { readFileSync } from 'fs';
import { join } from 'path';
import { ENDPOINT_OVERPASS } from '@/lib/overpass';
import { CACHE_TESSERE, TETTO_TESSERE } from '@/lib/tile-offline';

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
    /*
     * I nomi delle cache non sono più scritti qui: vengono da `CACHE_TESSERE`, che li
     * condivide col pannello dell'offline (task-37) — quello che dice quanto spazio
     * occupano e che li svuota. Due elenchi in due file sono due elenchi che divergono.
     */
    CACHE_TESSERE.forEach((_, i) => {
      expect(prima).toContain(`CACHE_TESSERE[${i}]`);
    });
  });

  /** Ogni nome dell'elenco deve avere la sua regola: cinque mappe, cinque cache. */
  test('c e una regola per ogni cache dichiarata', () => {
    const righe = righeRegole();
    const usati = righe.filter((r) => r.includes('CACHE_TESSERE[')).length;
    expect(usati).toBe(CACHE_TESSERE.length);
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

  /**
   * **Il tetto della cache e quello dello scaricamento non si conoscono, ma dipendono
   * l'uno dall'altro.** Un pre-caricamento riempie fino a `TETTO_TESSERE` voci in una
   * sola cache; se `maxEntries` fosse vicino a quel numero, le ultime mattonelle prese
   * sfratterebbero le prime — e si tornerebbe in quota con meta' mappa, senza che nulla
   * lo abbia segnalato, perche' lo sfratto e' silenzioso per progetto.
   *
   * Il margine chiesto qui e' il doppio: lo spazio per un pre-caricamento intero piu'
   * altrettanto di navigazione normale.
   */
  test('la cache tiene almeno il doppio di uno scaricamento intero', () => {
    const m = sorgente.match(/maxEntries:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(TETTO_TESSERE * 2);
  });

  /**
   * Le mattonelle sono le uniche cose che si riottengono da sole: quando lo spazio
   * finisce devono essere le prime a cadere, invece di far fallire la scrittura del
   * guscio dell'app o dei dati dell'utente.
   */
  test('le mattonelle sono dichiarate le prime da sacrificare quando lo spazio finisce', () => {
    expect(sorgente).toMatch(/purgeOnQuotaError:\s*true/);
  });

  /**
   * La riga che ha reso reale tutta la cache: senza, le risposte opache — quelle che
   * tornano dalle immagini di altri siti — venivano rifiutate in silenzio.
   */
  /**
   * **Le mattonelle si chiedono in CORS, e le risposte opache NON si accettano.**
   *
   * Storia in due atti. Prima: la cache non funzionava affatto, perche' Workbox rifiutava
   * le risposte opache — quelle dei tag `<img>` verso altri siti — e si e' aggiunto lo
   * stato `0` per accettarle. Poi, il 2026-09-02, si e' misurato quanto costano: il
   * browser addebita **7.688.466 byte di quota per mattonella opaca**, contro **1.907**
   * per la stessa mattonella chiesta in CORS. Un fattore quattromila.
   *
   * La correzione giusta non era accettare l'opaco ma **non produrlo**: si riscrive la
   * richiesta in CORS dentro il worker, cosi' anche le mattonelle conservate navigando
   * costano il loro peso vero. E lo stato `0` torna a essere rifiutato, di proposito: se
   * un giorno qualcosa tornasse opaco si preferisce che non venga conservato — il pannello
   * dira' «nessuna mappa conservata» — piuttosto che scoprire i gigabyte a cose fatte.
   */
  test('le mattonelle si chiedono in CORS', () => {
    expect(sorgente).toMatch(/requestWillFetch/);
    expect(sorgente).toMatch(/mode:\s*'cors'/);
  });

  test('le risposte opache non si accettano piu: costano 7 MB di quota l una', () => {
    expect(sorgente).toMatch(/CacheableResponsePlugin\(\{\s*statuses:\s*\[200\]/);
    expect(sorgente).not.toMatch(/statuses:\s*\[0,/);
  });
});
