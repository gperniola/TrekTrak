'use client';

import { useItineraryStore } from '@/stores/itineraryStore';
import { saveSettings } from '@/lib/storage';
import { ETICHETTE_TEMA, ICONE_TEMA, TEMI, type Tema } from '@/lib/tema';
import { useTema } from '@/lib/useTema';

/**
 * Sceglie l'aspetto: chiaro, scuro, o come il sistema (task-35).
 *
 * «Come il sistema» è il valore di partenza, e non è un terzo aspetto: è una delega. Chi
 * ha messo il telefono in scuro alle sette di sera non vuole ripetere la scelta qui, e
 * l'app lo segue **mentre cambia** — la preferenza del sistema si ascolta, non si legge
 * una volta all'avvio.
 */
export function SceltaTema() {
  const { tema, effettivo } = useTema();
  const settings = useItineraryStore((s) => s.settings);
  const updateSettings = useItineraryStore((s) => s.updateSettings);

  const scegli = (nuovo: Tema) => {
    const prossime = { ...settings, tema: nuovo };
    updateSettings(prossime);
    saveSettings(prossime);
  };

  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase text-gray-400">Aspetto</div>
      <div role="radiogroup" aria-label="Aspetto dell'app" className="flex gap-1">
        {TEMI.map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={tema === t}
            onClick={() => scegli(t)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              tema === t
                ? 'bg-green-700 text-su-colore font-bold'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span aria-hidden>{ICONE_TEMA[t]}</span>
            <span>{ETICHETTE_TEMA[t]}</span>
          </button>
        ))}
      </div>
      {/*
        Con «come il sistema» il nome dell'aspetto non dice cosa si vedra': lo si scrive,
        perche' un'impostazione che non mostra il suo effetto costringe a indovinare.
      */}
      {tema === 'sistema' && (
        <p className="text-[11px] text-gray-400">
          Adesso il sistema chiede il tema <strong className="font-medium text-gray-300">{effettivo}</strong>.
        </p>
      )}
    </div>
  );
}
