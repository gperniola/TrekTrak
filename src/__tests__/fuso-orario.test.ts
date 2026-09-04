import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { dataItaliana, oraItaliana } from '@/lib/formato';

/**
 * **Ogni data e ogni ora che l'utente legge sono in ora italiana.**
 *
 * È la famiglia di difetti più ripetuta di questo progetto, e non per distrazione: il fuso
 * è invisibile mentre si scrive il codice e visibile solo su un dispositivo che non sta in
 * Italia. Il conto delle volte che è costato un rilascio:
 *
 * - **v0.11.6** — la riga «Aggiornato alle» dei layer di emergenza scriveva l'ora del
 *   telefono mentre tutto il resto scriveva quella delle montagne;
 * - **v0.13.1** — `sunTimes` usava il giorno **UTC**: con partenza all'una di notte
 *   restituiva alba e tramonto del giorno prima;
 * - **v0.13.4** — il pannello meteo costruiva l'ora di partenza con `setHours`, cioè col
 *   fuso del dispositivo: su una macchina non italiana si sceglievano «le 5» e la tabella
 *   partiva dalle 07:00;
 * - **2026-09-04** (questo guardiano) — `CompletionList` e `QuizSummary` formattavano una
 *   **data** senza fuso: una registrazione dell'una di notte cadeva nel giorno prima. Ed è
 *   il caso peggiore della famiglia, perché un'ora sbagliata si vede e un giorno no.
 *
 * Un commento non è un controllo: le prime tre volte il file di `formato.ts` conteneva già
 * l'avvertimento. Questo è il controllo.
 */

const RADICE = process.cwd();

/** Dove **si può** formattare senza dichiarare il fuso a ogni chiamata. */
const CASA_DEI_FORMATI = join('src', 'lib', 'formato.ts');

function sorgenti(cartella: string, fuori: string[] = []): string[] {
  for (const voce of readdirSync(cartella)) {
    const completo = join(cartella, voce);
    if (statSync(completo).isDirectory()) {
      sorgenti(completo, fuori);
    } else if ((voce.endsWith('.ts') || voce.endsWith('.tsx')) && !voce.includes('.test.')) {
      fuori.push(completo);
    }
  }
  return fuori;
}

/**
 * Le chiamate a `toLocaleDateString`/`toLocaleTimeString` che **non** dichiarano il fuso.
 *
 * Si guarda una finestra di righe dopo la chiamata, non solo la riga: le opzioni stanno
 * spesso su righe successive, e cercare solo sulla stessa riga lascerebbe passare la
 * maggioranza dei casi — cioè il guardiano sarebbe verde per costruzione.
 */
export function senzaFuso(testo: string): number[] {
  const righe = testo.split('\n');
  const colpevoli: number[] = [];
  let inCommento = false;
  righe.forEach((riga, i) => {
    /*
      **I commenti si saltano.** La prima versione li contava, quindi il file che spiegava
      il difetto — «passava da toLocaleDateString senza fuso» — diventava colpevole. Un
      guardiano che punisce chi documenta il difetto insegna a non documentarlo.
    */
    const nudo = riga.trim();
    if (inCommento) {
      if (nudo.includes('*/')) inCommento = false;
      return;
    }
    if (nudo.startsWith('/*')) {
      if (!nudo.includes('*/')) inCommento = true;
      return;
    }
    if (nudo.startsWith('//') || nudo.startsWith('*')) return;
    if (!/toLocale(Date|Time)String/.test(riga)) return;
    const finestra = righe.slice(i, i + 8).join('\n');
    const fine = finestra.indexOf(');');
    const chiamata = fine === -1 ? finestra : finestra.slice(0, fine);
    if (/timeZone/.test(chiamata)) return;
    colpevoli.push(i + 1);
  });
  return colpevoli;
}

describe('il fuso non si dimentica', () => {
  const file = sorgenti(join(RADICE, 'src')).filter((f) => !f.endsWith(CASA_DEI_FORMATI));

  test('il controllo riconosce una chiamata senza fuso', () => {
    // Prima di fidarsi del verde: il controllo deve saper diventare rosso.
    expect(senzaFuso("d.toLocaleDateString('it-IT');")).toEqual([1]);
    expect(senzaFuso("d.toLocaleTimeString('it-IT', { hour: '2-digit' });")).toEqual([1]);
    expect(senzaFuso("d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });")).toEqual([]);
    // E i commenti non contano: documentare il difetto non deve renderlo colpevole.
    expect(senzaFuso("// passava da d.toLocaleDateString('it-IT') senza fuso")).toEqual([]);
    expect(senzaFuso(" * passava da d.toLocaleDateString('it-IT') senza fuso")).toEqual([]);
    // Anche con le opzioni su piu' righe, che e' la forma piu' comune nel progetto.
    expect(senzaFuso("d.toLocaleTimeString('it-IT', {\n  hour: '2-digit',\n  timeZone: 'Europe/Rome',\n});")).toEqual([]);
    expect(senzaFuso("d.toLocaleTimeString('it-IT', {\n  hour: '2-digit',\n});")).toEqual([1]);
  });

  /**
   * Un test solo, con l'elenco dei colpevoli nel messaggio: e' la forma degli altri
   * guardiani del progetto (`tema.test.ts`, `dialoghi-raggiungibili`). Un caso di test per
   * file darebbe centonovanta casi che leggono un file a testa — piu' lenti, e un conto
   * dei test che non dice niente.
   */
  test('nessun file formatta una data o un ora senza dichiarare il fuso', () => {
    const colpevoli: string[] = [];
    for (const f of file) {
      for (const riga of senzaFuso(readFileSync(f, 'utf8'))) {
        colpevoli.push(`${f.slice(RADICE.length + 1)}:${riga}`);
      }
    }
    expect(colpevoli).toEqual([]);
  });

  /**
   * **Il contatore.** Se un domani la ricerca dei file smettesse di trovarli — un cambio
   * di cartelle, un filtro sbagliato — il test sopra resterebbe verde su zero file, che e'
   * il modo in cui un guardiano muore senza che nessuno lo sappia. La soglia e' bassa di
   * proposito: serve a distinguere "molti" da "nessuno", non a inseguire il numero vero.
   */
  test('e la ricerca dei file trova davvero i file', () => {
    expect(file.length).toBeGreaterThanOrEqual(100);
    expect(file.some((f) => f.endsWith('CompletionList.tsx'))).toBe(true);
    expect(file.some((f) => f.endsWith('QuizSummary.tsx'))).toBe(true);
  });

  /**
   * `formato.ts` è l'unica casa in cui il fuso si scrive: se domani qualcuno ne facesse un
   * secondo posto, questo test non lo vedrebbe. Quindi si controlla che la casa sia una.
   */
  test('la casa dei formati e una sola, e dichiara il fuso', () => {
    const testo = readFileSync(join(RADICE, CASA_DEI_FORMATI), 'utf8');
    expect(senzaFuso(testo)).toEqual([]);
  });
});

/**
 * E le due funzioni di casa fanno quello che promettono, con un istante che cade in un
 * giorno diverso a seconda del fuso: l'una di notte italiana è ancora il giorno prima a
 * Londra, ed è esattamente il caso che ha prodotto il difetto.
 */
describe('le funzioni di casa', () => {
  const unaDiNotteItaliana = '2026-09-04T01:30:00+02:00';

  test('la data e quella italiana, non quella del dispositivo', () => {
    expect(dataItaliana(unaDiNotteItaliana)).toBe('04/09/2026');
  });

  test('l ora e quella italiana', () => {
    expect(oraItaliana(unaDiNotteItaliana)).toBe('01:30');
  });

  test('quello che non si legge diventa un trattino, non una data inventata', () => {
    expect(dataItaliana('ieri')).toBe('—');
    expect(oraItaliana('ieri')).toBe('—');
  });

  test('accettano stringhe, numeri e oggetti Date', () => {
    const d = new Date(unaDiNotteItaliana);
    expect(dataItaliana(d)).toBe('04/09/2026');
    expect(dataItaliana(d.getTime())).toBe('04/09/2026');
  });
});
