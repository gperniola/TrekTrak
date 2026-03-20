export type ValidationStatus = 'unverified' | 'valid' | 'warning' | 'error';

export interface ValidationResult {
  status: ValidationStatus;
  userValue: number;
  realValue?: number;
  delta?: number;
  tolerance: { strict: number; loose: number };
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  altitude: number | null;
  order: number;
  validationState?: {
    altitude?: ValidationResult;
  };
}

export interface Leg {
  id: string;
  fromWaypointId: string;
  toWaypointId: string;
  distance: number | null;
  elevationGain: number | null;
  elevationLoss: number | null;
  azimuth: number | null;
  routeGeometry?: [number, number][];
  elevationProfile?: { distance: number; altitude: number }[];
  estimatedTime?: number;
  slope?: number;
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
}

export interface ToleranceSettings {
  altitude: number;
  coordinates: number;
  distance: number;
  azimuth: number;
  elevationDelta: number;
}

export interface MapDisplaySettings {
  coloredPath: boolean;
}

export const DEFAULT_MAP_DISPLAY: MapDisplaySettings = {
  coloredPath: false,
};

export interface AppSettings {
  tolerances: ToleranceSettings;
  mapDisplay: MapDisplaySettings;
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

export type TrackRouting = 'classic' | 'guided';
