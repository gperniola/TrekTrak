'use client';

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { saveSettings, KEYS } from '@/lib/storage';
import { confirm as appConfirm } from '@/stores/notificationStore';
import { EMERGENCY_LAYERS, stripAttributionMarkup, type EmergencyLayerDef, type EmergencyLayerId, type EmergencyCategory } from '@/lib/emergency-layers';
import { dayOptions } from '@/lib/dpc';
import { useMapOverlayGuard } from '../useMapOverlayGuard';
import { useOnline } from '@/lib/useOnline';
import type { AppSettings } from '@/lib/types';

const CATEGORY_LABELS: Record<EmergencyCategory, string> = {
  incendi: '🔥 Incendi',
  temporali: '⛈️ Pioggia e temporali',
  alluvioni: '🌊 Alluvioni e frane',
  ripari: '🏠 Dove ripararsi',
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
  const retryLayer = useEmergencyStore((s) => s.retryLayer);
  const isStale = useEmergencyStore((s) => s.isStale);
  // `isStale` legge `Date.now()` in fase di render: senza qualcosa che provochi un
  // nuovo render, il badge "dati non aggiornati" non compariva mai — e cioè proprio
  // quando serve, ossia quando i refresh si sono fermati. `nowTick` (5 min) è quel
  // qualcosa. Serve anche a rietichettare i giorni DPC dopo la mezzanotte.
  const nowTick = useEmergencyStore((s) => s.nowTick);
  const online = useOnline();
  const dpc = useEmergencyStore((s) => s.dpc);
  const radar = useEmergencyStore((s) => s.radar);
  const radarFrame = useEmergencyStore((s) => s.radarFrame);
  const radarPlaying = useEmergencyStore((s) => s.radarPlaying);
  const setRadarFrame = useEmergencyStore((s) => s.setRadarFrame);
  const toggleRadarPlay = useEmergencyStore((s) => s.toggleRadarPlay);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);
  const setDpcSelectedDate = useEmergencyStore((s) => s.setDpcSelectedDate);

  const active = settings.mapDisplay.emergencyLayers.includes(def.id);
  // Giornata calma: bollettino valido, nessuna zona sopra il livello 0. È il caso
  // più frequente, e senza dirlo espressamente resta una mappa vuota da interpretare.
  const selectedDay = dpc?.days.find((d) => d.date === dpcSelectedDate);
  const calmDay = selectedDay != null && selectedDay.zones.every((z) => z.maxLevel === 0);
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
          className="relative shrink-0 flex items-center justify-center rounded max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-2
                     focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
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
          {/* Spec §6: da offline la riga dice "non disponibile offline", non mostra un
              errore di rete. I dati di emergenza sono esclusi dalla cache del service
              worker di proposito, quindi qui non c'è nulla da servire. */}
          {!online && (
            <div className="text-[10px] text-amber-400">⚠ non disponibile offline</div>
          )}
          {online && runtime.status === 'loading' && <div className="text-[10px] text-gray-400">Caricamento...</div>}
          {online && runtime.status === 'error' && (
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-red-400 flex-1">⚠ {runtime.error}</div>
              {/*
                Spegnere e riaccendere e' quello che si sarebbe dovuto fare a mano:
                farlo con un pulsante evita di far scoprire all'utente un rimedio che
                sembra un trucco. `stopLayer` butta il payload, che in errore non c'e'
                comunque.
              */}
              <button
                onClick={() => retryLayer(def.id)}
                className="shrink-0 px-2 py-0.5 text-[10px] rounded bg-gray-700 hover:bg-gray-600 text-gray-100 max-lg:min-h-[32px]"
              >
                Riprova
              </button>
            </div>
          )}
          {/* Spec §6: "nessun dato disponibile" non è un guasto — la fonte ha risposto,
              per il giorno corrente non c'è nulla. Va detto, non lasciato indovinare
              da una mappa vuota. */}
          {runtime.status === 'nodata' && (
            <div className="text-[10px] text-gray-300">Nessun dato disponibile{runtime.error ? ` — ${runtime.error}` : ''}</div>
          )}
          {/* Il gesto va detto: una pressione lunga non si scopre da sola. */}
          {def.wms?.queryable && (
            <div className="text-[10px] text-gray-400">
              Tieni premuto sulla mappa per i dettagli dell&apos;area
            </div>
          )}
          {runtime.partial && runtime.status === 'ready' && (
            <div className="text-[10px] text-amber-400">
              {def.id === 'shelters'
                // Per i ripari "parziale" ha un altro significato: l'elenco e' stato
                // tagliato dal servizio. Riusare il messaggio delle fonti avrebbe detto
                // una cosa falsa.
                ? '⚠ troppi ripari in quest\u2019area: ne vedi solo una parte, avvicinati per l\u2019elenco completo'
                : '⚠ dati parziali: alcune fonti non hanno risposto'}
            </div>
          )}
          {/* L'orario ora si mostra per TUTTI i layer attivi, WMS inclusi: prima era
              dietro `def.refreshMinutes != null`, quindi i due layer EFFIS non avevano
              mai né orario né avviso di staleness. */}
          {runtime.lastFetch != null && (
            <div className="text-[10px] text-gray-400">
              Aggiornato alle {new Date(runtime.lastFetch).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              {isStale(def.id) && <span className="text-amber-400 ml-1">⚠ dati non aggiornati</span>}
            </div>
          )}
          {def.id === 'rain-radar' && radar && radar.frames.length > 0 && (() => {
            const indice = radarFrame < 0 ? radar.frames.length - 1 : Math.min(radarFrame, radar.frames.length - 1);
            const frame = radar.frames[indice];
            const orario = new Date(frame.timeISO).toLocaleTimeString('it-IT', {
              hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
            });
            const ultimo = indice === radar.frames.length - 1;
            return (
              <div className="space-y-1">
                {/*
                  L'orario del fotogramma va mostrato SEMPRE e in grande: e' l'unico
                  modo di non far credere che il radar sia "adesso". Il piano gratuito
                  espone solo il passato (nowcast vuoto, misurato), quindi anche il
                  fotogramma piu' recente ha fino a dieci minuti.
                */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleRadarPlay}
                    aria-label={radarPlaying ? 'Ferma animazione radar' : 'Anima le ultime due ore di radar'}
                    className="px-2 min-h-[32px] max-lg:min-h-[44px] rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-100"
                  >
                    {radarPlaying ? '⏸' : '▶'}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={radar.frames.length - 1}
                    value={indice}
                    onChange={(e) => setRadarFrame(Number(e.target.value))}
                    aria-label="Fotogramma radar"
                    className="flex-1 accent-sky-400"
                  />
                  <span className="text-[11px] font-mono text-gray-200 tabular-nums">
                    {orario}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">
                  {ultimo
                    ? 'Fotogramma pi\u00f9 recente disponibile. \u00c8 pioggia GI\u00c0 CADUTA, non una previsione: serve a vedere da dove arriva la cella.'
                    : `Fotogramma di ${orario}. Scorri fino a destra per il pi\u00f9 recente.`}
                </p>
              </div>
            );
          })()}
          {def.id === 'dpc-alerts' && dpc && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {dayOptions(dpc.days.map((d) => d.date), new Date(nowTick)).map((o) => (
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
              {/* Giornata calma: il bollettino c'è ed è valido, semplicemente non
                  dichiara allerte. Senza dirlo, il layer acceso su una mappa vuota è
                  indistinguibile da un layer rotto — e sono la maggioranza dei giorni. */}
              {calmDay && (
                <div className="text-[10px] text-green-400">Nessuna zona in allerta per questo giorno</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmergencyLayersPanel() {
  const open = useUIStore((s) => s.emergencyPanelOpen);
  const setOpen = useUIStore((s) => s.setEmergencyPanelOpen);
  const activeIds = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers);
  const panelGuard = useMapOverlayGuard<HTMLDivElement>();
  const backdropGuard = useMapOverlayGuard<HTMLDivElement>();

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, setOpen]);

  if (!open) return null;

  const categories = Array.from(new Set(EMERGENCY_LAYERS.map((l) => l.category)));
  const activeDefs = EMERGENCY_LAYERS.filter((l) => activeIds.includes(l.id));
  // Fonti deduplicate: aree bruciate e FWI vengono entrambi da EFFIS, con attivi tutti e
  // due comparirebbe "Copernicus EFFIS · Copernicus EFFIS".
  const sources = Array.from(new Set(activeDefs.map((d) => stripAttributionMarkup(d.attribution))));
  const sourcesText = sources.length > 0 ? 'Fonti: ' + sources.join(' · ') : null;

  return (
    <>
      {/* Backdrop solo mobile: tocco fuori = chiudi, come il menu "Altro". Sta sotto
          lo sheet ma sopra la mappa; è guardato perché anche un tocco sul backdrop
          non deve diventare un waypoint. */}
      <div
        ref={backdropGuard}
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className="lg:hidden absolute inset-0 z-[1180]"
      />
      <div
        ref={panelGuard}
        role="dialog"
        aria-label="Layer di emergenza"
        // Su mobile lo sheet si fermava a bottom-0, coprendo le quattro destinazioni
        // della BottomNav (56px, senza z-index perché è in flusso normale): bottom-14
        // la lascia raggiungibile.
        className="absolute bottom-16 right-14 z-[1000] w-72 max-h-[70vh] overflow-y-auto bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3
                   max-lg:fixed max-lg:inset-x-0 max-lg:bottom-14 max-lg:right-auto max-lg:w-full max-lg:rounded-b-none max-lg:z-[1190] max-lg:max-h-[60vh]"
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
    </>
  );
}
