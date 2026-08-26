import { create } from 'zustand';
import { EMERGENCY_LAYERS, getEmergencyLayer, type EmergencyLayerId } from '@/lib/emergency-layers';
import { fetchFiresClient, fetchDpcClient, type DpcData } from '@/lib/emergency-api';
import { NoDataError } from '@/lib/no-data-error';
import { defaultDpcDate, toYmd } from '@/lib/dpc';
import { toast } from '@/stores/notificationStore';
import type { FirePoint } from '@/lib/firms';

/**
 * `nodata` è distinto da `ready` e da `error`: la fonte ha risposto, ma per il giorno
 * corrente non c'è nulla da mostrare (bollettino non ancora pubblicato, o troppo
 * vecchio). Senza questo stato il layer restava "ready" con orario fresco e mappa
 * vuota, cioè assenza di dati indistinguibile da "nessun pericolo".
 */
export type LayerStatus = 'idle' | 'loading' | 'ready' | 'nodata' | 'error';

interface LayerRuntime {
  status: LayerStatus;
  error: string | null;
  lastFetch: number | null;
  /** Vero quando solo una parte delle fonti del layer ha risposto. */
  partial?: boolean;
}

interface EmergencyState {
  layers: Record<EmergencyLayerId, LayerRuntime>;
  fires: { points: FirePoint[]; fetchedAt: string; partial?: boolean } | null;
  dpc: DpcData | null;
  dpcSelectedDate: string | null;
  /** Orologio grossolano: fa rivalutare staleness e giorno corrente. Vedi `startTick`. */
  nowTick: number;
  startLayer: (id: EmergencyLayerId) => void;
  stopLayer: (id: EmergencyLayerId) => void;
  refreshLayer: (id: EmergencyLayerId) => Promise<void>;
  reportWmsTile: (id: EmergencyLayerId, outcome: 'load' | 'error') => void;
  setDpcSelectedDate: (date: string) => void;
  isStale: (id: EmergencyLayerId) => boolean;
}

const IDLE: LayerRuntime = { status: 'idle', error: null, lastFetch: null };

const initialLayers = Object.fromEntries(
  EMERGENCY_LAYERS.map((l) => [l.id, { ...IDLE }])
) as Record<EmergencyLayerId, LayerRuntime>;

// Fuori dallo stato React: non serve reattività, solo lifecycle.
const timers = new Map<EmergencyLayerId, ReturnType<typeof setInterval>>();
/** Guardia anti-accumulo: senza, l'intervallo impila richieste su rete lenta. */
const inFlight = new Set<EmergencyLayerId>();
/** Tile WMS falliti prima del primo tile buono: un errore isolato non è un guasto. */
const wmsErrors = new Map<EmergencyLayerId, number>();
const WMS_ERROR_THRESHOLD = 3;

/**
 * Un solo tick da 5 minuti condiviso. Serve a due cose che prima non funzionavano:
 * il badge "dati non aggiornati" (isStale leggeva `Date.now()` in fase di render, ma
 * nulla provocava un nuovo render proprio quando i refresh si fermavano) e il
 * parametro TIME dei layer WMS (a sessione aperta oltre la mezzanotte "Pericolo
 * incendio oggi" mostrava la previsione del giorno prima).
 *
 * Lo consumano solo il pannello e i layer WMS: tenerlo fuori da `EmergencyLayers`
 * evita di rimontare a ogni tick i marker dei focolai.
 */
const TICK_MS = 5 * 60 * 1000;
let tickTimer: ReturnType<typeof setInterval> | null = null;

export const useEmergencyStore = create<EmergencyState>((set, get) => {
  const anyActive = () => Object.values(get().layers).some((l) => l.status !== 'idle');

  const syncTick = () => {
    if (anyActive() && tickTimer == null) {
      tickTimer = setInterval(() => set({ nowTick: Date.now() }), TICK_MS);
    } else if (!anyActive() && tickTimer != null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };

  return {
    layers: initialLayers,
    fires: null,
    dpc: null,
    dpcSelectedDate: null,
    nowTick: Date.now(),

    startLayer: (id) => {
      const def = getEmergencyLayer(id);
      if (get().layers[id].status !== 'idle') return; // idempotente

      if (def.kind === 'wms') {
        // Non più 'ready' a scatola chiusa: lo stato lo decidono i tile, via
        // reportWmsTile. Prima un'interruzione EFFIS dava tile bianchi con il
        // pannello che dichiarava il layer funzionante.
        wmsErrors.delete(id);
        set((s) => ({ layers: { ...s.layers, [id]: { status: 'loading', error: null, lastFetch: null } } }));
        syncTick();
        return;
      }
      set((s) => ({ layers: { ...s.layers, [id]: { status: 'loading', error: null, lastFetch: null } } }));
      syncTick();
      void get().refreshLayer(id);
      if (def.refreshMinutes != null && !timers.has(id)) {
        timers.set(id, setInterval(() => { void get().refreshLayer(id); }, def.refreshMinutes * 60 * 1000));
      }
    },

    stopLayer: (id) => {
      const t = timers.get(id);
      if (t) { clearInterval(t); timers.delete(id); }
      inFlight.delete(id);
      wmsErrors.delete(id);
      // Il payload va buttato con il layer. Tenendolo, riaccendere il layer
      // ridisegnava subito i dati di ore prima — e con `lastFetch` a null il
      // pannello nascondeva sia l'orario sia l'avviso di staleness, quindi senza
      // alcun riferimento temporale.
      set((s) => ({
        layers: { ...s.layers, [id]: { ...IDLE } },
        ...(id === 'fires-hotspots' ? { fires: null } : {}),
        ...(id === 'dpc-alerts' ? { dpc: null, dpcSelectedDate: null } : {}),
      }));
      syncTick();
    },

    refreshLayer: async (id) => {
      if (inFlight.has(id)) return; // una richiesta per volta, no risposte fuori ordine
      inFlight.add(id);
      try {
        if (id === 'fires-hotspots') {
          const fires = await fetchFiresClient();
          if (get().layers[id].status === 'idle') return; // stopLayer during flight: discard
          set((s) => ({
            fires,
            layers: {
              ...s.layers,
              [id]: { status: 'ready', error: null, lastFetch: Date.now(), partial: fires.partial },
            },
          }));
        } else if (id === 'dpc-alerts') {
          const dpc = await fetchDpcClient();
          if (get().layers[id].status === 'idle') return; // stopLayer during flight: discard
          set((s) => {
            const dates = dpc.days.map((d) => d.date);
            const today = toYmd(new Date());
            // La data scelta va tenuta solo se è ancora attuale: una selezione fatta
            // prima di mezzanotte restava attiva dopo, e la mappa continuava a
            // disegnare le zone di ieri come se fossero quelle correnti.
            const keep = s.dpcSelectedDate != null
              && dates.includes(s.dpcSelectedDate)
              && s.dpcSelectedDate >= today;
            const selected = keep ? s.dpcSelectedDate : defaultDpcDate(dates, new Date());
            return {
              dpc,
              dpcSelectedDate: selected,
              layers: {
                ...s.layers,
                [id]: selected == null
                  // Bollettino tutto nel passato: nessuna zona da disegnare. Va detto,
                  // non lasciato indovinare da una mappa vuota.
                  ? { status: 'nodata', error: 'Nessun bollettino per oggi', lastFetch: Date.now() }
                  : { status: 'ready', error: null, lastFetch: Date.now() },
              },
            };
          });
        }
      } catch (e) {
        if (get().layers[id].status === 'idle') return; // stopLayer during flight: discard
        const message = e instanceof Error ? e.message : 'Errore di rete';
        const noData = e instanceof NoDataError;
        // Spec §6: toast UNA volta per transizione in errore (non a ogni retry
        // fallito), e "nessun dato" non è un errore: niente toast rosso.
        if (!noData && get().layers[id].status !== 'error') {
          toast.error(`${getEmergencyLayer(id).label}: ${message}`);
        }
        set((s) => ({
          layers: {
            ...s.layers,
            [id]: {
              ...s.layers[id],
              status: noData ? 'nodata' : 'error',
              error: message,
              lastFetch: noData ? Date.now() : s.layers[id].lastFetch,
            },
          },
        }));
      } finally {
        inFlight.delete(id);
      }
    },

    reportWmsTile: (id, outcome) => {
      const cur = get().layers[id];
      if (cur.status === 'idle') return;
      if (outcome === 'load') {
        wmsErrors.delete(id);
        if (cur.status !== 'ready') {
          set((s) => ({ layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } } }));
        }
        return;
      }
      // Un tile fallito capita anche fuori copertura: si segnala il guasto solo se
      // non è ancora arrivato nessun tile buono e gli errori si accumulano.
      if (cur.status === 'ready' || cur.status === 'error') return;
      const n = (wmsErrors.get(id) ?? 0) + 1;
      wmsErrors.set(id, n);
      if (n < WMS_ERROR_THRESHOLD) return;
      const message = 'Tile non disponibili';
      toast.error(`${getEmergencyLayer(id).label}: ${message}`);
      set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], status: 'error', error: message } } }));
    },

    setDpcSelectedDate: (date) => set({ dpcSelectedDate: date }),

    isStale: (id) => {
      const def = getEmergencyLayer(id);
      const { lastFetch } = get().layers[id];
      if (def.refreshMinutes == null || lastFetch == null) return false;
      return Date.now() - lastFetch > 2 * def.refreshMinutes * 60 * 1000;
    },
  };
});
