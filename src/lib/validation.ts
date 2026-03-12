import type { ValidationResult, ValidationStatus } from './types';

export function determineStatus(
  userValue: number,
  realValue: number,
  strictTolerance: number,
  looseTolerance: number
): ValidationStatus {
  const delta = Math.abs(userValue - realValue);
  if (delta <= strictTolerance) return 'valid';
  if (delta <= looseTolerance) return 'warning';
  return 'error';
}

export function validateValue(
  userValue: number,
  realValue: number,
  tolerance: { strict: number; loose: number }
): ValidationResult {
  const delta = Math.abs(userValue - realValue);
  if (!Number.isFinite(delta)) {
    return { status: 'error', userValue, realValue, delta: Infinity, tolerance };
  }
  const status = determineStatus(userValue, realValue, tolerance.strict, tolerance.loose);
  return {
    status,
    userValue,
    realValue,
    delta,
    tolerance,
  };
}

export function validateAzimuth(
  userValue: number,
  realValue: number,
  tolerance: { strict: number; loose: number }
): ValidationResult {
  // Compute shortest angular distance (handles 0/360 wraparound)
  let delta = userValue - realValue;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const absDelta = Math.abs(delta);
  const status = absDelta <= tolerance.strict ? 'valid'
    : absDelta <= tolerance.loose ? 'warning'
    : 'error';
  return {
    status,
    userValue,
    realValue,
    delta: absDelta,
    tolerance,
  };
}

export function percentageTolerance(
  referenceValue: number,
  percentStrict: number
): { strict: number; loose: number } {
  const strict = Math.abs(referenceValue) * (percentStrict / 100);
  return { strict, loose: strict * 2 };
}
