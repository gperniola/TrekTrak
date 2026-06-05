export type ValidationStatus = 'unverified' | 'valid' | 'warning' | 'error';

export interface ValidationResult {
  status: ValidationStatus;
  userValue: number;
  realValue?: number;
  delta?: number;
  tolerance: { strict: number; loose: number };
}

/**
 * Numeric values a leg can carry in either learn or track mode.
 * Learn-only fields (no routeGeometry/elevationProfile because Learn doesn't compute paths).
 */
export interface LegModeValues {
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  azimuth: number | null;
}

export interface LegTrackModeValues extends LegModeValues {
  routeGeometry?: [number, number][];
  elevationProfile?: { distance: number; altitude: number }[];
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  /** Active altitude — driven by appMode. Mirrored in trackAltitude or learnAltitude. */
  altitude: number | null;
  /** Snapshot of altitude as last seen in Track mode. */
  trackAltitude?: number | null;
  /** Snapshot of altitude as last typed in Learn mode. */
  learnAltitude?: number | null;
  order: number;
  validationState?: {
    altitude?: ValidationResult;
  };
}

export interface Leg {
  id: string;
  fromWaypointId: string;
  toWaypointId: string;
  /** Active values — driven by appMode. Mirrored in trackValues or learnValues. */
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  azimuth: number | null;
  routeGeometry?: [number, number][];
  elevationProfile?: { distance: number; altitude: number }[];
  estimatedTime?: number;
  slope?: number;
  /** Snapshot of values as last seen in Track mode (auto-filled by ORS/DEM). */
  trackValues?: LegTrackModeValues;
  /** Snapshot of values as last typed in Learn mode (user input). */
  learnValues?: LegModeValues;
  validationState?: {
    distance?: ValidationResult;
    elevationGain?: ValidationResult;
    elevationLoss?: ValidationResult;
    azimuth?: ValidationResult;
  };
}

export interface Itinerary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  waypoints: Waypoint[];
  legs: Leg[];
  notes?: string;
  completions?: RouteCompletion[];
  metrics?: RouteMetrics;
  sortIndex?: number;
  /** Username del creatore (risolto dal cloud, solo per visualizzazione). */
  createdByUsername?: string;
}

export interface RouteCompletion {
  id: string;
  personName: string;
  date: string;              // ISO "YYYY-MM-DD"
  durationMinutes?: number;  // tempo impiegato (opzionale)
  notes: string;
}

export interface RouteMetrics {
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  minAltitude: number | null;
  maxAltitude: number | null;
  avgSlope: number;          // % media pesata sulla distanza
  maxSlope: number;          // % max pendenza di tratta
  estimatedTimeMin: number;  // stima Munter totale
}

export interface ToleranceSettings {
  altitude: number;
  coordinates: number;
  distance: number;
  azimuth: number;
  elevationDelta: number;
}

export type SampleIntervalOption = 20 | 50 | 100 | 200;

export const SAMPLE_INTERVAL_OPTIONS: { value: SampleIntervalOption; label: string }[] = [
  { value: 20, label: '20 m — Alta risoluzione' },
  { value: 50, label: '50 m — Default' },
  { value: 100, label: '100 m — Media risoluzione' },
  { value: 200, label: '200 m — Bassa risoluzione' },
];

export type BaseMapId = 'thunderforest-outdoors' | 'opentopomap' | 'cyclosm' | 'osm';

export interface BaseMapDef {
  id: BaseMapId;
  label: string;
  description: string;
  url: string;
  attribution: string;
  available: boolean;
  /** Maximum zoom level at which the tile server provides tiles */
  maxNativeZoom: number;
}

// Static process.env references so Next.js can inline them at build time.
// Dynamic process.env[var] does NOT work in the client bundle.
const TF_KEY = process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY ?? '';

export const BASE_MAPS: BaseMapDef[] = [
  {
    id: 'thunderforest-outdoors',
    label: 'Thunderforest Outdoors',
    description: 'Sentieri, curve di livello, rifugi',
    url: `https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${TF_KEY}`,
    attribution: '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    available: TF_KEY.length > 0,
    maxNativeZoom: 22,
  },
  {
    id: 'opentopomap',
    label: 'OpenTopoMap',
    description: 'Mappa topografica con curve di livello dettagliate',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    available: true,
    maxNativeZoom: 17,
  },
  {
    id: 'cyclosm',
    label: 'CyclOSM',
    description: 'Sentieri, superfici, fonti d\'acqua',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    available: true,
    maxNativeZoom: 20,
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    description: 'Mappa standard — sempre disponibile',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    available: true,
    maxNativeZoom: 19,
  },
];

export const HIKING_TRAILS_OVERLAY = {
  url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://waymarkedtrails.org">Waymarked Trails</a>',
};

export interface MapDisplaySettings {
  coloredPath: boolean;
  trailRouting: boolean;
  sampleInterval: SampleIntervalOption;
  baseMap: BaseMapId;
  showHikingTrails: boolean;
  showCoordinateGrid: boolean;
}

export const DEFAULT_MAP_DISPLAY: MapDisplaySettings = {
  coloredPath: true,
  trailRouting: true,
  sampleInterval: 50,
  baseMap: 'thunderforest-outdoors',
  showHikingTrails: true,
  showCoordinateGrid: false,
};

/**
 * Personal pace settings for Munter time estimation.
 * factor multiplies the standard Munter time. 1.0 = standard.
 */
export interface PaceSettings {
  /** Multiplier on Munter time. Range typically 0.7–1.5. Default 1.0. */
  factor: number;
}

export const DEFAULT_PACE: PaceSettings = { factor: 1 };

export interface AppSettings {
  tolerances: ToleranceSettings;
  mapDisplay: MapDisplaySettings;
  pace?: PaceSettings;
}

export const DEFAULT_TOLERANCES: ToleranceSettings = {
  altitude: 50,
  coordinates: 0.001,
  distance: 10,
  azimuth: 5,
  elevationDelta: 15,
};

export type DifficultyGrade = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export type AppMode = 'learn' | 'track';

export type ValidationFieldType = 'altitude' | 'distance' | 'azimuth' | 'elevationGain' | 'elevationLoss';

export interface ValidationSessionResult {
  field: ValidationFieldType;
  status: 'valid' | 'warning' | 'error';
  delta: number;
  tolerance: { strict: number; loose: number };
}

export interface ValidationSession {
  date: string;
  itineraryName: string;
  results: ValidationSessionResult[];
}
