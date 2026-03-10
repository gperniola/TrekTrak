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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown) => item != null && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string'
    ) as Itinerary[];
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
  try {
    localStorage.setItem(KEYS.itineraries, JSON.stringify(all));
  } catch {
    throw new Error('Spazio di archiviazione esaurito');
  }
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
    const parsed = JSON.parse(raw);
    if (typeof parsed?.tolerances !== 'object' || parsed.tolerances == null) {
      return { tolerances: { ...DEFAULT_TOLERANCES } };
    }
    return {
      tolerances: {
        ...DEFAULT_TOLERANCES,
        ...Object.fromEntries(
          Object.entries(parsed.tolerances).filter(
            ([, v]) => typeof v === 'number' && Number.isFinite(v as number) && (v as number) >= 0
          )
        ),
      },
    };
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
