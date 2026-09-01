import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * **Un dialogo centrato più alto della finestra è in parte irraggiungibile.**
 *
 * Non è un difetto di rifinitura, è un difetto di raggiungibilità, e ha una meccanica
 * precisa: un elemento centrato con `items-center` dentro un `fixed inset-0`, quando
 * cresce oltre l'altezza della finestra, sborda **da entrambi i lati**. Quello che esce
 * dal bordo inferiore si può ancora raggiungere scorrendo la pagina; quello che esce dal
 * bordo **superiore** no — non esiste uno scorrimento negativo che ce lo riporti.
 *
 * È successo il 2026-09-01, appena il pannello delle impostazioni mappa è cresciuto con
 * la sezione dell'uso senza rete. Playwright ha descritto lo stato meglio di quanto
 * saprei fare io: l'ultima riga era «visibile, abilitata e stabile» e insieme «fuori
 * dalla finestra», e il clic non arrivava mai. Un utente avrebbe visto un pannello
 * normale con l'ultima parte tagliata via, senza modo di capire che c'era dell'altro.
 *
 * Il rimedio è una riga: `max-h-[...] overflow-y-auto` sul dialogo, così non supera mai
 * la finestra e scorre dentro di sé. Questo test lo pretende da **tutti** i dialoghi, non
 * solo da quello che si è rotto: la meccanica è la stessa per ognuno, e il prossimo a
 * crescere non ha ragione di comportarsi meglio.
 */

const CARTELLE = ['src/components', 'src/app'];

function fileTsx(radice: string): string[] {
  const trovati: string[] = [];
  const scendi = (dir: string) => {
    for (const voce of readdirSync(dir)) {
      const p = join(dir, voce);
      if (statSync(p).isDirectory()) scendi(p);
      else if (voce.endsWith('.tsx')) trovati.push(p);
    }
  };
  scendi(join(process.cwd(), radice));
  return trovati;
}

/**
 * Il pezzo di sorgente dell'elemento che porta `role="dialog"`, dal `<` che lo apre al
 * `>` che chiude il tag. Basta per leggerne le classi, che è tutto ciò che serve qui.
 */
function tagDelDialogo(sorgente: string): string[] {
  const tag: string[] = [];
  let da = 0;
  for (;;) {
    const i = sorgente.indexOf('role="dialog"', da);
    if (i < 0) break;
    const apertura = sorgente.lastIndexOf('<', i);
    // La fine del tag: il primo `>` che non sta dentro una graffa di espressione JSX.
    let graffe = 0;
    let fine = i;
    for (let k = apertura; k < sorgente.length; k++) {
      const c = sorgente[k];
      if (c === '{') graffe++;
      else if (c === '}') graffe--;
      else if (c === '>' && graffe === 0) { fine = k; break; }
    }
    tag.push(sorgente.slice(apertura, fine + 1));
    da = i + 1;
  }
  return tag;
}

const dialoghi = CARTELLE.flatMap(fileTsx)
  .flatMap((f) => tagDelDialogo(readFileSync(f, 'utf8')).map((tag) => ({ file: f, tag })))
  .map((d) => ({ ...d, nome: d.file.replace(/.*[\\/]/, '') }));

describe('i dialoghi restano raggiungibili quando crescono', () => {
  test('ce ne sono, altrimenti questo test non sta guardando niente', () => {
    // La ricerca potrebbe smettere di funzionare in silenzio (un file spostato, un
    // attributo scritto diversamente) e il test passerebbe su un elenco vuoto.
    expect(dialoghi.length).toBeGreaterThanOrEqual(8);
  });

  test.each(dialoghi.map((d) => [d.nome, d.tag] as const))(
    '%s limita la propria altezza e scorre al suo interno',
    (_nome, tag) => {
      /*
       * Si accetta qualunque tetto d'altezza — `max-h-[90dvh]`, `max-h-screen`,
       * `max-h-[80vh]` — perche' la scelta giusta dipende dal dialogo. Cio' che non si
       * accetta e' che non ce ne sia nessuno.
       */
      expect(tag).toMatch(/max-h-/);
      expect(tag).toMatch(/overflow-y-(auto|scroll)/);
    },
  );
});
