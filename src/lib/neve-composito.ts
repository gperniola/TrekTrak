// Il composito della copertura nevosa: per ogni pixel, l'ultima vista libera da nubi fra i
// passaggi dei sensori sui giorni della finestra. Modulo puro (niente Leaflet, DOM, store):
// il componente della mappa importa `L.GridLayer`, che nel finto Leaflet dei test non c'e',
// quindi tutto cio' che si vuole provare sta qui.
import { giornoMeseLungo } from '@/lib/formato';
import type { EsitoPassaggio } from '@/lib/neve-rete';
import {
  ACQUA, NON_VISTO, SENSORI_NEVE, SENZA_NEVE, classificaTavolozza, type SensoreNeve,
} from '@/lib/snow-cover';

export interface Passaggio {
  giorno: string;
  sensore: SensoreNeve;
  esito: EsitoPassaggio;
}

export interface RiassuntoMattonella {
  /** I giorni dei passaggi che hanno vinto almeno un pixel, crescenti. */
  giorni: string[];
  sensori: SensoreNeve[];
  dati: number;
  nessunDato: number;
  nonPubblicati: number;
  errori: number;
  /**
   * Quando si e' guardato GIBS per questa composizione (ms epoch, da `adesso()` all'inizio).
   * Non quando la mattonella e' arrivata a schermo: e' l'orario che il pannello dichiara.
   */
  alle: number;
}

export interface CompositoMattonella {
  codici: Int8Array;
  /** Indice in `passaggi` del passaggio vincitore, -1 = nessuna vista. */
  origine: Int8Array;
  passaggi: Passaggio[];
  /** RGB delle voci 0-100 dalla tavolozza del primo passaggio con dati; vuoto se nessuno. */
  colori: Uint8Array;
  riassunto: RiassuntoMattonella;
}

export interface Composizione {
  aggiungi(p: Passaggio): void;
  completa(): boolean;
  risultato(): CompositoMattonella;
}

/** Ordine in cui i sensori si scrivono a schermo: non e' quello dei passaggi. */
const ORDINE_STAMPA: readonly SensoreNeve[] = ['terra', 'aqua', 'noaa20', 'noaa21', 'snpp'];

function ordinaSensori(s: SensoreNeve[]): SensoreNeve[] {
  const set = new Set(s);
  return ORDINE_STAMPA.filter((id) => set.has(id));
}

export function creaComposizione(alle: number, lato = 256): Composizione {
  const n = lato * lato;
  const codici = new Int8Array(n).fill(NON_VISTO);
  const origine = new Int8Array(n).fill(-1);
  const passaggi: Passaggio[] = [];
  let colori = new Uint8Array(0);
  let mancanti = n;
  const conteggi = { dati: 0, nessunDato: 0, nonPubblicati: 0, errori: 0 };

  return {
    aggiungi(p) {
      const idx = passaggi.length;
      passaggi.push(p);
      const e = p.esito;
      if (e.tipo === 'nessunDato') conteggi.nessunDato++;
      else if (e.tipo === 'nonPubblicato') conteggi.nonPubblicati++;
      else if (e.tipo === 'errore') conteggi.errori++;
      if (e.tipo !== 'dati') return;
      conteggi.dati++;
      const png = e.png;
      const classi = classificaTavolozza(png);
      if (colori.length === 0) {
        // Le voci 0-100 sempre tutte presenti: una tavolozza corta lascia zeri, mai fuori misura.
        colori = new Uint8Array(101 * 3);
        colori.set(png.tavolozza.subarray(0, Math.min(png.tavolozza.length, 101 * 3)));
      }
      const pixel = Math.min(n, png.indici.length);
      for (let i = 0; i < pixel; i++) {
        if (origine[i] !== -1) continue;
        // Un indice oltre la tavolozza e' un pixel che non sappiamo leggere: non visto, mai
        // `undefined` e mai senza neve.
        const codice = classi[png.indici[i]] ?? NON_VISTO;
        if (codice === NON_VISTO) continue;
        codici[i] = codice;
        origine[i] = idx;
        mancanti--;
      }
    },
    completa: () => mancanti === 0,
    risultato() {
      const vincitori = new Set<number>();
      for (let i = 0; i < n; i++) if (origine[i] !== -1) vincitori.add(origine[i]);
      const vinc = Array.from(vincitori);
      const giorni = Array.from(new Set(vinc.map((k) => passaggi[k].giorno))).sort();
      const sensori = ordinaSensori(vinc.map((k) => passaggi[k].sensore));
      return { codici, origine, passaggi, colori, riassunto: { giorni, sensori, ...conteggi, alle } };
    },
  };
}

/** Oggi se ha dati: oggi, ieri, l'altro ieri; altrimenti i tre giorni prima di oggi. */
export function giorniDellaFinestra(candidati: string[], oggiHaDati: boolean): string[] {
  return oggiHaDati ? candidati.slice(0, 3) : candidati.slice(1, 4);
}

export type StatoPunto =
  | { stato: 'neve'; ndsi: number; giorno: string; sensore: SensoreNeve }
  | { stato: 'senza' | 'acqua'; giorno: string; sensore: SensoreNeve }
  | { stato: 'nonVisto'; giorni: string[] }
  | { stato: 'ignoto' };

export function statoNelPunto(c: CompositoMattonella, px: number, py: number): StatoPunto {
  const lato = Math.round(Math.sqrt(c.codici.length));
  if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= lato || py >= lato) {
    return { stato: 'ignoto' };
  }
  const i = py * lato + px;
  const o = c.origine[i];
  if (o === -1) {
    // Senza nemmeno un passaggio con dati non c'e' nulla da dire: «ignoto», non «nubi».
    const giorni = Array.from(new Set(c.passaggi.filter((p) => p.esito.tipo === 'dati').map((p) => p.giorno))).sort();
    return giorni.length > 0 ? { stato: 'nonVisto', giorni } : { stato: 'ignoto' };
  }
  const { giorno, sensore } = c.passaggi[o];
  const codice = c.codici[i];
  if (codice >= 1) return { stato: 'neve', ndsi: codice, giorno, sensore };
  if (codice === ACQUA) return { stato: 'acqua', giorno, sensore };
  if (codice === SENZA_NEVE) return { stato: 'senza', giorno, sensore };
  return { stato: 'ignoto' };
}

export interface RiassuntoVista {
  stato: 'ready' | 'nodata' | 'error';
  da: string | null;
  a: string | null;
  sensori: SensoreNeve[];
  parziale: boolean;
  /**
   * La composizione **piu' vecchia** fra le mattonelle a schermo: «Aggiornato alle» e
   * `isStale` non possono spacciare per fresca una mattonella composta ore fa.
   */
  alle: number | null;
}

export function riassumiVista(r: RiassuntoMattonella[]): RiassuntoVista | null {
  if (r.length === 0) return null;
  const somma = (k: 'dati' | 'nessunDato' | 'errori') => r.reduce((s, m) => s + m[k], 0);
  // Tutti 404 e nessun dato e' un guasto da dire («error»), non un cielo vuoto («nodata»).
  const stato = somma('dati') > 0 ? 'ready' : somma('nessunDato') > 0 ? 'nodata' : 'error';
  const giorni = r.flatMap((m) => m.giorni).sort();
  return {
    stato,
    da: giorni[0] ?? null,
    a: giorni[giorni.length - 1] ?? null,
    sensori: ordinaSensori(r.flatMap((m) => m.sensori)),
    // Un 404 e' «non pubblicato», non un guasto: solo gli errori veri rendono parziale.
    parziale: somma('errori') > 0,
    alle: Math.min(...r.map((m) => m.alle)),
  };
}

export type EventoRiassunto =
  | { tipo: 'composta'; chiave: string; riassunto: RiassuntoMattonella }
  | { tipo: 'uscita'; chiave: string };

/** Il pannello descrive solo le mattonelle a schermo: una che esce esce anche dal riassunto. */
export function aggiornaRiassunti(
  m: Map<string, RiassuntoMattonella>,
  e: EventoRiassunto,
): RiassuntoVista | null {
  if (e.tipo === 'composta') m.set(e.chiave, e.riassunto);
  else m.delete(e.chiave);
  return riassumiVista(Array.from(m.values()));
}

function nomeSensore(id: SensoreNeve): string {
  const d = SENSORI_NEVE.find((s) => s.id === id);
  return d ? `${d.famiglia} ${d.nome}` : id;
}

/** `14 al 16 ottobre` / `30 settembre al 2 ottobre`, con «dal» davanti; un giorno solo: «del». */
function intervallo(da: string, a: string): string {
  if (da === a) return `del ${giornoMeseLungo(da)}`;
  const l1 = giornoMeseLungo(da);
  const l2 = giornoMeseLungo(a);
  const [g1, mese1] = l1.split(' ');
  const mese2 = l2.split(' ')[1];
  return mese1 === mese2 && da.slice(0, 7) === a.slice(0, 7) ? `dal ${g1} al ${l2}` : `dal ${l1} al ${l2}`;
}

export function testoViste(r: RiassuntoVista): string {
  if (!r.da || !r.a) return '';
  const base = `Viste ${intervallo(r.da, r.a)}`;
  if (r.sensori.length === 0) return base;
  const gruppi: string[] = [];
  for (const famiglia of ['MODIS', 'VIIRS'] as const) {
    const nomi = ordinaSensori(r.sensori)
      .map((id) => SENSORI_NEVE.find((s) => s.id === id))
      .filter((d) => d?.famiglia === famiglia)
      .map((d) => d!.nome);
    if (nomi.length > 0) gruppi.push(`${famiglia} ${nomi.join(', ')}`);
  }
  return `${base} · ${gruppi.join(' · ')}`;
}

export function testoPunto(s: StatoPunto): string {
  switch (s.stato) {
    case 'neve':
      return `Neve (indice ${s.ndsi}) · vista il ${giornoMeseLungo(s.giorno)} da ${nomeSensore(s.sensore)}`;
    case 'senza':
      return `Senza neve · vista il ${giornoMeseLungo(s.giorno)} da ${nomeSensore(s.sensore)}`;
    case 'acqua':
      return `Acqua o mare · vista il ${giornoMeseLungo(s.giorno)} da ${nomeSensore(s.sensore)}`;
    case 'nonVisto': {
      const g = [...s.giorni].sort();
      return `Non visto: nubi in tutti i passaggi ${intervallo(g[0], g[g.length - 1])}`;
    }
    default:
      return 'Nessuna immagine per questo punto negli ultimi 3 giorni';
  }
}
