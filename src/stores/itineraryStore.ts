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
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, data: Partial<Waypoint>) => void;
  updateWaypointPosition: (id: string, lat: number, lon: number) => void;
  updateLeg: (id: string, data: Partial<Leg>) => void;
  reorderWaypoints: (newOrder: number[]) => void;
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
      waypoints: get().waypoints.map((wp) =>
        wp.id === id ? { ...wp, ...data } : wp
      ),
    });
  },

  updateWaypointPosition: (id, lat, lon) => {
    set({
      waypoints: get().waypoints.map((wp) =>
        wp.id === id ? { ...wp, lat, lon } : wp
      ),
    });
  },

  updateLeg: (id, data) => {
    set({
      legs: get().legs.map((leg) => {
        if (leg.id !== id) return leg;
        const updated = { ...leg, ...data };
        return recalculateLeg(updated);
      }),
    });
  },

  reorderWaypoints: (newOrder) => {
    const { waypoints, legs } = get();
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

  updateSettings: (settings) => set({ settings }),

  resetItinerary: () => set({ ...initialState, itineraryId: generateId(), createdAt: new Date().toISOString() }),

  loadItinerary: (id, name, waypoints, legs, createdAt) => {
    const wpIds = new Set(waypoints.map((w) => w.id));
    const validLegs = legs.filter(
      (l) => wpIds.has(l.fromWaypointId) && wpIds.has(l.toWaypointId)
    );
    set({
      itineraryId: id,
      itineraryName: name,
      createdAt: createdAt ?? new Date().toISOString(),
      waypoints,
      legs: validLegs,
    });
  },
}));
