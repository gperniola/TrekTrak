'use client';

import { useState, useRef, useEffect } from 'react';
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

function formatValue(value: number, label?: string): string {
  if (label === 'azimuth') return `${value.toFixed(1)}°`;
  if (label === 'distance') return `${value.toFixed(3)} km`;
  return `${Math.round(value)}`;
}

export function ValidationBadge({ result, fieldType }: { result?: ValidationResult; fieldType?: string }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!result || result.status === 'unverified') return null;

  return (
    <span ref={popoverRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold cursor-pointer ${STATUS_STYLES[result.status]}`}
        aria-label={`Dettaglio validazione: ${result.status}`}
        aria-expanded={open}
      >
        {STATUS_LABELS[result.status]}
      </button>
      {open && result.realValue != null && (
        <div className="absolute left-0 top-7 z-[1300] bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white shadow-lg whitespace-nowrap">
          <div>Valore calcolato: <span className="font-bold text-green-400">{formatValue(result.realValue, fieldType)}</span></div>
          {result.delta != null && (
            <div className="text-gray-400 mt-0.5">Scarto: {result.delta.toFixed(2)}</div>
          )}
        </div>
      )}
    </span>
  );
}
