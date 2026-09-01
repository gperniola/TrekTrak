/**
 * Legge una coppia di coordinate scritta da un umano, in una delle forme in cui la si
 * trova in giro (task-26).
 *
 * Serve perché oggi l'unico modo di posizionare un waypoint con precisione è toccare la
 * mappa col dito, e per chi arriva con una coordinata già in mano — da una relazione, da
 * una guida, da un messaggio di un compagno — non c'è nessuna porta d'ingresso.
 *
 * Le forme accettate, tutte incontrate scrivendo di montagna:
 *
 * - `42.4419, 13.5595` — gradi decimali, punto decimale, la forma dei GPS
 * - `42,4419 13,5595` — **gradi decimali all'italiana**, con la virgola decimale
 * - `42° 26' 30.8" N, 13° 33' 34.2" E` — gradi, primi, secondi
 * - `N 42 26.510, E 13 33.570` — gradi e primi decimali, la forma dei geocacher
 * - con lettera davanti o dietro, in italiano (N/S/E/O) o in inglese (N/S/E/W)
 *
 * Torna `null` quando non capisce, e non un valore approssimato: una coordinata
 * indovinata male mette il waypoint in un altro posto senza dirlo, che è peggio del
 * rifiuto.
 */

import { numero } from './formato';

export interface Coordinate {
  lat: number;
  lon: number;
}

/**
 * La virgola fa **due** mestieri in questo campo: separa i decimali all'italiana e
 * separa le due coordinate. `42,4419, 13,5595` è ambiguo a occhio nudo, e va sciolto
 * guardando quante virgole ci sono e cosa hanno intorno.
 */
function separaLeDueParti(testo: string): [string, string] | null {
  const t = testo.trim();

  // Il punto e virgola non ha ambiguità: se c'è, è lui il separatore.
  if (t.includes(';')) {
    const parti = t.split(';');
    return parti.length === 2 ? [parti[0], parti[1]] : null;
  }

  const virgole = (t.match(/,/g) ?? []).length;

  // Nessuna virgola: separa lo spazio, ma solo quello che divide le DUE coordinate —
  // dentro una forma sessagesimale gli spazi sono tanti. Si taglia a metà sul segno
  // cardinale della seconda, se c'è, altrimenti sullo spazio centrale.
  if (virgole === 0) {
    const conSecondaLettera = /^(.*?)[\s]+([NSEOWnseow]\s*[\d.].*|.*?[EOWeow])$/.exec(t);
    if (conSecondaLettera && /[NSns]/.test(conSecondaLettera[1])) {
      return [conSecondaLettera[1], conSecondaLettera[2]];
    }
    const pezzi = t.split(/\s+/);
    if (pezzi.length === 2) return [pezzi[0], pezzi[1]];
    if (pezzi.length % 2 === 0) {
      const meta = pezzi.length / 2;
      return [pezzi.slice(0, meta).join(' '), pezzi.slice(meta).join(' ')];
    }
    return null;
  }

  // Una virgola sola: o separa le due coordinate (`42.44, 13.55`) o è il decimale di un
  // numero solo, che però da solo non fa una coppia. Quindi separa.
  if (virgole === 1) {
    const [a, b] = t.split(',');
    return [a, b];
  }

  /*
   * Due o tre virgole: c'è di mezzo il decimale all'italiana. Il separatore delle due
   * coordinate è quella virgola che NON sta fra due cifre — cioè quella seguita da uno
   * spazio o da una lettera. `42,4419, 13,5595` si taglia sulla seconda.
   */
  const tagli: number[] = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== ',') continue;
    const dopo = t.slice(i + 1);
    if (!/^\d/.test(dopo)) tagli.push(i);
  }
  if (tagli.length === 1) {
    return [t.slice(0, tagli[0]), t.slice(tagli[0] + 1)];
  }

  /*
   * Nessuna virgola si candida a separatore: allora sono tutte decimali all'italiana.
   * A dividere le due coordinate resta lo spazio (`42,4419 13,5595`), e se non c'e'
   * nemmeno quello, la virgola di mezzo (`42,4419,13,5595`).
   */
  if (tagli.length === 0) {
    const pezzi = t.split(/\s+/);
    if (pezzi.length === 2) return [pezzi[0], pezzi[1]];
    if (virgole % 2 === 0 && pezzi.length === 1) {
      const posizioni: number[] = [];
      for (let i = 0; i < t.length; i++) if (t[i] === ',') posizioni.push(i);
      const meta = posizioni[Math.floor(posizioni.length / 2)];
      return [t.slice(0, meta), t.slice(meta + 1)];
    }
  }
  return null;
}

/** Il segno che impone la lettera cardinale, se c'è. `null` = non l'ha detto. */
function segnoDa(parte: string): -1 | 1 | null {
  const t = parte.toUpperCase();
  if (/[SO]/.test(t) && !/[NE]/.test(t)) return -1;
  if (/\bW\b|W/.test(t) && !/[NE]/.test(t)) return -1;
  if (/[NE]/.test(t)) return 1;
  return null;
}

/**
 * Un solo valore, in una qualunque delle notazioni.
 *
 * Il conto è sempre lo stesso: gradi + primi/60 + secondi/3600. Quello che cambia è
 * quanti numeri ci sono.
 */
export function parseValore(parte: string): number | null {
  const grezzo = parte.trim();
  if (grezzo === '') return null;

  const segnoLettera = segnoDa(grezzo);
  const negativoEsplicito = /^\s*-/.test(grezzo);

  // I numeri, in ordine. La virgola diventa punto: qui dentro può essere solo decimale,
  // perché la separazione fra le due coordinate è già avvenuta.
  const numeri = (grezzo.replace(/,/g, '.').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (numeri.length === 0 || numeri.length > 3) return null;
  if (numeri.some((n) => !Number.isFinite(n))) return null;

  // Primi e secondi stanno sotto 60: se non ci stanno, la stringa non era una coordinata
  // sessagesimale e accettarla darebbe un punto sbagliato in silenzio.
  if (numeri.length >= 2 && numeri[1] >= 60) return null;
  if (numeri.length === 3 && numeri[2] >= 60) return null;

  const [gradi, primi = 0, secondi = 0] = numeri;
  const valore = gradi + primi / 60 + secondi / 3600;

  const segno = segnoLettera ?? (negativoEsplicito ? -1 : 1);
  return segno * valore;
}

/**
 * La coppia. `null` se non si capisce, se i valori escono dai limiti, o se le due parti
 * dichiarano lo stesso asse (`N 42, N 13` non è un punto).
 */
export function parseCoordinate(testo: string): Coordinate | null {
  if (typeof testo !== 'string') return null;
  const parti = separaLeDueParti(testo.replace(/[’′]/g, "'").replace(/[”″]/g, '"'));
  if (parti == null) return null;

  const [primaGrezza, secondaGrezza] = parti;
  const prima = parseValore(primaGrezza);
  const seconda = parseValore(secondaGrezza);
  if (prima == null || seconda == null) return null;

  /*
   * Di solito viene prima la latitudine, ma chi scrive «E 13.5595, N 42.4419» ha detto
   * esplicitamente quale è quale: le lettere hanno la precedenza sull'ordine.
   */
  const primaEstOvest = /[EOWeow]/.test(primaGrezza) && !/[Nn]|[Ss]/.test(primaGrezza);
  const secondaNordSud = /[NnSs]/.test(secondaGrezza) && !/[EeOoWw]/.test(secondaGrezza);
  const invertite = primaEstOvest && secondaNordSud;

  const lat = invertite ? seconda : prima;
  const lon = invertite ? prima : seconda;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Come si SCRIVE una coppia, all'italiana: `42,4419° N  13,5595° E`.
 *
 * Sta qui accanto a chi la legge perché scrivere e leggere una coordinata sono lo stesso
 * mestiere, e finora la forma era ripetuta dentro la riga compatta dell'editor: due copie
 * della stessa regola prima o poi diventano due regole.
 */
export function coordinataItaliana(lat: number, lon: number, decimali = 4): string {
  const asse = (v: number, positivo: string, negativo: string) =>
    `${numero(Math.abs(v), decimali)}° ${v >= 0 ? positivo : negativo}`;
  return `${asse(lat, 'N', 'S')}  ${asse(lon, 'E', 'O')}`;
}

