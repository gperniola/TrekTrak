'use client';

import { useState, useRef, useEffect } from 'react';
import type { ValidationResult } from '@/lib/types';

export type ValidationFieldType = 'altitude' | 'distance' | 'azimuth' | 'elevation' | 'elevationGain' | 'elevationLoss';

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

function formatValue(value: number, fieldType?: ValidationFieldType): string {
  if (!Number.isFinite(value)) return '—';
  if (fieldType === 'azimuth') return `${value.toFixed(1)}°`;
  if (fieldType === 'distance') return `${value.toFixed(3)} km`;
  return `${Math.round(value)} m`;
}

function formatDelta(delta: number, fieldType?: ValidationFieldType): string {
  if (!Number.isFinite(delta)) return '—';
  if (fieldType === 'azimuth') return `${delta.toFixed(1)}°`;
  if (fieldType === 'distance') return `${(delta * 1000).toFixed(0)} m`;
  return `${delta.toFixed(0)} m`;
}

export function ValidationBadge({ result, fieldType }: { result?: ValidationResult; fieldType?: ValidationFieldType }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLSpanElement>(null);

  // Close on outside click/touch + Escape key
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!result || result.status === 'unverified') return null;

  return (
    <span ref={popoverRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold cursor-pointer active:scale-110 transition-transform ${STATUS_STYLES[result.status]} relative before:absolute before:inset-[-10px] before:content-['']`}
        aria-label={`Dettaglio validazione: ${result.status}`}
        aria-expanded={open}
      >
        {STATUS_LABELS[result.status]}
      </button>
      {open && result.realValue != null && (
        <div
          role="status"
          className="absolute left-1/2 -translate-x-1/2 top-7 z-[1300] bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white shadow-lg max-w-[200px]"
        >
          <div>Calcolato: <span className="font-bold text-green-400">{formatValue(result.realValue, fieldType)}</span></div>
          {result.delta != null && (
            <div className="text-gray-300 mt-0.5">Scarto: {formatDelta(result.delta, fieldType)}</div>
          )}
        </div>
      )}
    </span>
  );
}
