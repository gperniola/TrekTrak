import { decodificaPngTavolozza, inflateDelBrowser } from '@/lib/png-tavolozza'
import { inflateNode, leggiFixture, pngRgba, pngTavolozza } from './fixtures/gibs/png-sintetico'

function conta(indici: Uint8Array, v: number): number {
  let n = 0
  for (let i = 0; i < indici.length; i++) if (indici[i] === v) n++
  return n
}

describe('decodificaPngTavolozza', () => {
  it('una mattonella vera si legge per intero', async () => {
    const png = await decodificaPngTavolozza(leggiFixture('terra-2026-10-13-8-94-138.png'), inflateNode)
    expect(png).not.toBeNull()
    expect(png!.larghezza).toBe(256)
    expect(png!.altezza).toBe(256)
    expect(png!.indici.length).toBe(65536)
    expect(conta(png!.indici, 106)).toBe(1946)
    expect(conta(png!.indici, 105)).toBe(55559)
    expect(conta(png!.indici, 0)).toBe(7757)
    expect(png!.indici[243 * 256 + 4]).toBe(82)
  })

  it('la tavolozza e le trasparenze arrivano con la mattonella', async () => {
    const png = await decodificaPngTavolozza(leggiFixture('terra-2026-10-13-8-94-138.png'), inflateNode)
    const t = png!.tavolozza
    expect(Array.from(t.subarray(3, 6))).toEqual([240, 240, 128])
    expect(Array.from(t.subarray(300, 303))).toEqual([255, 0, 0])
    expect(png!.alfa[106]).toBe(0)
    expect(png!.alfa[82]).toBeGreaterThan(0)
  })

  const sintetico = () => {
    const larghezza = 4
    const altezza = 5
    const indici = new Uint8Array(larghezza * altezza)
    for (let i = 0; i < indici.length; i++) indici[i] = (i * 37 + 11) % 200
    const tavolozza = new Uint8Array(200 * 3).map((_, i) => i % 251)
    return { larghezza, altezza, indici, tavolozza }
  }

  it('i cinque filtri di riga', async () => {
    const s = sintetico()
    const png = await decodificaPngTavolozza(pngTavolozza({ ...s, filtri: [0, 1, 2, 3, 4] }), inflateNode)
    expect(Array.from(png!.indici)).toEqual(Array.from(s.indici))
  })

  it('piu blocchi IDAT si concatenano', async () => {
    const s = sintetico()
    const png = await decodificaPngTavolozza(
      pngTavolozza({ ...s, filtri: [0, 1, 2, 3, 4], idatInPezzi: 3 }),
      inflateNode,
    )
    expect(Array.from(png!.indici)).toEqual(Array.from(s.indici))
  })

  it('un PNG non a tavolozza non e un dato', async () => {
    expect(await decodificaPngTavolozza(pngRgba(2, 2, [1, 2, 3, 4]), inflateNode)).toBeNull()
  })

  it('quello che non e un PNG non e un dato', async () => {
    expect(await decodificaPngTavolozza(new Uint8Array(Buffer.from('<html>')), inflateNode)).toBeNull()
  })
})

/*
  Safari < 16.4 non ha `DecompressionStream('deflate')`: senza un errore che lo dica, il
  guasto si leggeva come «DecompressionStream is not defined» o peggio come un altro errore
  qualunque, e nessuno avrebbe capito che era il browser.
*/
describe('inflateDelBrowser', () => {
  const g = globalThis as { DecompressionStream?: unknown }
  const originale = g.DecompressionStream
  afterEach(() => { g.DecompressionStream = originale })

  it('senza DecompressionStream rifiuta con un errore che dice cosa manca', async () => {
    g.DecompressionStream = undefined
    await expect(inflateDelBrowser(new Uint8Array([0x78, 0x9c]))).rejects.toThrow(
      'DecompressionStream assente: questo browser non sa aprire le immagini della neve (serve Safari 16.4 o successivo)',
    )
  })
})
