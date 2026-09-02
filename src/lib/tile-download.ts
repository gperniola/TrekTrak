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
 * Chiede tutte le mattonelle, a gruppetti, **in CORS**.
 *
 * ## Perché CORS, e perché è la differenza fra megabyte e gigabyte
 *
 * La prima versione usava `no-cors`, per somigliare alle richieste che Leaflet fa con i
 * suoi `<img>`. Il prezzo era una risposta **opaca**, e le risposte opache le browser le
 * conta in quota con un riempimento enorme, apposta, perché il loro peso non trapeli.
 *
 * Misurato il 2026-09-02 su Chrome, mettendo in cache venti mattonelle per volta e
 * leggendo `navigator.storage.estimate()`:
 *
 * | modo | quota addebitata per mattonella | tipo risposta |
 * |---|---|---|
 * | `no-cors` | **7.688.466 byte** (7,3 MB) | `opaque` |
 * | `cors` | **1.907 byte** | `cors` |
 *
 * Un fattore **quattromila**, per gli stessi byte scaricati. Con 164 mattonelle si passa
 * da 1,2 GB di quota trattenuta a pochi megabyte — ed è il motivo per cui il pannello
 * annunciava «giga scaricati in pochi secondi»: i giga erano veri come *quota*, non come
 * traffico. Le mattonelle vere pesano fra 7 e 53 kB.
 *
 * **Si può fare perché tutti i servizi che l'app usa lo permettono.** Verificato lo stesso
 * giorno, con `Origin` esplicito: `tile.openstreetmap.org`, `tile.opentopomap.org`,
 * `tile.waymarkedtrails.org`, `tile-cyclosm.openstreetmap.fr` e `tile.thunderforest.com`
 * rispondono tutti `access-control-allow-origin: *`.
 *
 * **In cambio si sa anche se sono arrivate.** Con una risposta opaca lo stato non era
 * leggibile, quindi «fatta» voleva dire solo «nessun errore di rete»: una mattonella
 * mancante sul server risultava scaricata e in quota appariva vuota. Ora un 404 si vede.
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
        const res = await fetch(url[mio], { mode: 'cors', cache: 'no-store', signal });
        // Ora lo stato si legge: una mattonella che il server non ha non va contata fra
        // quelle prese, o si torna in quota convinti di avere una mappa che ha dei buchi.
        if (res.ok) fatte++;
        else fallite++;
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
 * Il peso di una mattonella, misurato sui servizi che l'app usa davvero.
 *
 * Su una singola richiesta per servizio, il 2026-09-02: OpenStreetMap 7,0 kB, Waymarked
 * Trails 8,7 kB, Thunderforest 45,7 kB, OpenTopoMap 51,0 kB, CyclOSM 53,0 kB. Ma quei
 * campioni erano mattonelle **diverse fra loro**, e le densissime non sono la norma: su
 * due scaricamenti veri, misurando la media su 168 e su 78 mattonelle, sono venuti
 * **16,9 kB** e **23,2 kB**.
 *
 * Si tiene **25 kB**: appena sopra la media misurata, perché serve a dire in anticipo
 * quanto occuperà uno scaricamento e in quel giudizio è meglio sovrastimare — ma di poco.
 * Con 60 kB il pannello annunciava «circa 9,8 MB» per uno scaricamento che ne occupava
 * 2,7, cioè tornava a dire un numero che non somiglia alla realtà, che è proprio il
 * difetto da cui questa faccenda è partita.
 *
 * ## Perché prima qui c'erano 5 MB
 *
 * Le mattonelle si chiedevano `no-cors`, la risposta era **opaca**, e il browser conta le
 * risposte opache in quota con un riempimento enorme — apposta, perché il loro peso non
 * trapeli. Misurato: **7.688.466 byte addebitati per mattonella opaca** contro **1.907**
 * per la stessa in CORS. Il pannello annunciava gigabyte e diceva la verità sulla *quota*,
 * non sul traffico. Passati a CORS, il costo è tornato a essere il peso vero.
 */
export const PESO_MEDIO_TESSERA = 25 * 1024;

/**
 * Quante risposte si leggono al massimo per stabilire il peso.
 *
 * Misurato il 2026-09-02 su Chrome, build di produzione: leggere il `content-length` di
 * **168** voci ha richiesto **1.197 ms**. Col tetto pieno — cinquecento per servizio,
 * mille in tutto — sarebbero circa sette secondi in cui il pannello non sa cosa dire, e
 * per mostrare un numero è troppo.
 *
 * Cento: nel caso comune il campione **è** tutto, quindi il numero è esatto; oltre, è una
 * media misurata su cento mattonelle vere, che è un'altra cosa rispetto a una costante
 * inventata — e viene dichiarata come approssimata invece di essere spacciata per esatta.
 */
export const CAMPIONE_PESO = 100;

/**
 * Quante mattonelle sono conservate, e **quanto pesano davvero**.
 *
 * Il peso si legge dal `Content-Length` delle risposte in cache, non si stima: è fra le
 * intestazioni accessibili di una risposta CORS, e verificato che coincide al byte con la
 * dimensione del contenuto (28.719 su una mattonella OpenStreetMap).
 *
 * Due stime precedenti erano entrambe sbagliate — «circa 15 kB» dichiarati a naso, e poi
 * il conteggio di `navigator.storage.estimate()`, che riportava il riempimento delle
 * risposte opache. Da quando le risposte sono leggibili il peso si misura; `stimato` dice
 * se è stato letto per intero o ricavato da un campione.
 *
 * `null` vuol dire **«non si può sapere»** (niente Cache API, o storage bloccato) e non
 * «non lo so ancora»: quest'ultimo è il compito di chi chiama, e confonderli faceva
 * mostrare al pannello «Spazio non interrogabile» per un secondo intero a ogni apertura.
 */
export async function spazioTessere(): Promise<
  { quante: number; byte: number; stimato: boolean } | null
> {
  if (typeof caches === 'undefined') return null;
  try {
    /* Prima si contano tutte le voci: `keys()` e' una lettura sola per cache. */
    const perCache: { cache: Cache; chiavi: readonly Request[] }[] = [];
    let quante = 0;
    for (const nome of CACHE_TESSERE) {
      if (!(await caches.has(nome))) continue;
      const cache = await caches.open(nome);
      const chiavi = await cache.keys();
      perCache.push({ cache, chiavi });
      quante += chiavi.length;
    }
    if (quante === 0) return { quante: 0, byte: 0, stimato: false };

    /*
      Poi si leggono le intestazioni di **al massimo** `CAMPIONE_PESO` voci, distribuite
      su tutte le cache in proporzione: se si prendessero tutte dalla prima, con una mappa
      base pesante e un overlay leggero la media sarebbe quella della sola base.
      Si legge l'intestazione e non il contenuto — leggere i corpi vorrebbe dire spostare
      decine di megabyte per mostrare un numero.
    */
    const stimato = quante > CAMPIONE_PESO;
    let lette = 0;
    let byteLetti = 0;
    for (const { cache, chiavi } of perCache) {
      const quota = stimato
        ? Math.max(1, Math.round((chiavi.length / quante) * CAMPIONE_PESO))
        : chiavi.length;
      for (const k of chiavi.slice(0, quota)) {
        const r = await cache.match(k);
        const dichiarato = Number(r?.headers.get('content-length') ?? 0);
        if (Number.isFinite(dichiarato) && dichiarato > 0) {
          byteLetti += dichiarato;
          lette++;
        }
      }
    }
    const byte = lette === 0 ? 0 : Math.round((byteLetti / lette) * quante);
    return { quante, byte, stimato };
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
