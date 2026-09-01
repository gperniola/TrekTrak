import type { ValidationFieldType } from './types';
import type { Termine } from './glossario';

type TipField = 'altitude' | 'distance' | 'elevationGain' | 'elevationLoss' | 'azimuth';

type TipBand = 'small' | 'medium' | 'large';

const TIPS: Record<string, Record<TipBand, string>> = {
  altitude: {
    small: "Verifica quale curva di livello hai letto — l'equidistanza tra le curve potrebbe ingannarti.",
    medium: "Controlla di aver identificato la curva direttrice corretta (le linee più spesse, ogni 4-5 curve).",
    large: "Potresti aver letto il valore di una cima o valle adiacente. Riparti dalla curva direttrice più vicina e conta le curve intermedie.",
  },
  distance: {
    small: "Prova a verificare la scala della carta e il fattore di conversione che stai usando.",
    medium: "Stai usando la scala corretta? Ricorda: 1 cm sulla carta a scala 1:25000 = 250 m reali.",
    large: "Il percorso potrebbe seguire un sentiero curvo — la distanza reale lungo il tracciato è maggiore di quella in linea d'aria. Prova a misurare seguendo le curve.",
  },
  elevation: {
    small: "Attenzione ai piccoli saliscendi intermedi: ogni risalita va contata nel dislivello positivo, ogni discesa nel negativo.",
    medium: "Ricontrolla il profilo tra i due punti: potresti aver trascurato un cambio di pendenza intermedio.",
    large: "Il dislivello cumulativo è la somma di TUTTE le salite (o discese), non solo la differenza tra quota iniziale e finale.",
  },
  azimuth: {
    small: "Verifica la declinazione magnetica della zona — può introdurre uno scarto di qualche grado.",
    medium: "Controlla di misurare l'angolo dal Nord geografico (verso l'alto sulla carta), non dal bordo o da un riferimento arbitrario.",
    large: "Potresti aver invertito la direzione di lettura. L'azimut si misura dal punto di partenza verso il punto di arrivo, in senso orario dal Nord.",
  },
};

/**
 * I termini che ogni suggerimento tira in ballo: il testo parla di «declinazione
 * magnetica», di «curva direttrice», di «dislivello cumulativo», e chi ha appena
 * sbagliato quel valore e' esattamente la persona che potrebbe non sapere cosa siano.
 *
 * Sono dichiarati qui invece di essere cercati dentro le frasi: riconoscere una parola
 * in una stringa funziona finche' qualcuno non riscrive la frase, e allora il
 * collegamento sparisce senza che nessun test se ne accorga.
 */
const TERMINI_TIP: Record<string, readonly Termine[]> = {
  altitude: ['curve-di-livello', 'quota'],
  distance: ['linea-daria', 'percorso-su-sentiero'],
  elevation: ['dislivello-positivo', 'dislivello-negativo'],
  azimuth: ['declinazione-magnetica', 'azimut'],
};

/** I termini da offrire accanto al suggerimento di quel campo. */
export function getTermini(field: ValidationFieldType): readonly Termine[] {
  return TERMINI_TIP[tipKey(field as TipField)] ?? [];
}

function getBand(delta: number, tolerance: { strict: number; loose: number }): TipBand {
  if (delta <= tolerance.loose) return 'small';
  if (delta <= tolerance.loose * 2) return 'medium';
  return 'large';
}

function tipKey(field: TipField): string {
  if (field === 'elevationGain' || field === 'elevationLoss') return 'elevation';
  return field;
}

export function getTip(
  field: ValidationFieldType,
  delta: number | undefined,
  tolerance: { strict: number; loose: number },
): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  if (delta <= tolerance.strict) return null;

  const key = tipKey(field as TipField);
  const tips = TIPS[key];
  if (!tips) return null;

  const band = getBand(delta, tolerance);
  return tips[band];
}
