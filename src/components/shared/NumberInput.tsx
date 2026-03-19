'use client';

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
}: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400 uppercase">
          {label}
          {unit && <span className="text-gray-500"> ({unit})</span>}
        </span>
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
