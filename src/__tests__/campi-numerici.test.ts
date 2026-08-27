import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * `<input type="number">` scarta la virgola: in Italia significa che chi scrive "1,5"
 * vede il campo svuotarsi. E interpreta "1.500" come uno e mezzo, non come
 * millecinquecento.
 *
 * Lo stesso difetto è ricomparso **tre volte in due giorni**, sempre in un posto nuovo:
 * i campi dell'itinerario, poi il quiz, poi le tolleranze. Ogni volta l'avevo corretto
 * dove lo vedevo, senza cercare gli altri punti che leggono numeri.
 *
 * Questo controllo impedisce che ricompaia una quarta volta: chi ha una ragione per
 * usare `type="number"` la scrive accanto, con `${GIUSTIFICAZIONE}`.
 */
const GIUSTIFICAZIONE = 'campo-numerico-ok:';

function sorgenti(dir: string, out: string[] = []): string[] {
  for (const voce of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === '__tests__' || voce.name === 'node_modules') continue;
      sorgenti(p, out);
    } else if (voce.name.endsWith('.tsx')) {
      out.push(p);
    }
  }
  return out;
}

describe('campi numerici e separatore decimale italiano', () => {
  const file = sorgenti(join(process.cwd(), 'src'));

  test('il controllo guarda davvero i componenti', () => {
    expect(file.length).toBeGreaterThan(30);
  });

  test('nessun input type="number" senza giustificazione scritta', () => {
    const trovati: string[] = [];
    for (const f of file) {
      const righe = readFileSync(f, 'utf8').split('\n');
      righe.forEach((riga, i) => {
        if (!/type="number"/.test(riga)) return;
        // Recharts usa `type="number"` sugli assi: non è un campo di testo.
        if (/XAxis|YAxis|ZAxis|dataKey/.test(riga)) return;
        /*
         * Conta solo se è davvero un attributo di `<input`. I commenti CITANO
         * `type="number"` proprio per spiegare perché non si usa più, e una riga di
         * commento multilinea non si riconosce dal suo primo carattere.
         */
        const contesto = righe.slice(Math.max(0, i - 5), i + 2).join(' ');
        if (!/<input/.test(contesto)) return;
        if (contesto.includes(GIUSTIFICAZIONE)) return;
        trovati.push(`${f.split(/[\\/]/).pop()}:${i + 1}`);
      });
    }
    expect(trovati).toEqual([]);
  });
});
