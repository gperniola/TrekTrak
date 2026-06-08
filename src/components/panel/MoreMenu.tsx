'use client';

import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadGPX } from '@/lib/export-gpx';
import { buildMeteoUrl } from '@/lib/meteo';
import { calculateDifficulty } from '@/lib/calculations';
import { toast } from '@/stores/notificationStore';

/** Menu "Altro" della bottom nav (mobile): meteo + export del percorso corrente. */
export function MoreMenu() {
  const open = useUIStore((s) => s.moreMenuOpen);
  const setOpen = useUIStore((s) => s.setMoreMenuOpen);
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  if (!open) return null;

  const validCoord = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  const canPdf = waypoints.length >= 2;
  const canGpx = validCoord.length >= 2;
  const meteoUrl = buildMeteoUrl(waypoints);
  const close = () => setOpen(false);

  const handlePdf = async (format: 'summary' | 'roadbook') => {
    if (!canPdf) { toast.warning('Servono almeno 2 waypoint'); return; }
    const totalDistance = legs.reduce((s, l) => s + (l.distance ?? 0), 0);
    const totalGain = legs.reduce((s, l) => s + (l.elevationGain ?? 0), 0);
    const totalLoss = legs.reduce((s, l) => s + (l.elevationLoss ?? 0), 0);
    const totalTime = legs.reduce((s, l) => s + (l.estimatedTime ?? 0), 0);
    const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));
    const { downloadPDF } = await import('@/lib/export-pdf');
    downloadPDF({ name: itineraryName, waypoints, legs, totalDistance, totalElevGain: totalGain, totalElevLoss: totalLoss, totalTime, difficulty: calculateDifficulty(maxSlope) }, format);
    close();
  };
  const handleGpx = () => {
    if (!canGpx) { toast.warning('Servono almeno 2 waypoint con coordinate'); return; }
    downloadGPX(itineraryName, waypoints, legs);
    close();
  };
  const handleMeteo = () => { if (meteoUrl) { window.open(meteoUrl, '_blank'); close(); } };

  const itemCls = 'w-full text-left px-3 min-h-[44px] flex items-center gap-2 text-sm text-gray-200 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="lg:hidden fixed inset-0 z-[1150]" onClick={close}>
      <div
        role="menu"
        aria-label="Altro"
        onClick={(e) => e.stopPropagation()}
        className="absolute left-2 right-2 bottom-[60px] bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-1 space-y-0.5"
      >
        <button role="menuitem" disabled={!meteoUrl} onClick={handleMeteo} className={itemCls}>☀️ Meteo</button>
        <button role="menuitem" disabled={!canPdf} onClick={() => handlePdf('summary')} className={itemCls}>📄 PDF sintetico</button>
        <button role="menuitem" disabled={!canPdf} onClick={() => handlePdf('roadbook')} className={itemCls}>📋 PDF roadbook</button>
        <button role="menuitem" disabled={!canGpx} onClick={handleGpx} className={itemCls}>🛰️ GPX</button>
      </div>
    </div>
  );
}
