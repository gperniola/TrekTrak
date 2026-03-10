import type { Itinerary, AppSettings } from './types';
import { DEFAULT_TOLERANCES } from './types';

export const SCHEMA_VERSION = 1;

const KEYS = {
  itineraries: 'trektrak_itineraries',
  settings: 'trektrak_settings',
  learningHistory: 'trektrak_learning_history',
  schema: 'trektrak_schema_version',
} as const;

const STORAGE_WARNING_BYTES = 4 * 1024 * 1024; // 4MB

function initSchema(): void {
  try {
    const version = localStorage.getItem(KEYS.schema);
    if (!version) {
      localStorage.setItem(KEYS.schema, String(SCHEMA_VERSION));
    }
  } catch {
    // localStorage not available (private browsing, quota exceeded, etc.)
  }
}

export function loadItineraries(): Itinerary[] {
  initSchema();
  try {
    const raw = localStorage.getItem(KEYS.itineraries);
    if (!raw) return [];
    return JSON.parse(raw) as Itinerary[];
  } catch {
    return [];
  }
}

export function saveItinerary(itinerary: Itinerary): void {
  initSchema();
  const all = loadItineraries();
  const idx = all.findIndex((it) => it.id === itinerary.id);
  if (idx >= 0) {
    all[idx] = itinerary;
  } else {
    all.push(itinerary);
  }
  localStorage.setItem(KEYS.itineraries, JSON.stringify(all));
}

export function deleteItinerary(id: string): void {
  const all = loadItineraries().filter((it) => it.id !== id);
  try {
    localStorage.setItem(KEYS.itineraries, JSON.stringify(all));
  } catch {
    // storage write failed
  }
}

export function loadSettings(): AppSettings {
  initSchema();
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return { tolerances: { ...DEFAULT_TOLERANCES } };
    return JSON.parse(raw) as AppSettings;
  } catch {
    return { tolerances: { ...DEFAULT_TOLERANCES } };
  }
}

export function saveSettings(settings: AppSettings): void {
  initSchema();
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  } catch {
    // storage write failed
  }
}

export function getStorageUsage(): number {
  let total = 0;
  try {
    for (const key of Object.values(KEYS)) {
      const value = localStorage.getItem(key);
      if (value) total += key.length + value.length;
    }
  } catch {
    return 0;
  }
  return total * 2; // UTF-16 = 2 bytes per char
}

export function isStorageNearLimit(): boolean {
  return getStorageUsage() > STORAGE_WARNING_BYTES;
}
