import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * In italiano l'apostrofo dopo una vocale, seguito da spazio, e' quasi sempre un
 * accento sbagliato: "instabilita’ " invece di "instabilità", "piu’ " invece di "più",
 * "e’ " invece di "è".
 *
 * Ho commesso questo errore **quattro volte** in due giorni, sempre per la stessa
 * ragione: evitare le lettere accentate per non litigare con la shell mentre modifico i
 * file. Le prime tre le ha viste solo la prova a schermo, e una era in un'etichetta di
 * un layer. Un controllo automatico costa meno dell'attenzione.
 *
 * Le eccezioni sono le poche parole italiane che vogliono davvero l'apostrofo finale.
 */
const ECCEZIONI = ['po', 'be', 'mo', 'to', 'da', 'va', 'fa', 'sta', 'di', 'ca'];

/**
 * Due forme, perché nei sorgenti l'apostrofo compare in entrambe: come carattere `’` e
 * come **escape** `\uXXXX`. La seconda è proprio quella che ho usato io per non passare
 * lettere accentate attraverso la shell, quindi un controllo che guardasse solo il
 * carattere non avrebbe visto nessuno dei miei quattro errori.
 */
const SOSPETTI = [
  // l'apostrofo come carattere
  /(\b[a-zA-Z]*[aeiouAEIOU])’(?=[\s.,;:!?)\]"']|$)/g,
  // l'apostrofo scritto come escape unicode nel sorgente: ’
  /(\b[a-zA-Z]*[aeiouAEIOU])\\u2019(?=[\s.,;:!?)\]"']|\\n|$)/g,
];

function fileDiInteresse(): string[] {
  const radice = join(process.cwd(), 'src');
  const out: string[] = [];
  const cammina = (dir: string) => {
    for (const voce of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, voce.name);
      if (voce.isDirectory()) {
        if (voce.name === '__tests__' || voce.name === 'node_modules') continue;
        cammina(p);
      } else if (/\.tsx?$/.test(voce.name)) {
        out.push(p);
      }
    }
  };
  cammina(radice);
  return out;
}

describe('accenti italiani nei testi mostrati all\'utente', () => {
  const file = fileDiInteresse();

  test('il controllo guarda davvero i sorgenti', () => {
    expect(file.length).toBeGreaterThan(40);
  });

  test('nessun apostrofo usato al posto di un accento', () => {
    const trovati: string[] = [];
    for (const f of file) {
      const testo = readFileSync(f, 'utf8');
      for (const riga of testo.split('\n')) {
        // I commenti sono scritti senza accenti di proposito, per non litigare con gli
        // strumenti: il controllo riguarda i testi che l'utente legge.
        const pulita = riga.trim();
        if (pulita.startsWith('//') || pulita.startsWith('*') || pulita.startsWith('/*')) continue;
        for (const re of SOSPETTI) {
          // `exec` in ciclo invece di `matchAll`: senza un target ES2015 l'iteratore
          // non si può percorrere, e `npm run typecheck:tests` lo blocca.
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(pulita)) != null) {
            const parola = m[1].toLowerCase();
            if (ECCEZIONI.includes(parola)) continue;
            trovati.push(`${f.split(/[\\/]/).pop()}: «${m[0]}» in "${pulita.slice(0, 80)}"`);
          }
        }
      }
    }
    expect(trovati).toEqual([]);
  });
});
