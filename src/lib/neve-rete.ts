// Un passaggio di satellite scaricato da GIBS, e la risposta alla domanda «cosa e' arrivato?».
// Il difetto che questo file previene: per GIBS il «nessun dato» NON e' un 404 ma un 200, con
// un corpo che e' rumore (circa 170 KB) e che non va decodificato come se fosse neve. Cio' che
// distingue un passaggio vero e' l'header `layer-identifier-actual`; l'`etag` (il valore
// `1000000000000` dei vuoti) dal browser non e' leggibile, quindi non lo si guarda mai.
import { decodificaPngTavolozza, type Inflate, type PngTavolozza } from './png-tavolozza'

export type EsitoPassaggio =
  | { tipo: 'dati'; png: PngTavolozza }
  | { tipo: 'nessunDato' }
  | { tipo: 'nonPubblicato' }
  | { tipo: 'errore'; motivo: string }

export interface RispostaMinima {
  status: number
  headers: { get(nome: string): string | null }
  arrayBuffer(): Promise<ArrayBuffer>
  body?: { cancel(): Promise<void> } | null
}

export type FetchMinimo = (url: string, init?: { signal?: AbortSignal }) => Promise<RispostaMinima>

export const TIMEOUT_PASSAGGIO_MS = 20_000

function erroreDiAnnullamento(): Error {
  return new DOMException('Richiesta annullata', 'AbortError')
}

export async function scaricaPassaggio(
  url: string,
  deps: { fetch: FetchMinimo; inflate: Inflate; signal?: AbortSignal },
): Promise<EsitoPassaggio> {
  const { signal } = deps
  if (signal?.aborted) throw erroreDiAnnullamento()

  const controllo = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let siAnnulla: (() => void) | undefined

  const lavora = async (): Promise<EsitoPassaggio> => {
    try {
      const r = await deps.fetch(url, { signal: controllo.signal })
      if (r.status === 404) return { tipo: 'nonPubblicato' }
      if (r.status !== 200) return { tipo: 'errore', motivo: `HTTP ${r.status}` }
      if (!r.headers.get('layer-identifier-actual')) {
        // Nessun passaggio: il corpo e' rumore, si chiude senza scaricarlo. Il rifiuto di
        // cancel() non deve diventare un rifiuto non gestito.
        try {
          await r.body?.cancel()
        } catch {
          /* ignorato di proposito */
        }
        return { tipo: 'nessunDato' }
      }
      // La lettura del corpo sta FUORI dal try di decodifica: un trasferimento interrotto e' un
      // guasto (errore), non un passaggio senza dati.
      const corpo = new Uint8Array(await r.arrayBuffer())
      try {
        const png = await decodificaPngTavolozza(corpo, deps.inflate)
        return png ? { tipo: 'dati', png } : { tipo: 'nessunDato' }
      } catch {
        // Corpo non decodificabile (deflate corrotto): vale come assente, non come guasto.
        return { tipo: 'nessunDato' }
      }
    } catch (e) {
      if (signal?.aborted) throw erroreDiAnnullamento()
      return { tipo: 'errore', motivo: e instanceof Error ? e.message : 'rete non raggiungibile' }
    }
  }

  const lavoro = lavora()
  lavoro.catch(() => undefined) // se il timeout vince, il suo esito tardivo non e' un rifiuto non gestito

  // Il timeout si fa con una gara, non solo con abort(): un fetch che ignora il segnale
  // non deve poter tenere sospeso il chiamante.
  const scadenza = new Promise<EsitoPassaggio>((resolve) => {
    timer = setTimeout(() => {
      controllo.abort()
      resolve({ tipo: 'errore', motivo: 'tempo scaduto' })
    }, TIMEOUT_PASSAGGIO_MS)
  })
  const annullo = new Promise<never>((_, reject) => {
    siAnnulla = () => {
      controllo.abort()
      reject(erroreDiAnnullamento())
    }
    signal?.addEventListener('abort', siAnnulla)
  })
  annullo.catch(() => undefined)

  try {
    return await Promise.race([lavoro, scadenza, annullo])
  } finally {
    clearTimeout(timer)
    if (siAnnulla) signal?.removeEventListener('abort', siAnnulla)
  }
}
