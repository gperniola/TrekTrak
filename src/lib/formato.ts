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
