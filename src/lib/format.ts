export function formatTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '0h 0m';
  const totalMinutes = Math.round(minutes);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+$/, '')
    .substring(0, 100) || 'trektrak';
}
