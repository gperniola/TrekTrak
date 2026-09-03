import {
  REGIONI_EAWS,
  bboxDiGeometria,
  giorniDaProvare,
  parseRatings,
  regioniPerBbox,
  rettangoliSiToccano,
  semplificaGeometria,
  tolleranzaPerZoom,
  type BBoxGeo,
  type Valutazione,
} from './avalanche';

/**
 * Il lato server del pericolo valanghe: scarica, tiene, **ritaglia** e semplifica.
 *
 * Esiste per una misura, non per gusto architetturale: le geometrie delle micro-regioni
 * italiane pesano 4,85 MB e il server che le pubblica non comprime. Dal telefono non si
 * scaricano, e non basta prendere "solo la regione che serve" perché il rettangolo di
 * `IT-MeteoMont` copre l'Italia intera.
 *
 * Due cache separate, perché le due cose cambiano con ritmi diversi:
 *
 * - le **geometrie** sono confini amministrativi: si tengono a lungo;
 * - i **bollettini** escono ogni pomeriggio: mezz'ora.
 *
 * Quanto costa tenerle: **misurato** il 2026-09-03, +12,5 MB di heap per una vista
 * dolomitica (che tira dentro Bolzano, Trento, Veneto e l'Appennino, cioe' il file
 * grosso) e +13,7 MB con tutte e nove le regioni in cache. Non era una stima: la prima
 * versione di questo commento diceva "accettabile" senza un numero.
 */

const BASE_RATINGS = 'https://static.avalanche.report/eaws_bulletins';
const BASE_GEOMETRIE = 'https://regions.avalanches.org/micro-regions';
const URL_NOMI = 'https://regions.avalanches.org/micro-regions_names/it.json';

const TTL_GEOMETRIE_MS = 12 * 60 * 60 * 1000;
const TTL_BOLLETTINI_MS = 30 * 60 * 1000;
/** Fuori stagione i 404 sono la risposta normale: non serve richiederli ogni minuto. */
const TTL_FUORI_STAGIONE_MS = 60 * 60 * 1000;

interface FeatureGeo {
  id: string;
  geometria: { type: string; coordinates: unknown };
  bbox: BBoxGeo;
}

interface Conservato<T> { valore: T; scadenza: number }

interface Bollettino {
  /** Giorno usato, `null` = nessun bollettino (fuori stagione accertato). */
  data: string | null;
  valutazioni: Map<string, Valutazione>;
  /** `true` se qualche regione non ha risposto: il pannello lo dichiara. */
  parziale: boolean;
}

const geometrie = new Map<string, Conservato<FeatureGeo[]>>();
/**
 * Richieste **in volo**, per regione.
 *
 * Due chiamate contemporanee su cache fredda scaricavano due volte gli stessi confini —
 * per `IT-MeteoMont` sono 2,5 MB a testa, da un servizio gratuito. Il client fa da
 * tampone (aspetta 700 ms e annulla la precedente), ma il server non deve dipendere dalla
 * buona educazione del client: due schede aperte bastano a scavalcarlo.
 */
const inVolo = new Map<string, Promise<FeatureGeo[]>>();
let nomi: Conservato<Record<string, string>> | null = null;
let bollettino: Conservato<Bollettino> | null = null;

function vivo<T>(c: Conservato<T> | null | undefined): T | null {
  return c != null && c.scadenza > Date.now() ? c.valore : null;
}

/**
 * Le geometrie di una regione, pronte per il ritaglio.
 *
 * Una micro-regione può essere **più feature con lo stesso id** (misurato: 242 feature
 * per 172 id distinti, 61 id con più di un poligono). Si tengono separate e si filtrano
 * una per una: unirle sarebbe un lavoro inutile, e assumere "una feature per id" farebbe
 * sparire pezzi di zona dalla mappa.
 */
async function geometrieRegione(regione: string): Promise<FeatureGeo[]> {
  const conservata = vivo(geometrie.get(regione));
  if (conservata != null) return conservata;
  // Se qualcuno le sta gia' scaricando, si aspetta la sua: vedi `inVolo`.
  const giaInVolo = inVolo.get(regione);
  if (giaInVolo != null) return giaInVolo;
  const promessa = scaricaGeometrie(regione);
  inVolo.set(regione, promessa);
  try {
    return await promessa;
  } finally {
    inVolo.delete(regione);
  }
}

async function scaricaGeometrie(regione: string): Promise<FeatureGeo[]> {
  /*
    cache-immutabile-ok: i confini delle micro-regioni sono geodati amministrativi, non
    dati vivi: cambiano quando un servizio valanghe ridisegna le zone, cioe' una volta
    l'anno. Qui la Data Cache di Next e' un vantaggio, non un rischio — il rischio da cui
    quel guardiano protegge e' un BOLLETTINO vecchio, e il bollettino lo chiede la
    funzione qui sotto, con `no-store`.
  */
  const res = await fetch(
    `${BASE_GEOMETRIE}/${regione}_micro-regions.geojson.json`,
    // cache-immutabile-ok: confini amministrativi, vedi sopra.
  );
  if (!res.ok) throw new Error(`Geometrie ${regione} non disponibili`);
  const dati = await res.json() as { features?: unknown };
  if (!Array.isArray(dati.features)) throw new Error(`Geometrie ${regione} in un formato non riconosciuto`);

  const fuori: FeatureGeo[] = [];
  for (const f of dati.features) {
    const feature = f as { properties?: { id?: unknown }; geometry?: { type?: unknown; coordinates?: unknown } };
    const id = feature.properties?.id;
    const g = feature.geometry;
    if (typeof id !== 'string' || g == null || typeof g.type !== 'string') continue;
    const bbox = bboxDiGeometria(g.coordinates);
    if (bbox == null) continue;
    fuori.push({ id, geometria: { type: g.type, coordinates: g.coordinates }, bbox });
  }
  geometrie.set(regione, { valore: fuori, scadenza: Date.now() + TTL_GEOMETRIE_MS });
  return fuori;
}

/** I nomi italiani delle micro-regioni: 26 KB per tutta Europa, tutti i 242 id italiani coperti. */
async function nomiItaliani(): Promise<Record<string, string>> {
  const conservati = vivo(nomi);
  if (conservati != null) return conservati;
  try {
    // cache-immutabile-ok: i nomi delle micro-regioni cambiano con le geometrie.
    const res = await fetch(
      URL_NOMI,
      // cache-immutabile-ok: i nomi cambiano con le geometrie.
    );
    if (!res.ok) throw new Error('nomi non disponibili');
    const dati = await res.json() as Record<string, unknown>;
    const soloStringhe: Record<string, string> = {};
    for (const [k, v] of Object.entries(dati)) if (typeof v === 'string') soloStringhe[k] = v;
    nomi = { valore: soloStringhe, scadenza: Date.now() + TTL_GEOMETRIE_MS };
    return soloStringhe;
  } catch {
    // Senza nomi il layer funziona: il popup mostra l'id. Un nome mancante non è un
    // motivo per non dire il pericolo.
    nomi = { valore: {}, scadenza: Date.now() + TTL_BOLLETTINI_MS };
    return {};
  }
}

/**
 * Il bollettino più attuale: si provano i giorni in ordine, tutte le regioni per ogni
 * giorno.
 *
 * Un 404 non è un errore ma **la risposta normale fuori stagione**, e va distinto da "il
 * servizio è giù": se nessuna regione risponde per nessuno dei giorni, la data resta
 * `null` e il layer dirà "nessun bollettino", non "non raggiungibile".
 */
async function bollettinoCorrente(adesso: Date): Promise<Bollettino> {
  const conservato = vivo(bollettino);
  if (conservato != null) return conservato;

  const regioni = REGIONI_EAWS.map((r) => r.id);
  let qualcosaSiERotto = false;
  for (const giorno of giorniDaProvare(adesso)) {
    const risposte = await Promise.all(regioni.map(async (r) => {
      try {
        // Questo SI': e' il bollettino del giorno, l'unica parte viva.
        const res = await fetch(`${BASE_RATINGS}/${giorno}/${giorno}-${r}.ratings.json`, { cache: 'no-store' });
        // 404 = quella regione quel giorno non ha bollettino: e' la norma fuori stagione.
        if (res.status === 404) return { esito: 'assente' as const };
        if (!res.ok) return { esito: 'guasto' as const };
        return { esito: 'dati' as const, valutazioni: parseRatings(await res.json()) };
      } catch {
        // Rete interrotta, DNS, JSON illeggibile: un guasto, non un'assenza.
        return { esito: 'guasto' as const };
      }
    }));

    const valutazioni = new Map<string, Valutazione>();
    for (const r of risposte) {
      if (r.esito === 'dati') {
        r.valutazioni.forEach((v, k) => {
          /*
            **Uno zero non e' una valutazione, e un file di soli zeri non e' un bollettino.**

            MISURATO il 2026-09-03, fuori stagione: le otto regioni alpine rispondono 404,
            ma `IT-MeteoMont` pubblica ogni giorno le sue 39 zone **tutte a 0**. Tenendole,
            l'app dipingeva 39 poligoni grigi sull'Appennino annunciando «Bollettino del
            03/09/2026»: niente presentato come qualcosa, che e' il difetto che questo
            progetto inseguo da mesi. Le zone a zero non entrano.
          */
          if (v.pericolo > 0) valutazioni.set(k, v);
        });
      }
    }
    const guasti = risposte.filter((r) => r.esito === 'guasto').length;

    if (valutazioni.size > 0) {
      /*
        Qualcosa c'e': si mostra, e se una regione non ha risposto lo si DICHIARA. Per un
        layer di sicurezza il parziale dichiarato batte il niente — ma un parziale
        silenzioso sarebbe peggio di entrambi, perche' una zona senza colore si legge
        come una zona senza pericolo.
      */
      const esito = { data: giorno, valutazioni, parziale: guasti > 0 };
      bollettino = { valore: esito, scadenza: Date.now() + TTL_BOLLETTINI_MS };
      return esito;
    }
    /*
      Nessun dato per QUESTO giorno. Non si conclude niente: si prova il successivo.
      Concludere qui "fuori stagione" al primo giorno vuoto annullava il ripiego — e
      infatti il test del ripiego e' passato da verde a rosso appena l'ho scritto cosi'.
    */
    if (guasti > 0) qualcosaSiERotto = true;
  }
  if (qualcosaSiERotto) {
    /*
      Nessun dato, e per strada qualcosa si e' rotto: NON si dice "fuori stagione", si
      solleva. Chi legge "fuori stagione" non riprova, e a gennaio quella frase sarebbe
      una bugia che manda qualcuno in montagna senza bollettino.
    */
    throw new Error('Bollettino valanghe non raggiungibile');
  }
  /*
    Nessun dato e nessun guasto, per tutti i giorni provati: **fuori stagione accertato**
    (verificato il 2026-09-03: da giugno a novembre tutte e nove le regioni rispondono
    404). Questo si puo' tenere in cache a lungo.
  */
  const vuoto: Bollettino = { data: null, valutazioni: new Map(), parziale: false };
  bollettino = { valore: vuoto, scadenza: Date.now() + TTL_FUORI_STAGIONE_MS };
  return vuoto;
}

export interface ZonaValanghe {
  id: string;
  nome: string | null;
  pericolo: number;
  am: number | null;
  pm: number | null;
  alta: number | null;
  bassa: number | null;
  geometria: { type: string; coordinates: unknown };
}

export interface RispostaValanghe {
  /**
   * `true` quando il bollettino c'è ma **nessuna** delle sue zone si riesce a disegnare:
   * gli id delle micro-regioni non combaciano più con quelli delle geometrie.
   *
   * Serve a distinguere due cose che a schermo sono identiche — una mappa senza colori —
   * e che significano l'opposto: «in questa zona non ci sono aree valanghive» (vero e
   * normale a Roma) e «il bollettino esiste e non riusciamo a mostrartelo». La seconda è
   * un guasto, e succede per davvero: i servizi valanghe ridisegnano le micro-regioni fra
   * una stagione e l'altra. Senza questa distinzione, un inverno intero di bollettini
   * poteva restare invisibile mentre il pannello diceva che non c'era niente.
   */
  joinBroken: boolean;
  /** Giorno del bollettino usato, `null` = nessun bollettino (fuori stagione). */
  bulletinDate: string | null;
  zones: ZonaValanghe[];
  /** Quante micro-regioni ha il bollettino in tutto: il pannello lo dichiara. */
  totalRated: number;
  /** `true` se qualche regione non ha risposto: il bollettino mostrato e' incompleto. */
  partial: boolean;
}

/**
 * Le zone da disegnare per la vista chiesta.
 *
 * Si disegnano **solo le micro-regioni con una valutazione**. Nei dati veri ce ne sono
 * con geometria e senza rating (7 su 36 in IT-32-BZ il 15/02/2026): disegnarle grigie
 * suggerirebbe "valutata, nessun pericolo", che è la direzione di errore da evitare.
 * Tacere è l'unica cosa vera che si può dire di una zona non valutata.
 */
export async function zoneValanghe(
  vista: BBoxGeo,
  zoom: number,
  adesso = new Date(),
): Promise<RispostaValanghe> {
  const { data, valutazioni, parziale } = await bollettinoCorrente(adesso);
  if (data == null) {
    return { bulletinDate: null, zones: [], totalRated: 0, partial: false, joinBroken: false };
  }

  const tolleranza = tolleranzaPerZoom(zoom);
  const regioniCaricate = regioniPerBbox(vista);
  const [elencoNomi, ...perRegione] = await Promise.all([
    nomiItaliani(),
    ...regioniCaricate.map(async (r) => {
      try {
        return await geometrieRegione(r);
      } catch {
        return [] as FeatureGeo[];
      }
    }),
  ]);

  const zones: ZonaValanghe[] = [];
  const tutteLeFeature = perRegione.flat();
  for (const feature of tutteLeFeature) {
    if (!rettangoliSiToccano(feature.bbox, vista)) continue;
    const v = valutazioni.get(feature.id);
    if (v == null) continue;
    const geometria = semplificaGeometria(feature.geometria, tolleranza);
    if (geometria == null) continue;
    zones.push({
      id: feature.id,
      nome: elencoNomi[feature.id] ?? null,
      pericolo: v.pericolo,
      am: v.am,
      pm: v.pm,
      alta: v.alta,
      bassa: v.bassa,
      geometria,
    });
  }
  /*
    Il join si controlla sulle regioni **caricate per intero**, non sulla vista: guardando
    Roma e' normalissimo che nessuna zona cada nell'inquadratura, e quello non e' un
    guasto. Il guasto e' quando gli id valutati di una regione che abbiamo in mano non
    trovano **nessuna** geometria: allora non e' "niente qui", e' "non riusciamo a
    disegnarlo".
  */
  const idConGeometria = new Set(tutteLeFeature.map((f) => f.id));
  const valutatiQui = Array.from(valutazioni.keys())
    .filter((id) => regioniCaricate.some((r) => id.startsWith(r)));
  const joinBroken = valutatiQui.length > 0 && valutatiQui.every((id) => !idConGeometria.has(id));

  return {
    bulletinDate: data,
    zones,
    totalRated: valutazioni.size,
    partial: parziale,
    joinBroken,
  };
}

/** Per i test: svuota le cache di modulo. */
export function svuotaCacheValanghe(): void {
  geometrie.clear();
  inVolo.clear();
  nomi = null;
  bollettino = null;
}
