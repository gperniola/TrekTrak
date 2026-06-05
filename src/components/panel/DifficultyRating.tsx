'use client';

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Passeggiata di salute',
  2: 'Facile',
  3: 'Medio',
  4: 'Difficile',
  5: 'Kitemmurt',
};

type Level = 1 | 2 | 3 | 4 | 5;

/**
 * Selettore/visualizzatore di difficoltà percepita 1-5 (scarponi).
 * Editable: 5 bottoni; readOnly: scarponi + etichetta.
 */
export function DifficultyRating({
  value, onChange, readOnly = false,
}: {
  value: Level | undefined;
  onChange?: (v: Level) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    if (!value) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-300" title={DIFFICULTY_LABELS[value]}>
        <span aria-hidden="true">{'🥾'.repeat(value)}</span>
        <span className="text-gray-500">{DIFFICULTY_LABELS[value]}</span>
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-1" role="group" aria-label="Difficoltà percepita">
        {([1, 2, 3, 4, 5] as Level[]).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange?.(lvl)}
            aria-label={`${lvl} — ${DIFFICULTY_LABELS[lvl]}`}
            aria-pressed={value === lvl}
            className={`text-lg leading-none transition-transform active:scale-90 ${value && lvl <= value ? 'opacity-100' : 'opacity-30 grayscale'}`}
          >
            🥾
          </button>
        ))}
      </div>
      {value && <div className="text-[11px] text-gray-400">{DIFFICULTY_LABELS[value]}</div>}
    </div>
  );
}
