// Aiuto condiviso dai test della neve e dallo scenario e2e (contesto Node: solo zlib e fs).
// Non e' un test (Jest cerca solo *.test.ts): i percorsi sono relativi a questo file, non
// alla cartella da cui si lancia il comando.
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import type { Inflate } from '../../../lib/png-tavolozza'

export const inflateNode: Inflate = (d) => Promise.resolve(new Uint8Array(zlib.inflateSync(d)))

export function leggiFixture(nome: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(__dirname, nome)))
}

const TAVOLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(d: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < d.length; i++) c = TAVOLA_CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function blocco(tipo: string, dati: Uint8Array): Uint8Array {
  const out = Buffer.alloc(12 + dati.length)
  out.writeUInt32BE(dati.length, 0)
  out.write(tipo, 4, 'latin1')
  Buffer.from(dati).copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + dati.length)), 8 + dati.length)
  return new Uint8Array(out)
}

function assembla(
  larghezza: number,
  altezza: number,
  profondita: number,
  tipoColore: number,
  grezzi: Uint8Array,
  extra: Uint8Array[],
  idatInPezzi: number,
): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(larghezza, 0)
  ihdr.writeUInt32BE(altezza, 4)
  ihdr[8] = profondita
  ihdr[9] = tipoColore
  const compressi = new Uint8Array(zlib.deflateSync(grezzi))
  const n = Math.max(1, idatInPezzi)
  const passo = Math.ceil(compressi.length / n)
  const idat: Uint8Array[] = []
  for (let i = 0; i < n; i++) idat.push(blocco('IDAT', compressi.subarray(i * passo, (i + 1) * passo)))
  const parti = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco('IHDR', new Uint8Array(ihdr)),
    ...extra,
    ...idat,
    blocco('IEND', new Uint8Array(0)),
  ]
  return new Uint8Array(Buffer.concat(parti))
}

/** Applica il filtro di riga `f` agli indici (un byte per pixel). */
function filtra(f: number, riga: Uint8Array, sopra: Uint8Array): Uint8Array {
  const out = new Uint8Array(riga.length)
  for (let x = 0; x < riga.length; x++) {
    const a = x > 0 ? riga[x - 1] : 0
    const b = sopra[x]
    const c = x > 0 ? sopra[x - 1] : 0
    let pred = 0
    if (f === 1) pred = a
    else if (f === 2) pred = b
    else if (f === 3) pred = (a + b) >> 1
    else if (f === 4) {
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
    }
    out[x] = (riga[x] - pred) & 0xff
  }
  return out
}

export function pngTavolozza(o: {
  larghezza: number
  altezza: number
  indici: Uint8Array
  tavolozza: Uint8Array
  alfa?: Uint8Array
  filtri?: number[]
  idatInPezzi?: number
}): Uint8Array {
  const { larghezza, altezza, indici } = o
  const grezzi = new Uint8Array((larghezza + 1) * altezza)
  const zero = new Uint8Array(larghezza)
  for (let y = 0; y < altezza; y++) {
    const f = o.filtri?.[y] ?? 0
    const riga = indici.subarray(y * larghezza, (y + 1) * larghezza)
    const sopra = y > 0 ? indici.subarray((y - 1) * larghezza, y * larghezza) : zero
    grezzi[y * (larghezza + 1)] = f
    grezzi.set(filtra(f, riga, sopra), y * (larghezza + 1) + 1)
  }
  const extra = [blocco('PLTE', o.tavolozza)]
  if (o.alfa) extra.push(blocco('tRNS', o.alfa))
  return assembla(larghezza, altezza, 8, 3, grezzi, extra, o.idatInPezzi ?? 1)
}

export function pngRgba(
  larghezza: number,
  altezza: number,
  rgba: [number, number, number, number],
): Uint8Array {
  const grezzi = new Uint8Array((larghezza * 4 + 1) * altezza)
  for (let y = 0; y < altezza; y++) {
    for (let x = 0; x < larghezza; x++) grezzi.set(rgba, y * (larghezza * 4 + 1) + 1 + x * 4)
  }
  return assembla(larghezza, altezza, 8, 6, grezzi, [], 1)
}
