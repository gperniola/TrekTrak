/**
 * Come si scrivono i numeri a schermo, in italiano.
 *
 * L'app ACCETTA da tempo la scrittura italiana ("1.500" metri sono
 * millecinquecento, "2,4" km sono due e quattro decimi), ma fino alla 0.13.2 li
 * STAMPAVA all'inglese: 55 punti con `toFixed()` e nessuna formattazione di lingua.
 *
 * Non era solo un'incoerenza estetica. Nel dettaglio di validazione — il numero piu'
 * importante della modalita' Learn, quello con cui il principiante confronta la
 * propria stima — compariva `Calcolato: 3.161 km`, che in italiano si legge
 * **3161 km**. La stessa stringa, battuta in un campo in metri, l'app la interpreta
 * come 3161: due meta' della stessa applicazione davano due significati opposti allo
 * stesso testo.
 *
 * La formattazione e' scritta a mano invece di usare `toLocaleString('it-IT', ...)`
 * perche' cosi' il risultato e' identico ovunque: non dipende dai dati di lingua
 * presenti nel runtime, e i test pinzano le stringhe esatte.
 */

/** Il separatore delle migliaia si mette solo da cinque cifre in su? No: sempre. */
function conMigliaia(intero: string): string {
  return intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Numero in italiano: virgola per i decimali, punto per le migliaia.
 *
 * `numero(3.161, 3)` -> `"3,161"` · `numero(1500)` -> `"1.500"` · `numero(-590)` -> `"-590"`
 */
export function numero(valore: number, decimali = 0): string {
  if (!Number.isFinite(valore)) return '—';
  const fisso = Math.abs(valore).toFixed(decimali);
  const [intero, dec] = fisso.split('.');
  const segno = valore < 0 && Number(fisso) !== 0 ? '-' : '';
  return `${segno}${conMigliaia(intero)}${dec ? `,${dec}` : ''}`;
}

/** Distanza in chilometri: `km(3.161)` -> `"3,2 km"`, `km(3.161, 3)` -> `"3,161 km"`. */
export function km(valore: number, decimali = 1): string {
  return `${numero(valore, decimali)} km`;
}

/** Quota o dislivello: `metri(1500)` -> `"1.500 m"`. */
export function metri(valore: number, decimali = 0): string {
  return `${numero(valore, decimali)} m`;
}

/** Azimut o pendenza in gradi: `gradi(45)` -> `"45,0°"`. */
export function gradi(valore: number, decimali = 1): string {
  return `${numero(valore, decimali)}°`;
}

/**
 * Dislivello col segno: `dislivello(205, '+')` -> `"+205 m"`, `dislivello(1205, '−')` ->
 * `"−1.205 m"`.
 *
 * **Lo zero non porta il segno**: `dislivello(0, '−')` vale `"0 m"`, non `"−0 m"`, che si
 * legge «meno zero». Il segno e' quello tipografico (U+2212), non il trattino.
 *
 * Sta qui e non nei componenti perche' serviva gia' in due posti — la riga compatta
 * dell'editor e la barra di riepilogo — e una regola scritta due volte prima o poi viene
 * scritta in due modi diversi.
 */
export function dislivello(valore: number, segno: '+' | '−'): string {
  return valore === 0 ? metri(0) : `${segno}${metri(Math.abs(valore))}`;
}

/** Pendenza in percentuale: `percento(11.1)` -> `"11,1%"`. */
export function percento(valore: number, decimali = 1): string {
  return `${numero(valore, decimali)}%`;
}

/**
 * Distanza scritta nell'unita' che si legge meglio: sotto il chilometro in metri,
 * sopra in chilometri. `distanza(0.761)` -> `"761 m"`, `distanza(3.161)` -> `"3,2 km"`.
 */
export function distanza(valoreKm: number, decimaliKm = 1): string {
  if (!Number.isFinite(valoreKm)) return '—';
  return Math.abs(valoreKm) < 1 ? metri(Math.round(valoreKm * 1000)) : km(valoreKm, decimaliKm);
}

/**
 * Un orario in **ora italiana**, sempre.
 *
 * Sta qui perche' "come si scrive una cosa per chi legge in italiano" e' lo stesso
 * mestiere dei numeri, e perche' il fuso e' la famiglia di difetti piu' ripetuta di
 * questo progetto: quattro punti dell'app formattavano orari, e uno — la riga
 * "Aggiornato alle" dei layer di emergenza — si era dimenticato `timeZone`, quindi su
 * un dispositivo non italiano scriveva l'ora del telefono mentre tutto il resto
 * scriveva quella delle montagne.
 */
export function oraItaliana(quando: string | number | Date): string {
  const d = quando instanceof Date ? quando : new Date(quando);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
}
