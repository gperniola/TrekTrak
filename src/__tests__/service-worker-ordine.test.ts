import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ENDPOINT_OVERPASS } from '@/lib/overpass';
import { buildQuakesUrl } from '@/lib/quakes-api';
import { SENSORI_NEVE, urlMattonellaNeve } from '@/lib/snow-cover';
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

interface Regola { re: RegExp; handler: string }

/**
 * Le regole con un'espressione regolare, nell'ordine, ciascuna col nome del suo gestore
 * (`NetworkOnly`, `tileHandler`…). Le regole scritte come funzione (Overpass) non si
 * possono valutare da qui e restano fuori: riguardano solo i loro host.
 */
function regoleInOrdine(): Regola[] {
  const righe = righeRegole();
  const iDefault = righe.findIndex((r) => r.includes('...defaultCache'));
  const out: Regola[] = [];
  righe.slice(0, iDefault).forEach((r, i, tutte) => {
    const m = r.match(/matcher:\s*\/(.+)\/([a-z]*),/);
    if (!m) return;
    const conHandler = r.includes('handler:') ? r : tutte[i + 1] ?? '';
    const h = conHandler.match(/handler:\s*(?:new\s+)?(\w+)/);
    out.push({ re: new RegExp(m[1], m[2]), handler: h ? h[1] : '?' });
  });
  return out;
}

const ORIGINE = 'https://trektrak.example';

/**
 * Chi risponde a una URL: il gestore della **prima** regola che la prende, o
 * `defaultCache` se nessuna delle nostre la prende. Riproduce la regola del router di
 * Serwist (e di Workbox) per le espressioni regolari: per un altro sito l'espressione
 * deve corrispondere **dall'inizio** della URL, altrimenti la regola non vale.
 */
function chiRisponde(url: string): string {
  const u = new URL(url);
  const stessoSito = u.origin === ORIGINE;
  for (const { re, handler } of regoleInOrdine()) {
    re.lastIndex = 0;
    const m = re.exec(u.href);
    if (!m) continue;
    if (!stessoSito && m.index !== 0) continue;
    return handler;
  }
  return 'defaultCache';
}

/**
 * **I dati che dichiarano la propria età non si servono mai da cache.**
 *
 * Quello che resta fuori da queste regole cade in `defaultCache`, che non è innocuo: le
 * route `/api/*` vanno in `NetworkFirst` con 24 ore di cache (e la scadenza si conta
 * dall'ultimo uso, quindi chi apre l'app ogni giorno senza campo non la vede mai
 * scadere); gli altri siti in `NetworkFirst` per un'ora. Basta la rete spenta, o un
 * servizio che ci mette più di 10 secondi, e il worker restituisce la copia vecchia: il
 * pannello scrive «Aggiornato alle» con l'ora di adesso sopra il bollettino di ieri.
 *
 * Fino alla v0.33.1 valanghe e terremoti stavano fuori da queste regole, per una svista:
 * gli altri dati di emergenza c'erano tutti.
 */
describe('i dati dal vivo vanno sempre in rete', () => {
  test('il controllo sa leggere le regole: una mattonella va alla sua cache, un indirizzo qualunque in fondo', () => {
    expect(chiRisponde('https://a.tile.openstreetmap.org/12/2190/1490.png')).toBe('tileHandler');
    expect(chiRisponde('https://nominatim.openstreetmap.org/search?q=Chieti')).toBe('defaultCache');
  });

  test.each([
    ['focolai', `${ORIGINE}/api/fires?bbox=6.6,35.4,18.6,47.2`],
    ['allerta DPC', `${ORIGINE}/api/dpc-alerts`],
    ['valanghe', `${ORIGINE}/api/avalanche?south=42.0000&west=13.0000&north=43.0000&east=14.0000&zoom=9`],
    ['terremoti', buildQuakesUrl(new Date('2026-11-04T10:00:00Z'))],
    ['aree bruciate e FWI', 'https://maps.effis.emergency.copernicus.eu/effis?service=WMS&request=GetMap'],
    ['bollettino DPC', 'https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/preview/x.json'],
    ['radar', 'https://api.rainviewer.com/public/weather-maps.json'],
    ['previsione', 'https://api.open-meteo.com/v1/forecast?latitude=42.35&longitude=14.17'],
    ['instabilità', 'https://view.eumetsat.int/geoserver/wms?service=WMS&request=GetMap'],
    ['neve', urlMattonellaNeve(SENSORI_NEVE[0].layer, '2026-11-04', 8, 137, 95)],
  ])('%s: NetworkOnly', (_, url) => {
    expect(chiRisponde(url)).toBe('NetworkOnly');
  });

  /**
   * L'elenco qui sopra è scritto a mano, e una fonte nuova si può dimenticare in due posti
   * insieme. Per le **nostre** route no: si leggono dalla cartella, e ognuna deve essere
   * esclusa dalla cache oppure stare qui sotto con il motivo. Una route aggiunta senza
   * deciderlo fa fallire il test — è la svista che ha lasciato fuori le valanghe.
   */
  const ROUTE_CHE_SI_POSSONO_CONSERVARE: Record<string, string> = {
    elevation: 'quote del terreno: non cambiano nel tempo, una copia conservata non è mai vecchia',
    shared: 'solo POST, che il worker non intercetta (e la libreria è spenta)',
  };

  test('ogni route /api è esclusa dalla cache, o è scritto perché no', () => {
    const route = readdirSync(join(process.cwd(), 'src', 'app', 'api'), { withFileTypes: true })
      .filter((v) => v.isDirectory())
      .map((v) => v.name);
    expect(route.length).toBeGreaterThan(0);
    const scoperte = route.filter((nome) => !(nome in ROUTE_CHE_SI_POSSONO_CONSERVARE)
      && chiRisponde(`${ORIGINE}/api/${nome}?x=1`) !== 'NetworkOnly');
    expect(scoperte).toEqual([]);
  });
});

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

  test('la neve di GIBS non si serve mai da cache', () => {
    const righe = righeRegole();
    const iDefault = righe.findIndex((r) => r.includes('...defaultCache'));
    const riga = righe.slice(0, iDefault).find((r) => /gibs/i.test(r)) ?? '';
    expect(riga).toContain('NetworkOnly');
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
