'use client';

import { useState, useRef, useEffect } from 'react';
import type { ValidationResult, ValidationFieldType } from '@/lib/types';
import { ValidationBadge } from '@/components/validation/ValidationBadge';

/**
 * Legge un numero scritto **all'italiana o all'inglese**: `1,5` e `1.5` valgono
 * entrambi 1,5.
 *
 * Prima il campo era `type="number"`, e il browser scartava la virgola: il valore
 * diventava stringa vuota, cioe' chi scriveva "1,5" vedeva il campo svuotarsi mentre
 * inseriva distanze e azimut, che e' l'attivita' principale dell'app. Ora la
 * conversione la facciamo noi, e il campo e' di testo con tastiera decimale.
 *
 * `null` significa "non e' (ancora) un numero": vale sia per il campo vuoto, sia per
 * `-` o `1,` appena battuti, sia per testo non numerico. Chi chiama distingue i tre
 * casi guardando anche il testo, che resta a schermo.
 */
export function parseDecimale(testo: string, migliaia = false): number | null {
  const grezzo = testo.trim();
  if (grezzo === '') return null;

  /*
   * Separatore delle MIGLIAIA, non decimale.
   *
   * In italiano "1.500" sono millecinquecento, e nei campi in metri — quota, dislivelli
   * — e' la scrittura naturale: nessuno inserisce un dislivello di un metro e mezzo.
   * Senza questa regola chi scriveva 1.500 m di quota otteneva **1,5**, in silenzio.
   *
   * La regola e' quella tipografica: separatore seguito da esattamente tre cifre, e
   * nient'altro dopo. Cosi' "1.5" resta uno e mezzo (che in metri e' improbabile ma
   * innocuo) e non diventa quindici, che sarebbe una sorpresa peggiore del problema.
   */
  if (migliaia && /^-?\d{1,3}([.,]\d{3})+$/.test(grezzo)) {
    const n = Number(grezzo.replace(/[.,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  const pulito = grezzo.replace(',', '.');
  // Una sola forma ammessa: segno opzionale, cifre, un punto, cifre. Cosi' `1.2.3`,
  // `1e5` e `abc` valgono tutti "non e' un numero" invece di diventare qualcos'altro.
  if (!/^-?\d*\.?\d*$/.test(pulito)) return null;
  const n = Number(pulito);
  return Number.isFinite(n) ? n : null;
}

interface NumberInputProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  /**
   * HTML5 `step` attribute. Defaults to `"any"` so the browser does not flag
   * fractional values (like reverse-geocoded coordinates with 14 decimals) as
   * `:invalid`. Pass a numeric step when the field is genuinely stepped.
   */
  step?: number | 'any';
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
  step = 'any',
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

  // Il testo battuto vive qui, non nello store: `1,` e `-` non sono numeri, ma devono
  // restare a schermo mentre si scrive. Lo store riceve solo numeri o null.
  const [testo, setTesto] = useState(value == null ? '' : String(value));

  // Riallineo solo quando il valore cambia DAVVERO da fuori (modalita' Track che
  // compila, ripristino all'avvio): senza il confronto, ogni battuta rimbalzerebbe
  // indietro normalizzata e cancellerebbe la virgola appena scritta.
  // I campi in metri (quota, dislivelli) portano numeri interi: la' punto e virgola
  // sono separatori delle migliaia. Nei campi in km o gradi restano decimali.
  const migliaia = unit === 'm';

  useEffect(() => {
    if (parseDecimale(testo, migliaia) !== value) setTesto(value == null ? '' : String(value));
    // `testo` volutamente fuori dalle dipendenze: qui interessa solo l'arrivo di un
    // valore nuovo dall'esterno.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, migliaia]);

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
        // Di testo, non `number`: la conversione la fa `parseDecimale`, che accetta
        // anche la virgola. `inputMode="decimal"` chiede comunque al sistema la
        // tastiera numerica col separatore, anche su iOS.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={testo}
        onChange={(e) => {
          if (readOnly) return;
          const grezzo = e.target.value;
          const num = parseDecimale(grezzo, migliaia);
          // Testo non numerico: non si tiene a schermo (diventerebbe un campo che
          // mostra "abc" con valore null) e non diventa 0.
          setTesto(num == null && grezzo.trim() !== '' && !/^-?[\d.,]*$/.test(grezzo.trim()) ? '' : grezzo);
          if (num == null) { onChange(null); return; }
          let limitato = num;
          if (min != null && limitato < min) limitato = min;
          if (max != null && limitato > max) limitato = max;
          if (limitato !== num) setTesto(String(limitato));
          onChange(limitato);
        }}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        data-step={step}
        placeholder={placeholder}
        aria-label={`${label}${unit ? ` (${unit})` : ''}`}
        className={`bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none max-lg:min-h-[44px] ${
          readOnly
            ? 'opacity-60 cursor-not-allowed'
            : 'focus:border-green-500'
        }`}
      />
    </div>
  );
}
