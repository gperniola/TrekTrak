'use client';

import { useState } from 'react';
import type { Itinerary } from '@/lib/types';
import { useItineraryStore } from '@/stores/itineraryStore';
// Nota: lib/export-pdf importa jspdf (~100 kB). Caricato pigramente al primo export, per
// non pesare sul primo disegno della pagina.
import { REGISTRO, downloadAs } from '@/lib/exporters/registro';
import { calculateDifficulty } from '@/lib/calculations';
import { toast } from '@/stores/notificationStore';
import { useChiudiFuori } from '@/lib/useChiudiFuori';

/** Il JSON sta nell'intestazione, accanto al pulsante che lo riapre. */
const FORMATI = REGISTRO.filter((e) => e.id !== 'json');

/**
 * I due PDF, come voci della stessa tendina degli altri formati.
 *
 * Non stanno nel registry perché non seguono la sua forma: il registry produce un file da
 * un itinerario in memoria, i PDF passano da `html2canvas` sulla mappa disegnata a schermo
 * e da un caricamento pigro di jsPDF. Metterli lì avrebbe voluto dire piegare
 * l'interfaccia del registry per un caso che non le assomiglia; elencarli qui costa due
 * righe e dice la verità.
 */
const PDF_VOCI = [
  {
    id: 'summary' as const,
    etichetta: 'PDF sintetico',
    descrizione: 'Una pagina: mappa, profilo e tabella',
  },
  {
    id: 'roadbook' as const,
    etichetta: 'PDF roadbook',
    descrizione: 'Una riga per tratta, da seguire camminando',
  },
];

/**
 * **Un solo «Esporta», tutti i formati dentro.**
 *
 * Erano due pulsanti verdi a tutta larghezza accanto a una tendina che già esisteva per
 * gli altri formati: tre controlli per la stessa idea, e i due più grossi per i due
 * formati che si usano meno spesso. Ora ogni cosa che esce dall'app sta in un posto, con
 * scritto sotto a cosa serve.
 *
 * La tendina compare in **entrambi** i profili: in Imparo elenca solo i PDF — servono a
 * portarsi l'esercizio su carta — e non i formati da gita, che arrivano con `datiVisibili`.
 */
export function MenuEsporta({ abilitato, datiVisibili }: { abilitato: boolean; datiVisibili: boolean }) {
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const [aperto, setAperto] = useState(false);
  const contenitore = useChiudiFuori<HTMLDivElement>(aperto, () => setAperto(false));

  /** L'itinerario nella forma che il registry si aspetta. */
  const itinerarioCorrente = () => ({ name: itineraryName, waypoints, legs } as Itinerary);

  const esportaPDF = async (formato: 'summary' | 'roadbook') => {
    if (waypoints.length < 2) {
      toast.warning('Aggiungi almeno 2 waypoint');
      return;
    }
    // Il PDF è utile anche senza coordinate, quindi si guarda solo il numero di waypoint.
    // Il modulo (che porta jspdf) si carica al primo tocco, non prima.
    const { downloadPDF } = await import('@/lib/export-pdf');
    const maxSlope = Math.max(0, ...legs.map((l) => l.slope ?? 0));
    downloadPDF({
      name: itineraryName,
      waypoints,
      legs,
      totalDistance: legs.reduce((s, l) => s + (l.distance ?? 0), 0),
      totalElevGain: legs.reduce((s, l) => s + (l.elevationGain ?? 0), 0),
      totalElevLoss: legs.reduce((s, l) => s + (l.elevationLoss ?? 0), 0),
      totalTime: legs.reduce((s, l) => s + (l.estimatedTime ?? 0), 0),
      difficulty: calculateDifficulty(maxSlope),
    }, formato);
  };

  return (
    <div className="relative flex-1" ref={contenitore}>
      <button
        onClick={() => setAperto((p) => !p)}
        aria-expanded={aperto}
        aria-haspopup="menu"
        disabled={!abilitato}
        aria-describedby={!abilitato ? 'motivo-export' : undefined}
        className="w-full py-2 bg-blue-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
      >
        Esporta ▾
      </button>
      {aperto && (
        /*
          `left-0`, non `right-0`: la tendina si ancora al SUO pulsante, che ora e' il
          primo della fila. Con `right-0` — giusto finche' stava a destra di due PDF a
          tutta larghezza — il menu si estendeva a sinistra oltre il bordo del pannello
          e le voci risultavano tagliate a meta'. Nessun test l'ha visto: si vede solo
          aprendola.
        */
        <div role="menu" className="absolute left-0 bottom-full mb-1 z-[1300] w-60 max-w-[calc(100vw-2rem)] bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-1">
          {PDF_VOCI.map((v) => (
            <button
              key={v.id}
              role="menuitem"
              disabled={!abilitato}
              onClick={() => { esportaPDF(v.id); setAperto(false); }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="block text-xs font-bold text-gray-100">{v.etichetta}</span>
              {/*
                Nessun ramo «spento» qui: il pulsante che apre la tendina e' disabilitato
                alla stessa condizione, quindi un messaggio per il caso contrario non si
                potrebbe leggere mai. Il motivo, quando serve, sta nella nota sopra il
                gruppo — che si vede senza dover aprire niente.
              */}
              <span className="block text-[10px] text-gray-400 leading-snug">
                {v.descrizione}
              </span>
            </button>
          ))}
          {datiVisibili && <div className="my-1 border-t border-gray-700" />}
          {datiVisibili && FORMATI.map((f) => {
            const motivo = f.impedimento(itinerarioCorrente());
            return (
              <button
                key={f.id}
                role="menuitem"
                disabled={motivo != null}
                onClick={() => { downloadAs(f, itinerarioCorrente()); setAperto(false); }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="block text-xs font-bold text-gray-100">{f.etichetta}</span>
                <span className="block text-[10px] text-gray-400 leading-snug">
                  {motivo ?? f.descrizione}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
