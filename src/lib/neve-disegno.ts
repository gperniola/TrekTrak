import type { CompositoMattonella } from './neve-composito'
import { NON_VISTO, OPACITA_NEVE, VELO_NON_VISTO } from './snow-cover'

// GIBS pubblica la neve fino al livello 8. Oltre, la mattonella a schermo e' un quadrante
// di quella z8: si ingrandisce un blocco di pixel veri, senza interpolare, cosi' ogni
// pixel resta nitido e le mattonelle vicine si toccano senza salti.

const LATO = 256
const Z_MAX_GIBS = 8
/** Oltre questo livello il quadrante scenderebbe sotto il pixel sorgente. */
const Z_MAX_QUADRANTE = 16

export interface Ritaglio {
  /** Mattonella da comporre (sempre <= 8). */
  z: number
  x: number
  y: number
  /** Quadrante, in pixel della mattonella composta. */
  x0: number
  y0: number
  lato: number
}

export function ritaglioPer(z: number, x: number, y: number): Ritaglio {
  if (z <= Z_MAX_GIBS) return { z, x, y, x0: 0, y0: 0, lato: LATO }
  // Aritmetica intera: nessuna deriva in virgola mobile.
  const s = 2 ** (z - Z_MAX_GIBS)
  const gx = Math.floor(x / s)
  const gy = Math.floor(y / s)
  const rx = x - gx * s
  const ry = y - gy * s
  if (z <= Z_MAX_QUADRANTE) {
    const lato = LATO / s
    return { z: Z_MAX_GIBS, x: gx, y: gy, x0: rx * lato, y0: ry * lato, lato }
  }
  // Mappa fino a zoom 19: oltre il 16 il quadrante sarebbe meno di un pixel e x0 uscirebbe
  // dalla mattonella. Si resta sul singolo pixel sorgente che contiene la mattonella.
  const d = 2 ** (z - Z_MAX_QUADRANTE)
  return { z: Z_MAX_GIBS, x: gx, y: gy, x0: Math.floor(rx / d), y0: Math.floor(ry / d), lato: 1 }
}

export function pixelDellaMattonella(c: CompositoMattonella, r: Ritaglio): Uint8ClampedArray {
  const out = new Uint8ClampedArray(LATO * LATO * 4)
  // Il velo dice «visto, ma coperto»: con la rete giu' nessun pixel e' stato visto da
  // nessuno, e dipingerlo da nube fingerebbe un cielo coperto durante un guasto.
  const velo = c.riassunto.dati > 0
  for (let oy = 0; oy < LATO; oy++) {
    const sy = Math.floor(r.y0 + (oy * r.lato) / LATO)
    for (let ox = 0; ox < LATO; ox++) {
      const sx = Math.floor(r.x0 + (ox * r.lato) / LATO)
      const k = c.codici[sy * LATO + sx]
      const o = (oy * LATO + ox) * 4
      if (k >= 1 && k <= 100) {
        out[o] = c.colori[k * 3]
        out[o + 1] = c.colori[k * 3 + 1]
        out[o + 2] = c.colori[k * 3 + 2]
        out[o + 3] = OPACITA_NEVE
      } else if (k === NON_VISTO && velo) {
        out[o] = VELO_NON_VISTO[0]
        out[o + 1] = VELO_NON_VISTO[1]
        out[o + 2] = VELO_NON_VISTO[2]
        out[o + 3] = VELO_NON_VISTO[3]
      }
      // SENZA_NEVE e ACQUA restano a zero: trasparenti.
    }
  }
  return out
}
