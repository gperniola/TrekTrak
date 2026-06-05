import { create } from 'zustand';
import type { Waypoint, Leg, AppSettings, AppMode, LegModeValues, LegTrackModeValues } from '../lib/types';
import { DEFAULT_TOLERANCES, DEFAULT_MAP_DISPLAY } from '../lib/types';
import { calculateMunterTime, calculateSlope } from '../lib/calculations';

// --- Mode value snapshots (TASK-15: non-destructive Learn↔Track switch) ----------------
// Each leg carries two slots — trackValues and learnValues — plus the "active"
// fields (distance/elevationGain/...) that mirror whichever slot is current.
// On setAppMode, the active fields are snapshotted into the OLD mode's slot
// and the NEW mode's slot is restored to the active fields (or null defaults).
// Renderers keep reading leg.distance, leg.elevationGain, etc. unchanged.

function snapshotLegForMode(leg: Leg, mode: AppMode): LegModeValues | LegTrackModeValues {
  const base: LegModeValues = {
    distance: leg.distance,
    elevationGain: leg.elevationGain,
    elevationLoss: leg.elevationLoss,
    azimuth: leg.azimuth,
  };
  if (mode === 'track') {
    const trackSnap: LegTrackModeValues = { ...base };
    if (leg.routeGeometry !== undefined) trackSnap.routeGeometry = leg.routeGeometry;
    if (leg.elevationProfile !== undefined) trackSnap.elevationProfile = leg.elevationProfile;
    return trackSnap;
  }
  return base;
}

function restoreLegForMode(leg: Leg, mode: AppMode): Partial<Leg> {
  if (mode === 'track') {
    const tv = leg.trackValues;
    return {
      distance: tv?.distance ?? null,
      elevationGain: tv?.elevationGain ?? null,
      elevationLoss: tv?.elevationLoss ?? null,
      azimuth: tv?.azimuth ?? null,
      routeGeometry: tv?.routeGeometry,
      elevationProfile: tv?.elevationProfile,
    };
  }
  const lv = leg.learnValues;
  return {
    distance: lv?.distance ?? null,
    elevationGain: lv?.elevationGain ?? null,
    elevationLoss: lv?.elevationLoss ?? null,
    azimuth: lv?.azimuth ?? null,
    routeGeometry: undefined,
    elevationProfile: undefined,
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyLeg(fromId: string, toId: string): Leg {
  return {
    id: generateId(),
    fromWaypointId: fromId,
    toWaypointId: toId,
    distance: null,
    elevationGain: null,
    elevationLoss: null,
    azimuth: null,
  };
}

function recalculateLeg(leg: Leg, paceFactor: number = 1): Leg {
  const { distance, elevationGain, elevationLoss } = leg;
  if (distance != null && elevationGain != null && elevationLoss != null) {
    return {
      ...leg,
      estimatedTime: calculateMunterTime(distance, elevationGain, elevationLoss, paceFactor),
      slope: calculateSlope(distance, elevationGain, elevationLoss),
    };
  }
  return { ...leg, estimatedTime: undefined, slope: undefined };
}

interface ItineraryState {
  itineraryId: string;
  itineraryName: string;
  createdAt: string;
  waypoints: Waypoint[];
  legs: Leg[];
  settings: AppSettings;
  appMode: AppMode;

  setAppMode: (mode: AppMode) => void;
  setItineraryName: (name: string) => void;
  setItineraryId: (id: string) => void;
  addWaypoint: () => void;
  addWaypointAtPosition: (lat: number, lon: number) => void;
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, data: Partial<Waypoint>) => void;
  updateWaypointPosition: (id: string, lat: number, lon: number) => void;
  updateLeg: (id: string, data: Partial<Leg>) => void;
  reorderWaypoints: (newOrder: number[]) => void;
  clearAllValidation: () => void;
  updateSettings: (settings: AppSettings) => void;
  resetItinerary: () => void;
  loadItinerary: (id: string, name: string, waypoints: Waypoint[], legs: Leg[], createdAt?: string) => void;

  profileHover: { distance: number; source: 'chart' | 'map' } | null;
  setProfileHover: (distance: number, source: 'chart' | 'map') => void;
  clearProfileHover: () => void;
  profileFlyTo: number | null;
  setProfileFlyTo: (distance: number) => void;
  clearProfileFlyTo: () => void;
}

const initialState = {
  itineraryId: generateId(),
  itineraryName: '',
  createdAt: new Date().toISOString(),
  waypoints: [] as Waypoint[],
  legs: [] as Leg[],
  settings: { tolerances: { ...DEFAULT_TOLERANCES }, mapDisplay: { ...DEFAULT_MAP_DISPLAY } } as AppSettings,
  appMode: 'track' as AppMode,
  profileHover: null as { distance: number; source: 'chart' | 'map' } | null,
  profileFlyTo: null as number | null,
};

export const useItineraryStore = create<ItineraryState>()((set, get) => ({
  ...initialState,

  setAppMode: (mode) => {
    const oldMode = get().appMode;
    if (mode === oldMode) return;
    const { waypoints, legs } = get();
    // Non-destructive switch: snapshot current "active" values into the old mode's slot,
    // restore active values from the new mode's slot (or null defaults if never visited).
    set({
      appMode: mode,
      waypoints: waypoints.map((wp) => {
        const next: Waypoint = { ...wp, validationState: undefined };
        // Save current altitude into old mode's snapshot
        if (oldMode === 'track') next.trackAltitude = wp.altitude;
        else next.learnAltitude = wp.altitude;
        // Restore from new mode's snapshot
        next.altitude = mode === 'track' ? (wp.trackAltitude ?? null) : (wp.learnAltitude ?? null);
        return next;
      }),
      legs: legs.map((leg) => {
        const oldSnap = snapshotLegForMode(leg, oldMode);
        const restored = restoreLegForMode(leg, mode);
        const next: Leg = {
          ...leg,
          ...restored,
          validationState: undefined,
          estimatedTime: undefined,
          slope: undefined,
        };
        if (oldMode === 'track') next.trackValues = oldSnap as LegTrackModeValues;
        else next.learnValues = oldSnap;
        return recalculateLeg(next, get().settings.pace?.factor ?? 1);
      }),
    });
  },

  setItineraryName: (name) => set({ itineraryName: name }),

  setItineraryId: (id) => set({ itineraryId: id }),

  addWaypoint: () => {
    const { waypoints, legs } = get();
    if (waypoints.length >= 50) return;
    const newWp: Waypoint = {
      id: generateId(),
      name: `Waypoint ${waypoints.length + 1}`,
      lat: null,
      lon: null,
      altitude: null,
      order: waypoints.length,
    };
    const newLegs = [...legs];
    if (waypoints.length > 0) {
      const lastWp = waypoints[waypoints.length - 1];
      newLegs.push(createEmptyLeg(lastWp.id, newWp.id));
    }
    set({ waypoints: [...waypoints, newWp], legs: newLegs });
  },

  addWaypointAtPosition: (lat, lon) => {
    const { waypoints, legs } = get();
    if (waypoints.length >= 50) return;
    const newWp: Waypoint = {
      id: generateId(),
      name: `Waypoint ${waypoints.length + 1}`,
      lat,
      lon,
      altitude: null,
      order: waypoints.length,
    };
    const newLegs = [...legs];
    if (waypoints.length > 0) {
      const lastWp = waypoints[waypoints.length - 1];
      newLegs.push(createEmptyLeg(lastWp.id, newWp.id));
    }
    set({ waypoints: [...waypoints, newWp], legs: newLegs });
  },

  removeWaypoint: (id) => {
    const { waypoints, legs } = get();
    const filtered = waypoints.filter((wp) => wp.id !== id);
    const reordered = filtered.map((wp, i) => ({ ...wp, order: i }));
    const newLegs: Leg[] = [];
    for (let i = 0; i < reordered.length - 1; i++) {
      const existing = legs.find(
        (l) => l.fromWaypointId === reordered[i].id && l.toWaypointId === reordered[i + 1].id
      );
      // Preserve route data for legs whose from/to waypoints haven't changed
      newLegs.push(existing ? { ...existing, validationState: undefined } : createEmptyLeg(reordered[i].id, reordered[i + 1].id));
    }
    set({ waypoints: reordered, legs: newLegs });
  },

  updateWaypoint: (id, data) => {
    set({
      waypoints: get().waypoints.map((wp) => {
        if (wp.id !== id) return wp;
        const updated = { ...wp, ...data };
        if (!('validationState' in data) && wp.validationState) {
          if ('altitude' in data || 'lat' in data || 'lon' in data) {
            updated.validationState = undefined;
          }
        }
        return updated;
      }),
    });
  },

  updateWaypointPosition: (id, lat, lon) => {
    set({
      waypoints: get().waypoints.map((wp) =>
        wp.id === id ? { ...wp, lat, lon, validationState: undefined } : wp
      ),
    });
  },

  updateLeg: (id, data) => {
    set({
      legs: get().legs.map((leg) => {
        if (leg.id !== id) return leg;
        const updated = { ...leg, ...data };
        // Clear stale validation for fields the user edited (not when setting validationState itself)
        if (!('validationState' in data) && leg.validationState) {
          const cleared = { ...leg.validationState };
          if ('distance' in data) delete cleared.distance;
          if ('elevationGain' in data) delete cleared.elevationGain;
          if ('elevationLoss' in data) delete cleared.elevationLoss;
          if ('azimuth' in data) delete cleared.azimuth;
          updated.validationState = Object.keys(cleared).length > 0 ? cleared : undefined;
        }
        return recalculateLeg(updated, get().settings.pace?.factor ?? 1);
      }),
    });
  },

  reorderWaypoints: (newOrder) => {
    const { waypoints, legs } = get();
    if (newOrder.length !== waypoints.length) return;
    if (newOrder.some((idx) => idx < 0 || idx >= waypoints.length)) return;
    if (new Set(newOrder).size !== newOrder.length) return;
    const reordered = newOrder.map((oldIdx, newIdx) => ({
      ...waypoints[oldIdx],
      order: newIdx,
    }));
    const newLegs: Leg[] = [];
    for (let i = 0; i < reordered.length - 1; i++) {
      const existing = legs.find(
        (l) => l.fromWaypointId === reordered[i].id && l.toWaypointId === reordered[i + 1].id
      );
      // Preserve route data for legs whose from/to waypoints haven't changed
      newLegs.push(existing ? { ...existing, validationState: undefined } : createEmptyLeg(reordered[i].id, reordered[i + 1].id));
    }
    set({ waypoints: reordered, legs: newLegs });
  },

  clearAllValidation: () => {
    const { waypoints, legs } = get();
    set({
      waypoints: waypoints.map((wp) => ({ ...wp, validationState: undefined })),
      legs: legs.map((leg) => ({ ...leg, validationState: undefined })),
    });
  },

  updateSettings: (settings) => set({ settings }),

  resetItinerary: () => {
    const { appMode, settings } = get();
    set({
      itineraryId: generateId(),
      itineraryName: '',
      createdAt: new Date().toISOString(),
      waypoints: [],
      legs: [],
      settings,
      appMode,
      profileHover: null,
      profileFlyTo: null,
    });
  },

  loadItinerary: (id, name, waypoints, legs, createdAt) => {
    // Sort by order field before re-indexing to respect imported ordering (NaN-safe)
    const sorted = [...waypoints].sort((a, b) => {
      const aOrd = Number.isFinite(a.order) ? a.order : Infinity;
      const bOrd = Number.isFinite(b.order) ? b.order : Infinity;
      return aOrd - bOrd;
    });
    // Enforce 50-waypoint cap on import
    const capped = sorted.slice(0, 50);
    const cleanWaypoints = capped.map(({ validationState, ...wp }, i) => ({ ...wp, order: i }));
    // Rebuild consecutive leg chain, preserving data for matching from/to pairs
    const newLegs: Leg[] = [];
    for (let i = 0; i < cleanWaypoints.length - 1; i++) {
      const existing = legs.find(
        (l) => l.fromWaypointId === cleanWaypoints[i].id && l.toWaypointId === cleanWaypoints[i + 1].id
      );
      if (existing) {
        const { validationState, ...clean } = existing;
        newLegs.push(recalculateLeg(clean, get().settings.pace?.factor ?? 1));
      } else {
        newLegs.push(createEmptyLeg(cleanWaypoints[i].id, cleanWaypoints[i + 1].id));
      }
    }
    set({
      itineraryId: id,
      itineraryName: name,
      createdAt: createdAt ?? new Date().toISOString(),
      waypoints: cleanWaypoints,
      legs: newLegs,
      profileHover: null,
      profileFlyTo: null,
    });
  },

  setProfileHover: (distance, source) => {
    if (!Number.isFinite(distance) || distance < 0) return;
    set({ profileHover: { distance, source } });
  },
  clearProfileHover: () => set({ profileHover: null }),
  setProfileFlyTo: (distance) => {
    if (!Number.isFinite(distance) || distance < 0) return;
    set({ profileFlyTo: distance });
  },
  clearProfileFlyTo: () => set({ profileFlyTo: null }),
}));
