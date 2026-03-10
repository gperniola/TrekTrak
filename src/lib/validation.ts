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
  const status = determineStatus(userValue, realValue, tolerance.strict, tolerance.loose);
  return {
    status,
    userValue,
    realValue,
    delta,
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
