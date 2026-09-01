import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { canali, contrasto, temaEffettivo, temaValido, luminanza } from '@/lib/tema';
import { loadSettings, saveSettings } from '@/lib/storage';
import { DEFAULT_MAP_DISPLAY, DEFAULT_TOLERANCES, type AppSettings } from '@/lib/types';

/** Impostazioni minime valide, su cui innestare il campo in prova. */
const vuote = (): AppSettings => ({
  tolerances: { ...DEFAULT_TOLERANCES },
  mapDisplay: { ...DEFAULT_MAP_DISPLAY },
});

/**
 * TASK-35. Un tema chiaro «che sembra a posto» non è verificato da niente: il colore è
 * l'unica parte dell'interfaccia che nessun test guarda mai, ed è per questo che in questo
 * progetto un `text-gray-500` a 3,67:1 è passato **due volte** — la seconda il giorno dopo
 * averlo corretto la prima.
 *
 * Qui i token si leggono dal foglio di stile vero e le accoppiate si **misurano** con la
 * formula WCAG. Se domani qualcuno cambia un valore in `tema.css` e rompe la leggibilità,
 * lo dice la suite e non un utente al sole.
 */

const CSS = readFileSync(join(process.cwd(), 'src', 'app', 'tema.css'), 'utf8');

/**
 * I token di un tema, letti dal blocco che li dichiara.
 *
 * Niente `expect` qui dentro: questa funzione gira **all'importazione del modulo**, fuori
 * da qualunque test, e Jest la' rifiuta le asserzioni. Un blocco che non c'e' e' un
 * errore vero e si lancia.
 */
function tokenDi(selettore: string): Record<string, string> {
  const inizio = CSS.indexOf(selettore);
  if (inizio < 0) throw new Error(`Blocco "${selettore}" assente in tema.css`);
  const apertura = CSS.indexOf('{', inizio);
  const chiusura = CSS.indexOf('}', apertura);
  const corpo = CSS.slice(apertura + 1, chiusura);
  const token: Record<string, string> = {};
  for (const riga of corpo.split('\n')) {
    const m = /^\s*--([\w-]+):\s*([^;]+);/.exec(riga);
    if (m && /^[\d\s]+$/.test(m[2])) token[m[1]] = m[2].trim();
  }
  return token;
}

const SCURO = tokenDi(':root {');
const CHIARO = tokenDi(":root[data-tema='chiaro']");

/** Le soglie WCAG 2.1. */
const TESTO_NORMALE = 4.5;
const TESTO_GRANDE = 3;

describe('i due temi dichiarano gli stessi token', () => {
  test('nessun token manca nel chiaro', () => {
    for (const nome of Object.keys(SCURO)) {
      expect(CHIARO[nome]).toBeDefined();
    }
  });

  test('e nessuno avanza', () => {
    for (const nome of Object.keys(CHIARO)) {
      expect(SCURO[nome]).toBeDefined();
    }
  });

  test('sono abbastanza da coprire la scala e gli accenti', () => {
    expect(Object.keys(SCURO).length).toBeGreaterThanOrEqual(24);
  });

  test('ogni valore e una terna di canali valida', () => {
    for (const [nome, valore] of Object.entries({ ...SCURO, ...CHIARO })) {
      expect(() => canali(valore)).not.toThrow();
      expect(nome).toMatch(/^[\w-]+$/);
    }
  });
});

/**
 * Le accoppiate che l'app usa davvero. La sinistra è il testo, la destra il fondo su cui
 * sta: si ricavano leggendo i componenti, non inventandole.
 */
const ACCOPPIATE: { testo: string; fondo: string; soglia: number; dove: string }[] = [
  // Fondo della pagina e dei pannelli
  { testo: 'bianco', fondo: 'grigio-900', soglia: TESTO_NORMALE, dove: 'testo acceso sul pannello' },
  { testo: 'grigio-100', fondo: 'grigio-900', soglia: TESTO_NORMALE, dove: 'titoli sul pannello' },
  { testo: 'grigio-200', fondo: 'grigio-900', soglia: TESTO_NORMALE, dove: 'testo normale sul pannello' },
  { testo: 'grigio-300', fondo: 'grigio-900', soglia: TESTO_NORMALE, dove: 'testo secondario sul pannello' },
  { testo: 'grigio-400', fondo: 'grigio-900', soglia: TESTO_NORMALE, dove: 'etichette sul pannello' },
  { testo: 'grigio-300', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'testo su scheda' },
  { testo: 'grigio-400', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'etichette su scheda' },
  { testo: 'bianco', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'testo acceso su scheda' },
  { testo: 'grigio-200', fondo: 'grigio-950', soglia: TESTO_NORMALE, dove: 'testo sul fondo della pagina' },

  // Accenti come TESTO: sono quelli che il tema chiaro rischiava di sbiancare
  { testo: 'verde-400', fondo: 'grigio-900', soglia: TESTO_NORMALE, dove: 'titoli verdi' },
  { testo: 'verde-400', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'valori verdi su scheda' },
  { testo: 'rosso-400', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'dislivello in salita' },
  { testo: 'ambra-400', fondo: 'grigio-900', soglia: TESTO_NORMALE, dove: 'avvisi' },
  { testo: 'ambra-300', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'suggerimenti didattici' },
  { testo: 'blu-400', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'dislivello in discesa' },
  { testo: 'blu-300', fondo: 'grigio-800', soglia: TESTO_NORMALE, dove: 'valori in blu' },
  { testo: 'giallo-300', fondo: 'grigio-800', soglia: TESTO_GRANDE, dove: 'valori evidenziati' },
  { testo: 'viola-300', fondo: 'grigio-800', soglia: TESTO_GRANDE, dove: 'quiz' },
  { testo: 'arancio-300', fondo: 'grigio-800', soglia: TESTO_GRANDE, dove: 'pendenza ripida' },
  { testo: 'rosso-300', fondo: 'grigio-800', soglia: TESTO_GRANDE, dove: 'errori tenui' },
];

describe.each([
  ['scuro', SCURO],
  ['chiaro', CHIARO],
])('contrasto nel tema %s', (nome, token) => {
  test.each(ACCOPPIATE)('$dove: --$testo su --$fondo', ({ testo, fondo, soglia }) => {
    const valore = contrasto(canali(token[testo]), canali(token[fondo]));
    /*
     * Il numero misurato entra nel confronto, cosi' un fallimento dice **di quanto** si e'
     * sotto invece del solo «false non e' true». (`expect` di Jest non accetta un
     * messaggio come secondo argomento: quello e' di Vitest.)
     */
    const esito = `${testo} su ${fondo} nel tema ${nome}: ${valore.toFixed(2)}:1`;
    const atteso = valore >= soglia ? esito : `${esito} — serve almeno ${soglia}:1`;
    expect(atteso).toBe(esito);
  });
});

/**
 * La scala si **rovescia**: è il meccanismo su cui si regge tutto: se un giorno qualcuno
 * la «sistemasse» rendendola monotona nello stesso verso, il tema chiaro diventerebbe
 * testo chiaro su fondo chiaro senza che nessun singolo colore sembri sbagliato.
 */
describe('la scala grigia va nei due versi opposti', () => {
  const scala = ['grigio-100', 'grigio-200', 'grigio-300', 'grigio-400', 'grigio-600', 'grigio-700', 'grigio-800', 'grigio-900', 'grigio-950'];

  test('nel tema scuro i numeri alti sono piu scuri', () => {
    const l = scala.map((n) => luminanza(canali(SCURO[n])));
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeLessThan(l[i - 1]);
  });

  test('nel tema chiaro i numeri alti sono piu chiari', () => {
    const l = scala.map((n) => luminanza(canali(CHIARO[n])));
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
  });

  test('il fondo della pagina cambia davvero fra i due temi', () => {
    expect(contrasto(canali(SCURO['grigio-950']), canali(CHIARO['grigio-950']))).toBeGreaterThan(10);
  });
});

describe('la scelta del tema', () => {
  test('chiaro e scuro sono se stessi', () => {
    expect(temaEffettivo('chiaro', true)).toBe('chiaro');
    expect(temaEffettivo('scuro', false)).toBe('scuro');
  });

  test('«sistema» delega, e segue il sistema nei due versi', () => {
    expect(temaEffettivo('sistema', true)).toBe('scuro');
    expect(temaEffettivo('sistema', false)).toBe('chiaro');
  });

  /** Un valore salvato che non riconosciamo e' «non lo so», non un errore. */
  test('un tema salvato illeggibile vale «come il sistema»', () => {
    expect(temaValido('arcobaleno')).toBe('sistema');
    expect(temaValido(null)).toBe('sistema');
    expect(temaValido(undefined)).toBe('sistema');
    expect(temaValido('chiaro')).toBe('chiaro');
  });
});

describe('la formula del contrasto', () => {
  test('bianco su nero e il massimo', () => {
    expect(contrasto([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1);
  });

  test('un colore con se stesso e il minimo', () => {
    expect(contrasto([120, 130, 140], [120, 130, 140])).toBeCloseTo(1, 5);
  });

  test('non dipende dall ordine', () => {
    expect(contrasto([255, 255, 255], [30, 30, 30]))
      .toBeCloseTo(contrasto([30, 30, 30], [255, 255, 255]), 10);
  });

  test('i canali malformati non passano in silenzio', () => {
    expect(() => canali('74 222')).toThrow();
    expect(() => canali('74 222 300')).toThrow();
    expect(() => canali('#4ade80')).toThrow();
  });
});

/**
 * Il criterio del task diceva «setting persistito», e senza questo controllo non lo era:
 * `loadSettings` ricostruisce l'oggetto da zero con i soli campi che conosce, quindi il
 * tema veniva buttato a ogni riavvio. **L'ho scoperto guardando lo schermo** — avevo
 * salvato «scuro» e l'app tornava chiara — e non dal codice, perché il resto funzionava.
 *
 * Accanto ho trovato un difetto più vecchio: nemmeno il **passo personale** sopravviveva.
 * Chi si era tarato l'andatura la ritrovava a 1,0 al lancio dopo, e ogni stima di tempo
 * era di conseguenza sbagliata. È la stessa classe del livello utente scritto e mai
 * riletto (v0.11.8) e del campo `slim` (v0.13.1).
 */
describe('quello che deve sopravvivere a un riavvio', () => {
  beforeEach(() => localStorage.clear());

  test('il tema scelto si ritrova', () => {
    saveSettings({ ...vuote(), tema: 'scuro' });
    expect(loadSettings().tema).toBe('scuro');
  });

  test('un tema inventato non si ritrova, e non fa danni', () => {
    localStorage.setItem('trektrak_settings', JSON.stringify({ ...vuote(), tema: 'arcobaleno' }));
    expect(loadSettings().tema).toBeUndefined();
    expect(temaValido(loadSettings().tema)).toBe('sistema');
  });

  test('il passo personale si ritrova', () => {
    saveSettings({ ...vuote(), pace: { factor: 1.35 } });
    expect(loadSettings().pace?.factor).toBeCloseTo(1.35, 5);
  });

  /** Un'andatura assurda falserebbe ogni stima: meglio il valore di partenza. */
  test('un passo fuori scala non si ritrova', () => {
    saveSettings({ ...vuote(), pace: { factor: 42 } });
    expect(loadSettings().pace).toBeUndefined();
    saveSettings({ ...vuote(), pace: { factor: 0 } });
    expect(loadSettings().pace).toBeUndefined();
  });

  test('senza niente salvato non si inventa niente', () => {
    const s = loadSettings();
    expect(s.tema).toBeUndefined();
    expect(s.pace).toBeUndefined();
    expect(s.tolerances).toBeDefined();
  });
});

/**
 * **La classe di accoppiate che il primo giro non guardava**, e che la review ha trovato:
 * il testo scritto SOPRA un colore pieno.
 *
 * Misurando solo «accento come testo su fondo grigio» mi era sfuggito che nel tema chiaro
 * `text-white` diventa quasi nero — quindi ogni pulsante viola, rosso o ambra con la
 * scritta bianca sarebbe diventato scuro su medio. E `text-gray-950`, usato sui pulsanti
 * a gradiente verde, sarebbe diventato **bianco su verde acceso: 2,1:1**, illeggibile.
 *
 * La correzione: `text-su-colore` (bianco nei due temi) sopra i colori scuri, `text-black`
 * (che non si rovescia) sopra quelli accesi. Qui si misura che regga.
 */
describe('testo sopra un colore pieno', () => {
  /**
   * **La classe di accoppiate che il primo giro non guardava**, e che la review ha
   * trovato: il testo scritto SOPRA un colore pieno.
   *
   * Misurando solo «accento come testo su fondo grigio» mi era sfuggito che nel tema
   * chiaro `text-white` diventa quasi nero — quindi ogni pulsante viola, rosso o ambra con
   * la scritta bianca sarebbe diventato scuro su medio — e che `text-gray-950`, sui
   * pulsanti a gradiente verde, sarebbe diventato **bianco su verde acceso: 2,1:1**.
   *
   * Le accoppiate NON sono scritte qui: si **ricavano dal codice**, riga per riga. Una
   * lista a mano invecchia — l'ho appena visto succedere, correggendo i componenti e
   * lasciando il test a misurare colori che nessuno usava piu'.
   */

  /**
   * I valori di Tailwind per gli sfondi: NON sono variabili, perche' un pulsante si
   * dipinge il fondo e non segue la pagina. Se un componente ne usa uno che manca qui, il
   * test **fallisce** invece di saltarlo in silenzio: un controllo che si spegne da solo
   * e' peggio di nessun controllo.
   */
  const TAVOLOZZA: Record<string, [number, number, number]> = {
    'green-500': [34, 197, 94], 'green-600': [22, 163, 74], 'green-700': [21, 128, 61],
    'emerald-600': [5, 150, 105],
    'blue-500': [59, 130, 246], 'blue-600': [37, 99, 235], 'blue-700': [29, 78, 216],
    'red-500': [239, 68, 68], 'red-600': [220, 38, 38], 'red-700': [185, 28, 28],
    'purple-500': [168, 85, 247], 'purple-600': [147, 51, 234], 'purple-700': [126, 34, 206],
    'amber-500': [245, 158, 11], 'amber-600': [217, 119, 6], 'amber-700': [180, 83, 9],
    'indigo-500': [99, 102, 241], 'indigo-600': [79, 70, 229],
    'cyan-600': [8, 145, 178],
    'gray-700': [55, 65, 81], 'gray-800': [31, 41, 55],
  };

  /** Ogni riga di componente che scrive del bianco sopra una tinta. */
  function accoppiateDalCodice(): { dove: string; sfondo: string }[] {
    const trovate: { dove: string; sfondo: string }[] = [];
    const visita = (dir: string) => {
      for (const voce of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, voce.name);
        if (voce.isDirectory()) { visita(p); continue; }
        if (!voce.name.endsWith('.tsx')) continue;
        readFileSync(p, 'utf8').split(/\r?\n/).forEach((riga, i) => {
          if (!riga.includes('text-su-colore')) return;
          // `matchAll` restituisce un iteratore, che con il target di questo
          // progetto non si puo' percorrere direttamente: si usa `exec` in ciclo.
          const cerca = /\bbg-([a-z]+-\d{3})\b/g;
          let m: RegExpExecArray | null;
          while ((m = cerca.exec(riga)) != null) {
            trovate.push({ dove: `${voce.name}:${i + 1}`, sfondo: m[1] });
          }
        });
      }
    };
    visita(join(process.cwd(), 'src', 'components'));
    return trovate;
  }

  const ACCOPPIATE_VERE = accoppiateDalCodice();

  test('ce ne sono, altrimenti il controllo e vuoto', () => {
    expect(ACCOPPIATE_VERE.length).toBeGreaterThan(10);
  });

  test('ogni sfondo usato e nella tavolozza del test', () => {
    const usati = ACCOPPIATE_VERE.map((a) => a.sfondo).filter((c, i, t) => t.indexOf(c) === i);
    const mancanti = usati.filter((c) => !(c in TAVOLOZZA));
    expect(mancanti).toEqual([]);
  });

  /**
   * 4,5 e non 3: le etichette dei pulsanti qui sono da 10 a 14 px, e «testo grande» per
   * WCAG comincia a 18,66 px in grassetto. Il grassetto da solo non basta.
   */
  test('il bianco si legge su ogni tinta su cui viene scritto, hover compresi', () => {
    const scarsi: string[] = [];
    for (const { dove, sfondo } of ACCOPPIATE_VERE) {
      const rgb = TAVOLOZZA[sfondo];
      if (!rgb) continue;
      const v = contrasto([255, 255, 255], rgb);
      if (v < 4.5) scarsi.push(`${dove}: bianco su ${sfondo} = ${v.toFixed(2)}:1`);
    }
    expect(scarsi).toEqual([]);
  });

  /** Il punto della correzione: questi due NON seguono il tema. */
  test('su-colore resta bianco nei due temi', () => {
    expect(SCURO['su-colore']).toBe('255 255 255');
    expect(CHIARO['su-colore']).toBe('255 255 255');
  });

  test('il bianco «normale» invece si rovescia: e un altro mestiere', () => {
    expect(SCURO['bianco']).not.toBe(CHIARO['bianco']);
  });

  /**
   * `text-black` non e' una variabile e non si rovescia: e' il testo dei pulsanti accesi.
   * Qui si verifica che le tinte su cui viene scritto lo reggano.
   */
  test('il nero si legge sulle tinte accese', () => {
    for (const chiave of ['green-400', 'green-500', 'amber-400', 'amber-500', 'emerald-600'] as const) {
      const rgb = TAVOLOZZA[chiave] ?? ({ 'green-400': [74, 222, 128], 'amber-400': [251, 191, 36] } as Record<string, [number, number, number]>)[chiave];
      expect(contrasto([0, 0, 0], rgb)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/**
 * La guardia che impedisce il ritorno del difetto: nessun componente deve scrivere
 * `text-white` sopra uno sfondo colorato pieno, perché quel bianco si rovescia col tema.
 */
describe('nessuno riscrive text-white sopra un colore', () => {
  const ACCENTO = '(green|amber|red|blue|purple|cyan|indigo|emerald|fuchsia|orange|yellow|violet|teal|sky|rose|lime|pink)';

  test('i componenti usano text-su-colore, non text-white, sopra le tinte piene', () => {
    const colpevoli: string[] = [];
    // I colori accesi vogliono testo nero: il bianco sopra non si legge, in nessun tema.
    const ACCESI = /(?<!hover:)(?<!focus:)(?<!group-hover:)bg-(green|amber|emerald|yellow|lime|cyan)-(300|400|500)/;
    const cartella = join(process.cwd(), 'src', 'components');
    const visita = (dir: string) => {
      for (const voce of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, voce.name);
        if (voce.isDirectory()) { visita(p); continue; }
        if (!voce.name.endsWith('.tsx')) continue;
        readFileSync(p, 'utf8').split('\n').forEach((riga, i) => {
          const sfondoPieno = new RegExp(`(?<!hover:)(?<!focus:)(?<!group-hover:)\bbg-${ACCENTO}-\d+`);
          // 1. `text-white` sopra una tinta piena: si rovescerebbe col tema.
          if (riga.includes('text-white') && sfondoPieno.test(riga)) {
            colpevoli.push(`${voce.name}:${i + 1} (text-white su tinta)`);
          }
          // 2. bianco sopra una tinta ACCESA: non si legge, in nessuno dei due temi.
          if (riga.includes('text-su-colore') && ACCESI.test(riga)) {
            colpevoli.push(`${voce.name}:${i + 1} (bianco su tinta accesa)`);
          }
        });
      }
    };
    visita(cartella);
    expect(colpevoli).toEqual([]);
  });
});
