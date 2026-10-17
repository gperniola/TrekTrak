import { scaricaPassaggio, TIMEOUT_PASSAGGIO_MS, type FetchMinimo, type RispostaMinima } from '../lib/neve-rete'
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

  it('200 con l header e deflate corrotto (inflate che rifiuta): nessun dato, non errore', async () => {
    const png = pngTavolozza({
      larghezza: 2,
      altezza: 2,
      indici: new Uint8Array([0, 1, 1, 0]),
      tavolozza: new Uint8Array([0, 0, 0, 255, 255, 255]),
    })
    const r = risposta({ header: true, corpo: png })
    const inflateRotto = () => Promise.reject(new Error('incorrect header check'))
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateRotto })
    expect(e.tipo).toBe('nessunDato')
  })

  it('200 con l header ma il trasferimento del corpo si interrompe: errore, non nessun dato', async () => {
    const r = risposta({ header: true })
    r.arrayBuffer.mockRejectedValue(new TypeError('network'))
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(r), inflate: inflateNode })
    expect(e.tipo).toBe('errore')
  })

  it('404: non pubblicato', async () => {
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(risposta({ status: 404 })), inflate: inflateNode })
    expect(e.tipo).toBe('nonPubblicato')
  })

  it('500: errore', async () => {
    const e = await scaricaPassaggio(URL_PROVA, { fetch: fetchDi(risposta({ status: 500 })), inflate: inflateNode })
    expect(e.tipo).toBe('errore')
  })

  it('rete giu: errore', async () => {
    const f: FetchMinimo = () => Promise.reject(new TypeError('Failed to fetch'))
    const e = await scaricaPassaggio(URL_PROVA, { fetch: f, inflate: inflateNode })
    expect(e.tipo).toBe('errore')
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
