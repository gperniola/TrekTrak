'use client';

import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useMapOverlayGuard } from '../useMapOverlayGuard';
import { mostra } from '@/lib/profilo';

export function EmergencyLayersButton() {
  const open = useUIStore((s) => s.emergencyPanelOpen);
  const setOpen = useUIStore((s) => s.setEmergencyPanelOpen);
  const setMoreMenuOpen = useUIStore((s) => s.setMoreMenuOpen);
  const activeCount = useItineraryStore((s) => s.settings.mapDisplay.emergencyLayers.length);
  const guard = useMapOverlayGuard<HTMLButtonElement>();

  const toggle = () => {
    // Mutua esclusione col menu "Altro": due sheet mobile sovrapposti renderebbero
    // ambigua anche la priorità del tasto Indietro.
    if (!open) setMoreMenuOpen(false);
    setOpen(!open);
  };

  const profilo = useUIStore((s) => s.profilo);
  /*
   * In Imparo si sta a casa su una carta: i layer di emergenza non si offrono affatto.
   *
   * La guardia sta QUI, dopo tutti gli hook e appena prima del JSX: messa in cima al
   * corpo renderebbe condizionali gli hook che seguono. L'ha ripreso ESLint
   * (`react-hooks/rules-of-hooks`), come il giorno prima in MoreMenu.
   */
  if (!mostra('layerEmergenza', profilo)) return null;

  return (
    <button
      ref={guard}
      onClick={toggle}
      aria-label={activeCount > 0 ? `Layer di emergenza, ${activeCount} attivi` : 'Layer di emergenza'}
      aria-expanded={open}
      title="Layer di emergenza (incendi, allerte)"
      className="absolute bottom-16 right-3 z-[1000] w-10 h-10 max-lg:w-11 max-lg:h-11 rounded-full shadow-lg flex items-center justify-center text-lg bg-gray-800/90 text-amber-400 hover:bg-gray-700 transition-colors"
    >
      ⚠️
      {activeCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}
