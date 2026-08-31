/**
 * Trasporto condiviso verso **Overpass** (OpenStreetMap), usato dai ripari e dal quiz.
 *
 * Esiste per un difetto misurato il 2026-08-31: il layer dei ripari «andava in errore»
 * su una normale rete domestica italiana, e non per colpa della query. Il motivo:
 *
 * - il router distribuisce via DHCP il domino di ricerca `homenet.telecomitalia.it`;
 * - `overpass-api.de` ha **un solo punto**, quindi il resolver prova prima il nome col
 *   suffisso — `overpass-api.de.homenet.telecomitalia.it` — e il DNS dell'operatore
 *   risponde con un jolly che punta a **127.0.0.1**;
 * - la richiesta finisce su se stessi e resta appesa fino al timeout.
 *
 * `overpass-api.de` era **l'unico host dell'app con un solo punto**: tutti gli altri
 * (`api.open-meteo.com`, `tilecache.rainviewer.com`, `raw.githubusercontent.com`…) ne
 * hanno almeno due e vengono risolti per quello che sono. Per questo *solo* Overpass
 * cadeva, ed e' anche il motivo per cui la correzione dell'ordine delle regole del
 * service worker (v0.13.5) non era bastata: quella riguardava la cache, non il nome.
 *
 * Misurato dal browser su questa rete: l'istanza principale e i suoi ingressi `z.` e
 * `lz4.` non rispondono, `overpass.kumi.systems` alterna 500 e timeout, e
 * **`overpass.osm.ch` risponde in 465 ms con 39 ripari veri**. Da qui la scelta: non un
 * indirizzo, ma un **elenco di porte provate in ordine**, con la porta che ha funzionato
 * ricordata sul dispositivo. Cosi' l'app impara quale ingresso funziona su questa rete
 * e non ripaga l'attesa a ogni avvio.
 */

/**
 * Porte di Overpass, in ordine di tentativo.
 *
 * L'istanza principale sta per prima **di proposito**: e' quella dimensionata per il
 * carico, e mandare tutti sui mirror di comunita' come prima scelta sarebbe scaricare su
 * di loro il traffico di un'app che non li mantiene. I mirror sono la rete di sicurezza,
 * non il default.
 */
export const ENDPOINT_OVERPASS: readonly string[] = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Quanto si aspetta **una** porta prima di passare alla successiva. Con tre porte, il
 * caso peggiore (tutte morte) e' tre volte tanto, ma succede una volta: appena una
 * risponde, la si ricorda.
 */
export const TIMEOUT_ENDPOINT_MS = 8000;

/** Dove si ricorda la porta che ha funzionato. */
export const CHIAVE_PORTA_PREFERITA = 'trektrak_overpass_endpoint';

/**
 * Perche' non si e' ottenuta risposta da nessuna porta.
 *
 * - `occupato`: qualcuno ha risposto 429 o 504, cioe' il servizio c'e' ed e' in coda.
 *   Riprovare ha senso, e il messaggio non deve far credere che non ci siano ripari.
 * - `non-raggiungibile`: nessuno ha risposto affatto.
 */
export type MotivoOverpass = 'occupato' | 'non-raggiungibile';

export class ErroreOverpass extends Error {
  constructor(readonly motivo: MotivoOverpass, messaggio: string) {
    super(messaggio);
    this.name = 'ErroreOverpass';
  }
}

export interface EsitoOverpass {
  /** Il JSON grezzo: interpretarlo tocca a chi ha scritto la query. */
  dati: unknown;
  /** Quale porta ha risposto. Serve ai test e alle diagnosi. */
  endpoint: string;
}

function portaPreferita(): string | null {
  try {
    const salvata = localStorage.getItem(CHIAVE_PORTA_PREFERITA);
    // Si accetta solo una porta ancora presente nell'elenco: una salvata mesi fa e poi
    // rimossa dal codice non deve sopravvivere allo storage.
    return salvata != null && ENDPOINT_OVERPASS.includes(salvata) ? salvata : null;
  } catch {
    return null;
  }
}

function ricordaPorta(endpoint: string): void {
  try {
    localStorage.setItem(CHIAVE_PORTA_PREFERITA, endpoint);
  } catch {
    /* storage bloccato: si riprovera' l'ordine canonico, che funziona comunque */
  }
}

/** L'ordine dei tentativi: prima quella che ha funzionato l'ultima volta, poi le altre. */
export function ordineTentativi(preferita: string | null): string[] {
  if (preferita == null || !ENDPOINT_OVERPASS.includes(preferita)) return [...ENDPOINT_OVERPASS];
  return [preferita, ...ENDPOINT_OVERPASS.filter((e) => e !== preferita)];
}

/**
 * Manda la query a Overpass, provando le porte in ordine.
 *
 * `signal` e' l'annullamento di chi chiama (cambio di vista, componente smontato) e ha
 * la precedenza: se scatta, si esce subito **senza** provare la porta successiva, perche'
 * non e' un guasto del servizio ma un cambio di idea nostro.
 */
export async function interrogaOverpass(
  query: string,
  opzioni?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<EsitoOverpass> {
  const timeoutMs = opzioni?.timeoutMs ?? TIMEOUT_ENDPOINT_MS;
  const esterno = opzioni?.signal;
  let occupato = false;

  for (const endpoint of ordineTentativi(portaPreferita())) {
    if (esterno?.aborted) break;

    const ac = new AbortController();
    const scadenza = setTimeout(() => ac.abort(), timeoutMs);
    const inoltra = () => ac.abort();
    esterno?.addEventListener('abort', inoltra);

    try {
      // POST col corpo `data=`: la query non ha limiti di lunghezza da URL, e una POST
      // non e' cacheabile per costruzione — nessun rischio che una regola del service
      // worker se la tenga in tasca.
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: ac.signal,
      });
      if (res.status === 429 || res.status === 504) {
        occupato = true;
        continue;
      }
      if (!res.ok) continue;
      const dati = await res.json();
      ricordaPorta(endpoint);
      return { dati, endpoint };
    } catch {
      // Rete assente, nome che non si risolve, timeout: si prova la porta dopo.
      continue;
    } finally {
      clearTimeout(scadenza);
      esterno?.removeEventListener('abort', inoltra);
    }
  }

  if (esterno?.aborted) throw new DOMException('Richiesta annullata', 'AbortError');
  throw occupato
    ? new ErroreOverpass('occupato', 'Overpass è in coda su tutte le istanze')
    : new ErroreOverpass('non-raggiungibile', 'Nessuna istanza Overpass raggiungibile');
}
