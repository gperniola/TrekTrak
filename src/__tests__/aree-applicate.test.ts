import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { AREE, PROFILI } from '@/lib/profilo';

/**
 * Un'area dichiarata nella tabella e mai usata da nessun componente e' un pulsante che
 * credo di aver nascosto e che invece e' ancora a schermo.
 *
 * E' la forma che prende qui il difetto che in questo progetto e' gia' passato due volte
 * — il campo scritto e mai riletto (`trektrak_user_level` nella v0.11.8, `slim` nella
 * v0.13.1) — e una terza volta durante questo stesso lavoro: il quiz ha DUE ingressi,
 * il FAB su telefono e la toolbar su schermo grande, e ne avevo guardato uno solo.
 *
 * Quando un mio errore si ripete, la risposta e' un controllo automatico, non piu'
 * attenzione.
 */
function sorgenti(dir: string, out: string[] = []): string[] {
  for (const voce of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === '__tests__' || voce.name === 'node_modules') continue;
      sorgenti(p, out);
    } else if (voce.name.endsWith('.tsx') || voce.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

describe('ogni area della tabella e applicata da qualcuno', () => {
  const file = sorgenti(join(process.cwd(), 'src'))
    // la tabella stessa non conta: li' le aree sono dichiarate, non applicate
    .filter((f) => !f.endsWith(join('lib', 'profilo.ts')));
  const testo = file.map((f) => readFileSync(f, 'utf8')).join('\n');

  test('il controllo guarda davvero i sorgenti', () => {
    expect(file.length).toBeGreaterThan(30);
  });

  /*
   * Solo le aree LIMITATE a un sottoinsieme di profili devono essere applicate: una
   * disponibile in tutti i profili non ha niente da nascondere, quindi non ha un
   * `mostra()` da nessuna parte. Distinzione trovata facendo girare la guardia la prima
   * volta, che segnalava bussola, righello e PDF.
   */
  const limitate = Object.entries(AREE)
    .filter(([, profili]) => profili.length < PROFILI.length)
    .map(([nome]) => nome);

  test('ci sono aree limitate da controllare', () => {
    expect(limitate.length).toBeGreaterThan(5);
  });

  test.each(limitate)('l area %s e usata in un componente', (area) => {
    expect(testo).toContain(`'${area}'`);
  });

  test.each(
    Object.entries(AREE).filter(([, p]) => p.length === PROFILI.length).map(([n]) => n)
  )('l area %s e in tutti i profili, quindi non serve applicarla', (area) => {
    expect((AREE as Record<string, readonly string[]>)[area]).toHaveLength(PROFILI.length);
  });
});
