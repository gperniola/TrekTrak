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
export const ATTESA_NUOVO_TENTATIVO_MS = 1000

/** Attesa fra i due tentativi: si interrompe (AbortError) se il chiamante annulla. Iniettabile nei test. */
export type Attesa = (ms: number, signal?: AbortSignal) => Promise<void>

const attesaReale: Attesa = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(erroreDiAnnullamento())
    const alla = () => {
      clearTimeout(timer)
      reject(erroreDiAnnullamento())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', alla)
      resolve()
    }, ms)
    signal?.addEventListener('abort', alla, { once: true })
  })

function erroreDiAnnullamento(): Error {
  return new DOMException('Richiesta annullata', 'AbortError')
}

type Tentativo = { esito: EsitoPassaggio; riprovabile: boolean }

// GIBS risponde con 500 passeggeri quando molte mattonelle si chiedono insieme (misurato sul
// servizio vero: 4 richieste su 60 a zoom 9, mentre in sequenza rispondono tutte). Senza un
// secondo tentativo ogni 500 diventava un riassunto «parziale» e un avviso falso per un'ora.
// Si riprova UNA volta, e solo per 5xx e rete: il timeout ha gia' consumato 20 s.
export async function scaricaPassaggio(
  url: string,
  deps: { fetch: FetchMinimo; inflate: Inflate; signal?: AbortSignal; attesa?: Attesa },
): Promise<EsitoPassaggio> {
  const { signal } = deps
  if (signal?.aborted) throw erroreDiAnnullamento()
  const primo = await tentativo(url, deps)
  if (!primo.riprovabile) return primo.esito
  await (deps.attesa ?? attesaReale)(ATTESA_NUOVO_TENTATIVO_MS, signal)
  return (await tentativo(url, deps)).esito
}

async function tentativo(
  url: string,
  deps: { fetch: FetchMinimo; inflate: Inflate; signal?: AbortSignal },
): Promise<Tentativo> {
  const { signal } = deps
  const controllo = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let siAnnulla: (() => void) | undefined

  const fine = (esito: EsitoPassaggio): Tentativo => ({ esito, riprovabile: false })
  const lavora = async (): Promise<Tentativo> => {
    try {
      const r = await deps.fetch(url, { signal: controllo.signal })
      if (r.status === 404) return fine({ tipo: 'nonPubblicato' })
      if (r.status >= 500) return { esito: { tipo: 'errore', motivo: `HTTP ${r.status}` }, riprovabile: true }
      if (r.status !== 200) return fine({ tipo: 'errore', motivo: `HTTP ${r.status}` })
      if (!r.headers.get('layer-identifier-actual')) {
        // Nessun passaggio: il corpo e' rumore, si chiude senza scaricarlo. Il rifiuto di
        // cancel() non deve diventare un rifiuto non gestito.
        try {
          await r.body?.cancel()
        } catch {
          /* ignorato di proposito */
        }
        return fine({ tipo: 'nessunDato' })
      }
      // La lettura del corpo sta FUORI dal try di decodifica: un trasferimento interrotto e' un
      // guasto (errore), non un passaggio senza dati.
      const corpo = new Uint8Array(await r.arrayBuffer())
      try {
        const png = await decodificaPngTavolozza(corpo, deps.inflate)
        return fine(png ? { tipo: 'dati', png } : { tipo: 'nessunDato' })
      } catch {
        // Corpo non decodificabile (deflate corrotto): vale come assente, non come guasto.
        return fine({ tipo: 'nessunDato' })
      }
    } catch (e) {
      if (signal?.aborted) throw erroreDiAnnullamento()
      return {
        esito: { tipo: 'errore', motivo: e instanceof Error ? e.message : 'rete non raggiungibile' },
        riprovabile: true,
      }
    }
  }

  const lavoro = lavora()
  lavoro.catch(() => undefined) // se il timeout vince, il suo esito tardivo non e' un rifiuto non gestito

  // Il timeout si fa con una gara, non solo con abort(): un fetch che ignora il segnale
  // non deve poter tenere sospeso il chiamante.
  const scadenza = new Promise<Tentativo>((resolve) => {
    timer = setTimeout(() => {
      controllo.abort()
      resolve(fine({ tipo: 'errore', motivo: 'tempo scaduto' }))
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
