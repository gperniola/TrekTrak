import { readFileSync } from 'fs';
import { join } from 'path';
import { COSTO_QUOTA_PER_TESSERA, scaricaTessere, spazioTessere, svuotaTessere } from '@/lib/tile-download';
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
 * esiste, e il codice sotto esame non guarda la risposta — le richieste sono `no-cors`,
 * quindi lo stato non e' leggibile nemmeno in un browser.
 */
const RISPOSTA_FINTA = { ok: true, status: 0, type: 'opaque' } as unknown as Response;

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
   * `no-cors` di proposito: e' lo stesso tipo di richiesta che fa Leaflet coi suoi `<img>`,
   * e la voce di cache che ne risulta deve essere indistinguibile da quella che l'app usera'
   * poi. Con una richiesta di tipo diverso il pre-caricamento riempirebbe il disco senza
   * che nessuno peschi da li'.
   */
  test('la richiesta e dello stesso tipo di quelle di Leaflet', async () => {
    const fetchMock = jest.fn().mockResolvedValue(RISPOSTA_FINTA);
    global.fetch = fetchMock as unknown as typeof fetch;
    await scaricaTessere(urlFinti(1));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ mode: 'no-cors' });
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

describe('lo spazio delle mattonelle', () => {
  /** Un finto `caches` con un numero di voci per cache. */
  const finteCache = (voci: Record<string, number>) => ({
    has: (n: string) => Promise.resolve(n in voci),
    open: (n: string) => Promise.resolve({
      keys: () => Promise.resolve(Array.from({ length: voci[n] ?? 0 }, (_, i) => ({ url: `https://x/${i}` }))),
    }),
    delete: (n: string) => Promise.resolve(n in voci),
  });

  test('somma le voci di tutte le cache delle mattonelle', async () => {
    (global as { caches?: unknown }).caches = finteCache({ 'tiles-osm': 120, 'tiles-opentopomap': 80 });
    const s = await spazioTessere();
    expect(s?.quante).toBe(200);
  });

  test('senza niente conservato dice zero, non «non lo so»', async () => {
    (global as { caches?: unknown }).caches = finteCache({});
    expect((await spazioTessere())?.quante).toBe(0);
  });

  test('dove le cache non esistono si dice, invece di inventare uno zero', async () => {
    delete (global as { caches?: unknown }).caches;
    expect(await spazioTessere()).toBeNull();
  });

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
 * **Il numero che avevo inventato.** La prima versione dichiarava «circa 15 kB a
 * mattonella» e mostrava «1,0 MB» dove il browser ne contava **518**: le risposte opache
 * — quelle che tornano dalle immagini di altri siti — vengono conteggiate con un forte
 * arrotondamento in eccesso, apposta, perché il loro peso reale non trapeli.
 *
 * Misurato il 2026-09-01 su Chrome, build di produzione: dieci mattonelle nuove hanno
 * portato il conteggio da 518 a 563 MB. Il peso non si stima: si chiede al browser.
 */
describe('il costo di quota', () => {
  test('e dell ordine dei megabyte, non dei kilobyte', () => {
    expect(COSTO_QUOTA_PER_TESSERA).toBeGreaterThan(1024 * 1024);
    expect(COSTO_QUOTA_PER_TESSERA).toBeLessThan(20 * 1024 * 1024);
  });

  test('cinquecento mattonelle sono qualche gigabyte, e va saputo prima', () => {
    const perIlTetto = 500 * COSTO_QUOTA_PER_TESSERA;
    expect(perIlTetto).toBeGreaterThan(1e9);
  });

  /** `spazioTessere` conta e basta: il peso lo dichiara il browser, non noi. */
  test('spazioTessere non inventa un peso', async () => {
    (global as { caches?: unknown }).caches = {
      has: () => Promise.resolve(true),
      open: () => Promise.resolve({ keys: () => Promise.resolve([{ url: 'x' }]) }),
    };
    const s = await spazioTessere();
    expect(Object.keys(s ?? {})).toEqual(['quante']);
  });
});


/**
 * **Buttato il percorso, si buttano anche le sue mattonelle** (segnalato il 2026-09-02:
 * «quando si cancella un percorso si cancellano anche i tile salvati in locale»).
 *
 * Erano state scaricate per QUEL percorso: senza di lui occupano spazio per niente, e su
 * un telefono il browser le conta circa cinque megabyte l'una — cinquecento mattonelle
 * sono qualche gigabyte di quota trattenuta per una gita che non si fa piu'.
 *
 * La condizione difficile non e' cancellare: e' **dirlo**. Chi ha scaricato la mappa della
 * gita di domani e tocca «Nuovo» deve saperlo li', perche' l'alternativa e' scoprirlo in
 * quota. Per questo la conferma lo nomina e la liberazione lascia un avviso.
 */
describe('la liberazione quando si abbandona il percorso', () => {
  test('la conferma di «Nuovo» nomina le mappe scaricate', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'components', 'panel', 'ItineraryHeader.tsx'), 'utf8');
    // Non basta che il codice liberi: se non lo dice, l'utente lo scopre dove non serve.
    expect(src).toMatch(/mappe scaricate/);
    expect(src).toContain('liberaTessereDelPercorso');
  });

  /**
   * Cancellare **tutti** i waypoint e' abbandonare il percorso; cancellare **l'ultimo**
   * no — il percorso c'e' ancora, e portargli via la mappa sarebbe una punizione per una
   * correzione.
   */
  test('il cestino libera solo quando cancella tutto', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'components', 'map', 'ClearWaypointsButton.tsx'), 'utf8');
    const iTutti = src.indexOf('clearWaypoints();');
    const iUltimo = src.indexOf('removeWaypoint(ultimo.id);');
    // `lastIndexOf` e non `indexOf`: la prima occorrenza del nome e' **l'import**, in
    // cima al file, e cercandola il confronto sull'ordine diceva sempre di no.
    const iLibera = src.lastIndexOf('liberaTessereDelPercorso');
    expect(iTutti).toBeGreaterThan(-1);
    expect(iUltimo).toBeGreaterThan(-1);
    // La liberazione sta nel ramo "tutti": dopo di lui e prima del ramo "ultimo".
    expect(iLibera).toBeGreaterThan(iTutti);
    expect(iLibera).toBeLessThan(iUltimo);
  });

  test('e la conferma del cestino lo dice', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'components', 'map', 'ClearWaypointsButton.tsx'), 'utf8');
    expect(src).toMatch(/mappe scaricate/);
  });
});
