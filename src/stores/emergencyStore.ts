import { create } from 'zustand';
import { EMERGENCY_LAYERS, getEmergencyLayer, type EmergencyLayerId } from '@/lib/emergency-layers';
import { fetchFiresClient, fetchDpcClient, type DpcData } from '@/lib/emergency-api';
import { defaultDpcDate } from '@/lib/dpc';
import { toast } from '@/stores/notificationStore';
import type { FirePoint } from '@/lib/firms';

export type LayerStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LayerRuntime { status: LayerStatus; error: string | null; lastFetch: number | null; }

interface EmergencyState {
  layers: Record<EmergencyLayerId, LayerRuntime>;
  fires: { points: FirePoint[]; fetchedAt: string } | null;
  dpc: DpcData | null;
  dpcSelectedDate: string | null;
  startLayer: (id: EmergencyLayerId) => void;
  stopLayer: (id: EmergencyLayerId) => void;
  refreshLayer: (id: EmergencyLayerId) => Promise<void>;
  setDpcSelectedDate: (date: string) => void;
  isStale: (id: EmergencyLayerId) => boolean;
}

const IDLE: LayerRuntime = { status: 'idle', error: null, lastFetch: null };

const initialLayers = Object.fromEntries(
  EMERGENCY_LAYERS.map((l) => [l.id, { ...IDLE }])
) as Record<EmergencyLayerId, LayerRuntime>;

// Interval fuori dallo stato React: non serve reattività, solo lifecycle.
const timers = new Map<EmergencyLayerId, ReturnType<typeof setInterval>>();

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  layers: initialLayers,
  fires: null,
  dpc: null,
  dpcSelectedDate: null,

  startLayer: (id) => {
    const def = getEmergencyLayer(id);
    const current = get().layers[id];
    if (current.status !== 'idle') return; // idempotente

    if (def.kind === 'wms') {
      set((s) => ({ layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } } }));
      return;
    }
    set((s) => ({ layers: { ...s.layers, [id]: { status: 'loading', error: null, lastFetch: null } } }));
    void get().refreshLayer(id);
    if (def.refreshMinutes != null && !timers.has(id)) {
      timers.set(id, setInterval(() => { void get().refreshLayer(id); }, def.refreshMinutes * 60 * 1000));
    }
  },

  stopLayer: (id) => {
    const t = timers.get(id);
    if (t) { clearInterval(t); timers.delete(id); }
    set((s) => ({ layers: { ...s.layers, [id]: { ...IDLE } } }));
  },

  refreshLayer: async (id) => {
    try {
      if (id === 'fires-hotspots') {
        const fires = await fetchFiresClient();
        if (get().layers[id].status === 'idle') return; // stopLayer during flight: discard
        set((s) => ({ fires, layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } } }));
      } else if (id === 'dpc-alerts') {
        const dpc = await fetchDpcClient();
        if (get().layers[id].status === 'idle') return; // stopLayer during flight: discard
        set((s) => {
          const dates = dpc.days.map((d) => d.date);
          const keep = s.dpcSelectedDate != null && dates.includes(s.dpcSelectedDate);
          return {
            dpc,
            dpcSelectedDate: keep ? s.dpcSelectedDate : defaultDpcDate(dates, new Date()),
            layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } },
          };
        });
      }
    } catch (e) {
      if (get().layers[id].status === 'idle') return; // stopLayer during flight: discard
      const message = e instanceof Error ? e.message : 'Errore di rete';
      // Spec §6: toast UNA volta per transizione in errore (non a ogni retry fallito).
      if (get().layers[id].status !== 'error') {
        toast.error(`${getEmergencyLayer(id).label}: ${message}`);
      }
      set((s) => ({
        layers: { ...s.layers, [id]: { ...s.layers[id], status: 'error', error: message } },
      }));
    }
  },

  setDpcSelectedDate: (date) => set({ dpcSelectedDate: date }),

  isStale: (id) => {
    const def = getEmergencyLayer(id);
    const { lastFetch } = get().layers[id];
    if (def.refreshMinutes == null || lastFetch == null) return false;
    return Date.now() - lastFetch > 2 * def.refreshMinutes * 60 * 1000;
  },
}));
