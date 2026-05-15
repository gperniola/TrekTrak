import type { Itinerary, AppSettings, ValidationSession } from './types';
import { DEFAULT_TOLERANCES, DEFAULT_MAP_DISPLAY, BASE_MAPS, SAMPLE_INTERVAL_OPTIONS } from './types';

export const SCHEMA_VERSION = 1;

export const KEYS = {
  itineraries: 'trektrak_itineraries',
  settings: 'trektrak_settings',
  learningHistory: 'trektrak_learning_history',
  schema: 'trektrak_schema_version',
  tutorialSeen: 'trektrak_tutorial_seen',
  whatsNewVersion: 'trektrak_whatsnew_version',
  quizHistory: 'trektrak_quiz_history',
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

function isNumberOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && Number.isFinite(v));
}

function isValidWaypoint(item: unknown): boolean {
  if (item == null || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.name === 'string' &&
    isNumberOrNull(rec.lat) &&
    isNumberOrNull(rec.lon) &&
    isNumberOrNull(rec.altitude) &&
    typeof rec.order === 'number' && Number.isFinite(rec.order)
  );
}

function isValidLeg(item: unknown): boolean {
  if (item == null || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.fromWaypointId === 'string' &&
    typeof rec.toWaypointId === 'string' &&
    isNumberOrNull(rec.distance) &&
    isNumberOrNull(rec.elevationGain) &&
    isNumberOrNull(rec.elevationLoss) &&
    isNumberOrNull(rec.azimuth)
  );
}

export function loadItineraries(): Itinerary[] {
  initSchema();
  try {
    const raw = localStorage.getItem(KEYS.itineraries);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown) => {
        if (item == null || typeof item !== 'object') return false;
        const rec = item as Record<string, unknown>;
        if (typeof rec.id !== 'string') return false;
        if (typeof rec.name !== 'string') return false;
        if (!Array.isArray(rec.waypoints) || !rec.waypoints.every(isValidWaypoint)) return false;
        if (!Array.isArray(rec.legs) || !rec.legs.every(isValidLeg)) return false;
        return true;
      }
    ) as Itinerary[];
  } catch {
    return [];
  }
}

export function saveItinerary(itinerary: Itinerary): void {
  initSchema();
  const all = loadItineraries();
  const idx = all.findIndex((it) => it.id === itinerary.id);
  const cleaned = {
    ...itinerary,
    legs: itinerary.legs.map(({ elevationProfile, ...leg }) => leg),
  };
  if (idx >= 0) {
    all[idx] = cleaned;
  } else {
    all.push(cleaned);
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
    if (!raw) return { tolerances: { ...DEFAULT_TOLERANCES }, mapDisplay: { ...DEFAULT_MAP_DISPLAY } };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.tolerances !== 'object' || parsed.tolerances == null) {
      return { tolerances: { ...DEFAULT_TOLERANCES }, mapDisplay: { ...DEFAULT_MAP_DISPLAY } };
    }
    const settings = {
      tolerances: {
        ...DEFAULT_TOLERANCES,
        ...Object.fromEntries(
          Object.entries(parsed.tolerances).filter(
            ([k, v]) => k in DEFAULT_TOLERANCES && typeof v === 'number' && Number.isFinite(v as number) && (v as number) > 0
          )
        ),
      },
      mapDisplay: {
        ...DEFAULT_MAP_DISPLAY,
        ...Object.fromEntries(
          Object.entries(
            typeof parsed?.mapDisplay === 'object' && parsed.mapDisplay != null ? parsed.mapDisplay : {}
          ).filter(([k, v]) => {
            if (!(k in DEFAULT_MAP_DISPLAY)) return false;
            if (k === 'sampleInterval') return typeof v === 'number' && SAMPLE_INTERVAL_OPTIONS.some((o) => o.value === v);
            if (k === 'baseMap') return typeof v === 'string' && BASE_MAPS.some((m) => m.id === v);
            return typeof v === 'boolean';
          })
        ),
      },
    };
    // If the saved baseMap is no longer available at runtime (e.g., user removed the
    // Thunderforest API key), fall back to the first available map to avoid a broken tile layer.
    const chosenMap = BASE_MAPS.find((m) => m.id === settings.mapDisplay.baseMap);
    if (!chosenMap || !chosenMap.available) {
      const fallback = BASE_MAPS.find((m) => m.available);
      if (fallback) settings.mapDisplay.baseMap = fallback.id;
    }
    return settings;
  } catch {
    return { tolerances: { ...DEFAULT_TOLERANCES }, mapDisplay: { ...DEFAULT_MAP_DISPLAY } };
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

const MAX_VALIDATION_SESSIONS = 100;

const VALID_FIELDS = new Set(['altitude', 'distance', 'elevationGain', 'elevationLoss', 'azimuth']);
const VALID_STATUSES = new Set(['valid', 'warning', 'error']);

function isValidSession(item: unknown): item is ValidationSession {
  if (item == null || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  if (typeof rec.date !== 'string' || typeof rec.itineraryName !== 'string') return false;
  if (!Array.isArray(rec.results)) return false;
  return rec.results.every((r: unknown) => {
    if (r == null || typeof r !== 'object') return false;
    const res = r as Record<string, unknown>;
    return VALID_FIELDS.has(res.field as string)
      && VALID_STATUSES.has(res.status as string)
      && typeof res.delta === 'number' && Number.isFinite(res.delta)
      && typeof res.tolerance === 'object' && res.tolerance != null
      && typeof (res.tolerance as Record<string, unknown>).strict === 'number'
      && typeof (res.tolerance as Record<string, unknown>).loose === 'number';
  });
}

export function loadValidationHistory(): ValidationSession[] {
  try {
    const raw = localStorage.getItem(KEYS.learningHistory);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSession);
  } catch {
    return [];
  }
}

export function saveValidationSession(session: ValidationSession): void {
  try {
    const history = loadValidationHistory();
    history.push(session);
    const trimmed = history.length > MAX_VALIDATION_SESSIONS
      ? history.slice(history.length - MAX_VALIDATION_SESSIONS)
      : history;
    localStorage.setItem(KEYS.learningHistory, JSON.stringify(trimmed));
  } catch {
    // storage write failed
  }
}

export function clearValidationHistory(): void {
  try {
    localStorage.removeItem(KEYS.learningHistory);
  } catch {
    // storage unavailable
  }
}
