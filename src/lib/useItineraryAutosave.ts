'use client';

import { useEffect } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { clearCurrent, saveCurrent } from './current-itinerary';

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
 *
 * ## Un itinerario vuoto non cancella quello salvato
 *
 * Qui c'era una perdita di dati, trovata il 2026-09-02 mentre provavo altro. Salvare uno
 * stato **vuoto** cancellava la chiave, e questa funzione salva anche quando la pagina
 * viene nascosta: bastava aprire l'app in una seconda scheda — che parte sempre vuota,
 * perche' il ripristino avviene dopo — e cambiare scheda, per far sparire il lavoro
 * salvato dalla prima. Al riavvio non tornava niente.
 *
 * Ora la cancellazione avviene **solo quando l'utente svuota davvero l'itinerario**,
 * cioe' quando lo store passa da "ha waypoint" a "non ne ha piu'" (Nuovo, o il cestino
 * sulla mappa): e' un gesto, non uno stato. Uno stato vuoto che non viene da nessun
 * gesto non scrive niente, e chi ha del lavoro salvato lo ritrova.
 */
export function useItineraryAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const salvaOra = () => {
      if (timer != null) { clearTimeout(timer); timer = null; }
      const s = useItineraryStore.getState();
      // Niente da conservare e niente da cancellare: chi e' vuoto non parla per gli altri.
      if (s.waypoints.length === 0) return;
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
      /*
        L'utente ha svuotato l'itinerario adesso: e' l'unico caso in cui si cancella.
        Subito, senza attesa — la cancellazione non ha niente da accorpare, e il gesto
        (Nuovo, cestino) deve essere definitivo anche se si chiude l'app nell'istante dopo.
      */
      if (stato.waypoints.length === 0 && prima.waypoints.length > 0) {
        if (timer != null) { clearTimeout(timer); timer = null; }
        clearCurrent();
        return;
      }
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
