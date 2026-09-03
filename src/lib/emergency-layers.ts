import { ATTRIBUZIONE_RADAR } from './radar-api';
import { ATTRIBUZIONE_RIPARI } from './shelters-api';
import { ATTRIBUZIONE_VALANGHE } from './avalanche-api';
import { SCALA_EAWS } from './avalanche';
import { ATTRIBUZIONE_NEVE, LEGENDA_NEVE, ZOOM_NATIVO_MASSIMO_NEVE, giorniDaProvare as giorniNeve, templateNeve } from './snow-cover';
import { ATTRIBUZIONE_SISMI } from './quakes-api';

export type EmergencyLayerId = 'fires-hotspots' | 'fires-burned' | 'fires-fwi' | 'dpc-alerts'
  | 'rain-radar' | 'shelters' | 'storm-instability'
  | 'avalanche-danger' | 'snow-cover' | 'earthquakes';
/**
 * `viewport` = layer che si interroga sull'area inquadrata, non una volta per tutte:
 * comanda il componente, quindi `startLayer` non fa partire nessun refresh periodico.
 */
/*
  Il `kind` dice **quale renderer** monta l'orchestratore, non solo la forma del dato:
  focolai e terremoti sono entrambi punti, ma vengono da fonti diverse e si disegnano in
  modo diverso, quindi hanno due kind. Tenerli sotto `points` avrebbe richiesto un
  secondo criterio (l'id) dentro il dispatch, cioe' il modo classico di far divergere
  due verita' sulla stessa cosa.
*/
export type EmergencyLayerKind = 'wms' | 'points' | 'zones' | 'tiles' | 'viewport'
  | 'xyz' | 'quakes' | 'avalanche';
export type EmergencyCategory = 'incendi' | 'alluvioni' | 'temporali' | 'ripari'
  | 'neve' | 'sismi';

/**
 * Un'icona per categoria, da mettere sulla riga del layer.
 *
 * Prima le categorie erano quattro INTESTAZIONI, cioè quattro righe di elenco che non
 * si potevano toccare né spegnere: su sette layer erano quattro righe di sola
 * impaginazione su undici. Con l'icona sulla riga il raggruppamento si vede ancora
 * (l'ordine resta per categoria) e l'elenco torna a contenere solo cose che fanno
 * qualcosa.
 */
export const CATEGORY_ICONS: Record<EmergencyCategory, string> = {
  incendi: '\u{1F525}',
  alluvioni: '\u{1F30A}',
  temporali: '\u26C8\uFE0F',
  ripari: '\u{1F3E0}',
  neve: '\u2744\uFE0F',
  sismi: '\u{1F30D}',
};

/** Nome della categoria, per chi non vede l'icona. */
export const CATEGORY_NAMES: Record<EmergencyCategory, string> = {
  incendi: 'Incendi',
  alluvioni: 'Alluvioni e frane',
  temporali: 'Pioggia e temporali',
  ripari: 'Dove ripararsi',
  neve: 'Neve e valanghe',
  sismi: 'Terremoti',
};

export interface LegendEntry { color: string; label: string; }

export interface WmsConfig {
  url: string;
  layers: string;
  /**
   * `latest` = non si passa affatto il parametro TIME: il servizio serve l'istante piu'
   * recente della sua dimensione temporale. Verificato su EUMETSAT: senza TIME
   * l'immagine e' quella del default dichiarato nel capabilities, con TIME di tre ore
   * prima si ottiene un'immagine diversa.
   */
  timeMode: 'today' | 'yearToDate' | 'latest';
  opacity: number;
  /**
   * Fin dove il servizio ha **davvero** dati. Oltre, Leaflet stira l'ultimo livello
   * disponibile invece di chiedere mattonelle vuote.
   *
   * Serve perché un WMS non lo dichiara e non si deduce: `GetCapabilities` di EUMETSAT
   * non pubblica nessun `MaxScaleDenominator`, e a qualunque zoom la risposta è
   * **200 con un PNG valido**. Solo guardando i pixel si scopre che oltre un certo
   * ingrandimento è tutto trasparente — un successo che non contiene nulla, cioè lo
   * stesso schema del mirror Overpass svuotato.
   *
   * Si dichiara **solo** dove la misura lo ha trovato necessario: metterlo per prudenza
   * su un layer che ha dati butterebbe via dettaglio vero.
   */
  maxNativeZoom?: number;
  /**
   * Il layer risponde a `GetFeatureInfo`, quindi si può interrogare con una pressione
   * lunga sulla mappa. Va dichiarato per layer perché non è deducibile: EFFIS pubblica
   * i tile del FWI ma non lo offre come queryable (`QUERY_LAYERS=mf010.fwi` risponde
   * `LayerNotDefined`), mentre le aree bruciate rispondono con la data dell'incendio.
   */
  queryable?: boolean;
}

/**
 * Mattonelle XYZ statiche con una **data** nel percorso (e' il caso di GIBS).
 *
 * Diverso da `wms`: non c'e' nessun `GetMap`, e la data non e' un parametro ma un pezzo
 * dell'URL. `zoomNativoMassimo` qui non e' prudenza — il set di mattonelle si chiama
 * `GoogleMapsCompatible_Level8`, e sopra l'8 le mattonelle non esistono affatto.
 */
export interface XyzConfig {
  /** Da costruire col giorno: vedi `templateNeve`. */
  template: (giorno: string) => string;
  /** I giorni da provare, dal piu' recente. */
  giorni: (adesso: Date) => string[];
  opacity: number;
  zoomNativoMassimo: number;
}

export interface EmergencyLayerDef {
  id: EmergencyLayerId;
  category: EmergencyCategory;
  label: string;
  description: string;
  kind: EmergencyLayerKind;
  attribution: string;
  refreshMinutes: number | null;
  legend: LegendEntry[];
  wms?: WmsConfig;
  xyz?: XyzConfig;
}

/** Pane Leaflet dedicato: sopra i tile (200), sotto overlayPane dei tracciati (400). */
export const EMERGENCY_PANE = 'emergency';

const EFFIS_WMS_URL = 'https://maps.effis.emergency.copernicus.eu/effis';

export const EMERGENCY_LAYERS: EmergencyLayerDef[] = [
  {
    id: 'fires-hotspots',
    category: 'incendi',
    label: 'Focolai attivi (24h)',
    description: 'Anomalie termiche rilevate da satellite (VIIRS, ~375 m)',
    kind: 'points',
    attribution: 'Dati incendi: <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>',
    refreshMinutes: 15,
    legend: [
      { color: '#ef4444', label: 'Rilevato nelle ultime 6 ore' },
      { color: '#f97316', label: 'Rilevato oltre 6 ore fa' },
    ],
  },
  {
    id: 'fires-burned',
    category: 'incendi',
    label: 'Aree bruciate (anno corrente)',
    description: 'Perimetri incendi >30 ha (Copernicus EFFIS)',
    kind: 'wms',
    attribution: '<a href="https://forest-fire.emergency.copernicus.eu/">Copernicus EFFIS</a>',
    refreshMinutes: null,
    // Quattro classi per RECENZA, non una. I colori sono campionati dalla legenda
    // ufficiale del servizio (`REQUEST=GetLegendGraphic` su `effis.nrt.ba.poly`), non
    // scelti da noi: devono combaciare con quello che si vede sulla mappa. Prima ne
    // dichiaravamo una sola, di un rosso che non corrispondeva a nessuna classe,
    // quindi le aree azzurre e verdi restavano senza spiegazione — ed è proprio la
    // recenza l'informazione più utile del layer.
    legend: [
      { color: '#fd7f7f', label: 'Bruciata nell\'ultimo giorno' },
      { color: '#fdbe7f', label: 'Negli ultimi 7 giorni' },
      { color: '#8dc6fd', label: 'Negli ultimi 30 giorni' },
      { color: '#86de86', label: 'In questa stagione' },
    ],
    wms: { url: EFFIS_WMS_URL, layers: 'effis.nrt.ba.poly', timeMode: 'yearToDate', opacity: 0.7, queryable: true },
  },
  {
    id: 'fires-fwi',
    category: 'incendi',
    label: 'Pericolo incendio oggi (FWI)',
    description: 'Fire Weather Index previsionale (Copernicus EFFIS)',
    kind: 'wms',
    attribution: '<a href="https://forest-fire.emergency.copernicus.eu/">Copernicus EFFIS</a>',
    refreshMinutes: null,
    legend: [
      // Sei classi, coi loro intervalli, e i colori campionati dalla legenda ufficiale
      // del servizio. Prima erano cinque con colori inventati: mancava la classe piu'
      // pericolosa, che sulla mappa veniva quindi disegnata di un colore che l'utente
      // non poteva interpretare.
      //
      // Nomi e soglie ricalcano la legenda pubblicata (Low / Moderate / High / Very
      // High / Extreme / Very Extreme): le soglie hanno un decimale perche' ce l'hanno
      // alla fonte, e arrotondarle sposterebbe il confine fra due classi rispetto al
      // colore che il servizio disegna davvero.
      { color: '#9cffc0', label: 'Basso (< 11,2)' },
      { color: '#cde24e', label: 'Moderato (11,2-21,3)' },
      { color: '#e6ac00', label: 'Alto (21,3-38)' },
      { color: '#d97010', label: 'Molto alto (38-50)' },
      { color: '#ad060e', label: 'Estremo (50-70)' },
      { color: '#3a0015', label: 'Molto estremo (> 70)' },
    ],
    wms: { url: EFFIS_WMS_URL, layers: 'mf010.fwi', timeMode: 'today', opacity: 0.55 },
  },
  {
    id: 'dpc-alerts',
    category: 'alluvioni',
    label: 'Allerte meteo-idro (DPC)',
    description: 'Criticità idraulica, temporali e idrogeologica/frane per zona di allerta',
    kind: 'zones',
    attribution: '<a href="https://github.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica">Dipartimento Protezione Civile</a> (CC-BY 4.0)',
    refreshMinutes: 30,
    legend: [
      { color: '#eab308', label: 'Allerta gialla' },
      { color: '#f97316', label: 'Allerta arancione' },
      { color: '#dc2626', label: 'Allerta rossa' },
    ],
  },
  {
    id: 'rain-radar',
    category: 'temporali',
    label: 'Radar pioggia (ultime 2 h)',
    description: 'Precipitazioni gi\u00e0 cadute, non previsione. Dettaglio ~1 km (RainViewer)',
    kind: 'tiles',
    attribution: ATTRIBUZIONE_RADAR,
    // I fotogrammi escono ogni 10 minuti: chiedere l'indice piu' spesso non aggiunge nulla.
    refreshMinutes: 10,
    /*
     * Colori CAMPIONATI dai tile veri, non presi da una documentazione: scansione di 40
     * tile globali il 2026-08-27, coi conteggi per famiglia di colore. Il verde non
     * compare affatto in questo schema, e il grigio e' la neve (i tile si chiedono con
     * `snow=1`). La direzione della scala e' confermata dai numeri: 21.809 pixel blu
     * contro 21 viola, cioe' l'evento raro sta all'estremo intenso.
     *
     * Le legende EFFIS corrette nella v0.11.6 insegnano che dichiarare colori che sulla
     * mappa non esistono e' peggio che non avere legenda.
     */
    legend: [
      { color: '#88ddee', label: 'Pioggia leggera' },
      { color: '#ffee00', label: 'Moderata' },
      { color: '#ff9500', label: 'Forte' },
      { color: '#f23600', label: 'Molto forte' },
      { color: '#ff4eff', label: 'Nucleo intenso' },
      { color: '#706a5d', label: 'Neve' },
    ],
  },
  {
    id: 'shelters',
    category: 'ripari',
    label: 'Rifugi e ricoveri',
    description: 'Rifugi, bivacchi e ricoveri mappati su OpenStreetMap',
    kind: 'viewport',
    attribution: ATTRIBUZIONE_RIPARI,
    // Si interroga sulla vista: nessun refresh a tempo, altrimenti si tempesterebbe
    // un'istanza pubblica condivisa.
    refreshMinutes: null,
    legend: [
      { color: '#c084fc', label: 'Rifugio (custodito)' },
      { color: '#93c5fd', label: 'Bivacco' },
      { color: '#a3a3a3', label: 'Ricovero / tettoia' },
    ],
  },
  {
    id: 'storm-instability',
    category: 'temporali',
    label: 'Instabilit\u00e0 osservata (satellite)',
    /*
      La risoluzione va detta: il prodotto MSG e' dell'ordine dei chilometri, e oltre lo
      zoom 8 l'immagine e' un ingrandimento dell'ultimo livello con dati. Senza dirlo, chi
      ingrandisce vede una macchia sempre piu' sgranata e la crede piu' precisa.
    */
    description: 'Lifted Index MSG: instabilit\u00e0 misurata adesso, non prevista. Risoluzione di alcuni km: oltre lo zoom 8 l\u2019immagine \u00e8 stirata, non pi\u00f9 precisa (EUMETSAT)',
    kind: 'wms',
    attribution: 'Instabilit\u00e0: <a href="https://view.eumetsat.int/">EUMETSAT</a>',
    /*
     * 15 minuti: e' il passo del prodotto MSG. Per un layer WMS `refreshMinutes` non
     * avvia timer (li' i tile si ricaricano da soli col bollo di rinfresco), ma serve a
     * `isStale`: senza, un layer che smette di aggiornarsi non poteva essere dichiarato
     * vecchio, e restava "Aggiornato alle 20:06" per tutta la serata.
     */
    refreshMinutes: 15,
    /*
     * Legenda LETTA dalla barra ufficiale (GetLegendGraphic), non dedotta: la scala va
     * da -16 a +20 K e i colori vanno rossi -> oliva -> viola -> marroni. I quattro
     * colori qui sotto sono campionati dalla sequenza vera (38 tinte).
     *
     * La polarita' e' INVERSA rispetto al CAPE del pannello meteo — negativo =
     * instabile — e i colori non sono intuitivi (il viola sta fra il giallo e il
     * marrone). Per questo le etichette dicono la classe a parole e il valore in K,
     * invece di lasciare interpretare la tinta.
     */
    legend: [
      { color: '#c65151', label: 'Molto instabile (fino a -8 K)' },
      { color: '#b6b33a', label: 'Instabile (-8 a -4 K)' },
      { color: '#8176c4', label: 'Poco instabile (-4 a 0 K)' },
      { color: '#af8357', label: 'Stabile (oltre 0 K)' },
    ],
    wms: {
      url: 'https://view.eumetsat.int/geoserver/wms',
      layers: 'msg_fes:gii_liftedindex',
      timeMode: 'latest',
      opacity: 0.45,
      /*
        **Otto, e non e' un numero prudenziale: e' dove finiscono i dati.**

        Segnalato: «a volte fa sparire il layer se cambio lo zoom». Misurato sui pixel —
        il peso del PNG non basta, perche' una mattonella di un solo colore comprime come
        una trasparente — disegnando la risposta su una canvas e contando l'alfa, sulla
        mattonella del Gran Sasso: 100% di pixel opachi a z6 e z8, 86% a z9, **14% a z10,
        zero da z11**. Il servizio risponde sempre 200 con un PNG valido: nessun errore,
        nessun `tileerror`, solo il layer che svanisce.

        Il prodotto MSG ha risoluzione dell'ordine dei chilometri, quindi oltre lo zoom 8
        non c'e' nulla da mostrare e la cosa onesta e' stirare l'ultimo livello buono.
      */
      maxNativeZoom: 8,
      /*
       * NON interrogabile, malgrado il capabilities dichiari `queryable="1"`.
       * Misurato: GetFeatureInfo risponde con RED_BAND / GREEN_BAND / BLUE_BAND, cioe'
       * i canali del PNG renderizzato, non il valore fisico in K. Dichiararlo
       * interrogabile avrebbe fatto leggere "RED_BAND = 0" a chi tiene premuto: peggio
       * che non offrire il gesto.
       */
      queryable: false,
    },
  },
  {
    id: 'avalanche-danger',
    category: 'neve',
    label: 'Pericolo valanghe',
    /*
      La descrizione dice le due cose che cambiano una decisione: che e' un bollettino
      **per zona** (non per pendio: la scelta del pendio resta a chi cammina) e che fuori
      stagione non esiste. Senza la seconda, un layer che d'estate non disegna niente si
      legge come "nessun pericolo".
    */
    description: 'Scala europea 1-5 per micro-regione, dai servizi valanghe (EAWS). '
      + 'Vale per la zona, non per il singolo pendio. Fuori stagione non c\u2019\u00e8 bollettino',
    kind: 'avalanche',
    attribution: ATTRIBUZIONE_VALANGHE,
    // Si interroga sulla vista, come i ripari: nessun timer. Il bollettino esce una volta
    // al giorno, quindi non c'e' niente da rinfrescare a intervalli.
    refreshMinutes: null,
    /*
      Colori LETTI dal CSS dell'app che pubblica i bollettini, non ricordati: vedi
      `SCALA_EAWS`. Il livello 5 sul sito ufficiale e' rosso a tratteggio, e qui lo dice
      l'etichetta invece di inventargli una tinta sua.
    */
    legend: [
      { color: SCALA_EAWS[1].colore, label: '1 \u2014 Debole' },
      { color: SCALA_EAWS[2].colore, label: '2 \u2014 Moderato' },
      { color: SCALA_EAWS[3].colore, label: '3 \u2014 Marcato' },
      { color: SCALA_EAWS[4].colore, label: '4 \u2014 Forte' },
      { color: SCALA_EAWS[5].colore, label: '5 \u2014 Molto forte (bordo nero)' },
    ],
  },
  {
    id: 'snow-cover',
    category: 'neve',
    label: 'Copertura nevosa (satellite)',
    /*
      La riga che conta e' l'ultima: **dove non c'e' colore puo' esserci una nuvola**.
      Misurato su un tile vero il 2026-09-03: il 59,8% dei pixel era classe "nube", ed e'
      trasparente. Senza dirlo, un versante nevoso sotto un fronte si legge come spoglio.
    */
    description: 'Indice di neve MODIS, un passaggio al giorno. Dettaglio ~500 m, '
      + 'oltre lo zoom 8 l\u2019immagine \u00e8 stirata. Dove non c\u2019\u00e8 colore pu\u00f2 esserci una nuvola: '
      + 'il satellite non vede sotto le nubi',
    kind: 'xyz',
    attribution: ATTRIBUZIONE_NEVE,
    // Un passaggio al giorno: chiedere piu' spesso non cambia l'immagine. Serve pero' a
    // `isStale`, come per gli altri layer a mattonelle.
    refreshMinutes: 180,
    legend: LEGENDA_NEVE.map((v) => ({ color: v.color, label: v.label })),
    xyz: {
      template: templateNeve,
      giorni: giorniNeve,
      opacity: 0.6,
      zoomNativoMassimo: ZOOM_NATIVO_MASSIMO_NEVE,
    },
  },
  {
    id: 'earthquakes',
    category: 'sismi',
    label: 'Terremoti (48 h)',
    description: 'Eventi da magnitudo 2 in Italia, dall\u2019INGV. Il colore \u00e8 la magnitudo, '
      + 'il popup dice profondit\u00e0 e orario',
    kind: 'quakes',
    attribution: ATTRIBUZIONE_SISMI,
    // Un quarto d'ora: le revisioni di magnitudo arrivano poco dopo l'evento, e durante
    // uno sciame l'elenco cambia davvero.
    refreshMinutes: 15,
    /*
      Le soglie sono quelle degli effetti, non decimali per fare scala: sotto 3 la
      sentono pochi, da 4 muove gli oggetti, da 5 puo' far danni.
    */
    legend: [
      { color: '#60a5fa', label: 'Magnitudo < 3' },
      { color: '#eab308', label: '3 \u2013 4' },
      { color: '#f97316', label: '4 \u2013 5' },
      { color: '#dc2626', label: '5 e oltre' },
    ],
  },
];

export function getEmergencyLayer(id: EmergencyLayerId): EmergencyLayerDef {
  const def = EMERGENCY_LAYERS.find((l) => l.id === id);
  if (!def) throw new Error(`Unknown emergency layer: ${id}`);
  return def;
}

/**
 * Attribution senza markup, per i contesti di solo testo (banner, toast, popup
 * costruiti a mano). Unica implementazione: la spoglia-HTML esisteva già come copia
 * locale nel pannello.
 */
export function attributionText(id: EmergencyLayerId): string {
  return stripAttributionMarkup(getEmergencyLayer(id).attribution);
}

export function stripAttributionMarkup(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export function isEmergencyLayerId(v: unknown): v is EmergencyLayerId {
  return typeof v === 'string' && EMERGENCY_LAYERS.some((l) => l.id === v);
}
