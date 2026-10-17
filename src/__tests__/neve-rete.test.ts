import { ATTESA_NUOVO_TENTATIVO_MS, scaricaPassaggio, TIMEOUT_PASSAGGIO_MS, type FetchMinimo, type RispostaMinima } from '../lib/neve-rete'
import { inflateNode, leggiFixture, pngRgba, pngTavolozza } from './fixtures/gibs/png-sintetico'

function risposta(o: {
  status?: number
  header?: boolean
  corpo?: Uint8Array
}): RispostaMinima & { arrayBuffer: jest.Mock; body: { cancel: jest.Mock } } {
  const corpo = o.corpo ?? new Uint8Array(0)
  return {
    status: o.status ?? 200,
    headers: { get: (n: string) => (o.header && n === 'layer-identifier-actual' ? 'MODIS_Terra' : null) },
    arrayBuffer: jest.fn(async () => corpo.buffer.slice(corpo.byteOffset, corpo.byteOffset + corpo.byteLength) as ArrayBuffer),
    body: { cancel: jest.fn(async () => undefined) },
  }
}

const fetchDi = (r: RispostaMinima): FetchMinimo => async () => r
const URL_PROVA = 'https://esempio.test/t.png'

describe('scaricaPassaggio', () => {
  afterEach(() => jest.useRealTimers())

  it('200 con l header e un PNG a tavolozza: dati', async () => {
    const r = risposta({ header: true, corpo: leggiFixture('terra-2026-10-13-8-94-138.png') })
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateNode })
    expect(e.tipo).toBe('dati')
    if (e.tipo === 'dati') expect(e.png.larghezza).toBe(256)
  })

  it('200 senza l header: nessun dato, e il corpo non si legge', async () => {
    const r = risposta({ header: false, corpo: leggiFixture('terra-2026-10-13-8-94-138.png') })
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateNode })
    expect(e.tipo).toBe('nessunDato')
    expect(r.arrayBuffer).not.toHaveBeenCalled()
    expect(r.body.cancel).toHaveBeenCalled()
  })

  it('200 senza l header e cancel che rifiuta: nessun dato, nessun rifiuto non gestito', async () => {
    const r = risposta({ header: false })
    r.body.cancel.mockRejectedValue(new Error('gia chiuso'))
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateNode })
    expect(e.tipo).toBe('nessunDato')
  })

  it('200 con l header ma corpo RGBA: nessun dato', async () => {
    const r = risposta({ header: true, corpo: pngRgba(4, 4, [1, 2, 3, 255]) })
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateNode })
    expect(e.tipo).toBe('nessunDato')
  })

  /*
    Regola cambiata di proposito (revisione finale, ruling del controller sul R9): prima un
    inflate che rifiutava valeva «nessun dato». Ma con l'header il passaggio c'e', e un corpo
    che non sappiamo aprire (deflate rotto, `DecompressionStream` assente, un errore del
    nostro decodificatore) e' un guasto nostro o della rete, non un'assenza: senza
    `DecompressionStream` tutta la mappa diceva «Nessuna immagine negli ultimi 3 giorni».
    Non si riprova: lo stesso corpo darebbe lo stesso errore.
  */
  it('200 con l header e deflate corrotto (inflate che rifiuta): errore, e non si riprova', async () => {
    const png = pngTavolozza({
      larghezza: 2,
      altezza: 2,
      indici: new Uint8Array([0, 1, 1, 0]),
      tavolozza: new Uint8Array([0, 0, 0, 255, 255, 255]),
    })
    const r = risposta({ header: true, corpo: png })
    const f = jest.fn(fetchDi(r))
    const inflateRotto = () => Promise.reject(new Error('incorrect header check'))
    const e = await scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateRotto, attesa: async () => undefined })
    expect(e).toEqual({ tipo: 'errore', motivo: 'corpo illeggibile' })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('200 con l header e un inflate che lancia (non rifiuta): errore anche cosi', async () => {
    const r = risposta({ header: true, corpo: leggiFixture('terra-2026-10-13-8-94-138.png') })
    const inflateCheLancia = () => { throw new Error('DecompressionStream assente') }
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateCheLancia, attesa: async () => undefined })
    expect(e).toEqual({ tipo: 'errore', motivo: 'corpo illeggibile' })
  })

  it('200 con l header ma il trasferimento del corpo si interrompe: errore, non nessun dato', async () => {
    const r = risposta({ header: true })
    r.arrayBuffer.mockRejectedValue(new TypeError('network'))
    jest.useFakeTimers() // anche il secondo tentativo fallisce: si salta l'attesa fra i due
    const p = scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateNode })
    await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS)
    expect((await p).tipo).toBe('errore')
  })

  it('404: non pubblicato', async () => {
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(risposta({ status: 404 })), inflate: inflateNode })
    expect(e.tipo).toBe('nonPubblicato')
  })

  it('500: errore', async () => {
    jest.useFakeTimers() // il 500 si ripete anche al secondo tentativo
    const p = scaricaPassaggio(URL_PROVA, { fetch: fetchDi(risposta({ status: 500 })), inflate: inflateNode })
    await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS)
    expect((await p).tipo).toBe('errore')
  })

  it('rete giu: errore', async () => {
    jest.useFakeTimers()
    const f: FetchMinimo = () => Promise.reject(new TypeError('Failed to fetch'))
    const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
    await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS)
    expect((await p).tipo).toBe('errore')
  })

  describe('secondo tentativo', () => {
    const dai = (...r: RispostaMinima[]) => {
      let i = 0
      return jest.fn<ReturnType<FetchMinimo>, Parameters<FetchMinimo>>(async () => r[Math.min(i++, r.length - 1)])
    }
    const buona = () => risposta({ header: true, corpo: leggiFixture('terra-2026-10-13-8-94-138.png') })

    it('un 500 seguito da un 200 con dati: dati, con due richieste', async () => {
      jest.useFakeTimers()
      const f = dai(risposta({ status: 500 }), buona())
      const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
      await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS)
      expect((await p).tipo).toBe('dati')
      expect(f).toHaveBeenCalledTimes(2)
    })

    it('due 500 di fila: errore, e non si insiste oltre', async () => {
      jest.useFakeTimers()
      const f = dai(risposta({ status: 503 }))
      const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
      await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS * 10)
      expect(await p).toEqual({ tipo: 'errore', motivo: 'HTTP 503' })
      expect(f).toHaveBeenCalledTimes(2)
    })

    it('rete giu poi dati: dati', async () => {
      jest.useFakeTimers()
      let n = 0
      const f = jest.fn<ReturnType<FetchMinimo>, Parameters<FetchMinimo>>(async () => {
        if (n++ === 0) throw new TypeError('Failed to fetch')
        return buona()
      })
      const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
      await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS)
      expect((await p).tipo).toBe('dati')
      expect(f).toHaveBeenCalledTimes(2)
    })

    it('non si riprova prima dell attesa', async () => {
      jest.useFakeTimers()
      const f = dai(risposta({ status: 500 }), buona())
      const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
      await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS - 1)
      expect(f).toHaveBeenCalledTimes(1)
      await jest.advanceTimersByTimeAsync(1)
      await p
      expect(f).toHaveBeenCalledTimes(2)
    })

    it('un 404 non si riprova', async () => {
      const f = dai(risposta({ status: 404 }), buona())
      expect((await scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })).tipo).toBe('nonPubblicato')
      expect(f).toHaveBeenCalledTimes(1)
    })

    it('un 403 non si riprova', async () => {
      const f = dai(risposta({ status: 403 }), buona())
      expect((await scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })).tipo).toBe('errore')
      expect(f).toHaveBeenCalledTimes(1)
    })

    it('il timeout non si riprova', async () => {
      jest.useFakeTimers()
      const f = jest.fn<ReturnType<FetchMinimo>, Parameters<FetchMinimo>>(() => new Promise<RispostaMinima>(() => undefined))
      const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
      await jest.advanceTimersByTimeAsync(TIMEOUT_PASSAGGIO_MS + ATTESA_NUOVO_TENTATIVO_MS * 2)
      expect(await p).toEqual({ tipo: 'errore', motivo: 'tempo scaduto' })
      expect(f).toHaveBeenCalledTimes(1)
    })

    it('annullato durante l attesa: AbortError e niente secondo tentativo', async () => {
      jest.useFakeTimers()
      const c = new AbortController()
      const f = dai(risposta({ status: 500 }), buona())
      const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode, signal: c.signal })
      const atteso = expect(p).rejects.toMatchObject({ name: 'AbortError' })
      await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS / 2)
      c.abort()
      await atteso
      await jest.advanceTimersByTimeAsync(ATTESA_NUOVO_TENTATIVO_MS * 2)
      expect(f).toHaveBeenCalledTimes(1)
      expect(jest.getTimerCount()).toBe(0)
    })
  })

  it('oltre 20 secondi: errore', async () => {
    jest.useFakeTimers()
    const f: FetchMinimo = () => new Promise<RispostaMinima>(() => undefined) // ignora anche il segnale
    const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
    await jest.advanceTimersByTimeAsync(TIMEOUT_PASSAGGIO_MS)
    expect((await p).tipo).toBe('errore')
  })

  it('annullato da chi l ha chiesto: si propaga, non e un errore', async () => {
    const c = new AbortController()
    c.abort()
    const f = jest.fn(fetchDi(risposta({})))
    await expect(
      scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode, signal: c.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('annullato durante il scaricamento: si propaga', async () => {
    const c = new AbortController()
    const f: FetchMinimo = () => new Promise<RispostaMinima>(() => undefined)
    const p = scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode, signal: c.signal })
    c.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
  })
})
