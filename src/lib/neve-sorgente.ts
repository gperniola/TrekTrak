// La sorgente della copertura nevosa: lega rete, composito e cache in un oggetto solo, che il
// layer sulla mappa e il popup della pressione lunga usano senza sapere nulla di GIBS.
// Niente Leaflet, DOM o store: tutto cio' che si vuole provare sta qui.
import type { Inflate } from '@/lib/png-tavolozza';
import { scaricaPassaggio, type EsitoPassaggio, type FetchMinimo } from '@/lib/neve-rete';
import {
  creaComposizione, giorniDellaFinestra, statoNelPunto,
  type CompositoMattonella, type Passaggio, type StatoPunto,
} from '@/lib/neve-composito';
import { SENSORI_NEVE, giorniCandidati, pixelZ8, urlMattonellaNeve } from '@/lib/snow-cover';

export interface DipendenzeSorgente {
  fetch: FetchMinimo;
  inflate: Inflate;
  adesso: () => Date;
  /** Tetto dei passaggi decodificati tenuti in memoria (predefinito 400). */
  maxPassaggiInCache?: number;
}

export interface SorgenteNeve {
  mattonella(z: number, x: number, y: number, signal?: AbortSignal): Promise<CompositoMattonella>;
  punto(lat: number, lon: number, signal?: AbortSignal): Promise<StatoPunto>;
  dimensioneCache(): number;
}

type PassaggioConDati = Extract<EsitoPassaggio, { tipo: 'dati' }>;

function annullata(): Error {
  return new DOMException('Richiesta annullata', 'AbortError');
}

export function creaSorgenteNeve(deps: DipendenzeSorgente): SorgenteNeve {
  const tetto = deps.maxPassaggiInCache ?? 400;
  // Solo gli esiti `dati`: gli altri si riprovano, perche' un guasto o un passaggio non ancora
  // pubblicato domani puo' esserci. L'ordine di inserimento della Map fa da LRU.
  const cache = new Map<string, PassaggioConDati>();
  // A zoom >= 9 ~20 mattonelle a schermo hanno lo stesso genitore z8: si compone una volta sola.
  const inCorso = new Map<string, Promise<CompositoMattonella>>();

  async function passaggio(layer: string, giorno: string, z: number, x: number, y: number): Promise<EsitoPassaggio> {
    const chiave = `${layer}|${giorno}|${z}|${x}|${y}`;
    const hit = cache.get(chiave);
    if (hit) {
      cache.delete(chiave);
      cache.set(chiave, hit); // il piu' recente
      return hit;
    }
    // Senza il segnale di chi chiede: il lavoro e' condiviso, ha il suo timeout.
    const esito = await scaricaPassaggio(urlMattonellaNeve(layer, giorno, z, x, y), {
      fetch: deps.fetch,
      inflate: deps.inflate,
    });
    if (esito.tipo === 'dati') {
      cache.set(chiave, esito);
      while (cache.size > tetto) {
        const piuVecchia = cache.keys().next().value;
        if (piuVecchia === undefined) break;
        cache.delete(piuVecchia);
      }
    }
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
    dimensioneCache: () => cache.size,
  };
}
