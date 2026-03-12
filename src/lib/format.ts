export function formatTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '0h 0m';
  const totalMinutes = Math.round(minutes);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+$/, '')
    .trimEnd()
    .substring(0, 100) || 'trektrak';
  return WINDOWS_RESERVED.test(cleaned) ? `_${cleaned}` : cleaned;
}
