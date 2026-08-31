import { oraItaliana } from './formato';
import type { Waypoint, Leg } from './types';

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

/** Un punto del percorso su cui si è chiesta la previsione. */
export interface PuntoInterrogato {
  waypointIndex: number;
  lat: number;
  lon: number;
  name: string;
}

/** Una lettura oraria per un punto. */
export interface PuntoOrario {
  /** Istante in ISO UTC. */
  time: string;
  cape: number;
  weatherCode: number;
  gusts: number;
  precipProb: number;
}

/** Serie orarie come arrivano da Open-Meteo, un oggetto per punto. */
export interface SerieOraria {
  time: string[];
  cape: number[];
  weather_code: number[];
  wind_gusts_10m: number[];
  precipitation_probability: number[];
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
const CAPE_MODERATO = 300;
const CAPE_ALTO = 800;
const CAPE_MOLTO_ALTO = 1500;
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

export function samplePoints(waypoints: Waypoint[], max = MAX_PUNTI): PuntoInterrogato[] {
  const validi = waypoints
    .map((wp, i) => ({ wp, i }))
    .filter(({ wp }) => wp.lat != null && wp.lon != null);
  if (validi.length === 0) return [];

  const scelti = validi.length <= max
    ? validi
    // Primo e ultimo sempre, il resto a passo costante: un percorso lungo deve essere
    // rappresentato agli estremi, dove cambia la quota.
    : Array.from({ length: max }, (_, k) => validi[Math.round((k * (validi.length - 1)) / (max - 1))]);

  const visti = new Set<number>();
  return scelti
    .filter(({ i }) => (visti.has(i) ? false : (visti.add(i), true)))
    .map(({ wp, i }) => ({ waypointIndex: i, lat: wp.lat as number, lon: wp.lon as number, name: wp.name }));
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
  }
  return out;
}

export function classifyHour(o: PuntoOrario): Classificazione {
  const reasons: string[] = [];
  let level: Livello = 0;
  let qualcosaDiNoto = false;

  const alza = (l: Exclude<Livello, null>) => { if (level != null && l > level) level = l; };

  if (Number.isFinite(o.weatherCode)) {
    qualcosaDiNoto = true;
    const etichetta = CODICI_TEMPORALE[o.weatherCode];
    if (etichetta) { reasons.push(etichetta); alza(3); }
  }

  if (Number.isFinite(o.cape)) {
    qualcosaDiNoto = true;
    const c = o.cape;
    if (c >= CAPE_MOLTO_ALTO) { reasons.push(`CAPE ${Math.round(c)} J/kg: instabilità molto alta`); alza(3); }
    else if (c >= CAPE_ALTO) { reasons.push(`CAPE ${Math.round(c)} J/kg: instabilità alta`); alza(2); }
    else if (c >= CAPE_MODERATO) { reasons.push(`CAPE ${Math.round(c)} J/kg: instabilità moderata`); alza(1); }
  }

  if (Number.isFinite(o.gusts)) {
    qualcosaDiNoto = true;
    const g = o.gusts;
    if (g >= RAFFICA_PERICOLOSA) { reasons.push(`raffiche ${Math.round(g)} km/h: pericolose in cresta`); alza(3); }
    else if (g >= RAFFICA_FORTE) { reasons.push(`raffiche ${Math.round(g)} km/h: forti`); alza(2); }
    else if (g >= RAFFICA_ATTENZIONE) { reasons.push(`raffiche ${Math.round(g)} km/h`); alza(1); }
  }

  if (Number.isFinite(o.precipProb) && o.precipProb >= 60) {
    reasons.push(`${Math.round(o.precipProb)}% di probabilità di precipitazione`);
    alza(1);
  }

  // Nessuna delle tre letture disponibile: si dichiara ignoto invece di "sereno".
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
  /** Orario stimato di arrivo (ISO UTC), o `null` se i tempi non sono stimabili. */
  arrival: string | null;
  /** Lettura dell'ora più vicina all'arrivo, se disponibile. */
  hour: PuntoOrario | null;
  classification: Classificazione;
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
export function oraFineItaliana(iso: string): string {
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
}): RouteWeatherReport {
  const { waypoints, legs, departure, punti, serie } = input;
  if (punti.length === 0 || serie.length === 0) {
    return {
      rows: [], windows: [], hitWindow: null, sampled: 0,
      verdict: { level: null, message: 'Previsione non disponibile per questo percorso.' },
    };
  }

  const arrivi = arrivalTimes(waypoints, legs, departure);
  const rows: RigaPercorso[] = punti.map((p, k) => {
    const arrivo = arrivi[p.waypointIndex] ?? null;
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
    // Senza orario di arrivo non si puo' dire "il meteo quando ci arrivi": si dichiara
    // il motivo, invece di leggere un'ora a caso.
    const hour = arrivo != null && mia != null ? letturaVicina(mia, arrivo) : null;
    const motivo = arrivo == null ? 'orario di arrivo non stimabile' : 'dati non disponibili';
    return {
      waypointIndex: p.waypointIndex,
      name: p.name,
      arrival: arrivo?.toISOString() ?? null,
      hour,
      classification: hour ? classifyHour(hour) : { level: null, reasons: [motivo] },
    };
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
    message = windows.length > 0
      ? `Ore instabili nella giornata: ${windows.map(fascia).join(', ')}. Per sapere se ti prendono `
        + 'servono i tempi di percorrenza: inserisci distanza e dislivelli, oppure passa a Track.'
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
      message = `Attenzione: ${quando}sei a «${dove.name}» e la previsione è critica.${coda}`;
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
      const dettaglio = dove != null ? `, e a quell’ora hai passato «${dove.name}»` : '';
      // Inizio E fine: senza la fine non si puo' decidere se aspettare o rinunciare.
      message = `Attenzione: dalle ${orario(hitWindow.fromISO)} alle ${orarioFine(hitWindow.toISO)}`
        + ` la previsione diventa critica${dettaglio}, mentre sei ancora in cammino.${coda}`;
    } else {
      message = `Attenzione: la previsione è critica nelle ore in cui sei in cammino.${coda}`;
    }
  }

  return { rows, windows, hitWindow, verdict: { level: peggio, message }, sampled: punti.length };
}
