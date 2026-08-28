import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * I dati di emergenza devono essere freschi, e "freschi" non e' un'opinione: sono
 * layer di sicurezza che dichiarano la propria eta' all'utente.
 *
 * Il difetto che questo test impedisce e' stato trovato **provando l'app**, non
 * leggendo il codice, ed era invisibile a tre giri di review perche' il codice
 * sembrava corretto e il commento affermava il contrario del vero: `export const
 * dynamic = 'force-dynamic'` rende dinamica la RISPOSTA della route, ma le `fetch`
 * in uscita finiscono comunque nella Data Cache di Next, che sta su disco
 * (`.next/cache/fetch-cache`) e sopravvive ai riavvii.
 *
 * Conseguenza misurata il 28/08/2026: `/api/fires` restituiva focolai con
 * `acquiredAt` del 26/08 sotto l'etichetta "Focolai attivi (24h) — Aggiornato alle
 * 09:29", e la discovery DPC sceglieva un bollettino di due giorni prima, cosi' il
 * layer allerte diceva "Nessun bollettino per oggi" mentre quello valido esisteva.
 */
const GIUSTIFICAZIONE = 'cache-immutabile-ok:';

/** File che servono dati vivi: ogni `fetch` qui dentro deve dichiarare no-store. */
const SORGENTI_LIVE = [
  'src/lib/fires-proxy.ts',
  'src/lib/dpc-discovery.ts',
];

function fetchDichiarateSenzaNoStore(testo: string): number[] {
  const righe = testo.split('\n');
  const colpevoli: number[] = [];
  righe.forEach((riga, i) => {
    if (!/\bfetch\(/.test(riga)) return;
    // Le opzioni possono stare sulla stessa riga o nelle successive, fino alla
    // chiusura della chiamata: guardo una finestra generosa.
    const finestra = righe.slice(i, i + 14).join('\n');
    const fineChiamata = finestra.indexOf(');');
    const opzioni = fineChiamata === -1 ? finestra : finestra.slice(0, fineChiamata);
    if (/cache:\s*'no-store'/.test(opzioni)) return;
    if (opzioni.includes(GIUSTIFICAZIONE)) return;
    colpevoli.push(i + 1);
  });
  return colpevoli;
}

describe('i dati di emergenza non passano dalla Data Cache', () => {
  test.each(SORGENTI_LIVE)('%s: ogni fetch dichiara no-store', (rel) => {
    const testo = readFileSync(join(process.cwd(), rel), 'utf8');
    expect(fetchDichiarateSenzaNoStore(testo)).toEqual([]);
  });

  test('il controllo sa riconoscere una fetch senza no-store', () => {
    expect(fetchDichiarateSenzaNoStore('const r = await fetch(url);')).toEqual([1]);
    expect(fetchDichiarateSenzaNoStore("const r = await fetch(url, { cache: 'no-store' });")).toEqual([]);
    expect(
      fetchDichiarateSenzaNoStore('const r = await fetch(url, {\n  signal: s,\n});')
    ).toEqual([1]);
  });

  /**
   * La seconda cintura: se una `fetch` sfuggisse al controllo sopra, la direttiva di
   * route eviterebbe comunque il disastro.
   */
  test.each(['fires', 'dpc-alerts'])('la route %s dichiara fetchCache force-no-store', (nome) => {
    const testo = readFileSync(join(process.cwd(), 'src', 'app', 'api', nome, 'route.ts'), 'utf8');
    expect(testo).toMatch(/export const fetchCache = 'force-no-store'/);
    expect(testo).toMatch(/export const dynamic = 'force-dynamic'/);
  });

  /** Le route che servono dati vivi sono quelle che ci si aspetta: niente sorprese. */
  test('non ci sono altre route che proxano dati di emergenza senza dichiararlo', () => {
    const dir = join(process.cwd(), 'src', 'app', 'api');
    const nomi = readdirSync(dir, { withFileTypes: true })
      .filter((v) => v.isDirectory())
      .map((v) => v.name);
    expect(nomi.sort()).toEqual(['dpc-alerts', 'elevation', 'fires', 'shared']);
  });
});
