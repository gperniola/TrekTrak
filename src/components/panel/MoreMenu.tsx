'use client';

import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { REGISTRO, downloadAs } from '@/lib/exporters/registro';

/**
 * Il JSON resta fuori da qui: sta nell'intestazione accanto al pulsante che lo
 * RIAPRE, ed e' l'unica coppia dell'app in cui esportare e importare sono lo stesso
 * gesto in due versi. Metterlo anche qui sarebbe una seconda porta per la stessa cosa.
 */
const FORMATI = REGISTRO.filter((e) => e.id !== 'json');
import type { Itinerary } from '@/lib/types';
import { buildMeteoUrl } from '@/lib/meteo';
import { calculateDifficulty } from '@/lib/calculations';
import { toast } from '@/stores/notificationStore';
import { SheetHandle } from '@/components/shared/SheetHandle';
import { useSheetDrag } from '@/lib/useSheetDrag';
import { useSchermoPiccolo } from '@/lib/useSchermoPiccolo';
import { mostra } from '@/lib/profilo';
import { ProfiloSwitch } from '@/components/shared/ProfiloSwitch';

/** Menu "Altro" della bottom nav (mobile): meteo + export del percorso corrente. */
export function MoreMenu() {
  const open = useUIStore((s) => s.moreMenuOpen);
  const setOpen = useUIStore((s) => s.setMoreMenuOpen);
  const setWeatherOpen = useUIStore((s) => s.setWeatherOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);

  const close = () => setOpen(false);
  /*
   * Trascinamento verso il basso per chiudere. Questo menu non scorre mai (quattro
   * voci), quindi il gesto puo' partire da tutta la sua superficie senza rubare niente
   * a nessuno.
   *
   * Sta QUI, sopra il ritorno anticipato: un hook chiamato dopo un `return` gira in
   * ordine diverso fra un render e l'altro. L'ha trovato ESLint, non io.
   */
  const profilo = useUIStore((s) => s.profilo);
  const piccolo = useSchermoPiccolo();
  const { refFoglio, propsFoglio, propsManiglia } = useSheetDrag({
    onDismiss: close,
    attivo: piccolo,
  });

  if (!open) return null;

  const validCoord = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  const canPdf = waypoints.length >= 2;
  const canGpx = validCoord.length >= 2;
  const meteoUrl = buildMeteoUrl(waypoints);

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
  /** L'itinerario nella forma che il registry si aspetta. */
  const itinerarioCorrente = () => ({ name: itineraryName, waypoints, legs } as Itinerary);
  /* Quali formati sono spenti adesso: la nota qui sotto guarda questo, non una
     condizione riscritta a mano che potrebbe divergere da quella dei formati. */
  const formatiSpenti = FORMATI.filter((f) => f.impedimento(itinerarioCorrente()) != null);
  // Apre il pannello del percorso invece di Meteoblue: il collegamento esterno sta
  // dentro il pannello.
  const handleMeteo = () => { setWeatherOpen(true); close(); };

  const itemCls = 'w-full text-left px-3 min-h-[44px] flex items-center gap-2 text-sm text-gray-200 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="lg:hidden fixed inset-0 z-[1150]" onClick={close}>
      <div
        ref={refFoglio}
        {...propsFoglio}
        role="menu"
        aria-label="Altro"
        onClick={(e) => e.stopPropagation()}
        className="absolute left-2 right-2 bottom-[60px] bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-1 space-y-0.5"
      >
        <SheetHandle gesto={propsManiglia} />
        {/*
          L'interruttore del profilo come PRIMA voce: e' la scelta che decide tutte le
          altre, e nascosta nelle impostazioni non si troverebbe.
        */}
        <ProfiloSwitch />
        <div className="border-b border-gray-700 my-0.5" />
        {/* Meteo e GPX seguono il profilo; i due PDF restano in entrambi. */}
        {mostra('meteo', profilo) && (
          <button role="menuitem" disabled={!meteoUrl} onClick={handleMeteo} className={itemCls}>☀️ Meteo del percorso</button>
        )}
        <button role="menuitem" disabled={!canPdf} onClick={() => handlePdf('summary')} className={itemCls}>📄 PDF sintetico</button>
        <button role="menuitem" disabled={!canPdf} onClick={() => handlePdf('roadbook')} className={itemCls}>📋 PDF roadbook</button>
        {/*
          I formati vengono dal registry: aggiungerne uno non richiede di ricordarsi di
          questo menu. Ognuno dichiara il proprio impedimento, quindi la voce si spegne
          per la sua ragione e non per una condizione riscritta qui.
        */}
        {/*
          Le Impostazioni (tolleranze, tema, rivedi tutorial) erano raggiungibili SOLO
          dal pulsante desktop sopra la mappa: su telefono tema e tolleranze non
          esistevano. La voce sta qui e non in «Impostazioni mappa» perche' quel pannello
          parla della mappa, e il tema e le tolleranze parlano dell'app.
        */}
        <button
          role="menuitem"
          onClick={() => { close(); setSettingsOpen(true); }}
          className={itemCls}
        >
          ⚙️ Impostazioni e tema
        </button>
        {mostra('exportDati', profilo) && FORMATI.map((f) => (
          <button
            key={f.id}
            role="menuitem"
            disabled={f.impedimento(itinerarioCorrente()) != null}
            onClick={() => { downloadAs(f, itinerarioCorrente()); close(); }}
            className={itemCls}
            title={f.descrizione}
          >
            🛰️ {f.etichetta}
          </button>
        ))}
        {/*
          Con l'itinerario vuoto tutte le voci sono grigie: senza questa riga il menu
          era quattro voci spente e nessuna spiegazione, e su un telefono non c'e'
          tooltip che possa dirlo.
        */}
        {/* Come in ActionBar: si guardano solo le voci visibili in questo profilo. */}
        {(!canPdf
          || (mostra('exportDati', profilo) && formatiSpenti.length > 0)
          || (mostra('meteo', profilo) && !meteoUrl)) && (
          <p className="px-3 py-2 text-[11px] text-amber-300/90 leading-snug">
            {waypoints.length < 2
              ? 'Aggiungi almeno 2 waypoint sulla mappa per usare queste voci.'
              : 'Servono waypoint con coordinate: toccane uno sulla mappa per posizionarlo.'}
          </p>
        )}
      </div>
    </div>
  );
}
