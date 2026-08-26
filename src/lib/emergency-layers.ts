export type EmergencyLayerId = 'fires-hotspots' | 'fires-burned' | 'fires-fwi' | 'dpc-alerts';
export type EmergencyLayerKind = 'wms' | 'points' | 'zones';
export type EmergencyCategory = 'incendi' | 'alluvioni';

export interface LegendEntry { color: string; label: string; }

export interface WmsConfig {
  url: string;
  layers: string;
  timeMode: 'today' | 'yearToDate';
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
    legend: [{ color: '#7f1d1d', label: 'Area percorsa dal fuoco' }],
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
      { color: '#22c55e', label: 'Basso' },
      { color: '#eab308', label: 'Moderato' },
      { color: '#f97316', label: 'Alto' },
      { color: '#dc2626', label: 'Molto alto' },
      { color: '#7f1d1d', label: 'Estremo' },
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
];

export function getEmergencyLayer(id: EmergencyLayerId): EmergencyLayerDef {
  const def = EMERGENCY_LAYERS.find((l) => l.id === id);
  if (!def) throw new Error(`Unknown emergency layer: ${id}`);
  return def;
}

export function isEmergencyLayerId(v: unknown): v is EmergencyLayerId {
  return typeof v === 'string' && EMERGENCY_LAYERS.some((l) => l.id === v);
}
