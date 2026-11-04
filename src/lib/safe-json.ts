import { NoDataError } from './no-data-error';

/**
 * Lato client il timeout non c'era affatto: su una connessione ballerina — l'ambiente
 * tipico di questa app — la fetch resta appesa, il layer non esce mai da "Caricamento"
 * e nessun toast avvisa.
 */
export const CLIENT_TIMEOUT_MS = 12000;

export interface OpzioniJson {
  /** Con un testo, un 404 è «nessun dato» (`NoDataError`) e non un guasto. */
  nonTrovato?: string;
  /** Il segnale di chi chiama: annulla la richiesta insieme al tempo massimo. */
  signal?: AbortSignal;
  /**
   * Quando la risposta non arriva o non si legge: rete assente, tempo scaduto, il portale
   * di un Wi-Fi che risponde con una pagina HTML. Per un servizio chiamato dal browser va
   * nominato il servizio: non si sa quale dei due lati manchi.
   */
  senzaRisposta?: string;
  /**
   * Una risposta d'errore senza un messaggio nostro. Il `{ error }` nel corpo lo scrivono
   * in italiano solo le nostre route: quello di un servizio altrui è nella sua lingua.
   */
  nonDisponibile?: string;
}

/**
 * Un errore che viene dal browser, non da noi: la `fetch` che non parte (`TypeError` in
 * ogni browser, ma col testo suo — «Failed to fetch» su Chrome, «Load failed» su Safari),
 * il corpo che non è JSON (`SyntaxError`), l'annullo o il tempo scaduto (`AbortError`).
 *
 * Il riconoscimento per parole del messaggio resta solo come rete di sicurezza: da solo
 * lasciava passare «Load failed», e su iPhone il pannello scriveva il testo inglese.
 */
function dalBrowser(e: unknown): boolean {
  if (e instanceof TypeError || e instanceof SyntaxError) return true;
  if ((e as { name?: unknown } | null)?.name === 'AbortError') return true;
  return !(e instanceof Error) || !e.message || /fetch|abort|network|json|unexpected|token/i.test(e.message);
}

/**
 * Una fetch che va in reject (rete assente, DNS, CORS, timeout) propaga il TypeError
 * del browser ("Failed to fetch"): qui lo intercettiamo per mostrare in UI sempre un
 * messaggio in italiano, mai il testo inglese grezzo. Include la lettura del JSON,
 * perché un corpo malformato (captive portal che risponde HTML, risposta troncata)
 * fa lanciare a `res.json()` un `SyntaxError` in inglese, e prima quella chiamata
 * stava fuori dalla protezione.
 */
export async function safeJson(input: string, opzioni: OpzioniJson = {}): Promise<unknown> {
  const {
    nonTrovato, signal: esterno,
    senzaRisposta = 'Rete non disponibile', nonDisponibile = 'Dati non disponibili',
  } = opzioni;
  const controller = new AbortController();
  // Un segnale esterno (componente smontato) deve poter interrompere: senza, la
  // catena continuava a scaricare e a fare il parse per un componente morto.
  const onAbort = () => controller.abort();
  if (esterno?.aborted) controller.abort();
  esterno?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch(input, { signal: controller.signal });
    if (!res.ok) {
      // Spec §6: 404 = "nessun dato disponibile", non errore. Il pattern serve già
      // ora e la fase 2 ci si appoggia per la stagionalità delle valanghe.
      if (res.status === 404 && nonTrovato) throw new NoDataError(nonTrovato);
      // Una URL che comincia con «/» è una nostra route.
      const body = input.startsWith('/') ? await res.json().catch(() => null) : null;
      const upstream = (body as { error?: string } | null)?.error;
      throw new Error(typeof upstream === 'string' && upstream ? upstream : nonDisponibile);
    }
    return await res.json();
  } catch (e) {
    // Un errore già in italiano (venuto dalla route, o scritto qui sopra) va propagato
    // così com'è.
    if (e instanceof NoDataError || !dalBrowser(e)) throw e;
    throw new Error(senzaRisposta);
  } finally {
    clearTimeout(timer);
    esterno?.removeEventListener('abort', onAbort);
  }
}
