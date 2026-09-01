'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import type { ValidationResult, ValidationFieldType } from '@/lib/types';
import { getTip, getTermini } from '@/lib/didactic-tips';
import { computeCategoryStats, staMigliorando } from '@/lib/learning-stats';
import { loadValidationHistory } from '@/lib/storage';
import { GLOSSARIO, type Termine } from '@/lib/glossario';
import { ContenutoGlossario } from '@/components/shared/TermineGlossario';
import { gradi, km, metri } from '@/lib/formato';
import { mostra } from '@/lib/profilo';
import { useUIStore } from '@/stores/uiStore';

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

/**
 * Il valore calcolato e' il numero piu' importante della modalita' Learn: e' quello con
 * cui il principiante confronta la propria stima. Va scritto come lo scriverebbe lui,
 * perche' prima diceva `Calcolato: 3.161 km` — che in italiano si legge 3161 km, e in
 * un campo in metri l'app lo interpreta proprio cosi'.
 */
function formatValue(value: number, fieldType?: ValidationFieldType): string {
  if (!Number.isFinite(value)) return '—';
  if (fieldType === 'azimuth') return gradi(value);
  if (fieldType === 'distance') return km(value, 3);
  return metri(Math.round(value));
}

function formatDelta(delta: number, fieldType?: ValidationFieldType): string {
  if (!Number.isFinite(delta)) return '—';
  if (fieldType === 'azimuth') return gradi(delta);
  // Lo scarto di una distanza si legge in metri: "761 m" invece di "0,761 km".
  if (fieldType === 'distance') return metri(Math.round(delta * 1000));
  return metri(Math.round(delta));
}

/**
 * Il nome accessibile diceva la parola interna dello stato: "Dettaglio validazione:
 * error". Chi usa un lettore di schermo si sentiva leggere meta' italiano e meta'
 * enum, sul riscontro didattico che e' il cuore dell'app.
 */
const DESCRIZIONE_STATO = {
  unverified: 'non ancora verificato',
  valid: 'valore corretto',
  warning: 'valore quasi corretto',
  error: 'valore sbagliato',
} as const;

export function ValidationBadge({ result, fieldType }: { result?: ValidationResult; fieldType?: ValidationFieldType }) {
  const [open, setOpen] = useState(false);
  const [popoverBelow, setPopoverBelow] = useState(false);
  /**
   * Quale termine si sta leggendo dentro il popover. Si azzera quando il popover si
   * chiude: riaprendolo si vuole il suggerimento, non la definizione lasciata a meta'.
   */
  const [termineAperto, setTermineAperto] = useState<Termine | null>(null);
  /*
   * Il rinforzo positivo si calcola solo a popover aperto: i badge a schermo possono
   * essere venti, e leggere lo storico dal disco per ognuno a ogni ridisegno sarebbe
   * lavoro buttato. Qui la lettura avviene una volta, quando qualcuno guarda davvero.
   */
  const staMeglio = useMemo(() => {
    if (!open || fieldType == null) return false;
    const stats = computeCategoryStats(loadValidationHistory());
    return staMigliorando(stats[fieldType]?.recentDeltas ?? []);
  }, [open, fieldType]);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevStatusRef = useRef<string | undefined>(undefined);
  const [animating, setAnimating] = useState(false);
  const profilo = useUIStore((s) => s.profilo);

  // Trigger pop animation when badge appears for the first time
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = result?.status;
    prevStatusRef.current = currentStatus;

    if (
      currentStatus &&
      currentStatus !== 'unverified' &&
      (!prevStatus || prevStatus === 'unverified')
    ) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [result?.status]);

  // Close on outside click/touch + Escape key
  useEffect(() => {
    if (!open) return;
    const chiudi = () => { setOpen(false); setTermineAperto(null); };
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) chiudi();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chiudi();
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

  /*
   * In Montagna i valori li calcola l'app: non c'e' nulla da verificare, e i badge
   * sarebbero venti pulsanti che non dicono niente di utile.
   *
   * Una guardia sola QUI invece di una in ogni scheda: il badge e' l'unico punto da cui
   * la validazione arriva a schermo — compreso il suggerimento didattico, che vive nel
   * suo popover — quindi non se ne dimentica una. E sta dopo gli hook, non prima.
   */
  if (!mostra('validazione', profilo)) return null;
  if (!result || result.status === 'unverified') return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverBelow(rect.top < window.innerHeight * 0.25);
    }
    setOpen((p) => {
      if (p) setTermineAperto(null);
      return !p;
    });
  };

  const tip = fieldType ? getTip(fieldType, result.delta, result.tolerance) : null;
  const termini = fieldType ? getTermini(fieldType) : [];

  return (
    <span ref={popoverRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold cursor-pointer active:scale-110 transition-transform ${STATUS_STYLES[result.status]} ${animating ? 'animate-badge-pop' : ''} relative before:absolute before:inset-[-10px] before:content-['']`}
        aria-label={`${DESCRIZIONE_STATO[result.status]}, apri il dettaglio`}
        aria-expanded={open}
      >
        {STATUS_LABELS[result.status]}
      </button>
      {open && result.realValue != null && (
        <div
          role="status"
          className={`absolute left-1/2 -translate-x-1/2 ${popoverBelow ? 'top-7' : 'bottom-7'} z-[1300] bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white shadow-lg max-w-[220px]`}
        >
          <div>Calcolato: <span className="font-bold text-green-400">{formatValue(result.realValue, fieldType)}</span></div>
          {result.delta != null && (
            <div className="text-gray-300 mt-0.5">Scarto: {formatDelta(result.delta, fieldType)}</div>
          )}
          {tip && (
            <div className="text-[10px] mt-1.5 leading-tight border-t border-gray-700 pt-1.5">
              {/*
                La definizione si apre QUI DENTRO e non in un popover suo: un popover
                dentro un popover si posiziona rispetto al pulsantino e finisce per
                coprire il suggerimento che dovrebbe spiegare.
              */}
              {termineAperto == null ? (
                <>
                  <div className="text-amber-300 italic">💡 {tip}</div>
                  {/*
                    Detto DOPO il suggerimento e non al posto suo: l'errore appena fatto
                    resta la cosa da leggere, questo e' il contorno. Compare solo col
                    verso positivo e con abbastanza sessioni alle spalle — un
                    incoraggiamento dato sul rumore e' una frase falsa.
                  */}
                  {staMeglio && (
                    <div className="text-green-400 mt-1">
                      📈 Su questo tipo di errore stai migliorando.
                    </div>
                  )}
                  {termini.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="text-gray-500">Che cos&rsquo;è:</span>
                      {termini.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setTermineAperto(t); }}
                          className="underline decoration-dotted text-gray-300 hover:text-white"
                        >
                          {GLOSSARIO[t].titolo}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <ContenutoGlossario termine={termineAperto} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setTermineAperto(null); }}
                    className="mt-1.5 text-gray-400 hover:text-white underline decoration-dotted"
                  >
                    &lsquo; torna al suggerimento
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
