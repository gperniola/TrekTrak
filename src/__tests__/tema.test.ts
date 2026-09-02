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

/**
 * **Il difetto peggiore di questa giornata, e il piu' stupido.**
 *
 * `text-su-colore` era usato in 25 componenti, la variabile CSS c'era, il test del
 * contrasto era verde, il build passava — e la classe **non esisteva**, perche' la riga
 * che la definisce sta in `tailwind.config.ts`, nella radice, e un `git add -A src/`
 * l'aveva lasciata fuori dal commit. In produzione quei 25 elementi ereditavano il colore
 * del genitore: nel tema chiaro, testo scuro su pulsante viola.
 *
 * Nessun test guardava il ponte fra «la classe che i componenti scrivono» e «il colore che
 * Tailwind conosce». Adesso sì.
 */
describe('le classi di colore inventate esistono davvero', () => {
  const CONFIG = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8');

  test('la config definisce su-colore, altrimenti la classe non genera nulla', () => {
    expect(CONFIG).toContain('"su-colore"');
    expect(CONFIG).toContain('var(--su-colore)');
  });

  /** E il token esiste nei due temi, sennò la classe genera una regola vuota. */
  test('e il token c e nei due temi', () => {
    expect(SCURO['su-colore']).toBeDefined();
    expect(CHIARO['su-colore']).toBeDefined();
  });

  /**
   * Il controllo generale: ogni nome di colore **non standard** che i componenti scrivono
   * deve stare nella config. Se domani qualcuno inventa `text-su-mappa`, questo test lo
   * ferma prima del rilascio invece di lasciarlo diventare una classe muta.
   */
  test('nessun componente usa un colore che la config non conosce', () => {
    const STANDARD = /^(gray|green|red|blue|amber|yellow|purple|cyan|indigo|emerald|fuchsia|orange|violet|teal|sky|rose|lime|pink|slate|zinc|neutral|stone|white|black|transparent|current|inherit)$/;
    const inventati: string[] = [];
    const visita = (dir: string) => {
      for (const voce of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, voce.name);
        if (voce.isDirectory()) { visita(p); continue; }
        if (!voce.name.endsWith('.tsx')) continue;
        const testo = readFileSync(p, 'utf8');
        const cerca = /\b(?:text|bg|border)-([a-z]+-[a-z]+(?:-[a-z]+)*)\b/g;
        let m: RegExpExecArray | null;
        while ((m = cerca.exec(testo)) != null) {
          const nome = m[1];
          // Si guardano solo i nomi composti che NON sono utilita' di Tailwind
          if (STANDARD.test(nome.split('-')[0])) continue;
          if (/^(gradient|clip|opacity|wrap|balance|nowrap|left|right|center|justify|start|end|top|bottom|none|auto|solid|dashed|dotted|current|transparent|inherit|ellipsis)/.test(nome)) continue;
          if (!CONFIG.includes(`"${nome}"`) && !CONFIG.includes(`${nome}:`)) {
            inventati.push(`${voce.name}: ${nome}`);
          }
        }
      }
    };
    visita(join(process.cwd(), 'src', 'components'));
    const unici = inventati.filter((v, i, t) => t.indexOf(v) === i).sort();
    expect(unici).toEqual([]);
  });
});

/**
 * **I grigi usati come testo di pagina, contati nel codice invece che elencati a mano.**
 *
 * L'elenco `ACCOPPIATE` qui sopra è scritto a mano, e per gli accenti va bene: il fondo su
 * cui stanno non si deduce da nulla. Ma è proprio la parte scritta a mano che ha lasciato
 * passare per la **terza** volta un `text-gray-500` a 3,67:1 — e in cima a questo file
 * c'era perfino un commento che avvertiva delle prime due. Un commento non è un controllo.
 *
 * ## I fondi, e perché sono tre
 *
 * `grigio-800`, `grigio-900` e `grigio-950`. Misurati il 2026-09-02 sul DOM di una build
 * di produzione, chiedendo a ogni elemento con testo quale fosse il primo fondo opaco
 * sopra di lui: 44 su `grigio-900`, 4 su `grigio-800`, 1 su `grigio-950`. **Nessuno** su
 * `grigio-700`, che nell'app è la traccia degli interruttori e il colore dei bordi, non un
 * piano su cui si scrive — e la differenza conta, perché su `grigio-700` non passerebbe
 * nemmeno `grigio-400` (4,06:1).
 *
 * ## Cosa questo blocco NON guarda, e perché
 *
 * Si scartano due categorie, e in entrambi i casi lo scarto può solo far **passare** un
 * uso cattivo, mai far fallire un uso buono — un controllo che grida al lupo viene
 * indebolito dal primo che ci sbatte contro:
 *
 * - i separatori decorativi (`aria-hidden`), che le regole di contrasto non riguardano;
 * - il testo dentro un campo con fondo `bg-gray-100`: lì fondo e testo sono **entrambi**
 *   token della scala, quindi si rovesciano insieme e il rapporto resta (12,04:1 nello
 *   scuro, 9,85:1 nel chiaro) — ma la coppia è rovesciata rispetto a quelle di qui, e
 *   metterla nello stesso prodotto incrociato darebbe un falso allarme.
 *
 * I popup di Leaflet **non** sono più un'eccezione: dal TASK-63 hanno il fondo dell'app,
 * quindi i grigi ci funzionano come altrove ed entrano in questo controllo come tutti.
 */
describe('i grigi usati come testo di pagina', () => {
  /** I fondi su cui l'app scrive davvero: vedi la misura nel commento qui sopra. */
  const FONDI_DI_TESTO = ['grigio-800', 'grigio-900', 'grigio-950'];

  /** Un fondo chiaro **fisso**, che non segue il tema: là i grigi non si applicano. */
  const FONDO_CHIARO_FISSO = /bg-gray-100\b|bg-white\b/;

  /**
   * Il sorgente **senza commenti**.
   *
   * Non è una rifinitura: un commento che *spiega* una classe la nomina, e senza questo
   * passaggio il controllo scatta sulla spiegazione invece che sull'uso. È successo subito,
   * su una nota che diceva «`text-gray-400` e non `text-gray-600`, perché…». Un controllo
   * che punisce chi documenta viene indebolito dal primo che ci sbatte contro.
   */
  const senzaCommenti = (sorgente: string): string =>
    sorgente
      .replace(/\/\*[\s\S]*?\*\//g, '')   // blocchi /* */ e {/* */} di JSX
      .replace(/(^|[^:])\/\/.*$/gm, '$1'); // righe //, senza mangiare le URL "https://"

  /** Le classi `text-gray-N` che i componenti usano come testo di pagina. */
  const grigiUsatiComeTesto = (): string[] => {
    const trovati = new Set<string>();
    const scendi = (dir: string) => {
      for (const voce of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, voce.name);
        if (voce.isDirectory()) {
          // I file di prova nominano queste classi per vietarle: non sono usi.
          if (voce.name === '__tests__') continue;
          scendi(p);
          continue;
        }
        if (!voce.name.endsWith('.tsx')) continue;
        for (const riga of senzaCommenti(readFileSync(p, 'utf8')).split('\n')) {
          if (riga.includes('aria-hidden') || FONDO_CHIARO_FISSO.test(riga)) continue;
          // `matchAll` non e' iterabile col bersaglio TS di questo progetto: `exec` in ciclo.
          const re = /\b(?:text|placeholder:text)-gray-(\d+)\b/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(riga)) != null) trovati.add(`grigio-${m[1]}`);
        }
      }
    };
    scendi(join(process.cwd(), 'src'));
    return Array.from(trovati).sort();
  };

  const USATI = grigiUsatiComeTesto();

  test('ce ne sono, altrimenti la ricerca non sta guardando niente', () => {
    // Senza questo, cartelle spostate o classi scritte diversamente farebbero passare
    // il blocco su un elenco vuoto, in silenzio.
    expect(USATI.length).toBeGreaterThanOrEqual(3);
    expect(USATI).toContain('grigio-400');
  });

  describe.each([['scuro', SCURO], ['chiaro', CHIARO]])('nel tema %s', (nome, token) => {
    test.each(USATI.flatMap((testo) => FONDI_DI_TESTO.map((fondo) => [testo, fondo])))(
      '--%s su --%s',
      (testo, fondo) => {
        const valore = contrasto(canali(token[testo]), canali(token[fondo]));
        const esito = `${testo} su ${fondo} nel tema ${nome}: ${valore.toFixed(2)}:1`;
        const atteso = valore >= TESTO_NORMALE ? esito : `${esito} — serve almeno ${TESTO_NORMALE}:1`;
        expect(atteso).toBe(esito);
      },
    );
  });

  /**
   * **Il grigio che non si può schiarire.**
   *
   * `grigio-500` non passa su nessun fondo dell'app nel tema scuro: 2,13 su `grigio-700`,
   * 3,04 su `grigio-800`, 3,67 su `grigio-900`. La tentazione naturale è schiarire il
   * token, e romperebbe altro: `bg-gray-500` fa il fondo di due pulsanti secondari e il
   * loro testo chiaro sta a 4,83:1, cioè appena sopra la soglia. Portando il token al
   * valore che servirebbe al testo su `grigio-800`, quei pulsanti scenderebbero a 3,05:1.
   *
   * Per questo la correzione è stata sulle **classi** — 96 usi in 33 file, nessuno dei
   * quali arriva alla taglia del testo grande — e non sul token. E per questo la classe va
   * tenuta fuori: rimetterla non è una scelta di stile, è un guasto.
   */
  test('nessun componente scrive in grigio-500, nemmeno come segnaposto', () => {
    const colpevoli: string[] = [];
    const scendi = (dir: string) => {
      for (const voce of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, voce.name);
        if (voce.isDirectory()) {
          if (voce.name === '__tests__') continue;
          scendi(p);
        } else if (voce.name.endsWith('.tsx')
          && /\b(?:text|placeholder:text|placeholder)-gray-500\b/
            .test(senzaCommenti(readFileSync(p, 'utf8')))) {
          colpevoli.push(voce.name);
        }
      }
    };
    scendi(join(process.cwd(), 'src'));
    expect(colpevoli).toEqual([]);
  });
});

/**
 * **Un colore che segue il tema, sopra un fondo che non lo segue.**
 *
 * È la classe di difetto più insidiosa che il tema chiaro ha introdotto, e il 2026-09-02 l'ho
 * incontrata **quattro volte in una sessione** prima di capire che era sempre la stessa:
 *
 * | dove | testo | fondo | scuro | chiaro |
 * |---|---|---|---|---|
 * | popup di Leaflet | `text-gray-600` (token) | bianco della sua CSS | 7,56 | **1,54** |
 * | pulsante «Ricarica» | nero letterale | `bg-white/25` (token!) | 8,6 | **4,20** |
 * | avviso «serve un waypoint» | `text-amber-300` (token) | `bg-amber-950/40` (grezzo) | 6,4 | **2,46** |
 * | toast di avviso | `text-amber-100` (token) | `bg-amber-900/95` (grezzo) | 8,47 | **1,13** |
 *
 * Il meccanismo è sempre lo stesso: `tailwind.config.ts` fa passare **alcune** tonalità per
 * variabili CSS, che si rovesciano col tema, e lascia grezze tutte le altre. Mescolarle su
 * uno stesso elemento dà un contrasto che regge in un tema e crolla nell'altro. E quale
 * tonalità sia token non si indovina: `amber-100` lo è, `green-100` e `red-100` no — per
 * questo il toast di avviso era rotto e i suoi fratelli identici stavano bene.
 *
 * Nessun audit a schermo può bastare da solo: coglie ciò che è a schermo, e questi difetti
 * vivono in stati che si raggiungono per caso — un avviso, un toast di errore. Qui si guarda
 * il **codice**, e le tonalità che seguono il tema si ricavano dalla configurazione invece
 * di essere elencate: se domani se ne aggiunge una, il controllo la conosce da subito.
 */
describe('non si mescola un colore del tema con un fondo che non lo segue', () => {
  const CONFIG = readFileSync(join(process.cwd(), 'tailwind.config.ts'), 'utf8');

  /**
   * Da classe Tailwind al token CSS che la definisce: `gray-400` → `grigio-400`.
   *
   * La corrispondenza la **dichiara la configurazione**, non un dizionario scritto qui:
   * la riga di `gray-400` contiene `rgb(var(--grigio-400)`, e tanto basta. Un dizionario a
   * mano sarebbe una seconda copia della verità, e le seconde copie divergono.
   */
  const classiDelTema = (): Map<string, string> => {
    const mappa = new Map<string, string>();
    /*
      Si legge riga per riga, tenendo a mente l'ultima famiglia aperta.

      Un solo regex sul file intero non funziona: le graffe sono **annidate**
      (`theme > extend > colors > gray`), e `[^}]*` si ferma alla prima chiusura,
      attribuendo le tonalita' di `gray` alla famiglia `theme`. L'insieme risultava privo
      di nomi utili e il controllo muto — ed e' proprio il caso che la prova qui sotto
      esiste per impedire.
    */
    let famiglia: string | null = null;
    for (const riga of CONFIG.split('\n')) {
      const apre = /^\s*"?([a-z][\w-]*)"?:\s*\{/.exec(riga);
      if (apre != null) famiglia = apre[1];
      // `white: "rgb(var(--bianco)..."`, `"su-colore": "rgb(var(...)"` — nome pieno
      const singolo = /^\s*"?([a-z][\w-]*)"?:\s*"rgb\(var\(--([\w-]+)\)/.exec(riga);
      if (singolo != null) { mappa.set(singolo[1], singolo[2]); continue; }
      /*
        `(\d+): "rgb(var(--...` dentro la famiglia aperta, **anche sulla stessa riga**
        dell'apertura: `yellow: { 300: "rgb(var(--giallo-300)..." },` sta tutto su una
        riga, e fermandosi all'apertura quelle tonalita' risultavano grezze — cioe' il
        controllo le segnalava al contrario.
      */
      const tonalita = /(?:^|\{)\s*(\d+):\s*"rgb\(var\(--([\w-]+)\)/g;
      let t: RegExpExecArray | null;
      while ((t = tonalita.exec(riga)) != null) {
        if (famiglia != null) mappa.set(`${famiglia}-${t[1]}`, t[2]);
      }
    }
    return mappa;
  };

  const TEMA = classiDelTema();

  /**
   * **Essere un token non basta: conta se il valore CAMBIA fra i due temi.**
   *
   * `--su-colore` è un token come gli altri e vale `255 255 255` in entrambi: esiste
   * proprio per stare sopra un colore pieno che non si rovescia. Trattarlo come «varia»
   * segnalava tredici usi perfettamente corretti — e un controllo che grida al lupo viene
   * disattivato dal primo che ci sbatte contro.
   */
  const variaColTema = (classe: string): boolean => {
    const token = TEMA.get(classe);
    if (token == null) return false;
    const s = SCURO[token];
    const c = CHIARO[token];
    // Un nome che non si risolve vale «non lo so»: meglio tacere che segnalare male.
    if (s == null || c == null) return false;
    return s !== c;
  };

  test('la configurazione si legge, e dichiara le tonalita che ci si aspetta', () => {
    // Senza questo, un formato cambiato renderebbe l'insieme vuoto e il controllo muto.
    expect(TEMA.get('gray-400')).toBe('grigio-400');
    expect(TEMA.get('amber-100')).toBe('ambra-100');
    expect(TEMA.get('white')).toBe('bianco');
    // le famiglie scritte su una riga sola: era il caso che il parser sbagliava
    expect(TEMA.get('yellow-300')).toBe('giallo-300');
    expect(TEMA.get('orange-300')).toBe('arancio-300');
    // e non deve pescare cio' che resta grezzo
    expect(TEMA.has('amber-900')).toBe(false);
    expect(TEMA.has('green-100')).toBe(false);
    expect(TEMA.size).toBeGreaterThanOrEqual(18);

    // `su-colore` e' un token che NON varia: e' il caso che il controllo deve saper distinguere
    expect(TEMA.has('su-colore')).toBe(true);
    expect(variaColTema('su-colore')).toBe(false);
    expect(variaColTema('gray-400')).toBe(true);
  });

  /** Il sorgente senza commenti: un commento che spiega una classe la nomina. */
  const pulito = (s: string): string =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  /**
   * Le mescolanze sospette: **sullo stesso elemento** un colore di testo e un colore di
   * fondo di cui uno solo segue il tema.
   *
   * Si guarda un solo elemento per volta e non gli antenati: è l'unico caso in cui
   * l'accoppiata è certa, e un controllo che indovina il fondo risalendo l'albero darebbe
   * falsi allarmi — e un falso allarme è ciò che porta a disattivare un controllo.
   */
  /**
   * Le mescolanze **misurate a mano** e trovate innocue.
   *
   * Questo controllo segnala un *rischio*, non una prova: il fondo grezzo può avere
   * un'opacità, e la composizione con il fondo di pagina — che invece si rovescia — può
   * cadere a metà strada e funzionare nei due temi. Va misurato, non dedotto: la stessa
   * riga calcolata come se il fondo fosse opaco dava 1,35:1 e sembrava un guasto grave.
   *
   * `QuizQuestion` — `text-gray-200` su `bg-purple-900/40` sopra `grigio-900`:
   * **12,41:1 nel tema scuro, 6,30:1 nel chiaro.** Va lasciata così: sostituire il token
   * con un letterale la porterebbe a 2,5:1 nel tema chiaro, cioè la romperebbe.
   */
  const VERIFICATE_A_MANO = new Set([
    'QuizQuestion.tsx: text-gray-200 (varia) su bg-purple-900 (fisso)',
  ]);

  const mescolanze = (): string[] => {
    const trovate: string[] = [];
    const scendi = (dir: string) => {
      for (const voce of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, voce.name);
        if (voce.isDirectory()) {
          if (voce.name === '__tests__') continue;
          scendi(p);
          continue;
        }
        if (!voce.name.endsWith('.tsx')) continue;
        for (const riga of pulito(readFileSync(p, 'utf8')).split('\n')) {
          /*
            **Si valuta solo quando l'appaiamento e' certo**: una sola classe di testo e
            un solo fondo sulla riga.

            Con due o piu' di uno la riga tiene varianti diverse e appaiarle a caso da'
            falsi allarmi. Misurato su due casi veri: in `ConfirmModal` una riga dichiara
            `confirmBtn: 'bg-green-600 ... text-black'` e, accanto, `iconColor:
            'text-green-400'` — due elementi diversi; in `EmergencyLayerRow` una riga
            porta i due rami di un ternario, `'bg-amber-500 text-black'` e
            `'bg-gray-700 text-gray-300'`. In entrambi il controllo segnalava una coppia
            che non esiste a schermo.

            Saltarle e' un falso negativo, cioe' il verso giusto in cui sbagliare: un
            controllo che grida al lupo viene disattivato dal primo che ci sbatte contro,
            e allora non protegge piu' niente.
          */
          const tuttiTesto = riga.match(/\btext-(?:[a-z]+-\d+|white|su-colore)\b/g) ?? [];
          const tuttiFondo = riga.match(/\bbg-(?:[a-z]+-\d+|white)\b/g) ?? [];
          if (tuttiTesto.length !== 1 || tuttiFondo.length !== 1) continue;
          const testo = /\btext-([a-z]+-\d+|white|su-colore)\b/.exec(riga);
          const fondo = /\bbg-([a-z]+-\d+|white)\b/.exec(riga);
          if (testo == null || fondo == null) continue;
          const tTema = variaColTema(testo[1]);
          const fTema = variaColTema(fondo[1]);
          if (tTema !== fTema) {
            const voce_ = `${voce.name}: text-${testo[1]} (${tTema ? 'varia' : 'fisso'})`
              + ` su bg-${fondo[1]} (${fTema ? 'varia' : 'fisso'})`;
            if (!VERIFICATE_A_MANO.has(voce_)) trovate.push(voce_);
          }
        }
      }
    };
    scendi(join(process.cwd(), 'src'));
    return trovate;
  };

  test('nessun componente mescola le due famiglie sullo stesso elemento', () => {
    expect(mescolanze()).toEqual([]);
  });
});
