'use client';

import { useState, useRef, useEffect } from 'react';
import type { ValidationResult } from '@/lib/types';
import { ValidationBadge, type ValidationFieldType } from '@/components/validation/ValidationBadge';

interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  validation?: ValidationResult;
  validationFieldType?: ValidationFieldType;
  placeholder?: string;
  readOnly?: boolean;
  highlight?: boolean;
  info?: string;
}

export function NumberInput({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  validation,
  validationFieldType,
  placeholder,
  readOnly,
  highlight,
  info,
}: NumberInputProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!infoOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [infoOpen]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className={`text-xs uppercase ${highlight ? 'text-amber-400 font-medium' : 'text-gray-400'}`}>
          {label}
          {unit && <span className={highlight ? 'text-amber-500' : 'text-gray-500'}> ({unit})</span>}
        </span>
        {info && (
          <span ref={infoRef} className="relative inline-flex">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setInfoOpen((p) => !p); }}
              className="text-gray-500 hover:text-gray-300 text-xs leading-none"
              aria-label={`Info: ${label}`}
            >
              ⓘ
            </button>
            {infoOpen && (
              <div role="tooltip" className="absolute left-1/2 -translate-x-1/2 top-5 z-[1300] bg-gray-800 border border-gray-600 rounded px-2 py-1 text-[10px] text-gray-300 shadow-lg max-w-[180px] leading-tight">
                {info}
              </div>
            )}
          </span>
        )}
        <ValidationBadge result={validation} fieldType={validationFieldType} />
      </div>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          if (readOnly) return;
          const v = e.target.value;
          if (v === '') { onChange(null); return; }
          let num = Number(v);
          if (!Number.isFinite(num)) { onChange(null); return; }
          if (min != null && num < min) num = min;
          if (max != null && num > max) num = max;
          onChange(num);
        }}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        aria-label={`${label}${unit ? ` (${unit})` : ''}`}
        className={`bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none ${
          readOnly
            ? 'opacity-60 cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'
            : 'focus:border-green-500'
        }`}
      />
    </div>
  );
}
