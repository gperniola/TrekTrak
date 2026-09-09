/**
 * L'indirizzo della pagina **Meteoblue** per un punto qualsiasi.
 *
 * Perché un link e non i loro dati: Meteoblue non è fra i modelli di Open-Meteo, e la sua
 * API vuole una chiave che va tenuta su un server (la loro documentazione sconsiglia
 * esplicitamente di chiamarla dal browser). Leggere la pagina non è un'alternativa —
 * provato il 2026-09-09, la richiesta riceve 5.522 byte di sfida Cloudflare e zero valori.
 *
 * Il **link**, invece, non chiede niente a nessuno e porta l'utente alla fonte che
 * consulta di suo, dove i numeri sono di Meteoblue e si vede che lo sono. Verificato con
 * un browser vero: la pagina risponde col titolo «Meteo 42.2°N 14.28°E - meteoblue».
 */

/** Coordinate non finite: non c'è una pagina da aprire, e non se ne inventa una. */
export function linkMeteoblue(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // I segni si ricavano dal valore: darli per scontati funziona finché l'app resta in
  // Italia, e smette il primo giorno che non ci resta.
  const ns = lat >= 0 ? 'N' : 'S';
  const eo = lon >= 0 ? 'E' : 'W';
  // Il punto qui è quello dell'indirizzo, non un numero da leggere: resta un punto anche
  // in un'app che scrive tutto all'italiana.
  return 'https://www.meteoblue.com/it/tempo/settimana/'
    + `${Math.abs(lat).toFixed(3)}${ns}${Math.abs(lon).toFixed(3)}${eo}`;
}
