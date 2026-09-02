import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CAMPIONE_PESO,
  PESO_MEDIO_TESSERA,
  scaricaTessere,
  spazioTessere,
  svuotaTessere,
} from '@/lib/tile-download';
import { CACHE_TESSERE } from '@/lib/tile-offline';

/**
 * La parte con la rete e il disco. Quel che conta qui non è il conteggio ma **le promesse
 * che l'interfaccia fa a chi sta per partire**: che una mattonella mancante non fermi le
 * altre, che «interrompi» interrompa davvero, e che liberare lo spazio non lasci residui.
 */

const originale = { fetch: global.fetch, caches: (global as { caches?: CacheStorage }).caches };

afterEach(() => {
  global.fetch = originale.fetch;
  (global as { caches?: CacheStorage }).caches = originale.caches;
  jest.restoreAllMocks();
});

/**
 * Una risposta finta e non una `Response` vera: in questo ambiente di test la classe non
 * esiste. Ora e' di tipo `cors` con stato 200, perche' e' quello che si ottiene dal
 * 2026-09-02 — e lo stato **si guarda**, per non contare fra le prese una mattonella che
 * il server non ha.
 */
const RISPOSTA_FINTA = { ok: true, status: 200, type: 'cors' } as unknown as Response;

const urlFinti = (quanti: number) =>
  Array.from({ length: quanti }, (_, i) => `https://a.tile.example/14/${i}/0.png`);

describe('scaricare le mattonelle', () => {
  test('le chiede tutte e conta quelle fatte', async () => {
    const fetchMock = jest.fn().mockResolvedValue(RISPOSTA_FINTA);
    global.fetch = fetchMock as unknown as typeof fetch;
    const esito = await scaricaTessere(urlFinti(20));
    expect(esito.fatte).toBe(20);
    expect(esito.fallite).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });

  /**
   * **`cors`, e non `no-cors`: è la differenza fra megabyte e gigabyte.**
   *
   * La prima versione usava `no-cors` per somigliare alle richieste che Leaflet fa coi
   * suoi `<img>`. Il prezzo era una risposta **opaca**, e il browser conta le risposte
   * opache in quota con un riempimento enorme — apposta, perché il loro peso non trapeli.
   *
   * Misurato il 2026-09-02 su Chrome, venti mattonelle per volta, leggendo
   * `navigator.storage.estimate()`:
   *
   * | modo | quota addebitata per mattonella |
   * |---|---|
   * | `no-cors` | **7.688.466 byte** |
   * | `cors` | **1.907 byte** |
   *
   * Quattromila volte tanto, per gli stessi byte sulla rete. Si può fare perché tutti e
   * cinque i servizi che l'app usa rispondono `access-control-allow-origin: *`, verificato
   * lo stesso giorno con `Origin` esplicito. Il service worker riscrive in CORS anche le
   * richieste dei tag `<img>`, così non resta nessuna via che produca risposte opache.
   */
  test('la richiesta e in CORS, non opaca', async () => {
    const fetchMock = jest.fn().mockResolvedValue(RISPOSTA_FINTA);
    global.fetch = fetchMock as unknown as typeof fetch;
    await scaricaTessere(urlFinti(1));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ mode: 'cors' });
  });

  /**
   * Con una risposta leggibile una mattonella mancante si **vede**. Prima, essendo opaca,
   * un 404 risultava «fatta» e in quota si trovava un buco grigio senza preavviso.
   */
  test('una mattonella che il server non ha non viene contata fra le prese', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      { ok: false, status: 404, type: 'cors' } as unknown as Response,
    ) as unknown as typeof fetch;
    const esito = await scaricaTessere(urlFinti(5));
    expect(esito.fatte).toBe(0);
    expect(esito.fallite).toBe(5);
  });

  /** Una mattonella che non arriva non deve fermare le altre quattrocentonovantanove. */
  test('un errore su una non ferma le altre', async () => {
    let n = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      n++;
      return n === 3 ? Promise.reject(new TypeError('rete')) : Promise.resolve(RISPOSTA_FINTA);
    }) as unknown as typeof fetch;
    const esito = await scaricaTessere(urlFinti(10));
    expect(esito.fatte).toBe(9);
    expect(esito.fallite).toBe(1);
  });

  test('l avanzamento arriva a chi lo mostra, e non torna indietro', async () => {
    global.fetch = jest.fn().mockResolvedValue(RISPOSTA_FINTA) as unknown as typeof fetch;
    const visti: number[] = [];
    await scaricaTessere(urlFinti(15), { onAvanzamento: (a) => visti.push(a.fatte) });
    expect(visti.length).toBe(15);
    expect(Math.max(...visti)).toBe(15);
    // monotono: nessun conteggio minore di uno precedente
    expect([...visti].sort((a, b) => a - b)).toEqual(visti);
  });

  test('l avanzamento dichiara sempre il totale giusto', async () => {
    global.fetch = jest.fn().mockResolvedValue(RISPOSTA_FINTA) as unknown as typeof fetch;
    const totali: number[] = [];
    await scaricaTessere(urlFinti(7), { onAvanzamento: (a) => totali.push(a.totali) });
    expect(totali.filter((v, i, t) => t.indexOf(v) === i)).toEqual([7]);
  });

  /**
   * «Interrompi» deve interrompere: chi ha toccato il pulsante non vuole aspettare altre
   * quattrocento richieste. E quello che e' arrivato resta — non si butta il lavoro fatto.
   */
  test('interrompendo, si smette di chiedere', async () => {
    const ac = new AbortController();
    let chiamate = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      chiamate++;
      if (chiamate === 5) ac.abort();
      return Promise.resolve(RISPOSTA_FINTA);
    }) as unknown as typeof fetch;

    const esito = await scaricaTessere(urlFinti(300), { signal: ac.signal });
    expect(esito.interrotto).toBe(true);
    // I sei lavoratori in volo possono finire il loro giro: qualche richiesta in piu' e'
    // fisiologica, quattrocento no.
    expect(chiamate).toBeLessThan(20);
  });

  test('un annullamento non viene contato come fallimento', async () => {
    const ac = new AbortController();
    ac.abort();
    global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')) as unknown as typeof fetch;
    const esito = await scaricaTessere(urlFinti(10), { signal: ac.signal });
    expect(esito.fallite).toBe(0);
    expect(esito.interrotto).toBe(true);
  });

  test('senza niente da scaricare non chiede niente', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const esito = await scaricaTessere([]);
    expect(esito.fatte).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('liberare le mattonelle', () => {
  test('svuotare tocca tutte le cache dell elenco', async () => {
    const toccate: string[] = [];
    (global as { caches?: unknown }).caches = {
      delete: (n: string) => { toccate.push(n); return Promise.resolve(true); },
    };
    const quante = await svuotaTessere();
    expect(quante).toBe(CACHE_TESSERE.length);
    expect(toccate).toEqual(CACHE_TESSERE.slice());
  });

  /** Una cache che si rifiuta non deve impedire di liberare le altre. */
  test('una cache che non si cancella non blocca le altre', async () => {
    (global as { caches?: unknown }).caches = {
      delete: (n: string) => (n === 'tiles-thunderforest'
        ? Promise.reject(new Error('no'))
        : Promise.resolve(true)),
    };
    expect(await svuotaTessere()).toBe(CACHE_TESSERE.length - 1);
  });
});

/**
 * **Il peso non si stima più: si legge.**
 *
 * Storia in tre passaggi, e ognuno correggeva il precedente.
 *
 * 1. La prima versione dichiarava «circa 15 kB a mattonella» e mostrava «1,0 MB» dove il
 *    browser ne contava **518**.
 * 2. Allora si è smesso di stimare e si è chiesto al browser, con
 *    `navigator.storage.estimate()`. Misurato: **4,5 MB per mattonella**, e il pannello
 *    annunciava gigabyte.
 * 3. Il 2026-09-02 si è scoperto **perché**: le mattonelle si chiedevano `no-cors`, la
 *    risposta era opaca, e il browser conta le risposte opache in quota con un riempimento
 *    enorme — misurato 7.688.466 byte l'una, contro 1.907 per la stessa mattonella in
 *    CORS. I gigabyte erano veri come *quota trattenuta*, non come traffico: una
 *    mattonella pesa fra i 7 e i 53 kB.
 *
 * Passati a CORS, la risposta è leggibile e il peso **vero** si ricava dal suo
 * `content-length` — verificato che è fra le intestazioni accessibili di una risposta CORS
 * e che coincide al byte con la dimensione del contenuto (28.719 su una mattonella OSM).
 * Niente più stime: nessuna delle due precedenti era vicina.
 */
describe('lo spazio delle mattonelle, misurato', () => {
  const conRisposte = (pesi: number[]) => ({
    // `has` per UNA cache sola: rispondendo a tutte e cinque il conteggio si moltiplica.
    has: (n: string) => Promise.resolve(n === CACHE_TESSERE[0]),
    open: () => Promise.resolve({
      keys: () => Promise.resolve(pesi.map((_, i) => ({ url: `https://x/${i}.png` }))),
      match: (r: { url: string }) => {
        const i = Number(/(\d+)\.png/.exec(typeof r === 'string' ? r : r.url)?.[1] ?? 0);
        return Promise.resolve({
          headers: new Map([['content-length', String(pesi[i])]]) as unknown as Headers,
        });
      },
    }),
  });

  test('somma i pesi veri dichiarati dalle risposte', async () => {
    (global as { caches?: unknown }).caches = conRisposte([28719, 45738, 8728]);
    const s = await spazioTessere();
    expect(s?.quante).toBe(3);
    expect(s?.byte).toBe(28719 + 45738 + 8728);
  });

  test('senza niente conservato dice zero, non «non lo so»', async () => {
    (global as { caches?: unknown }).caches = {
      has: () => Promise.resolve(true),
      open: () => Promise.resolve({ keys: () => Promise.resolve([]) }),
    };
    const s = await spazioTessere();
    expect(s?.quante).toBe(0);
    expect(s?.byte).toBe(0);
  });

  test('dove le cache non esistono si dice, invece di inventare uno zero', async () => {
    delete (global as { caches?: unknown }).caches;
    expect(await spazioTessere()).toBeNull();
  });
});

/**
 * Il peso medio serve a **una cosa sola**: dire in anticipo quanto occuperà uno
 * scaricamento. Misurato su due scaricamenti veri il 2026-09-02 — media di 16,9 kB su 168
 * mattonelle e di 23,2 kB su 78 — e tenuto appena sopra, a 25 kB.
 *
 * La prima scelta era 60 kB, presa dai campioni singoli per servizio (fino a 53 kB), e il
 * pannello annunciava «circa 9,8 MB» per uno scaricamento che ne occupava 2,7: un numero
 * che non somiglia alla realtà, cioè il difetto da cui questa faccenda è partita.
 */
describe('il peso medio di una mattonella', () => {
  test('e dell ordine delle decine di kilobyte, non dei megabyte', () => {
    expect(PESO_MEDIO_TESSERA).toBeGreaterThan(10 * 1024);
    expect(PESO_MEDIO_TESSERA).toBeLessThan(60 * 1024);
  });

  /**
   * Il confronto che spiega tutta questa faccenda: il tetto di cinquecento mattonelle
   * costa **decine di megabyte**, non gigabyte. Se un giorno questo test fallisse verso
   * l'alto, vorrebbe dire che siamo tornati a contare risposte opache.
   */
  test('cinquecento mattonelle sono decine di megabyte', () => {
    const perIlTetto = 500 * PESO_MEDIO_TESSERA;
    expect(perIlTetto).toBeGreaterThan(5e6);
    expect(perIlTetto).toBeLessThan(5e7);
  });
});

/**
 * **Leggere il peso di mille mattonelle costa troppo per mostrare un numero.**
 *
 * Misurato il 2026-09-02 su Chrome, build di produzione: leggere il `content-length` di
 * **168** voci ha richiesto **1.197 ms**. Con il tetto pieno — cinquecento per servizio,
 * mille in tutto — sarebbero circa sette secondi in cui il pannello non sa cosa dire.
 *
 * Da qui il campione: si leggono fino a `CAMPIONE_PESO` voci e si scala sul totale. Nel
 * caso comune il campione **è** tutto, quindi il numero è esatto; oltre, è una media
 * misurata su cento mattonelle vere — che è un'altra cosa rispetto a una costante
 * inventata, ed è dichiarata come approssimata invece di essere spacciata per esatta.
 */
describe('il peso si legge su un campione quando le voci sono tante', () => {
  const conPesi = (pesi: number[]) => ({
    has: (n: string) => Promise.resolve(n === CACHE_TESSERE[0]),
    open: () => Promise.resolve({
      keys: () => Promise.resolve(pesi.map((_, i) => ({ url: `https://x/${i}.png` }))),
      match: (r: { url: string }) => {
        const i = Number(/(\d+)\.png/.exec(typeof r === 'string' ? r : r.url)?.[1] ?? 0);
        return Promise.resolve({
          headers: new Map([['content-length', String(pesi[i])]]) as unknown as Headers,
        });
      },
    }),
  });

  test('poche voci: si leggono tutte e il numero e esatto', async () => {
    (global as { caches?: unknown }).caches = conPesi([1000, 2000, 3000]);
    const s = await spazioTessere();
    expect(s?.quante).toBe(3);
    expect(s?.byte).toBe(6000);
    expect(s?.stimato).toBe(false);
  });

  test('molte voci: si campiona, si scala, e si dichiara approssimato', async () => {
    // Tutte da 20.000 byte: la media del campione coincide col vero, e il totale scala.
    const molte = Array.from({ length: 600 }, () => 20_000);
    (global as { caches?: unknown }).caches = conPesi(molte);
    const s = await spazioTessere();
    expect(s?.quante).toBe(600);
    expect(s?.byte).toBe(600 * 20_000);
    expect(s?.stimato).toBe(true);
  });

  /** Il campione non deve leggere più di quanto dichiara: è il motivo per cui esiste. */
  test('con molte voci si leggono al massimo CAMPIONE_PESO risposte', async () => {
    let letture = 0;
    (global as { caches?: unknown }).caches = {
      has: (n: string) => Promise.resolve(n === CACHE_TESSERE[0]),
      open: () => Promise.resolve({
        keys: () => Promise.resolve(Array.from({ length: 900 }, (_, i) => ({ url: `https://x/${i}.png` }))),
        match: () => {
          letture++;
          return Promise.resolve({
            headers: new Map([['content-length', '20000']]) as unknown as Headers,
          });
        },
      }),
    };
    await spazioTessere();
    expect(letture).toBeLessThanOrEqual(CAMPIONE_PESO);
  });
});
