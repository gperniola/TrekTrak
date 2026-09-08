import { oraItaliana } from './formato';
import { haversineDistance } from './calculations';
import type { Waypoint, Leg, AppMode } from './types';

/**
 * Incrocia l'itinerario con l'ora: **cosa incontro, e quando**.
 *
 * È la cosa che TrekTrak può dire e un'app meteo no, perché richiede tre ingredienti
 * che stanno solo qui: i waypoint, le loro quote e la stima Munter dei tempi. Il
 * risultato è la frase che serve davvero prima di partire — "al waypoint 5, dove arrivi
 * verso le 14:40, il CAPE è a 1200" — e la decisione che ne segue: partire prima, o
 * rinunciare.
 *
 * Tutto quello che c'è qui è **puro**: la rete sta in `weather-api.ts`.
 */

/**
 * Metadati di un punto **inserito automaticamente** fra due waypoint distanti.
 *
 * Non è un waypoint dell'utente: serve a non lasciare un buco geografico dove il meteo
 * potrebbe essere diverso. `traA`/`traB` sono i waypoint che lo racchiudono, `frazione`
 * la sua posizione nel TEMPO fra i loro due arrivi (per stimare a che ora ci passi).
 */
export interface PuntoIntermedio {
  /** Indice del waypoint che segue (quello che precede è `waypointIndex` del punto). */
  ibIndex: number;
  /**
   * Posizione 0..1 lungo il segmento A→B, misurata in **distanza** (linea d'aria). La si
   * riusa come frazione di **tempo** per stimare l'orario di passaggio: dentro una tratta
   * il passo di Munter è costante, quindi distanza e tempo sono proporzionali. È una
   * stima, e come tale è dichiarata.
   */
  frazione: number;
  /**
   * Distanza cumulata (linea d'aria) dall'inizio: NON si mostra all'utente — i km a
   * schermo sono di traccia, e mescolarli confonde (v0.13.3). Serve solo come chiave
   * stabile e ordinata della riga.
   */
  kmDaInizio: number;
  traA: string;
  traB: string;
}

/** Un punto del percorso su cui si è chiesta la previsione. */
export interface PuntoInterrogato {
  /** Per un waypoint reale: il suo indice. Per un intermedio: l'indice del waypoint A. */
  waypointIndex: number;
  lat: number;
  lon: number;
  name: string;
  /**
   * Quota del punto, quella che l'utente ha scritto (o che l'app ha ricavato in Track).
   *
   * Serve a **chiedere la previsione alla quota giusta**: la maglia del modello sta dove
   * capita, e sulla Maiella la cella di Cima delle Murelle (2596 m) e' a 1257 m. Misurato
   * il 2026-09-02: 26,1 gradi contro 19,5, e raffiche 47 contro 40, per lo stesso punto
   * alla stessa ora. Senza la quota si legge il meteo del fondovalle.
   */
  alt: number | null;
  /** Presente solo sui punti inseriti automaticamente fra due waypoint distanti. */
  intermedio?: PuntoIntermedio;
}

/** Una lettura oraria per un punto. */
export interface PuntoOrario {
  /** Istante in ISO UTC. */
  time: string;
  cape: number;
  weatherCode: number;
  gusts: number;
  precipProb: number;
  /** Temperatura in gradi, alla quota chiesta al modello. */
  temp: number;
}

/**
 * Quel che basta per **giudicare** un'ora: la temperatura non entra nel giudizio.
 *
 * Tenerla fuori non e' pignoleria: `classifyHour` e' la funzione che decide i livelli di
 * rischio, e chiederle un campo che non guarda vorrebbe dire inventarne un valore in ogni
 * punto che la chiama — cioe' esattamente dove nascono i dati finti.
 */
export type OraDaClassificare = Omit<PuntoOrario, 'temp'>;

/** Serie orarie come arrivano da Open-Meteo, un oggetto per punto. */
export interface SerieOraria {
  time: string[];
  cape: number[];
  weather_code: number[];
  wind_gusts_10m: number[];
  precipitation_probability: number[];
  temperature_2m: number[];
}

/**
 * `null` = **non lo so**, che non è "nessun rischio". Distinzione già costata caro in
 * questo progetto: un dato mancante presentato come sereno è la direzione di errore
 * pericolosa.
 */
export type Livello = 0 | 1 | 2 | 3 | null;

export interface Classificazione {
  level: Livello;
  reasons: string[];
}

/** Massimo punti da interrogare: oltre, si ripete lo stesso numero di maglia. */
export const MAX_PUNTI = 12;

// Soglie. CAPE in J/kg: energia disponibile alla convezione, non certezza di temporale.
// È carburante, non fuoco: da solo non fa un temporale, serve un innesco.
const CAPE_ALTO = 800;
/**
 * Sopra questa probabilità di pioggia il modello sta prevedendo un innesco: è la
 * condizione perché il CAPE conti come aggravante («c'è energia E succederà qualcosa»).
 */
const CAPE_INNESCO_PIOGGIA = 30;
/**
 * CAPE così alto da meritare una nota anche SENZA pioggia prevista: in montagna la
 * convezione orografica è sotto-risolta dai modelli a maglia larga, e un temporale di
 * calore può formarsi dove la previsione dà poca pioggia. È un «tienila d'occhio»
 * (giallo), non un «attenzione»: 2000 e non 1500, perché d'estate 1500 in quota è comune
 * e allarmarci sopra sarebbe il difetto di prima con una soglia più alta.
 */
const CAPE_ESTREMO = 2000;
// Raffiche in km/h: in cresta e su terreno esposto contano quanto la pioggia.
const RAFFICA_ATTENZIONE = 30;
const RAFFICA_FORTE = 50;
const RAFFICA_PERICOLOSA = 70;
/** Codici WMO di temporale: la lettura più forte, perché è una dichiarazione. */
const CODICI_TEMPORALE: Record<number, string> = {
  95: 'temporale previsto',
  96: 'temporale con grandine',
  99: 'temporale con grandine forte',
};

/**
 * Distanza (km) oltre la quale, fra due waypoint consecutivi, si inserisce un punto in
 * mezzo per il meteo. Le maglie dei modelli sono 1-11 km: con waypoint a 15 km di
 * distanza il tratto centrale non verrebbe interrogato, e un temporale che si forma lì
 * sfuggirebbe. Scelto dall'utente: ~5 km.
 */
export const SPAZIO_MAX_KM = 5;

/**
 * I punti su cui chiedere la previsione: i waypoint dell'utente, **più** punti inseriti
 * automaticamente dove due waypoint distano più di `spazioMaxKm`.
 *
 * Con solo partenza e arrivo lontani, interrogare i due estremi lascia scoperto tutto il
 * mezzo: qui si spezza il tratto più lungo finché nessun buco supera la soglia, entro il
 * tetto di `max` punti (una sola chiamata, multi-punto). Se i waypoint sono già tanti si
 * fa il contrario — si downsampla — e non c'è spazio per gli intermedi.
 *
 * I punti inseriti portano `intermedio`: la tabella li mostra solo quando sono critici,
 * ma alimentano sempre verdetto e fasce critiche (è lì che sta la sicurezza).
 */
export function samplePoints(
  waypoints: Waypoint[], max = MAX_PUNTI, spazioMaxKm = SPAZIO_MAX_KM,
): PuntoInterrogato[] {
  const validi = waypoints
    .map((wp, i) => ({ wp, i }))
    .filter(({ wp }) => wp.lat != null && wp.lon != null);
  if (validi.length === 0) return [];

  const daWaypoint = (wp: Waypoint, i: number): PuntoInterrogato => ({
    waypointIndex: i, lat: wp.lat as number, lon: wp.lon as number, name: wp.name, alt: wp.altitude,
  });

  // Troppi waypoint per il tetto: si downsampla (estremi sempre), nessuno spazio per gli
  // intermedi.
  if (validi.length >= max) {
    const scelti = validi.length === max
      ? validi
      : Array.from({ length: max }, (_, k) => validi[Math.round((k * (validi.length - 1)) / (max - 1))]);
    const visti = new Set<number>();
    return scelti
      .filter(({ i }) => (visti.has(i) ? false : (visti.add(i), true)))
      .map(({ wp, i }) => daWaypoint(wp, i));
  }

  // Distanze cumulate lungo i waypoint validi, per l'etichetta «≈ km N».
  const cum: number[] = [0];
  for (let j = 1; j < validi.length; j++) {
    const a = validi[j - 1].wp, b = validi[j].wp;
    cum.push(cum[j - 1] + haversineDistance(a.lat as number, a.lon as number, b.lat as number, b.lon as number));
  }

  // Lista di lavoro: i waypoint reali, con l'indice nell'array `validi`.
  interface Pos { lat: number; lon: number; vi: number | null; }
  const pos: Pos[] = validi.map(({ wp }, vi) => ({ lat: wp.lat as number, lon: wp.lon as number, vi }));

  // Spezza sempre il segmento più lungo, finché supera la soglia e c'è budget: così i
  // punti si distribuiscono da soli sui tratti che ne hanno più bisogno.
  while (pos.length < max) {
    let idx = -1;
    let dMax = 0;
    for (let k = 0; k < pos.length - 1; k++) {
      const d = haversineDistance(pos[k].lat, pos[k].lon, pos[k + 1].lat, pos[k + 1].lon);
      if (d > dMax) { dMax = d; idx = k; }
    }
    if (idx < 0 || dMax <= spazioMaxKm) break;
    const a = pos[idx], b = pos[idx + 1];
    // Punto medio geografico: alla scala del tratto la linea d'aria basta per il meteo.
    pos.splice(idx + 1, 0, { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2, vi: null });
  }

  return pos.map((p, k) => {
    if (p.vi != null) return daWaypoint(validi[p.vi].wp, validi[p.vi].i);
    // Intermedio: i waypoint reali che lo racchiudono (i segmenti non scavalcano mai un
    // waypoint, quindi A e B esistono sempre a sinistra e a destra).
    let aK = k; while (aK >= 0 && pos[aK].vi == null) aK--;
    let bK = k; while (bK < pos.length && pos[bK].vi == null) bK++;
    const viA = pos[aK].vi as number;
    const viB = pos[bK].vi as number;
    const A = validi[viA].wp, B = validi[viB].wp;
    const dAB = haversineDistance(A.lat as number, A.lon as number, B.lat as number, B.lon as number);
    const dAP = haversineDistance(A.lat as number, A.lon as number, p.lat, p.lon);
    const frazione = dAB > 0 ? Math.min(1, dAP / dAB) : 0;
    const alt = A.altitude != null && B.altitude != null
      ? Math.round(A.altitude + (B.altitude - A.altitude) * frazione)
      : null;
    return {
      waypointIndex: validi[viA].i,
      lat: p.lat, lon: p.lon,
      name: `tra «${A.name}» e «${B.name}»`,
      alt,
      intermedio: {
        ibIndex: validi[viB].i,
        frazione,
        kmDaInizio: cum[viA] + dAP,
        traA: A.name, traB: B.name,
      },
    };
  });
}

/**
 * Orari di arrivo, o `null` da dove la catena si interrompe.
 *
 * Una tratta senza distanza o dislivelli non ha `estimatedTime`: e' la condizione
 * NORMALE in modalita' Learn, dove i valori li scrive l'utente. Prima quel tempo
 * ignoto valeva zero, quindi tutti i punti risultavano raggiunti **all'ora di
 * partenza**: un principiante leggeva di arrivare in vetta alle 7 del mattino.
 *
 * Un orario che non si conosce va detto, non stimato a zero.
 */
/** La pausa in un punto, in minuti: 0 se non impostata o non valida. */
export function pausaDi(wp: Waypoint | undefined): number {
  const m = wp?.pausaMin;
  return Number.isFinite(m) && (m as number) > 0 ? (m as number) : 0;
}

/**
 * Gli orari di **arrivo** a ogni waypoint.
 *
 * Le pause slittano in avanti gli arrivi dei punti **successivi**: si arriva al punto
 * (arrivo invariato), ci si ferma `pausaMin`, e da lì in poi tutto scorre più tardi. La
 * pausa dell'ultimo punto non ha nessun arrivo dopo di sé, quindi non sposta niente qui
 * (ma conta nel tempo totale — vedi `computeRouteMetrics`).
 */
export function arrivalTimes(waypoints: Waypoint[], legs: Leg[], departure: Date): (Date | null)[] {
  const out: (Date | null)[] = [];
  let minuti = 0;
  let catenaRotta = false;
  for (let i = 0; i < waypoints.length; i++) {
    if (i > 0) {
      const t = legs[i - 1]?.estimatedTime;
      if (!Number.isFinite(t)) catenaRotta = true;
      else minuti += t as number;
    }
    out.push(catenaRotta ? null : new Date(departure.getTime() + minuti * 60000));
    // La sosta a questo punto ritarda gli arrivi ai punti dopo, non l'arrivo a questo.
    if (!catenaRotta) minuti += pausaDi(waypoints[i]);
  }
  return out;
}

/**
 * **Il rischio di un'ora segue la PREVISIONE, e il CAPE è solo il contesto.**
 *
 * La versione precedente lasciava che il CAPE alzasse il livello da solo: CAPE ≥ 300 →
 * «attenzione», anche col cielo coperto e zero pioggia prevista. D'estate il CAPE
 * pomeridiano in quota è ~500-1000 quasi ogni giorno, quindi l'app gridava «attenzione»
 * su pomeriggi che il modello dava nuvolosi e stabili — misurato sull'Abruzzo il
 * 2026-09-06: cielo coperto, pioggia 0-3%, CAPE 970-1160, e il verdetto era arancione.
 *
 * Il CAPE è l'energia DISPONIBILE alla convezione: il carburante, non il fuoco. Senza un
 * innesco (aria che sale, un fronte, orografia) resta energia inutilizzata. Il modello lo
 * sa e lo dice, col codice meteo e con la probabilità di pioggia: quelli sono il giudice
 * del «ci sarà o no». Quindi:
 *
 * 1. **codice di temporale** (95/96/99): è una dichiarazione del modello → livello 3;
 * 2. **probabilità di pioggia**: è già il verdetto sull'innesco → livello 1-2;
 * 3. **CAPE**: aggravante quando c'è già un innesco previsto (pioggia probabile + CAPE
 *    alto = temporale potenzialmente forte); da solo, solo se ESTREMO, come «tienila
 *    d'occhio» per la convezione orografica che i modelli a maglia larga sotto-stimano;
 * 4. **raffiche**: il vento previsto è un fatto, non un potenziale → restano com'erano.
 */
export function classifyHour(o: OraDaClassificare): Classificazione {
  const reasons: string[] = [];
  let level: Livello = 0;
  const alza = (l: Exclude<Livello, null>) => { if (level != null && l > level) level = l; };

  const codiceNoto = Number.isFinite(o.weatherCode);
  const pioggiaNota = Number.isFinite(o.precipProb);
  const capeNoto = Number.isFinite(o.cape);
  const raffNota = Number.isFinite(o.gusts);
  const qualcosaDiNoto = codiceNoto || pioggiaNota || capeNoto || raffNota;

  // 1. Temporale esplicito: il modello lo dichiara. La lettura più forte.
  if (codiceNoto && CODICI_TEMPORALE[o.weatherCode]) {
    reasons.push(CODICI_TEMPORALE[o.weatherCode]);
    alza(3);
  }

  // 2. Pioggia dal modello: la probabilità è già il «ci sarà o no».
  if (pioggiaNota) {
    if (o.precipProb >= 70) { reasons.push(`${Math.round(o.precipProb)}% di probabilità di pioggia`); alza(2); }
    else if (o.precipProb >= 40) { reasons.push(`${Math.round(o.precipProb)}% di probabilità di pioggia`); alza(1); }
  }

  // 3. CAPE: energia, non evento.
  if (capeNoto) {
    const c = o.cape;
    const innescoPrevisto = pioggiaNota && o.precipProb >= CAPE_INNESCO_PIOGGIA;
    if (innescoPrevisto && c >= CAPE_ALTO) {
      reasons.push(`CAPE ${Math.round(c)} J/kg con pioggia prevista: possibili temporali forti`);
      alza(3);
    } else if (!innescoPrevisto && c >= CAPE_ESTREMO) {
      reasons.push(`forte instabilità (CAPE ${Math.round(c)} J/kg): in montagna un temporale di calore può formarsi anche con poca pioggia prevista`);
      alza(1);
    }
    // CAPE alto ma senza innesco previsto: non si nomina. Gridare «attenzione» col cielo
    // stabile e zero pioggia era il difetto — è carburante che resta nel serbatoio.
  }

  // 4. Raffiche: il vento previsto è un fatto.
  if (raffNota) {
    const g = o.gusts;
    if (g >= RAFFICA_PERICOLOSA) { reasons.push(`raffiche ${Math.round(g)} km/h: pericolose in cresta`); alza(3); }
    else if (g >= RAFFICA_FORTE) { reasons.push(`raffiche ${Math.round(g)} km/h: forti`); alza(2); }
    else if (g >= RAFFICA_ATTENZIONE) { reasons.push(`raffiche ${Math.round(g)} km/h`); alza(1); }
  }

  // Nessuna lettura disponibile: si dichiara ignoto invece di "sereno".
  if (!qualcosaDiNoto) return { level: null, reasons: ['dati non disponibili'] };
  return { level, reasons };
}

/**
 * Ora di partenza suggerita.
 *
 * Prima delle 10 si assume che si stia pianificando **oggi** (chi guarda il meteo
 * all'alba sta per uscire), dopo si passa a domani alle 7. Non propone mai un'ora già
 * passata, che sarebbe un orario di arrivo nel passato.
 */
export function defaultDeparture(now: Date, oraTipica = 7): Date {
  // Tutto in ora italiana: e' quella che il pannello mostra e quella in cui si cammina.
  const ora = oraItalianaDi(now);
  const oggi = giornoItaliano(now);
  if (ora < 10) {
    const prossima = istanteItaliano(oggi, Math.max(ora + 1, 6));
    return prossima.getTime() >= now.getTime() ? prossima : new Date(now.getTime() + 3600000);
  }
  const domani = giornoItaliano(new Date(now.getTime() + 24 * 3600000));
  return istanteItaliano(domani, oraTipica);
}

export interface RigaPercorso {
  waypointIndex: number;
  name: string;
  /** Quota del punto secondo l'itinerario, se c'e'. */
  alt: number | null;
  /**
   * Quota a cui il modello ha risposto per questo punto, come la dichiara lui stesso.
   *
   * Non e' un dettaglio da nascondere: se non coincide con quella del punto, temperatura
   * e raffiche sono di un altro posto — piu' in basso, quindi piu' calde e piu' miti di
   * quel che si trovera'.
   */
  modelElevation: number | null;
  /** Orario stimato di arrivo (ISO UTC), o `null` se i tempi non sono stimabili. */
  arrival: string | null;
  /** Lettura dell'ora più vicina all'arrivo, se disponibile. */
  hour: PuntoOrario | null;
  classification: Classificazione;
  /**
   * Minuti di sosta a questo punto, se > 0. Solo per l'etichetta in tabella.
   */
  pausaMin?: number;
  /**
   * Con una sosta **lunga** (≥ `SOGLIA_PAUSA_METEO`), il punto genera DUE righe — il
   * meteo all'arrivo e alla ripartenza possono differire — e questo campo dice quale
   * delle due è. Con sosta breve o assente, il campo manca (una sola riga).
   */
  fase?: 'arrivo' | 'ripartenza';
  /**
   * Presente se questa riga è un punto **inserito automaticamente** fra due waypoint
   * distanti (non un waypoint dell'utente). La tabella lo mostra solo quando è critico
   * (`righeVisibili`), ma alimenta sempre verdetto e fasce.
   */
  intermedio?: PuntoIntermedio;
}

/**
 * Sopra questa sosta (minuti) il meteo all'arrivo e alla ripartenza vanno mostrati
 * **entrambi**: le previsioni hanno passo orario, quindi sotto l'ora la lettura sarebbe
 * la stessa e la seconda riga sarebbe un doppione. Scelta dell'utente: «se la pausa dura
 * 1 ora o più, mostra arrivo e partenza».
 */
export const SOGLIA_PAUSA_METEO = 60;

/**
 * Da questo livello in su un punto **intermedio** (inserito fra due waypoint distanti)
 * compare in tabella. Sotto, resta nascosto: alimenta comunque verdetto e fasce, ma non
 * intasa la tabella quando il meteo lì è tranquillo. Scelta dell'utente: «solo se
 * problematico» = da «Attenzione» in su.
 */
export const SOGLIA_MOSTRA_INTERMEDIO = 2;

/**
 * Le righe da MOSTRARE in tabella: i waypoint reali sempre, gli intermedi solo se la
 * loro criticità raggiunge `SOGLIA_MOSTRA_INTERMEDIO`. Le righe nascoste restano nel
 * rapporto (verdetto e fasce le hanno già viste): è solo un filtro di presentazione.
 */
export function righeVisibili(rows: RigaPercorso[]): RigaPercorso[] {
  return rows.filter(
    (r) => r.intermedio == null || (r.classification.level ?? 0) >= SOGLIA_MOSTRA_INTERMEDIO,
  );
}

/**
 * Una fascia critica **contigua**, come istanti.
 *
 * Due errori corretti qui, entrambi visti solo sui dati veri:
 *
 * 1. prima erano due numeri presi con `getUTCHours()` e stampati cosi' come erano: in
 *    Italia significava mostrare "10-21" per una fascia che l'utente legge 12-23. Due
 *    ore di errore su un'informazione di sicurezza, invisibile ai test perche' li
 *    dentro tutto era coerentemente UTC;
 * 2. prima era **una sola** fascia, dal minimo al massimo. Su una giornata instabile
 *    reale (Abruzzo, 28/08: CAPE sopra 800 quasi tutto il giorno) diventava
 *    "00:00-00:00" — aritmeticamente giusto e completamente inutile. Ora le fasce sono
 *    quelle vere, contigue, e possono essere piu' di una.
 */
export interface FinestraCritica {
  fromISO: string;
  toISO: string;
}

export interface Verdetto {
  level: Livello;
  message: string;
}

export interface RouteWeatherReport {
  rows: RigaPercorso[];
  /** Tutte le fasce critiche del giorno, in ordine: possono essere piu' di una. */
  windows: FinestraCritica[];
  /** La prima fascia che si sovrappone al tempo di cammino, se c'e'. */
  hitWindow: FinestraCritica | null;
  verdict: Verdetto;
  /** Quanti punti sono stati davvero interrogati: il pannello lo dichiara. */
  sampled: number;
}

function letturaVicina(serie: SerieOraria, quando: Date): PuntoOrario | null {
  if (!Array.isArray(serie?.time) || serie.time.length === 0) return null;
  let migliore = -1;
  let distanza = Infinity;
  for (let i = 0; i < serie.time.length; i++) {
    // Open-Meteo con timezone=UTC restituisce "2026-08-28T14:00" senza suffisso.
    const t = new Date(`${serie.time[i]}Z`).getTime();
    if (Number.isNaN(t)) continue;
    const d = Math.abs(t - quando.getTime());
    if (d < distanza) { distanza = d; migliore = i; }
  }
  if (migliore < 0) return null;
  // Oltre le 3 ore di distanza non è più "l'ora dell'arrivo": meglio dire niente.
  if (distanza > 3 * 3600000) return null;
  return {
    time: new Date(`${serie.time[migliore]}Z`).toISOString(),
    cape: serie.cape?.[migliore] ?? Number.NaN,
    weatherCode: serie.weather_code?.[migliore] ?? Number.NaN,
    gusts: serie.wind_gusts_10m?.[migliore] ?? Number.NaN,
    precipProb: serie.precipitation_probability?.[migliore] ?? Number.NaN,
    temp: serie.temperature_2m?.[migliore] ?? Number.NaN,
  };
}

/**
 * Fasce critiche nell'intervallo che interessa, contigue e in ordine.
 *
 * L'intervallo va dall'inizio del giorno (italiano) della partenza alla fine del giorno
 * dell'arrivo: cosi' un cammino che attraversa la mezzanotte vede anche le ore critiche
 * del giorno dopo, e resta il contesto per dire "la fascia cade quando sei rientrato".
 *
 * Prima il filtro era il solo giorno della partenza, e una salita notturna con
 * temporale alle 3 veniva dichiarata tranquilla: partire di notte non e' un caso di
 * scuola, e' la partenza classica per una vetta.
 */
function fasceCritiche(serie: SerieOraria[], da: Date, a: Date): FinestraCritica[] {
  const istanti = new Set<number>();
  for (const s of serie) {
    if (!Array.isArray(s?.time)) continue;
    for (let i = 0; i < s.time.length; i++) {
      const t = new Date(`${s.time[i]}Z`);
      if (Number.isNaN(t.getTime())) continue;
      if (t.getTime() < da.getTime() || t.getTime() > a.getTime()) continue;
      const c = classifyHour({
        time: s.time[i],
        cape: s.cape?.[i] ?? Number.NaN,
        weatherCode: s.weather_code?.[i] ?? Number.NaN,
        gusts: s.wind_gusts_10m?.[i] ?? Number.NaN,
        precipProb: s.precipitation_probability?.[i] ?? Number.NaN,
      });
      if (c.level != null && c.level >= 2) istanti.add(t.getTime());
    }
  }
  const ordinati = Array.from(istanti).sort((a, b) => a - b);
  const ORA = 3600000;
  const fasce: FinestraCritica[] = [];
  for (const t of ordinati) {
    const ultima = fasce[fasce.length - 1];
    // Contigua se comincia dove finisce la precedente: un salto di ore significa
    // un'altra fascia, e dirlo e' l'unico modo di essere utili in una giornata a
    // tratti instabile.
    if (ultima != null && new Date(ultima.toISO).getTime() === t) {
      ultima.toISO = new Date(t + ORA).toISOString();
    } else {
      fasce.push({ fromISO: new Date(t).toISOString(), toISO: new Date(t + ORA).toISOString() });
    }
  }
  return fasce;
}

/** Giorno civile in Italia: e' il fuso in cui l'utente sceglie la partenza. */
export function giornoItaliano(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
}

/**
 * L'ora italiana di un istante, come numero da 0 a 23.
 *
 * Serve perche' il pannello mostra OGNI orario in ora italiana: se il menu della
 * partenza leggesse `getHours()` userebbe il fuso del dispositivo, e su una macchina
 * fuori dall'Italia si sceglierebbe "le 5" per poi vedere la tabella partire dalle
 * 07:00. Le due meta' del pannello devono parlare dello stesso fuso.
 */
export function oraItalianaDi(d: Date): number {
  const h = Number(d.toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }));
  return Number.isFinite(h) ? h % 24 : 0;
}

/**
 * L'istante che in Italia e' `giorno` alle `ora` in punto.
 *
 * Stessa tecnica di `inizioGiornoItaliano`: si parte da mezzogiorno UTC, che non e'
 * mai ambiguo nemmeno nei giorni del cambio d'ora, si misura quanto vale a Roma e si
 * scende all'inizio del giorno locale.
 */
export function istanteItaliano(giorno: string, ora: number): Date {
  const [y, m, g] = giorno.split('-').map(Number);
  const mezzogiorno = Date.UTC(y, m - 1, g, 12, 0, 0);
  const oreLocali = Number(
    new Date(mezzogiorno).toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false })
  );
  return new Date(mezzogiorno - oreLocali * 3600000 + ora * 3600000);
}

/**
 * Mezzanotte italiana del giorno di `d`, come istante.
 *
 * Si ricava per differenza invece di costruire una data con l'offset a mano: l'offset
 * italiano cambia due volte l'anno, e scriverlo fisso significa sbagliare per meta'
 * dell'anno.
 */
function inizioGiornoItaliano(d: Date): Date {
  const [y, m, g] = giornoItaliano(d).split('-').map(Number);
  // si parte da mezzogiorno UTC (mai ambiguo) e si scende all'inizio del giorno locale
  const mezzogiorno = Date.UTC(y, m - 1, g, 12, 0, 0);
  const oreLocali = Number(new Date(mezzogiorno).toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }));
  return new Date(mezzogiorno - oreLocali * 3600000);
}

function fineGiornoItaliano(d: Date): Date {
  return new Date(inizioGiornoItaliano(d).getTime() + 24 * 3600000 - 1);
}

/**
 * Orari sempre in ora italiana: e' il fuso della montagna e di chi legge.
 *
 * L'implementazione vive in `formato.ts`, con gli altri modi di scrivere le cose;
 * resta esportata da qui perche' e' da qui che la importano il pannello e i test.
 */
export { oraItaliana };

/**
 * La fine di una finestra e' ESCLUSIVA: una fascia che comprende l'ultima ora della
 * giornata finisce a mezzanotte, e scritta "00:00" si legge come un intervallo al
 * contrario ("15:00-00:00"). A fine giornata si scrive 24:00, come gli orari di
 * chiusura.
 */
function oraFineItaliana(iso: string): string {
  const scritto = oraItaliana(iso);
  return scritto === '00:00' ? '24:00' : scritto;
}

/**
 * Una fascia critica scritta per intero. Esportata perche' la stessa riga la stampa
 * ANCHE il pannello: quando la correzione del "24:00" era solo qui dentro, a schermo
 * si continuava a leggere "15:00-00:00" — il difetto era corretto in un posto solo.
 */
export function formattaFascia(f: FinestraCritica): string {
  return `${oraItaliana(f.fromISO)}-${oraFineItaliana(f.toISO)}`;
}

export function buildRouteWeather(input: {
  waypoints: Waypoint[];
  legs: Leg[];
  departure: Date;
  punti: PuntoInterrogato[];
  serie: SerieOraria[];
  /** Quote a cui il modello ha risposto, una per punto, nello stesso ordine. */
  elevations?: number[];
  /**
   * Serve solo a scrivere il consiglio giusto quando i tempi mancano: in «Impara» si
   * inseriscono a mano o si passa a Pianificazione; in «Pianificazione» li calcola l'app
   * (serve la rete), e dire «passa a Pianificazione» a chi ci è già è un consiglio falso.
   */
  appMode?: AppMode;
}): RouteWeatherReport {
  const { waypoints, legs, departure, punti, serie } = input;
  if (punti.length === 0 || serie.length === 0) {
    return {
      rows: [], windows: [], hitWindow: null, sampled: 0,
      verdict: { level: null, message: 'Previsione non disponibile per questo percorso.' },
    };
  }

  const arrivi = arrivalTimes(waypoints, legs, departure);
  const rows: RigaPercorso[] = punti.flatMap((p, k) => {
    /*
     * Orario del punto. Per un waypoint è il suo arrivo; per un intermedio si interpola
     * fra l'arrivo ad A e quello a B, partendo da DOPO la sosta ad A (il punto è già in
     * cammino). Se un estremo non ha orario, l'intermedio nemmeno.
     */
    let arrivo: Date | null;
    if (p.intermedio != null) {
      const tA = arrivi[p.waypointIndex] ?? null;
      const tB = arrivi[p.intermedio.ibIndex] ?? null;
      if (tA == null || tB == null) {
        arrivo = null;
      } else {
        const partenzaDaA = tA.getTime() + pausaDi(waypoints[p.waypointIndex]) * 60000;
        arrivo = new Date(partenzaDaA + p.intermedio.frazione * (tB.getTime() - partenzaDaA));
      }
    } else {
      arrivo = arrivi[p.waypointIndex] ?? null;
    }
    /*
     * Una serie per punto, nello stesso ordine. Se per quel punto la serie non c'e' —
     * risposta piu' corta di quanto chiesto — la riga dichiara "non disponibile".
     *
     * Prima c'era un ripiego silenzioso sulla prima serie: il dato di un posto veniva
     * presentato come se fosse di un altro, che e' la classe di difetto piu' pericolosa
     * di questo progetto. Su tre punti e una serie sola tutte le righe mostravano lo
     * stesso CAPE come se fosse stato calcolato per ognuno.
     */
    const mia = serie[k];
    const quotaModello = input.elevations?.[k];
    const modelElevation = Number.isFinite(quotaModello) ? (quotaModello as number) : null;
    // Gli intermedi non sono waypoint: non hanno soste (la sosta di A è già nell'orario).
    const pausa = p.intermedio != null ? 0 : pausaDi(waypoints[p.waypointIndex]);

    /** Costruisce una riga per un dato istante (arrivo o ripartenza). */
    const riga = (istante: Date | null, extra: Partial<RigaPercorso>): RigaPercorso => {
      // Senza orario non si puo' dire "il meteo quando ci arrivi": si dichiara il motivo.
      const hour = istante != null && mia != null ? letturaVicina(mia, istante) : null;
      const motivo = istante == null ? 'orario di arrivo non stimabile' : 'dati non disponibili';
      return {
        waypointIndex: p.waypointIndex, name: p.name, alt: p.alt, modelElevation,
        arrival: istante?.toISOString() ?? null,
        hour,
        classification: hour ? classifyHour(hour) : { level: null, reasons: [motivo] },
        ...(p.intermedio != null ? { intermedio: p.intermedio } : {}),
        ...extra,
      };
    };

    /*
     * Sosta lunga: il meteo all'arrivo e alla ripartenza possono essere diversi, quindi
     * due righe. La ripartenza è l'arrivo più la durata della sosta. Con arrivo ignoto
     * non si sdoppia niente: non c'è un istante da spostare.
     */
    if (pausa >= SOGLIA_PAUSA_METEO && arrivo != null) {
      const ripartenza = new Date(arrivo.getTime() + pausa * 60000);
      return [
        riga(arrivo, { pausaMin: pausa, fase: 'arrivo' }),
        riga(ripartenza, { pausaMin: pausa, fase: 'ripartenza' }),
      ];
    }
    // Sosta breve o assente: una riga sola (la sosta breve resta come etichetta).
    return [riga(arrivo, pausa > 0 ? { pausaMin: pausa } : {})];
  });

  // Estremi dell'intervallo da esaminare: dall'inizio del giorno della partenza alla
  // fine del giorno in cui si arriva (ora italiana in entrambi i casi).
  // Se la catena dei tempi si interrompe, l'ultimo arrivo noto e' l'ultimo non nullo:
  // le fasce si guardano comunque sulla giornata, perche' sono informazione vera.
  const arriviNoti = arrivi.filter((a): a is Date => a != null);
  const arrivoUltimo = arriviNoti[arriviNoti.length - 1] ?? departure;
  const tempiCompleti = arrivi.length > 0 && arrivi.every((a) => a != null);
  const windows = fasceCritiche(serie, inizioGiornoItaliano(departure), fineGiornoItaliano(arrivoUltimo));

  /*
   * Il verdetto guarda il tempo in cui si CAMMINA, non gli istanti dei punti
   * interrogati.
   *
   * La differenza conta per via del campionamento: su un percorso lungo si
   * interrogano 12 punti, e valutare solo quei 12 istanti significherebbe non vedere
   * un temporale che arriva mentre si e' fra un punto campionato e il successivo. Il
   * criterio giusto e' l'intersezione fra la finestra critica e l'intervallo
   * partenza-arrivo: "il temporale mi prende se sono ancora fuori quando arriva".
   *
   * E vale anche il contrario, che e' la parte utile: un temporale alle 18 non conta
   * se alle 15 sei al parcheggio.
   */
  const arrivoFinale = arrivoUltimo;
  // Intersezione fra intervalli di ISTANTI: niente aritmetica sulle ore, quindi niente
  // casi limite a mezzanotte e nessun fuso da indovinare.
  // L'incrocio ha senso solo se si sa quando si cammina: senza i tempi non si puo'
  // affermare che una fascia "ti prende".
  const hitWindow = tempiCompleti
    ? windows.find((f) =>
      new Date(f.toISO).getTime() > departure.getTime()
      && new Date(f.fromISO).getTime() < arrivoFinale.getTime()) ?? null
    : null;
  const finestraIncrociata = hitWindow != null;

  const livelli = rows.map((r) => r.classification.level).filter((l): l is Exclude<Livello, null> => l != null);
  const peggioPunti = livelli.length > 0 ? Math.max(...livelli) as Exclude<Livello, null> : null;
  const peggio: Livello = peggioPunti == null
    ? (finestraIncrociata ? 2 : null)
    : (finestraIncrociata ? Math.max(peggioPunti, 2) as Exclude<Livello, null> : peggioPunti);

  const orario = oraItaliana;
  const orarioFine = oraFineItaliana;
  const fascia = formattaFascia;
  const elencoFasce = windows.map(fascia).join(', ');

  /** Il punto in cui ti trovi quando la finestra si apre: e' quello che serve sapere. */
  /** Dove ti trovi quando la fascia si apre: e' quello che serve sapere. */
  const doveAllInizioFinestra = () => {
    if (hitWindow == null) return null;
    const inizio = new Date(hitWindow.fromISO).getTime();
    // Le righe senza orario non hanno posto in questa graduatoria.
    const passati = rows.filter((r) => r.arrival != null && new Date(r.arrival).getTime() <= inizio);
    return passati.length > 0 ? passati[passati.length - 1] : rows[0] ?? null;
  };



  let message: string;
  if (!tempiCompleti) {
    /*
     * Caso normale in modalita' Learn: le tratte non hanno ancora distanze e dislivelli,
     * quindi non esiste un orario di arrivo da incrociare. Prima il codice dava un
     * verdetto come se tutti i punti si raggiungessero all'ora di partenza.
     *
     * Le fasce critiche restano informazione vera e si dicono: quello che manca e'
     * l'incrocio, non la previsione.
     */
    /*
     * Il consiglio dipende dalla modalità: in Pianificazione i tempi li calcola l'app
     * (serve la rete), quindi «passa a Pianificazione» a chi ci è già sarebbe falso.
     */
    const comeAvereITempi = input.appMode === 'track'
      ? 'i tempi delle tratte non sono ancora stati calcolati (serve la connessione)'
      : 'servono i tempi: inserisci distanza e dislivelli, oppure passa a Pianificazione';
    message = windows.length > 0
      ? `Ore instabili nella giornata: ${windows.map(fascia).join(', ')}. Per sapere se ti prendono, ${comeAvereITempi}.`
      : 'Nessuna criticità nella giornata. Gli orari di arrivo non sono stimabili finché mancano '
        + 'distanza e dislivelli delle tratte.';
    return {
      rows, windows, hitWindow: null, sampled: punti.length,
      verdict: { level: null, message },
    };
  }
  if (peggio == null) message = 'Previsione non disponibile per questo percorso.';
  else if (peggio === 0) message = windows.length > 0
    ? `Sul percorso non incontri criticità: le ore instabili (${elencoFasce}) cadono quando sei già rientrato.`
    : 'Nessuna criticità prevista sul percorso agli orari stimati.';
  else if (peggio === 1) message = 'Qualche segnale da tenere d’occhio agli orari stimati: guarda i dettagli per tratta.';
  else {
    const critici = rows.filter((r) => (r.classification.level ?? 0) >= 2);
    // Si nomina la fascia che ti PRENDE, non l'elenco di tutte: e' quella su cui si
    // decide se partire prima o rinunciare.
    const coda = hitWindow != null ? ' Partire prima cambia la giornata.' : '';

    if (critici.length > 0) {
      // C'e' un punto del percorso in cui la previsione, all'ora in cui ci arrivi, e'
      // critica: e' la frase piu' precisa che si possa dire.
      const dove = critici[0];
      // Qui `arrival` non e' nullo: una riga critica ha una lettura, e una lettura
      // esiste solo se l'orario di arrivo si conosce.
      const quando = dove.arrival != null ? `verso le ${orario(dove.arrival)} ` : '';
      // Un punto in mezzo non ha un nome proprio: si dice «nel tratto tra A e B», non
      // «sei a «tra «A» e «B»»» — le virgolette annidate del nome dell'intermedio.
      const luogo = dove.intermedio != null
        ? `nel tratto tra «${dove.intermedio.traA}» e «${dove.intermedio.traB}»`
        : `a «${dove.name}»`;
      message = `Attenzione: ${quando}sei ${luogo} e la previsione è critica.${coda}`;
    } else if (hitWindow != null) {
      /*
       * Nessun punto interrogato e' critico all'ora del suo arrivo, ma una fascia
       * critica cade mentre si cammina: e' il caso del campionamento, in cui la
       * criticita' arriva fra un punto e il successivo.
       *
       * L'ora da nominare e' l'inizio della FASCIA, non l'arrivo al punto. Prima
       * diceva "verso le 11:00 sei a «X» e la previsione e' critica" mentre a quell'ora
       * e in quel punto era tranquilla e la fascia cominciava alle 12: una frase falsa
       * su un dato di sicurezza, che nessun test poteva vedere perche' guardava i
       * livelli, non la verita' della frase.
       */
      const dove = doveAllInizioFinestra();
      const nomeLuogo = dove == null
        ? ''
        : dove.intermedio != null
          ? `il tratto tra «${dove.intermedio.traA}» e «${dove.intermedio.traB}»`
          : `«${dove.name}»`;
      const dettaglio = dove != null ? `, e a quell’ora hai passato ${nomeLuogo}` : '';
      // Inizio E fine: senza la fine non si puo' decidere se aspettare o rinunciare.
      message = `Attenzione: dalle ${orario(hitWindow.fromISO)} alle ${orarioFine(hitWindow.toISO)}`
        + ` la previsione diventa critica${dettaglio}, mentre sei ancora in cammino.${coda}`;
    } else {
      message = `Attenzione: la previsione è critica nelle ore in cui sei in cammino.${coda}`;
    }
  }

  return { rows, windows, hitWindow, verdict: { level: peggio, message }, sampled: punti.length };
}

/**
 * Di quanto la quota del modello si scosta da quella del punto, in metri (segno incluso:
 * negativo = il modello sta piu' in basso). `null` quando manca una delle due — e allora
 * la cosa da dire e' "non lo so", non "coincidono".
 */
export function scartoQuota(r: RigaPercorso): number | null {
  if (r.alt == null || r.modelElevation == null) return null;
  if (!Number.isFinite(r.alt) || !Number.isFinite(r.modelElevation)) return null;
  return Math.round(r.modelElevation - r.alt);
}

/**
 * Oltre questo scarto conviene dirlo.
 *
 * Centocinquanta metri di quota valgono circa un grado: sotto, il margine e' minore
 * dell'incertezza del modello stesso e avvisare sarebbe rumore.
 */
export const SCARTO_QUOTA_RILEVANTE = 150;

/** Lo scarto piu' grosso fra le righe, quello che vale la pena dichiarare. */
export function scartoQuotaMassimo(rows: RigaPercorso[]): number | null {
  let peggiore: number | null = null;
  for (const r of rows) {
    // Un punto in mezzo non ha una quota da correggere: l'avviso invita a «scrivere la
    // quota nell'Editor», ma per un punto inserito dall'app non c'è un campo. La sua
    // quota è già interpolata dai waypoint, che restano loro il posto dove agire.
    if (r.intermedio != null) continue;
    const s = scartoQuota(r);
    if (s == null) continue;
    if (peggiore == null || Math.abs(s) > Math.abs(peggiore)) peggiore = s;
  }
  return peggiore;
}
