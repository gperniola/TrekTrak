import { ATTRIBUZIONE_RADAR } from './radar-api';
import { ATTRIBUZIONE_RIPARI } from './shelters-api';

export type EmergencyLayerId = 'fires-hotspots' | 'fires-burned' | 'fires-fwi' | 'dpc-alerts'
  | 'rain-radar' | 'shelters' | 'storm-instability';
/**
 * `viewport` = layer che si interroga sull'area inquadrata, non una volta per tutte:
 * comanda il componente, quindi `startLayer` non fa partire nessun refresh periodico.
 */
export type EmergencyLayerKind = 'wms' | 'points' | 'zones' | 'tiles' | 'viewport';
export type EmergencyCategory = 'incendi' | 'alluvioni' | 'temporali' | 'ripari';

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
   * Il layer risponde a `GetFeatureInfo`, quindi si può interrogare con una pressione
   * lunga sulla mappa. Va dichiarato per layer perché non è deducibile: EFFIS pubblica
   * i tile del FWI ma non lo offre come queryable (`QUERY_LAYERS=mf010.fwi` risponde
   * `LayerNotDefined`), mentre le aree bruciate rispondono con la data dell'incendio.
   */
  queryable?: boolean;
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
    description: 'Lifted Index MSG: instabilit\u00e0 misurata adesso, non prevista (EUMETSAT)',
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
       * NON interrogabile, malgrado il capabilities dichiari `queryable="1"`.
       * Misurato: GetFeatureInfo risponde con RED_BAND / GREEN_BAND / BLUE_BAND, cioe'
       * i canali del PNG renderizzato, non il valore fisico in K. Dichiararlo
       * interrogabile avrebbe fatto leggere "RED_BAND = 0" a chi tiene premuto: peggio
       * che non offrire il gesto.
       */
      queryable: false,
    },
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
