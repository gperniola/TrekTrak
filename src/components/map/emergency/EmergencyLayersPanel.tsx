'use client';

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { saveSettings, KEYS } from '@/lib/storage';
import { confirm as appConfirm } from '@/stores/notificationStore';
import { EMERGENCY_LAYERS, type EmergencyLayerDef, type EmergencyLayerId, type EmergencyCategory } from '@/lib/emergency-layers';
import { dayOptions } from '@/lib/dpc';
import type { AppSettings } from '@/lib/types';

const CATEGORY_LABELS: Record<EmergencyCategory, string> = {
  incendi: '🔥 Incendi',
  alluvioni: '🌊 Alluvioni e frane',
};

const DISCLAIMER =
  'I dati provengono da satelliti e bollettini ufficiali ma possono essere incompleti o in ritardo. ' +
  'Non sostituiscono i canali ufficiali di allerta. In caso di emergenza chiama il 112.';

function LayerRow({ def }: { def: EmergencyLayerDef }) {
  const settings = useItineraryStore((s) => s.settings);
  const updateSettings = useItineraryStore((s) => s.updateSettings);
  const runtime = useEmergencyStore((s) => s.layers[def.id]);
  const startLayer = useEmergencyStore((s) => s.startLayer);
  const stopLayer = useEmergencyStore((s) => s.stopLayer);
  const isStale = useEmergencyStore((s) => s.isStale);
  const dpc = useEmergencyStore((s) => s.dpc);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);
  const setDpcSelectedDate = useEmergencyStore((s) => s.setDpcSelectedDate);

  const active = settings.mapDisplay.emergencyLayers.includes(def.id);
  // Guardia anti-rientranza: un secondo tap mentre il disclaimer è in attesa di risposta
  // (await appConfirm) viene ignorato invece di aprire un secondo dialog.
  const pendingRef = useRef(false);

  const persist = (base: AppSettings, list: EmergencyLayerId[]) => {
    const newSettings = { ...base, mapDisplay: { ...base.mapDisplay, emergencyLayers: list } };
    updateSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleToggle = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      // Legge lo stato fresco dello store (non la chiusura di `settings` catturata al render):
      // tra il click e questo punto — e soprattutto dopo l'`await appConfirm` sotto — un altro
      // toggle può aver già aggiornato i settings altrove; costruire la nuova lista da qui evita
      // di sovrascriverlo (stale closure / lost update).
      const base = useItineraryStore.getState().settings;
      const isActiveNow = base.mapDisplay.emergencyLayers.includes(def.id);
      if (isActiveNow) {
        persist(base, base.mapDisplay.emergencyLayers.filter((id) => id !== def.id));
        stopLayer(def.id);
        return;
      }
      let seen = false;
      try { seen = localStorage.getItem(KEYS.emergencyDisclaimer) === '1'; } catch { /* noop */ }
      if (!seen) {
        const ok = await appConfirm({
          title: 'Layer di emergenza', message: DISCLAIMER,
          variant: 'info', confirmText: 'Ho capito', cancelText: 'Annulla',
        });
        if (!ok) return;
        try { localStorage.setItem(KEYS.emergencyDisclaimer, '1'); } catch { /* noop */ }
      }
      const fresh = useItineraryStore.getState().settings;
      if (!fresh.mapDisplay.emergencyLayers.includes(def.id)) {
        persist(fresh, [...fresh.mapDisplay.emergencyLayers, def.id]);
      }
      startLayer(def.id);
    } finally {
      pendingRef.current = false;
    }
  };

  return (
    <div className="py-2 border-b border-gray-700 last:border-0">
      <div className="flex items-center justify-between max-lg:min-h-[44px]">
        <div className="pr-2">
          <div className="text-sm text-gray-100">{def.label}</div>
          <div className="text-[10px] text-gray-400">{def.description}</div>
        </div>
        <button
          role="switch"
          aria-checked={active}
          aria-label={def.label}
          onClick={handleToggle}
          className="relative shrink-0 flex items-center justify-center max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-2"
        >
          <span className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-amber-500' : 'bg-gray-600'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${active ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      </div>

      {active && (
        <div className="mt-1 space-y-1">
          <div className="flex flex-wrap gap-2">
            {def.legend.map((e) => (
              <span key={e.label} className="flex items-center gap-1 text-[10px] text-gray-300">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: e.color }} />
                {e.label}
              </span>
            ))}
          </div>
          {runtime.status === 'loading' && <div className="text-[10px] text-gray-400">Caricamento...</div>}
          {runtime.status === 'error' && (
            <div className="text-[10px] text-red-400">⚠ {runtime.error}</div>
          )}
          {runtime.lastFetch != null && def.refreshMinutes != null && (
            <div className="text-[10px] text-gray-400">
              Aggiornato alle {new Date(runtime.lastFetch).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              {isStale(def.id) && <span className="text-amber-400 ml-1">⚠ dati non aggiornati</span>}
            </div>
          )}
          {def.id === 'dpc-alerts' && dpc && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {dayOptions(dpc.days.map((d) => d.date), new Date()).map((o) => (
                  <button
                    key={o.date}
                    disabled={o.disabled}
                    onClick={() => setDpcSelectedDate(o.date)}
                    className={`px-2 py-1 rounded text-[10px] ${
                      o.date === dpcSelectedDate ? 'bg-amber-500 text-black font-bold' : 'bg-gray-700 text-gray-300'
                    } disabled:opacity-40`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-gray-400">Bollettino del {dpc.issuedLabel}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

export function EmergencyLayersPanel() {
  const open = useUIStore((s) => s.emergencyPanelOpen);
  const setOpen = useUIStore((s) => s.setEmergencyPanelOpen);
  const activeIds = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, setOpen]);

  if (!open) return null;

  const categories = Array.from(new Set(EMERGENCY_LAYERS.map((l) => l.category)));
  const activeDefs = EMERGENCY_LAYERS.filter((l) => activeIds.includes(l.id));
  const sourcesText = activeDefs.length > 0
    ? 'Fonti: ' + activeDefs.map((d) => stripHtml(d.attribution)).join(' · ')
    : null;

  return (
    <div
      role="dialog"
      aria-label="Layer di emergenza"
      className="absolute bottom-16 right-14 z-[1000] w-72 max-h-[70vh] overflow-y-auto bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3
                 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:right-auto max-lg:w-full max-lg:rounded-b-none max-lg:z-[1190] max-lg:max-h-[60vh]"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-200">Layer di emergenza</span>
        <button onClick={() => setOpen(false)} aria-label="Chiudi" className="text-gray-500 hover:text-white max-lg:min-h-[44px] max-lg:min-w-[44px]">✕</button>
      </div>
      {categories.map((cat) => (
        <div key={cat} className="mb-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-2">{CATEGORY_LABELS[cat]}</div>
          {EMERGENCY_LAYERS.filter((l) => l.category === cat).map((def) => (
            <LayerRow key={def.id} def={def} />
          ))}
        </div>
      ))}
      <div className="text-[9px] text-gray-500 mt-2">{DISCLAIMER}</div>
      {sourcesText && (
        <div className="text-[9px] text-gray-500 mt-1">{sourcesText}</div>
      )}
    </div>
  );
}
