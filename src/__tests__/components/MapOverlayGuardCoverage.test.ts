import { readFileSync } from 'fs';
import { join } from 'path';

const MAP_DIR = join(process.cwd(), 'src', 'components', 'map');
const INTERACTIVE_MAP = join(MAP_DIR, 'InteractiveMap.tsx');

/** Chi dichiara di non servirsene lo scrive, con la ragione accanto. */
const OPT_OUT = 'overlay-guard: non serve';

/** Componenti figli di `<MapContainer>` importati da un path relativo, cioè i nostri. */
function overlayDentroLaMappa(): { nome: string; file: string; sorgente: string }[] {
  const src = readFileSync(INTERACTIVE_MAP, 'utf8');
  const apertura = src.indexOf('<MapContainer');
  const chiusura = src.indexOf('</MapContainer>');
  expect(apertura).toBeGreaterThan(-1);
  expect(chiusura).toBeGreaterThan(apertura);
  const corpo = src.slice(apertura, chiusura);

  // `match` con /g restituisce un array, mentre `matchAll` e `Set` andrebbero
  // iterati: senza un target ES2015 lo spread di un iteratore non compila.
  const tag = corpo.match(/<[A-Z][A-Za-z0-9]*/g) ?? [];
  const usati = tag
    .map((t) => t.slice(1))
    .filter((nome, i, tutti) => tutti.indexOf(nome) === i);
  const risultato: { nome: string; file: string; sorgente: string }[] = [];

  for (const nome of usati) {
    // Solo i componenti nostri: quelli di react-leaflet non hanno un import relativo.
    const imp = new RegExp(`import\\s*\\{[^}]*\\b${nome}\\b[^}]*\\}\\s*from\\s*'(\\.[^']+)'`).exec(src);
    if (!imp) continue;
    const file = join(MAP_DIR, `${imp[1].replace(/^\.\//, '')}.tsx`);
    try {
      risultato.push({ nome, file, sorgente: readFileSync(file, 'utf8') });
    } catch {
      // Non è un .tsx sotto components/map: fuori dal perimetro di questo controllo.
    }
  }
  return risultato;
}

/**
 * Rete di sicurezza per una classe di difetti che si è già ripetuta due volte: il
 * pannello dei layer di emergenza (v0.11.0) e il mirino del GPS (v0.11.7). Entrambi
 * erano overlay React dentro `MapContainer` senza guardia di propagazione, quindi il
 * tocco arrivava a `.leaflet-container` e diventava "aggiungi waypoint".
 *
 * I test per componente verificano il comportamento; questo verifica che nessun
 * overlay NUOVO possa nascere senza la guardia, perché l'elenco lo ricava da
 * `InteractiveMap` invece di essere scritto a mano qui.
 *
 * L'euristica è "se ti posizioni in `absolute`, stai sopra la mappa": non è una
 * dimostrazione, ma è il segno che distingue un overlay da un layer Leaflet. Chi ha
 * una ragione per farne a meno lo dichiara con `${OPT_OUT}` e la scrive.
 */
describe('nessun overlay dentro la mappa senza guardia di propagazione', () => {
  const overlay = overlayDentroLaMappa();

  test('l\'elenco si ricava da InteractiveMap, e non è vuoto', () => {
    // Se questo scende a zero il controllo è diventato vacuo (import rinominati,
    // MapContainer spostato): meglio accorgersene qui che scoprirlo con un difetto.
    expect(overlay.length).toBeGreaterThanOrEqual(6);
    expect(overlay.map((o) => o.nome)).toContain('MyLocationButton');
  });

  test.each(overlay.map((o) => [o.nome, o] as const))('%s', (_nome, o) => {
    const posizionato = /className=("absolute|\{`absolute|"[^"]*\babsolute\b)/.test(o.sorgente);
    if (!posizionato) return; // non si sovrappone alla mappa: niente da guardare
    const haGuardia = o.sorgente.includes('useMapOverlayGuard');
    const dichiaraDiFarneSenza = o.sorgente.includes(OPT_OUT);
    expect(haGuardia || dichiaraDiFarneSenza).toBe(true);
  });
});
