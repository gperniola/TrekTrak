'use client';

import { useRef } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { saveSettings, KEYS } from '@/lib/storage';
import { confirm as appConfirm } from '@/stores/notificationStore';
import type { EmergencyLayerId } from '@/lib/emergency-layers';
import type { AppSettings } from '@/lib/types';

export const DISCLAIMER =
  'I dati provengono da satelliti e bollettini ufficiali ma possono essere incompleti o in ritardo. ' +
  'Non sostituiscono i canali ufficiali di allerta. In caso di emergenza chiama il 112.';

/**
 * **Accendere e spegnere un layer di emergenza.**
 *
 * Trentacinque righe che stavano dentro `EmergencyLayerRow`, e che contengono due
 * guardie non ovvie: sono la ragione per cui vale la pena tirarle fuori.
 *
 * ## Le due guardie
 *
 * 1. **Anti-rientranza.** Il disclaimer si mostra una volta sola, e mostrarlo è un
 *    `await`: un secondo tocco mentre si aspetta la risposta aprirebbe un **secondo**
 *    dialogo sullo stesso layer. Il riferimento è sincrono, lo stato di React no.
 * 2. **Lo stato si rilegge fresco, due volte.** Fra il tocco e questo punto — e
 *    soprattutto **dopo** l'`await` del disclaimer, che può durare secondi — un altro
 *    interruttore può aver già aggiornato le impostazioni. Usare la chiusura di
 *    `settings` catturata al render vorrebbe dire scrivere una lista vecchia, cioè
 *    spegnere il layer che qualcun altro ha appena acceso.
 *
 * Il disclaimer si accetta una volta e vale per tutti i layer: è una dichiarazione sulla
 * natura dei dati, non su un layer in particolare.
 */
export function useAccendiLayer(id: EmergencyLayerId): () => Promise<void> {
  const updateSettings = useItineraryStore((s) => s.updateSettings);
  const startLayer = useEmergencyStore((s) => s.startLayer);
  const stopLayer = useEmergencyStore((s) => s.stopLayer);
  const inAttesa = useRef(false);

  const salva = (base: AppSettings, elenco: EmergencyLayerId[]) => {
    const nuove = { ...base, mapDisplay: { ...base.mapDisplay, emergencyLayers: elenco } };
    updateSettings(nuove);
    saveSettings(nuove);
  };

  return async () => {
    if (inAttesa.current) return;
    inAttesa.current = true;
    try {
      const base = useItineraryStore.getState().settings;
      if (base.mapDisplay.emergencyLayers.includes(id)) {
        salva(base, base.mapDisplay.emergencyLayers.filter((x) => x !== id));
        stopLayer(id);
        return;
      }
      let visto = false;
      try { visto = localStorage.getItem(KEYS.emergencyDisclaimer) === '1'; } catch { /* noop */ }
      if (!visto) {
        const ok = await appConfirm({
          title: 'Layer di emergenza', message: DISCLAIMER,
          variant: 'info', confirmText: 'Ho capito', cancelText: 'Annulla',
        });
        if (!ok) return;
        try { localStorage.setItem(KEYS.emergencyDisclaimer, '1'); } catch { /* noop */ }
      }
      const fresche = useItineraryStore.getState().settings;
      if (!fresche.mapDisplay.emergencyLayers.includes(id)) {
        salva(fresche, [...fresche.mapDisplay.emergencyLayers, id]);
      }
      startLayer(id);
    } finally {
      inAttesa.current = false;
    }
  };
}
