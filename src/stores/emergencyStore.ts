import { create } from 'zustand';
import { EMERGENCY_LAYERS, getEmergencyLayer, type EmergencyLayerId } from '@/lib/emergency-layers';
import { fetchFiresClient, fetchDpcClient, type DpcData } from '@/lib/emergency-api';
import { fetchRadarIndex, type RadarIndex } from '@/lib/radar-api';
import type { Riparo } from '@/lib/shelters-api';
import { fetchQuakes, type Quake } from '@/lib/quakes-api';
import type { BollettinoValanghe } from '@/lib/avalanche-api';
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

export interface LayerRuntime {
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
  /** Indice dei fotogrammi radar e quale si sta guardando. */
  radar: RadarIndex | null;
  radarFrame: number;
  radarPlaying: boolean;
  /** Ripari dell'area inquadrata: li aggiorna il componente, non un timer. */
  shelters: Riparo[] | null;
  /** Terremoti delle ultime 48 ore. */
  quakes: Quake[] | null;
  /** Bollettino valanghe della vista: come i ripari, lo chiede il componente. */
  avalanche: BollettinoValanghe | null;
  /** Giorno effettivamente usato dai layer a mattonelle con data (neve). */
  xyzGiorno: Partial<Record<EmergencyLayerId, string>>;
  /**
   * Contatore di tentativi per layer. Entra nella chiave dei layer WMS: senza, il
   * "Riprova" non li rimontava, nessun tile veniva richiesto e il layer restava in
   * "Caricamento..." per sempre — peggio dell'errore da cui si veniva.
   */
  retryTick: Record<EmergencyLayerId, number>;
  /** Orologio grossolano: fa rivalutare staleness e giorno corrente. Vedi `startTick`. */
  nowTick: number;
  startLayer: (id: EmergencyLayerId) => void;
  stopLayer: (id: EmergencyLayerId) => void;
  refreshLayer: (id: EmergencyLayerId) => Promise<void>;
  reportWmsTile: (id: EmergencyLayerId, outcome: 'load' | 'error') => void;
  setDpcSelectedDate: (date: string) => void;
  setRadarFrame: (index: number) => void;
  toggleRadarPlay: () => void;
  /**
   * Esito di un'interrogazione dei ripari sull'area inquadrata. Lo store non sa la
   * bbox: la conosce solo il componente sulla mappa.
   */
  /** Rimette in piedi un layer dopo un errore, tile WMS compresi. */
  retryLayer: (id: EmergencyLayerId) => void;
  reportShelters: (
    esito: { shelters: Riparo[]; troncato?: boolean } | { error: string } | { nodata: string }
  ) => void;
  /**
   * Esito di un'interrogazione delle valanghe sull'area inquadrata. Come per i ripari, la
   * bbox la conosce solo il componente sulla mappa.
   */
  reportAvalanche: (
    esito: { bollettino: BollettinoValanghe } | { error: string } | { nodata: string }
  ) => void;
  /**
   * Quale giorno stanno mostrando le mattonelle con data.
   *
   * Serve a dichiararlo nel pannello: un'immagine di ieri presentata come di oggi e' la
   * classe di difetto piu' ripetuta di questo progetto.
   */
  reportXyzTile: (
    id: EmergencyLayerId,
    esito: { giorno: string } | { esaurito: true },
  ) => void;
  isStale: (id: EmergencyLayerId) => boolean;
}

const IDLE: LayerRuntime = { status: 'idle', error: null, lastFetch: null };

/** Una copia senza quella chiave: `delete` su una copia, per non mutare lo stato. */
function senza<T>(mappa: Partial<Record<EmergencyLayerId, T>>, id: EmergencyLayerId): Partial<Record<EmergencyLayerId, T>> {
  const fuori = { ...mappa };
  delete fuori[id];
  return fuori;
}

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
    radar: null,
    // Si parte dal fotogramma piu' recente: e' quello che risponde a "che sta
    // succedendo adesso", mentre l'animazione serve a capire da dove arriva.
    radarFrame: -1,
    radarPlaying: false,
    shelters: null,
    quakes: null,
    avalanche: null,
    xyzGiorno: {},
    retryTick: Object.fromEntries(EMERGENCY_LAYERS.map((l) => [l.id, 0])) as Record<EmergencyLayerId, number>,
    nowTick: Date.now(),

    startLayer: (id) => {
      const def = getEmergencyLayer(id);
      if (get().layers[id].status !== 'idle') return; // idempotente

      /*
        Le mattonelle con data (neve) si comportano come il WMS: non c'e' niente da
        chiedere via fetch, il layer e' pronto quando le mattonelle arrivano. Lo stato lo
        dichiara il componente con `reportXyzTile`.
      */
      if (def.kind === 'wms' || def.kind === 'xyz') {
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
      // I layer legati alla vista li interroga il componente, che e' l'unico a
      // conoscere l'area inquadrata: qui non si fa partire nulla.
      if (def.kind === 'viewport' || def.kind === 'avalanche') return;
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
        ...(id === 'rain-radar' ? { radar: null, radarFrame: -1, radarPlaying: false } : {}),
        ...(id === 'shelters' ? { shelters: null } : {}),
        ...(id === 'earthquakes' ? { quakes: null } : {}),
        ...(id === 'avalanche-danger' ? { avalanche: null } : {}),
        /*
          Anche l'etichetta del giorno se ne va col layer: e' un pezzo del payload, e
          tenerla vorrebbe dire lasciare in giro una data che non descrive piu' niente.

          Si toglie **solo la sua**, e la condizione guarda il KIND e non un id scritto a
          mano: `xyzGiorno: {}` azzerava la mappa intera — oggi non si vede perche' di
          layer a mattonelle con data ce n'e' uno, ma il campo e' indicizzato per layer
          proprio perche' ce ne saranno altri, e un secondo layer si sarebbe spento
          insieme al primo. Il commento diceva "questo layer", il codice diceva "tutti".
        */
        ...(getEmergencyLayer(id).kind === 'xyz' ? { xyzGiorno: senza(get().xyzGiorno, id) } : {}),
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
        } else if (id === 'rain-radar') {
          const radar = await fetchRadarIndex();
          if (get().layers[id].status === 'idle') return; // stopLayer during flight
          set((s) => ({
            radar,
            // Ogni aggiornamento porta un fotogramma nuovo in coda: se si stava
            // guardando il piu' recente si resta sul piu' recente, altrimenti si
            // rispetta la scelta dell'utente.
            radarFrame: s.radarFrame < 0 ? -1 : Math.min(s.radarFrame, radar.frames.length - 1),
            layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } },
          }));
        } else if (id === 'earthquakes') {
          const { quakes, troncato } = await fetchQuakes(new Date());
          if (get().layers[id].status === 'idle') return; // stopLayer during flight
          set((s) => ({
            quakes,
            layers: {
              ...s.layers,
              /*
                Zero eventi non e' un errore ed e' la condizione NORMALE: in Italia due
                giorni senza scosse sopra magnitudo 2 sono frequenti. Va detto come
                "nessun evento", non lasciato a una mappa vuota che si legge come guasto.
              */
              [id]: quakes.length === 0
                ? { status: 'nodata', error: 'Nessun terremoto sopra magnitudo 2 nelle ultime 48 ore', lastFetch: Date.now() }
                : { status: 'ready', error: null, lastFetch: Date.now(), partial: troncato },
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

    setRadarFrame: (index) => {
      const n = get().radar?.frames.length ?? 0;
      if (n === 0) return;
      // Fermare l'animazione quando si trascina a mano: continuare a scorrere sotto le
      // dita e' il modo piu' rapido di rendere inutilizzabile uno slider.
      set({ radarFrame: Math.max(0, Math.min(index, n - 1)), radarPlaying: false });
    },

    toggleRadarPlay: () => set((s) => ({ radarPlaying: !s.radarPlaying })),

    retryLayer: (id) => {
      get().stopLayer(id);
      set((s) => ({ retryTick: { ...s.retryTick, [id]: (s.retryTick[id] ?? 0) + 1 } }));
      get().startLayer(id);
    },

    reportAvalanche: (esito) => {
      if (get().layers['avalanche-danger'].status === 'idle') return; // layer spento nel frattempo
      if ('bollettino' in esito) {
        const b = esito.bollettino;
        set((s) => ({
          avalanche: b,
          layers: {
            ...s.layers,
            'avalanche-danger': b.bulletinDate == null
              /*
                Nessuna valutazione pubblicata: e' un'informazione, non un guasto.
                Verificato il 2026-09-03: fuori stagione otto regioni su nove rispondono
                404 e Meteomont pubblica tutte le zone a zero.

                Il messaggio NON dice "fuori stagione": sarebbe una deduzione nostra, e in
                gennaio una giornata senza valutazioni la renderebbe falsa. Dice quello
                che si sa.
              */
              ? { status: 'nodata', error: 'Nessuna valutazione pubblicata per questi giorni', lastFetch: Date.now() }
              : b.joinBroken === true
                /*
                  Il bollettino esiste ma non si riesce a disegnare: e' un guasto nostro
                  (gli id delle micro-regioni sono cambiati), e va detto come errore —
                  con il "Riprova" accanto — non come "nessun dato". A schermo le due
                  cose sono identiche: una mappa senza colori.
                */
                ? { status: 'error', error: 'Bollettino ricevuto ma non disegnabile: le zone sono cambiate', lastFetch: Date.now() }
                : b.zones.length === 0
                // C'e' il bollettino ma non su questa vista: succede fuori dalle zone
                // montane. Dirlo evita di far credere che il layer sia rotto.
                ? { status: 'nodata', error: 'Nessuna zona valanghe in questa area', lastFetch: Date.now() }
                // `partial` = qualche regione non ha risposto: la riga del pannello lo
                // dichiara, perche' una zona senza colore si legge come senza pericolo.
                : { status: 'ready', error: null, lastFetch: Date.now(), partial: b.partial === true },
          },
        }));
      } else if ('nodata' in esito) {
        set((s) => ({
          avalanche: null,
          layers: { ...s.layers, 'avalanche-danger': { status: 'nodata', error: esito.nodata, lastFetch: null } },
        }));
      } else {
        set((s) => ({
          layers: { ...s.layers, 'avalanche-danger': { status: 'error', error: esito.error, lastFetch: null } },
        }));
      }
    },

    reportXyzTile: (id, esito) => {
      if (get().layers[id].status === 'idle') return;
      if ('esaurito' in esito) {
        /*
          Nessuno dei giorni provati ha immagini. Prima questo caso non esisteva: il
          componente passava un flag `ultimoTentativo` che lo store **ignorava**, quindi
          il layer restava 'ready' con una mappa vuota — assenza di dati indistinguibile
          da "niente neve". E' la stessa classe di difetto di `slim` e del livello utente,
          valori scritti e riletti da nessuno.
        */
        set((s) => ({
          // La chiave si toglie, non si mette a `undefined`: una chiave presente col
          // valore vuoto e' la stessa cosa per chi legge, ma non per `Object.keys`.
          xyzGiorno: senza(s.xyzGiorno, id),
          layers: {
            ...s.layers,
            [id]: { status: 'nodata', error: 'Nessuna immagine disponibile negli ultimi giorni', lastFetch: Date.now() },
          },
        }));
        return;
      }
      set((s) => ({
        xyzGiorno: { ...s.xyzGiorno, [id]: esito.giorno },
        layers: { ...s.layers, [id]: { status: 'ready', error: null, lastFetch: Date.now() } },
      }));
    },

    reportShelters: (esito) => {
      if (get().layers.shelters.status === 'idle') return; // layer spento nel frattempo
      if ('shelters' in esito) {
        set((s) => ({
          shelters: esito.shelters,
          layers: {
            ...s.layers,
            // `partial` e' il canale che il pannello usa gia' per dire "solo una parte
            // delle fonti ha risposto": qui significa "solo una parte dei ripari".
            shelters: { status: 'ready', error: null, lastFetch: Date.now(), partial: esito.troncato === true },
          },
        }));
      } else if ('nodata' in esito) {
        // "Avvicinati" non e' un errore: la fonte non e' stata nemmeno interrogata.
        set((s) => ({
          shelters: null,
          layers: { ...s.layers, shelters: { status: 'nodata', error: esito.nodata, lastFetch: null } },
        }));
      } else {
        set((s) => ({
          layers: { ...s.layers, shelters: { status: 'error', error: esito.error, lastFetch: null } },
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
  };
});
