import { creaComposizione } from '../lib/neve-composito'
import { pixelDellaMattonella, ritaglioPer } from '../lib/neve-disegno'
import { decodificaPngTavolozza } from '../lib/png-tavolozza'
import { OPACITA_NEVE, VELO_NON_VISTO } from '../lib/snow-cover'
import { inflateNode, leggiFixture, pngTavolozza } from './fixtures/gibs/png-sintetico'

const carica = async (nome: string) => {
  const png = await decodificaPngTavolozza(leggiFixture(nome), inflateNode)
  if (!png) throw new Error(`fixture non decodificabile: ${nome}`)
  return png
}

const compositoFixture = async () => {
  const c = creaComposizione()
  c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'dati', png: await carica('terra-2026-10-16-8-94-138.png') } })
  c.aggiungi({ giorno: '2026-10-13', sensore: 'terra', esito: { tipo: 'dati', png: await carica('terra-2026-10-13-8-94-138.png') } })
  return c
}

const rgba = (p: Uint8ClampedArray, ox: number, oy: number) => {
  const i = (oy * 256 + ox) * 4
  return [p[i], p[i + 1], p[i + 2], p[i + 3]]
}

const IDENTITA = { z: 8, x: 138, y: 94, x0: 0, y0: 0, lato: 256 }

describe('pixelDellaMattonella', () => {
  test('la neve ha il colore della tavolozza e alfa 235', async () => {
    const png = await carica('terra-2026-10-13-8-94-138.png')
    const attesi = Array.from(png.tavolozza.slice(82 * 3, 82 * 3 + 3))
    const c = await compositoFixture()
    const p = pixelDellaMattonella(c.risultato(), ritaglioPer(8, 138, 94))
    expect(p.length).toBe(256 * 256 * 4)
    expect(rgba(p, 4, 243)).toEqual([...attesi, OPACITA_NEVE])
  })

  test('il velo dove nessuno ha visto', async () => {
    const c = await compositoFixture()
    const r = c.risultato()
    const i = r.codici.findIndex((k) => k === -2)
    expect(i).toBeGreaterThanOrEqual(0)
    const p = pixelDellaMattonella(r, IDENTITA)
    expect(rgba(p, i % 256, Math.floor(i / 256))).toEqual([...VELO_NON_VISTO])
  })

  test('senza neve e acqua restano trasparenti', async () => {
    const c = await compositoFixture()
    const r = c.risultato()
    const p = pixelDellaMattonella(r, IDENTITA)
    const s = r.codici.findIndex((k) => k === 0)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(p[s * 4 + 3]).toBe(0)
    const a = r.codici.findIndex((k) => k === -1)
    if (a >= 0) expect(p[a * 4 + 3]).toBe(0)
  })

  test('rete giu: niente velo', () => {
    const c = creaComposizione()
    c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'errore', motivo: 'rete' } })
    c.aggiungi({ giorno: '2026-10-15', sensore: 'terra', esito: { tipo: 'errore', motivo: 'rete' } })
    const p = pixelDellaMattonella(c.risultato(), IDENTITA)
    let opachi = 0
    for (let i = 3; i < p.length; i += 4) if (p[i] !== 0) opachi++
    expect(p.length).toBe(65536 * 4)
    expect(opachi).toBe(0)
  })
})

describe('ritaglioPer', () => {
  test('fino a z 8 e il ritaglio intero', () => {
    expect(ritaglioPer(8, 138, 94)).toEqual(IDENTITA)
    expect(ritaglioPer(5, 3, 2)).toEqual({ z: 5, x: 3, y: 2, x0: 0, y0: 0, lato: 256 })
  })

  test('z 9: due mattonelle vicine si cuciono', () => {
    const a = ritaglioPer(9, 276, 188)
    const b = ritaglioPer(9, 277, 188)
    expect([a.z, a.x, a.y]).toEqual([8, 138, 94])
    expect([b.z, b.x, b.y]).toEqual([8, 138, 94])
    expect(a.lato).toBe(128)
    // ultima colonna della prima = 127, prima della seconda = 128
    expect(a.x0 + a.lato - 1).toBe(127)
    expect(b.x0).toBe(128)
  })

  test('z 9: le colonne d uscita leggono le sorgenti giuste', async () => {
    const c = await compositoFixture()
    const r = c.risultato()
    const pa = pixelDellaMattonella(r, ritaglioPer(9, 276, 188))
    const pb = pixelDellaMattonella(r, ritaglioPer(9, 277, 188))
    const sorg = (sx: number, sy: number) => {
      const k = r.codici[sy * 256 + sx]
      return k
    }
    // controllo di coerenza sul valore alfa: neve <=> alfa 235
    for (let oy = 0; oy < 256; oy += 17) {
      const sy = Math.floor(oy / 2)
      expect(pa[(oy * 256 + 255) * 4 + 3] === OPACITA_NEVE).toBe(sorg(127, sy) > 0)
      expect(pb[(oy * 256) * 4 + 3] === OPACITA_NEVE).toBe(sorg(128, sy) > 0)
    }
  })

  test('z 12: pixel nitidi', () => {
    const lato = 256
    const indici = new Uint8Array(lato * lato)
    for (let i = 0; i < indici.length; i++) indici[i] = (i % 7) + 1
    const tavolozza = new Uint8Array(303)
    for (let k = 0; k < 101; k++) { tavolozza[k * 3] = k; tavolozza[k * 3 + 1] = 255 - k; tavolozza[k * 3 + 2] = k * 2 }
    return decodificaPngTavolozza(pngTavolozza({ larghezza: lato, altezza: lato, indici, tavolozza }), inflateNode).then((png) => {
      const c = creaComposizione()
      c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'dati', png: png! } })
      const rit = ritaglioPer(12, 138 * 16 + 5, 94 * 16 + 9)
      expect(rit.lato).toBe(16)
      expect(rit.x0).toBe(5 * 16)
      expect(rit.y0).toBe(9 * 16)
      const p = pixelDellaMattonella(c.risultato(), rit)
      for (let sy = 0; sy < 16; sy++) {
        for (let sx = 0; sx < 16; sx++) {
          const ref = rgba(p, sx * 16, sy * 16)
          expect(ref[3]).toBe(OPACITA_NEVE)
          for (let dy = 0; dy < 16; dy += 5) for (let dx = 0; dx < 16; dx += 5) {
            expect(rgba(p, sx * 16 + dx, sy * 16 + dy)).toEqual(ref)
          }
        }
      }
    })
  })

  test('z oltre 16: ogni pixel d uscita resta un pixel sorgente valido', () => {
    for (const z of [17, 18, 19]) {
      const s = 2 ** (z - 8)
      for (const x of [0, 1, s - 1, 3 * s + 7]) {
        const r = ritaglioPer(z, x, x)
        expect(r.z).toBe(8)
        expect(r.lato).toBe(1)
        expect(r.x0).toBeGreaterThanOrEqual(0)
        expect(r.x0).toBeLessThanOrEqual(255)
        expect(r.y0).toBeLessThanOrEqual(255)
      }
    }
  })
})
