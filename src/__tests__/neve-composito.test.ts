import {
  aggiornaRiassunti, creaComposizione, giorniDellaFinestra, riassumiVista, statoNelPunto,
  testoPunto, testoViste, type RiassuntoMattonella, type RiassuntoVista,
} from '../lib/neve-composito'
import { decodificaPngTavolozza } from '../lib/png-tavolozza'
import { SENZA_NEVE } from '../lib/snow-cover'
import { inflateNode, leggiFixture, pngTavolozza } from './fixtures/gibs/png-sintetico'

const carica = async (nome: string) => {
  const png = await decodificaPngTavolozza(leggiFixture(nome), inflateNode)
  if (!png) throw new Error(`fixture non decodificabile: ${nome}`)
  return png
}

/** L'istante di una composizione: quando si e' guardato GIBS. */
const ALLE = Date.parse('2026-10-16T12:00:00Z')

const rm = (o: Partial<RiassuntoMattonella> = {}): RiassuntoMattonella => ({
  giorni: [], sensori: [], dati: 0, nessunDato: 0, nonPubblicati: 0, errori: 0, alle: ALLE, ...o,
})
const rv = (o: Partial<RiassuntoVista> = {}): RiassuntoVista => ({
  stato: 'ready', da: '2026-10-14', a: '2026-10-16', sensori: ['terra'], parziale: false, alle: ALLE, ...o,
})

describe('composito', () => {
  test('vince il passaggio piu recente che ha visto il suolo', async () => {
    const c = creaComposizione(ALLE)
    c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'dati', png: await carica('terra-2026-10-16-8-94-138.png') } })
    c.aggiungi({ giorno: '2026-10-13', sensore: 'terra', esito: { tipo: 'dati', png: await carica('terra-2026-10-13-8-94-138.png') } })
    expect(statoNelPunto(c.risultato(), 4, 243)).toEqual({ stato: 'neve', ndsi: 82, giorno: '2026-10-13', sensore: 'terra' })
  })

  test('la nube si scavalca, l assente non diventa senza neve', async () => {
    const c = creaComposizione(ALLE)
    c.aggiungi({ giorno: '2026-10-16', sensore: 'aqua', esito: { tipo: 'errore', motivo: 'rete' } })
    c.aggiungi({ giorno: '2026-10-16', sensore: 'noaa20', esito: { tipo: 'nonPubblicato' } })
    c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'dati', png: await carica('terra-2026-10-16-8-94-138.png') } })
    expect(statoNelPunto(c.risultato(), 4, 243)).toEqual({ stato: 'nonVisto', giorni: ['2026-10-16'] })
  })

  test('nessun passaggio con dati: ignoto', () => {
    const c = creaComposizione(ALLE)
    c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'nessunDato' } })
    expect(statoNelPunto(c.risultato(), 4, 243)).toEqual({ stato: 'ignoto' })
  })

  test('completa quando ogni pixel ha una vista', async () => {
    const c = creaComposizione(ALLE, 2)
    expect(c.completa()).toBe(false)
    const bytes = pngTavolozza({
      larghezza: 2, altezza: 2, indici: new Uint8Array([0, 0, 0, 0]),
      tavolozza: new Uint8Array([0, 255, 0]),
    })
    const png = (await decodificaPngTavolozza(bytes, inflateNode))!
    c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'dati', png } })
    expect(c.completa()).toBe(true)
    expect(c.risultato().codici[0]).toBe(SENZA_NEVE)
  })

  test('il riassunto dice quando si e guardato GIBS', () => {
    expect(creaComposizione(ALLE).risultato().riassunto.alle).toBe(ALLE)
  })

  test('un indice oltre la tavolozza e non visto, mai senza neve', async () => {
    const c = creaComposizione(ALLE, 2)
    const bytes = pngTavolozza({
      larghezza: 2, altezza: 2, indici: new Uint8Array([0, 7, 0, 0]),
      tavolozza: new Uint8Array([0, 255, 0]),
    })
    const png = (await decodificaPngTavolozza(bytes, inflateNode))!
    c.aggiungi({ giorno: '2026-10-16', sensore: 'terra', esito: { tipo: 'dati', png } })
    expect(c.risultato().origine[1]).toBe(-1)
    expect(c.completa()).toBe(false)
  })
})

describe('finestra e riassunto', () => {
  const cand = ['2026-10-16', '2026-10-15', '2026-10-14', '2026-10-13']
  test('giorniDellaFinestra', () => {
    expect(giorniDellaFinestra(cand, true)).toEqual(cand.slice(0, 3))
    expect(giorniDellaFinestra(cand, false)).toEqual(cand.slice(1, 4))
  })

  test('un 404 da solo non accende parziale, un errore si', () => {
    expect(riassumiVista([rm({ nonPubblicati: 2 })])?.parziale).toBe(false)
    expect(riassumiVista([rm({ errori: 1, dati: 1 })])?.parziale).toBe(true)
  })

  test('stati', () => {
    expect(riassumiVista([])).toBeNull()
    expect(riassumiVista([rm({ nonPubblicati: 3 })])?.stato).toBe('error')
    expect(riassumiVista([rm({ nessunDato: 1 })])?.stato).toBe('nodata')
    expect(riassumiVista([rm({ dati: 1 })])?.stato).toBe('ready')
  })

  /*
    «Aggiornato alle» dice quando si e' guardato GIBS: con mattonelle composte in momenti
    diversi, vale la piu' vecchia. Dire la piu' recente spaccerebbe per fresca quella di ore fa.
  */
  test('alle: la mattonella composta per prima', () => {
    const r = riassumiVista([rm({ dati: 1, alle: ALLE + 3_600_000 }), rm({ dati: 1, alle: ALLE }), rm({ dati: 1, alle: ALLE + 60_000 })])
    expect(r?.alle).toBe(ALLE)
  })

  test('da e a', () => {
    const r = riassumiVista([rm({ dati: 1, giorni: ['2026-10-14'] }), rm({ dati: 1, giorni: ['2026-10-15', '2026-10-16'] })])
    expect(r?.da).toBe('2026-10-14')
    expect(r?.a).toBe('2026-10-16')
  })

  test('una mattonella uscita dallo schermo esce dal riassunto', () => {
    const m = new Map<string, RiassuntoMattonella>()
    aggiornaRiassunti(m, { tipo: 'composta', chiave: 'A', riassunto: rm({ dati: 1, giorni: ['2026-10-14'] }) })
    expect(aggiornaRiassunti(m, { tipo: 'composta', chiave: 'B', riassunto: rm({ dati: 1, giorni: ['2026-10-16'] }) })?.da).toBe('2026-10-14')
    expect(aggiornaRiassunti(m, { tipo: 'uscita', chiave: 'A' })?.da).toBe('2026-10-16')
    expect(aggiornaRiassunti(m, { tipo: 'uscita', chiave: 'B' })).toBeNull()
  })
})

describe('testi', () => {
  test('testoViste', () => {
    expect(testoViste(rv({ sensori: ['noaa20', 'aqua', 'terra'] }))).toBe('Viste dal 14 al 16 ottobre · MODIS Terra, Aqua · VIIRS NOAA-20')
    expect(testoViste(rv({ da: '2026-10-16', sensori: ['terra'] }))).toBe('Viste del 16 ottobre · MODIS Terra')
    expect(testoViste(rv({ da: '2026-09-30', a: '2026-10-02', sensori: ['noaa21'] }))).toBe('Viste dal 30 settembre al 2 ottobre · VIIRS NOAA-21')
  })

  test('testoPunto', () => {
    expect(testoPunto({ stato: 'neve', ndsi: 45, giorno: '2026-10-15', sensore: 'terra' })).toBe('Neve (indice 45) · vista il 15 ottobre da MODIS Terra')
    expect(testoPunto({ stato: 'senza', giorno: '2026-10-16', sensore: 'noaa20' })).toBe('Senza neve · vista il 16 ottobre da VIIRS NOAA-20')
    expect(testoPunto({ stato: 'acqua', giorno: '2026-10-16', sensore: 'aqua' })).toBe('Acqua o mare · vista il 16 ottobre da MODIS Aqua')
    expect(testoPunto({ stato: 'nonVisto', giorni: ['2026-10-16', '2026-10-14', '2026-10-15'] })).toBe('Non visto: nubi in tutti i passaggi dal 14 al 16 ottobre')
    expect(testoPunto({ stato: 'nonVisto', giorni: ['2026-10-16'] })).toBe('Non visto: nubi in tutti i passaggi del 16 ottobre')
    expect(testoPunto({ stato: 'ignoto' })).toBe('Nessuna immagine per questo punto negli ultimi 3 giorni')
  })
})
