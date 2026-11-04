import { fetchAvalanche } from '@/lib/avalanche-api';
import { fetchQuakes } from '@/lib/quakes-api';
import { CLIENT_TIMEOUT_MS } from '@/lib/safe-json';

/**
 * **Senza rete, il messaggio è in italiano.**
 *
 * Una `fetch` che non parte rifiuta con il `TypeError` del browser — «Failed to fetch» su
 * Chrome, «Load failed» su Safari — e un corpo che non è JSON (il portale di un Wi-Fi che
 * risponde con una pagina HTML) con un `SyntaxError`, anch'esso in inglese. Valanghe e
 * terremoti mettevano quel testo a schermo così com'era: «Terremoti (48 h): Failed to
 * fetch», visto il 2026-11-04 a rete spenta su una build di produzione. Gli altri dati di
 * emergenza lo traducevano già (`safeJson`, ora in `safe-json.ts` e usata da tutti).
 *
 * Per le valanghe è diventato più frequente dopo la v0.33.1: prima, a rete spenta, il
 * service worker restituiva il bollettino conservato; ora la richiesta fallisce, come
 * deve, e il messaggio si vede.
 */
const VISTA = { south: 42.3, west: 13.3, north: 42.6, east: 13.8 };
const fetchOriginale = global.fetch;

afterEach(() => {
  global.fetch = fetchOriginale;
  jest.useRealTimers();
});

function rispostaNonJson(): Partial<Response> {
  return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); } };
}

/**
 * Una connessione che non risponde mai, come in montagna con una tacca: la `fetch` vera
 * resta appesa finché qualcuno non la annulla, e allora rifiuta con un `AbortError`.
 */
function rispostaCheNonArriva(): jest.Mock {
  return jest.fn((_url: string, init?: RequestInit) => new Promise((_, rifiuta) => {
    init?.signal?.addEventListener('abort', () => rifiuta(new DOMException('The operation was aborted.', 'AbortError')));
  }));
}

/**
 * Senza un tempo massimo il layer restava su «Caricamento» per sempre, e per i terremoti
 * la richiesta appesa saltava anche ogni aggiornamento successivo (una per volta). Fino
 * alla v0.33.1, per le valanghe, il service worker tagliava a 10 secondi solo quando aveva
 * una copia della stessa vista da servire al suo posto: il difetto che la regola
 * `NetworkOnly` toglie. Il tempo massimo è quello degli altri dati di emergenza.
 */
async function finisceDopoIlTempoMassimo(p: Promise<unknown>, messaggio: string): Promise<void> {
  const atteso = expect(p).rejects.toThrow(messaggio);
  await jest.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS);
  await atteso;
}

describe('terremoti senza rete', () => {
  test('la fetch che non parte dice «rete», non «Failed to fetch»', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchQuakes(new Date())).rejects.toThrow('Rete assente o servizio INGV non raggiungibile');
  });

  test('un corpo che non è JSON dice la stessa cosa, non l\'errore del parser', async () => {
    global.fetch = jest.fn().mockResolvedValue(rispostaNonJson());
    await expect(fetchQuakes(new Date())).rejects.toThrow('Rete assente o servizio INGV non raggiungibile');
  });

  test('un errore del servizio resta il suo', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(fetchQuakes(new Date())).rejects.toThrow('Terremoti non disponibili in questo momento');
  });

  test('una risposta che non arriva finisce dopo il tempo massimo, con lo stesso messaggio', async () => {
    jest.useFakeTimers();
    global.fetch = rispostaCheNonArriva();
    await finisceDopoIlTempoMassimo(fetchQuakes(new Date()), 'Rete assente o servizio INGV non raggiungibile');
  });
});

describe('valanghe senza rete', () => {
  test('la fetch che non parte dice «rete», non «Failed to fetch»', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchAvalanche(VISTA, 10)).rejects.toThrow('Rete non disponibile');
  });

  test('un corpo che non è JSON dice la stessa cosa, non l\'errore del parser', async () => {
    global.fetch = jest.fn().mockResolvedValue(rispostaNonJson());
    await expect(fetchAvalanche(VISTA, 10)).rejects.toThrow('Rete non disponibile');
  });

  /** La route scrive già in italiano cosa non va a monte: quel testo deve arrivare intero. */
  test('l\'errore della nostra route resta il suo', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 502, json: async () => ({ error: 'Nessuna regione EAWS ha risposto' }),
    });
    await expect(fetchAvalanche(VISTA, 10)).rejects.toThrow('Nessuna regione EAWS ha risposto');
  });

  test('una risposta che non arriva finisce dopo il tempo massimo, con lo stesso messaggio', async () => {
    jest.useFakeTimers();
    global.fetch = rispostaCheNonArriva();
    await finisceDopoIlTempoMassimo(fetchAvalanche(VISTA, 10), 'Rete non disponibile');
  });

  /** Chi chiama annulla a ogni spostamento della mappa: l'annullo deve arrivare alla rete. */
  test('l\'annullo di chi chiama ferma la richiesta', async () => {
    global.fetch = rispostaCheNonArriva();
    const ac = new AbortController();
    const p = fetchAvalanche(VISTA, 10, ac.signal);
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});
