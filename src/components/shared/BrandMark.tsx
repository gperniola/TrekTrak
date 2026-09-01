/**
 * Wordmark TrekTrak: pittogramma "vetta" in un badge con gradiente verde +
 * testo "TrekTrak" con gradiente tenue. Coerente col tema del popup di invito.
 */
export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const badge = size === 'sm' ? 'h-6 w-6 text-[13px]' : 'h-7 w-7 text-[15px]';
  const word = size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span
        className={`${badge} grid place-items-center rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 text-black font-black shadow-sm shadow-emerald-900/40 ring-1 ring-white/10`}
        aria-hidden="true"
      >
        &#9650;
      </span>
      <span className={`${word} font-extrabold tracking-tight bg-gradient-to-r from-green-300 to-emerald-400 bg-clip-text text-transparent`}>
        TrekTrak
      </span>
    </span>
  );
}
