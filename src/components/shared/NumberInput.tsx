'use client';

import type { ValidationResult } from '@/lib/types';
import { ValidationBadge } from '@/components/validation/ValidationBadge';

interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  validation?: ValidationResult;
  placeholder?: string;
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
  placeholder,
}: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 uppercase flex items-center gap-1">
        {label}
        {unit && <span className="text-gray-500">({unit})</span>}
        <ValidationBadge result={validation} />
      </label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        className="bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
      />
    </div>
  );
}
