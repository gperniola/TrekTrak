import type { DifficultyGrade } from './types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function forwardAzimuth(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const dLon = toRad(lon2 - lon1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const x = Math.sin(dLon) * Math.cos(lat2R);
  const y =
    Math.cos(lat1R) * Math.sin(lat2R) -
    Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLon);
  const bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export function calculateMunterTime(
  distanceKm: number,
  elevationGainM: number,
  elevationLossM: number
): number {
  const d = Math.max(0, distanceKm);
  const g = Math.max(0, elevationGainM);
  const l = Math.max(0, elevationLossM);
  if (d === 0 && g === 0 && l === 0) return 0;
  const tHoriz = (d / 4) * 60;
  const tVertGain = (g / 400) * 60;
  const tVertLoss = (l / 800) * 60;
  const tVert = Math.max(tVertGain, tVertLoss);
  return Math.max(tHoriz, tVert) + 0.5 * Math.min(tHoriz, tVert);
}

export function calculateSlope(
  distanceKm: number,
  elevationGainM: number,
  elevationLossM: number
): number {
  const d = Math.max(0, distanceKm);
  if (d === 0) return 0;
  const maxElevation = Math.max(0, elevationGainM, elevationLossM);
  return (maxElevation / (d * 1000)) * 100;
}

/**
 * Approximate SAC-style difficulty from slope percentage.
 * Simplified heuristic -- the real SAC scale also considers
 * trail marking, exposure, and terrain type.
 */
export function calculateDifficulty(maxSlopePercent: number): DifficultyGrade {
  if (maxSlopePercent >= 55) return 'T6';
  if (maxSlopePercent >= 45) return 'T5';
  if (maxSlopePercent >= 35) return 'T4';
  if (maxSlopePercent >= 25) return 'T3';
  if (maxSlopePercent >= 15) return 'T2';
  return 'T1';
}

export function azimuthToCardinal(azimuth: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((azimuth % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}
