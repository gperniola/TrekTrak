import { create } from 'zustand';
import type { Waypoint, Leg, AppSettings } from '../lib/types';
import { DEFAULT_TOLERANCES } from '../lib/types';
import { calculateMunterTime, calculateSlope } from '../lib/calculations';

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

function recalculateLeg(leg: Leg): Leg {
  const { distance, elevationGain, elevationLoss } = leg;
  if (distance != null && elevationGain != null && elevationLoss != null) {
    return {
      ...leg,
      estimatedTime: calculateMunterTime(distance, elevationGain, elevationLoss),
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

  setItineraryName: (name: string) => void;
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
}

const initialState = {
  itineraryId: generateId(),
  itineraryName: '',
  createdAt: new Date().toISOString(),
  waypoints: [] as Waypoint[],
  legs: [] as Leg[],
  settings: { tolerances: { ...DEFAULT_TOLERANCES } } as AppSettings,
};

export const useItineraryStore = create<ItineraryState>()((set, get) => ({
  ...initialState,

  setItineraryName: (name) => set({ itineraryName: name }),

  addWaypoint: () => {
    const { waypoints, legs } = get();
    const newWp: Waypoint = {
      id: generateId(),
      name: '',
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
    const newWp: Waypoint = {
      id: generateId(),
      name: '',
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
      newLegs.push(existing ?? createEmptyLeg(reordered[i].id, reordered[i + 1].id));
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
        return recalculateLeg(updated);
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
      newLegs.push(existing ?? createEmptyLeg(reordered[i].id, reordered[i + 1].id));
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

  resetItinerary: () => set({
    itineraryId: generateId(),
    itineraryName: '',
    createdAt: new Date().toISOString(),
    waypoints: [],
    legs: [],
    settings: { tolerances: { ...DEFAULT_TOLERANCES } },
  }),

  loadItinerary: (id, name, waypoints, legs, createdAt) => {
    const cleanWaypoints = waypoints.map(({ validationState, ...wp }, i) => ({ ...wp, order: i }));
    // Rebuild consecutive leg chain, preserving data for matching from/to pairs
    const newLegs: Leg[] = [];
    for (let i = 0; i < cleanWaypoints.length - 1; i++) {
      const existing = legs.find(
        (l) => l.fromWaypointId === cleanWaypoints[i].id && l.toWaypointId === cleanWaypoints[i + 1].id
      );
      if (existing) {
        const { validationState, ...clean } = existing;
        newLegs.push(recalculateLeg(clean));
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
    });
  },
}));
