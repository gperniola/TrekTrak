'use client';

import type { ValidationResult } from '@/lib/types';

const STATUS_STYLES = {
  unverified: 'bg-gray-600 text-gray-300',
  valid: 'bg-green-600 text-green-100',
  warning: 'bg-yellow-600 text-yellow-100',
  error: 'bg-red-600 text-red-100',
} as const;

const STATUS_LABELS = {
  unverified: '?',
  valid: '✓',
  warning: '~',
  error: '✗',
} as const;

export function ValidationBadge({ result }: { result?: ValidationResult }) {
  if (!result || result.status === 'unverified') return null;

  const tooltip =
    result.realValue != null
      ? `Valore reale: ${result.realValue.toFixed(2)}, Delta: ${result.delta?.toFixed(2)}`
      : '';

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${STATUS_STYLES[result.status]}`}
      title={tooltip}
    >
      {STATUS_LABELS[result.status]}
    </span>
  );
}
