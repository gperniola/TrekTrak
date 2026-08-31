'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { EMERGENCY_LAYERS, stripAttributionMarkup, type EmergencyLayerId } from '@/lib/emergency-layers';
import { useMapOverlayGuard } from '../useMapOverlayGuard';
import { EmergencyLayerRow, DISCLAIMER } from './EmergencyLayerRow';

/**
 * Quadro di comando dei layer di emergenza.
 *
 * Il pannello era diventato illeggibile man mano che lo si usava: ogni layer acceso si
 * portava dietro per sempre descrizione, legenda (fino a sei voci), riga di stato e
 * comandi specifici. Misurato su un telefono da 412x823 con cinque layer accesi:
 * **1044 px di contenuto in una finestra di 494**, 52 righe, quattro interruttori
 * visibili su sette. Più lo usavi, più era faticoso raggiungere gli interruttori.
 *
 * Ora fa una cosa: accendere e spegnere. Sette righe, tutte in una schermata; il resto
 * si apre toccando la riga, una per volta. Nessuna funzione è stata rimossa: sono
 * cambiate di posto.
 */
export function EmergencyLayersPanel() {
  const open = useUIStore((s) => s.emergencyPanelOpen);
  const setOpen = useUIStore((s) => s.setEmergencyPanelOpen);
  const activeIds = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers);
  const panelGuard = useMapOverlayGuard<HTMLDivElement>();
  const backdropGuard = useMapOverlayGuard<HTMLDivElement>();
  /** Una riga aperta per volta: due dettagli aperti riportano il pannello al problema. */
  const [apertaId, setApertaId] = useState<EmergencyLayerId | null>(null);
  const [noteAperte, setNoteAperte] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, setOpen]);

  if (!open) return null;

  /** Categorie nell'ordine di prima apparizione, come faceva l'elenco a intestazioni. */
  const ordineCategorie = Array.from(new Set(EMERGENCY_LAYERS.map((l) => l.category)));
  const ordinatiPerCategoria = ordineCategorie.flatMap((cat) =>
    EMERGENCY_LAYERS.filter((l) => l.category === cat)
  );

  const activeDefs = EMERGENCY_LAYERS.filter((l) => activeIds.includes(l.id));
  // Fonti deduplicate: aree bruciate e FWI vengono entrambi da EFFIS, con attivi tutti e
  // due comparirebbe "Copernicus EFFIS · Copernicus EFFIS".
  const sources = Array.from(new Set(activeDefs.map((d) => stripAttributionMarkup(d.attribution))));
  const sourcesText = sources.length > 0 ? 'Fonti: ' + sources.join(' · ') : null;

  return (
    <>
      {/* Backdrop solo mobile: tocco fuori = chiudi, come il menu "Altro". Sta sotto lo
          sheet ma sopra la mappa; è guardato perché anche un tocco sul backdrop non
          deve diventare un waypoint. */}
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
        className="absolute bottom-16 right-14 z-[1000] w-80 max-h-[70vh] overflow-y-auto bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3
                   max-lg:fixed max-lg:inset-x-0 max-lg:bottom-14 max-lg:right-auto max-lg:w-full max-lg:rounded-b-none max-lg:z-[1190] max-lg:max-h-[60vh]"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-200">Layer di emergenza</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Chiudi"
            className="text-gray-500 hover:text-white max-lg:min-h-[44px] max-lg:min-w-[44px]"
          >
            ✕
          </button>
        </div>

        {/*
          Elenco piatto ma ORDINATO PER CATEGORIA: l'icona sulla riga porta il
          raggruppamento che prima costava quattro righe di intestazione, e perche' si
          legga come un raggruppamento i layer affini devono restare adiacenti.
          Nell'array le categorie sono interlacciate (i ripari stanno fra due layer dei
          temporali), quindi renderizzarlo cosi' com'e' spezzava i gruppi: ⛈ radar,
          🏠 rifugi, ⛈ instabilita'. Trovato guardando lo schermo, non dai test.
        */}
        {ordinatiPerCategoria.map((def) => (
          <EmergencyLayerRow
            key={def.id}
            def={def}
            aperta={apertaId === def.id}
            onApri={() => setApertaId((corrente) => (corrente === def.id ? null : def.id))}
          />
        ))}

        {/*
          Avvertenza e fonti: due paragrafi che stavano sempre in fondo e che nessuno
          rilegge a ogni apertura. L'avvertenza vera è il modale al primo uso, e
          l'attribuzione richiesta dalle licenze è già nell'angolo della mappa: qui
          restano per consultazione, dietro una riga.
        */}
        <button
          type="button"
          onClick={() => setNoteAperte((v) => !v)}
          aria-expanded={noteAperte}
          className="mt-2 w-full text-left text-[10px] text-gray-500 hover:text-gray-300 max-lg:min-h-[36px]"
        >
          ⓘ fonti e avvertenze {noteAperte ? '▲' : '▼'}
        </button>
        {noteAperte && (
          <div className="mt-1 space-y-1">
            <div className="text-[9px] text-gray-500">{DISCLAIMER}</div>
            {sourcesText && <div className="text-[9px] text-gray-500">{sourcesText}</div>}
          </div>
        )}
      </div>
    </>
  );
}
