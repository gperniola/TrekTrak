// Decodifica a mano dei PNG a tavolozza (tipo colore 3, 8 bit) che GIBS serve per la neve.
//
// Perche' non il canvas: nella mattonella la nube e il «senza neve» hanno entrambi alfa 0
// ma RGB diverso, ed e' proprio l'RGB a distinguerli. Misurato in Chromium e WebKit, il
// canvas azzera l'RGB dei pixel trasparenti (premoltiplicazione), quindi i due casi
// diventano indistinguibili. Leggendo gli indici di tavolozza non si perde nulla.

export type Inflate = (compressi: Uint8Array) => Promise<Uint8Array>

export interface PngTavolozza {
  larghezza: number
  altezza: number
  /** Un indice per pixel, riga per riga. */
  indici: Uint8Array
  /** RGB, 3 byte per voce. */
  tavolozza: Uint8Array
  /** Una voce per colore; 255 dove tRNS manca. */
  alfa: Uint8Array
}

const FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function u32(d: Uint8Array, p: number): number {
  return ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0
}

function tipo(d: Uint8Array, p: number): string {
  return String.fromCharCode(d[p], d[p + 1], d[p + 2], d[p + 3])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

export async function decodificaPngTavolozza(
  png: Uint8Array,
  inflate: Inflate,
): Promise<PngTavolozza | null> {
  if (png.length < 8 || FIRMA.some((b, i) => png[i] !== b)) return null

  let larghezza = 0
  let altezza = 0
  let ihdrOk = false
  let tavolozza: Uint8Array | null = null
  let trns: Uint8Array | null = null
  const idat: Uint8Array[] = []

  let p = 8
  while (p + 8 <= png.length) {
    const len = u32(png, p)
    const t = tipo(png, p + 4)
    const inizio = p + 8
    const fine = inizio + len
    if (fine > png.length) return null
    if (t === 'IHDR') {
      larghezza = u32(png, inizio)
      altezza = u32(png, inizio + 4)
      // Solo 8 bit a tavolozza: gli altri tipi non sono il dato che cerchiamo.
      if (png[inizio + 8] !== 8 || png[inizio + 9] !== 3 || png[inizio + 12] !== 0) return null
      ihdrOk = true
    } else if (t === 'PLTE') tavolozza = png.slice(inizio, fine)
    else if (t === 'tRNS') trns = png.slice(inizio, fine)
    else if (t === 'IDAT') idat.push(png.subarray(inizio, fine))
    else if (t === 'IEND') break
    p = fine + 4
  }
  if (!ihdrOk || !tavolozza || idat.length === 0 || larghezza === 0 || altezza === 0) return null

  const totale = idat.reduce((s, c) => s + c.length, 0)
  const compressi = new Uint8Array(totale)
  let o = 0
  for (const c of idat) {
    compressi.set(c, o)
    o += c.length
  }

  const grezzi = await inflate(compressi)
  const stride = larghezza + 1
  if (grezzi.length < stride * altezza) return null

  const indici = new Uint8Array(larghezza * altezza)
  for (let y = 0; y < altezza; y++) {
    const filtro = grezzi[y * stride]
    const src = y * stride + 1
    const dst = y * larghezza
    for (let x = 0; x < larghezza; x++) {
      const a = x > 0 ? indici[dst + x - 1] : 0
      const b = y > 0 ? indici[dst - larghezza + x] : 0
      const c = x > 0 && y > 0 ? indici[dst - larghezza + x - 1] : 0
      const v = grezzi[src + x]
      let r: number
      switch (filtro) {
        case 0: r = v; break
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: r = v + paeth(a, b, c); break
        default: return null
      }
      indici[dst + x] = r & 0xff
    }
  }

  const voci = Math.floor(tavolozza.length / 3)
  const alfa = new Uint8Array(voci).fill(255)
  if (trns) alfa.set(trns.subarray(0, voci))

  return { larghezza, altezza, indici, tavolozza, alfa }
}

/** Inflate del browser (Safari >= 16.4). Il PNG usa zlib, cioe' il formato «deflate». */
export const inflateDelBrowser: Inflate = async (compressi) => {
  // Senza, il guasto si sarebbe letto come un errore qualunque: deve dire che e' il browser.
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'DecompressionStream assente: questo browser non sa aprire le immagini della neve (serve Safari 16.4 o successivo)',
    )
  }
  const flusso = new Blob([compressi as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(flusso).arrayBuffer())
}
