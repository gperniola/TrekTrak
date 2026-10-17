// La sorgente della copertura nevosa: lega rete, composito e cache in un oggetto solo, che il
// layer sulla mappa e il popup della pressione lunga usano senza sapere nulla di GIBS.
// Niente Leaflet, DOM o store: tutto cio' che si vuole provare sta qui.
import type { Inflate } from '@/lib/png-tavolozza';
import { scaricaPassaggio, type EsitoPassaggio, type FetchMinimo } from '@/lib/neve-rete';
import {
  creaComposizione, giorniDellaFinestra, statoNelPunto,
  type CompositoMattonella, type Passaggio, type StatoPunto,
} from '@/lib/neve-composito';
import { SENSORI_NEVE, giorniCandidati, giornoUTC, pixelZ8, urlMattonellaNeve } from '@/lib/snow-cover';

export interface DipendenzeSorgente {
  fetch: FetchMinimo;
  inflate: Inflate;
  adesso: () => Date;
  /** Tetto dei passaggi decodificati tenuti in memoria (predefinito 400). */
  maxPassaggiInCache?: number;
  /**
   * Tetto degli esiti assenti ricordati (predefinito 2000). Sono piccoli (solo il tipo), ma
   * una sessione lunga che gira per mezza Italia ne accumula senza fine.
   */
  maxAssentiInCache?: number;
}

export interface SorgenteNeve {
  mattonella(z: number, x: number, y: number, signal?: AbortSignal): Promise<CompositoMattonella>;
  punto(lat: number, lon: number, signal?: AbortSignal): Promise<StatoPunto>;
  /**
   * Il «prossimo aggiornamento»: dimentica gli assenti ricordati e i passaggi con dati di
   * oggi (UTC), cosi' la composizione successiva li richiede. GIBS pubblica a pezzi durante
   * il giorno, quindi oggi puo' essere cambiato; i giorni prima no, e restano in memoria.
   */
  rinnova(): void;
  /** I passaggi con dati in memoria (gli assenti non contano: pesano un tipo e basta). */
  dimensioneCache(): number;
}

type PassaggioConDati = Extract<EsitoPassaggio, { tipo: 'dati' }>;
type PassaggioAssente = Extract<EsitoPassaggio, { tipo: 'nessunDato' | 'nonPubblicato' }>;

/** Una voce letta torna in fondo: l'ordine di inserimento della Map fa da LRU. */
function richiama<V>(m: Map<string, V>, chiave: string): V | undefined {
  const v = m.get(chiave);
  if (v !== undefined) {
    m.delete(chiave);
    m.set(chiave, v);
  }
  return v;
}

function ricorda<V>(m: Map<string, V>, chiave: string, v: V, tetto: number): void {
  m.set(chiave, v);
  while (m.size > tetto) {
    const piuVecchia = m.keys().next().value;
    if (piuVecchia === undefined) break;
    m.delete(piuVecchia);
  }
}

function annullata(): Error {
  return new DOMException('Richiesta annullata', 'AbortError');
}

export function creaSorgenteNeve(deps: DipendenzeSorgente): SorgenteNeve {
  const tetto = deps.maxPassaggiInCache ?? 400;
  const tettoAssenti = deps.maxAssentiInCache ?? 2000;
  // Chiave di entrambe: `layer|giorno|z|x|y`. I passaggi con dati restano finche' il tetto
  // non li spinge fuori (tranne quelli di oggi, che `rinnova` dimentica).
  const cache = new Map<string, PassaggioConDati>();
  /*
    Gli assenti («nessun dato» e 404) fino al prossimo `rinnova`, come dice la spec: senza,
    a zoom >= 9 ogni mattonella nuova riscaricava ogni «nessun dato» (fino a 152 KB di
    rumore, misurato su Aqua) e ogni 404. Gli `errore` NON si ricordano: un guasto
    passeggero si riprova alla richiesta dopo, e l'avviso «parziale» non resta acceso un'ora.
  */
  const assenti = new Map<string, PassaggioAssente>();
  /*
    A zoom >= 9 ~20 mattonelle a schermo hanno lo stesso genitore z8: finche' la sua
    composizione e' in corso la condividono. Finita, una mattonella nuova la rifa' da capo,
    ma dalla memoria: i passaggi con dati e gli assenti ricordati non tornano in rete.
  */
  const inCorso = new Map<string, Promise<CompositoMattonella>>();

  async function passaggio(layer: string, giorno: string, z: number, x: number, y: number): Promise<EsitoPassaggio> {
    const chiave = `${layer}|${giorno}|${z}|${x}|${y}`;
    const hit = richiama(cache, chiave) ?? richiama(assenti, chiave);
    if (hit) return hit;
    // Senza il segnale di chi chiede: il lavoro e' condiviso, ha il suo timeout.
    const esito = await scaricaPassaggio(urlMattonellaNeve(layer, giorno, z, x, y), {
      fetch: deps.fetch,
      inflate: deps.inflate,
    });
    if (esito.tipo === 'dati') ricorda(cache, chiave, esito, tetto);
    else if (esito.tipo === 'nessunDato' || esito.tipo === 'nonPubblicato') ricorda(assenti, chiave, esito, tettoAssenti);
    return esito;
  }

  const giornata = (giorno: string, z: number, x: number, y: number): Promise<Passaggio[]> =>
    Promise.all(
      SENSORI_NEVE.map(async (s) => ({ giorno, sensore: s.id, esito: await passaggio(s.layer, giorno, z, x, y) })),
    );

  async function componi(z: number, x: number, y: number): Promise<CompositoMattonella> {
    const candidati = giorniCandidati(deps.adesso()); // letto una volta sola
    const composizione = creaComposizione();
    // I passaggi di oggi si aggiungono sempre, anche se oggi esce dalla finestra: contano nel riassunto.
    const oggi = await giornata(candidati[0], z, x, y);
    oggi.forEach((p) => composizione.aggiungi(p));
    const oggiHaDati = oggi.some((p) => p.esito.tipo === 'dati');
    for (const giorno of giorniDellaFinestra(candidati, oggiHaDati)) {
      if (composizione.completa()) break;
      if (giorno === candidati[0]) continue;
      (await giornata(giorno, z, x, y)).forEach((p) => composizione.aggiungi(p));
    }
    return composizione.risultato();
  }

  function mattonella(z: number, x: number, y: number, signal?: AbortSignal): Promise<CompositoMattonella> {
    if (signal?.aborted) return Promise.reject(annullata());
    const chiave = `${z}|${x}|${y}`;
    let lavoro = inCorso.get(chiave);
    if (!lavoro) {
      const nuovo = componi(z, x, y);
      lavoro = nuovo;
      inCorso.set(chiave, nuovo);
      const togli = () => {
        if (inCorso.get(chiave) === nuovo) inCorso.delete(chiave);
      };
      nuovo.then(togli, togli);
    }
    if (!signal) return lavoro;
    const condiviso = lavoro;
    // L'annullo di un chiamante respinge solo la sua promessa: gli altri hanno ancora bisogno del risultato.
    return new Promise<CompositoMattonella>((resolve, reject) => {
      const siAnnulla = () => reject(annullata());
      signal.addEventListener('abort', siAnnulla, { once: true });
      condiviso.then(
        (r) => {
          signal.removeEventListener('abort', siAnnulla);
          resolve(r);
        },
        (e) => {
          signal.removeEventListener('abort', siAnnulla);
          reject(e);
        },
      );
    });
  }

  return {
    mattonella,
    async punto(lat, lon, signal) {
      const { x, y, px, py } = pixelZ8(lat, lon);
      return statoNelPunto(await mattonella(8, x, y, signal), px, py);
    },
    rinnova() {
      assenti.clear();
      const oggi = giornoUTC(deps.adesso());
      for (const chiave of Array.from(cache.keys())) {
        if (chiave.split('|')[1] === oggi) cache.delete(chiave);
      }
    },
    dimensioneCache: () => cache.size,
  };
}
