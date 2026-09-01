import { CACHE_TESSERE } from './tile-offline';

/**
 * Lo scaricamento vero delle mattonelle, e la gestione dello spazio (task-37).
 *
 * Separato da `tile-offline.ts`, che è tutto puro: qui c'è la rete, il disco e il service
 * worker. La divisione serve a poter verificare i conti — quali mattonelle, quante, a che
 * zoom — senza un browser.
 */

/**
 * Quante richieste in volo insieme.
 *
 * Sei: abbastanza per non aspettare un'ora, poche per non presentarsi a un servizio
 * gratuito come un attacco. È lo stesso ordine di grandezza che usa un browser per le
 * immagini di una pagina, e le condizioni d'uso di OpenStreetMap chiedono esattamente di
 * non fare di più.
 */
const IN_VOLO = 6;

export interface Avanzamento {
  fatte: number;
  totali: number;
  fallite: number;
}

export interface EsitoScaricamento {
  fatte: number;
  fallite: number;
  interrotto: boolean;
}

/**
 * Chiede tutte le mattonelle, a gruppetti.
 *
 * **`mode: 'no-cors'`** di proposito: è lo stesso tipo di richiesta che fa Leaflet con i
 * suoi `<img>`, e la voce di cache che ne risulta deve essere indistinguibile da quella
 * che l'app userà poi. Il prezzo è che la risposta è opaca — non si può leggerne lo stato
 * — quindi «fatta» qui vuol dire «richiesta completata senza errore di rete», non
 * «il servizio ha risposto 200». È una distinzione che va detta e non nascosta: una
 * mattonella mancante sul server risulta scaricata e in quota apparirà vuota.
 */
export async function scaricaTessere(
  url: string[],
  opzioni: { onAvanzamento?: (a: Avanzamento) => void; signal?: AbortSignal } = {},
): Promise<EsitoScaricamento> {
  const { onAvanzamento, signal } = opzioni;
  let fatte = 0;
  let fallite = 0;
  let prossima = 0;

  const lavoratore = async () => {
    while (prossima < url.length) {
      if (signal?.aborted) return;
      const mio = prossima++;
      try {
        await fetch(url[mio], { mode: 'no-cors', cache: 'no-store', signal });
        fatte++;
      } catch {
        // Rete assente, host irraggiungibile, richiesta annullata: si prosegue. Una
        // mattonella in meno non deve fermare le altre quattrocentonovantanove.
        if (!signal?.aborted) fallite++;
      }
      onAvanzamento?.({ fatte, totali: url.length, fallite });
    }
  };

  await Promise.all(Array.from({ length: Math.min(IN_VOLO, url.length) }, lavoratore));
  return { fatte, fallite, interrotto: signal?.aborted === true };
}

/**
 * Quanto **spazio del limite** costa una mattonella. Misurato, non stimato.
 *
 * Sul disco un PNG topografico a 256 px pesa una quindicina di kilobyte. Nel conteggio
 * del browser ne pesa **trecento volte tanto**: le risposte opache — quelle che tornano
 * dalle immagini di altri siti — vengono contate con un forte arrotondamento in eccesso,
 * apposta, perche' il loro peso reale non trapeli a chi le ha chieste.
 *
 * Misurato il 2026-09-01 su Chrome, build di produzione: dieci mattonelle nuove hanno
 * fatto salire il conteggio da 518 a 563 MB, **4,5 MB l'una**. Il riempimento e' casuale
 * per voce, quindi si tiene 5 come ordine di grandezza prudente.
 *
 * Serve a una cosa sola: sapere in anticipo se lo scaricamento ci sta, invece di
 * scoprirlo a meta' con una scrittura rifiutata.
 */
export const COSTO_QUOTA_PER_TESSERA = 5 * 1024 * 1024;

/** Quante mattonelle sono conservate. Il **peso** vero lo dice `spazioOrigine`. */
export async function spazioTessere(): Promise<{ quante: number } | null> {
  if (typeof caches === 'undefined') return null;
  try {
    let quante = 0;
    for (const nome of CACHE_TESSERE) {
      if (!(await caches.has(nome))) continue;
      const cache = await caches.open(nome);
      quante += (await cache.keys()).length;
    }
    return { quante };
  } catch {
    return null;
  }
}

/** Lo spazio dell'origine, se il browser lo dichiara. */
export async function spazioOrigine(): Promise<{ usato: number; disponibile: number } | null> {
  try {
    if (typeof navigator === 'undefined' || navigator.storage?.estimate == null) return null;
    const s = await navigator.storage.estimate();
    if (s.usage == null || s.quota == null) return null;
    return { usato: s.usage, disponibile: s.quota };
  } catch {
    return null;
  }
}

/** Butta tutte le mattonelle conservate. Torna quante cache ha svuotato. */
export async function svuotaTessere(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  let svuotate = 0;
  for (const nome of CACHE_TESSERE) {
    try {
      if (await caches.delete(nome)) svuotate++;
    } catch {
      // una cache che non si cancella non deve impedire di cancellare le altre
    }
  }
  return svuotate;
}
