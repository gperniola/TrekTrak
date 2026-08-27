'use client';

import { useEffect } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { saveCurrent } from './current-itinerary';

/** Abbastanza per non scrivere a ogni tasto premuto, poco per non perdere nulla. */
const ATTESA_MS = 400;

/**
 * Tiene l'itinerario in lavorazione su disco.
 *
 * Osserva solo i campi che sono *lavoro*: waypoint, tratte, nome, modalita', id.
 * `profileHover` cambia a ogni movimento del dito sul profilo altimetrico, quindi
 * sottoscrivere lo store senza filtrare significherebbe scrivere in localStorage
 * decine di volte al secondo.
 *
 * Salva anche quando la pagina viene nascosta: su mobile il sistema puo' sospendere
 * una PWA senza preavviso, e i 400 ms di attesa sarebbero persi.
 */
export function useItineraryAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const salvaOra = () => {
      if (timer != null) { clearTimeout(timer); timer = null; }
      const s = useItineraryStore.getState();
      saveCurrent({
        itineraryId: s.itineraryId,
        itineraryName: s.itineraryName,
        createdAt: s.createdAt,
        appMode: s.appMode,
        waypoints: s.waypoints,
        legs: s.legs,
      });
    };

    const unsub = useItineraryStore.subscribe((stato, prima) => {
      const cambiato = stato.waypoints !== prima.waypoints
        || stato.legs !== prima.legs
        || stato.itineraryName !== prima.itineraryName
        || stato.appMode !== prima.appMode
        || stato.itineraryId !== prima.itineraryId;
      if (!cambiato) return;
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(salvaOra, ATTESA_MS);
    });

    const allUscita = () => { if (document.visibilityState === 'hidden') salvaOra(); };
    document.addEventListener('visibilitychange', allUscita);
    window.addEventListener('pagehide', salvaOra);

    return () => {
      if (timer != null) clearTimeout(timer);
      document.removeEventListener('visibilitychange', allUscita);
      window.removeEventListener('pagehide', salvaOra);
      unsub();
    };
  }, []);
}
