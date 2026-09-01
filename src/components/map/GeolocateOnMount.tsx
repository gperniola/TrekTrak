'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { usePositionStore } from '@/stores/positionStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { rettangoloDaPunti, type Rettangolo } from '@/lib/tile-offline';
import {
  MAX_ZOOM_INQUADRAMENTO,
  seguireLaPosizione,
  vistaIniziale,
  type VistaIniziale,
  type VistaSalvata,
} from '@/lib/vista-iniziale';

// Chieti, Italy - default center
export const DEFAULT_CENTER: [number, number] = [42.351, 14.168];
export const DEFAULT_ZOOM = 13;
export const MAX_ZOOM = 19;

const VIEW_KEY = 'tt_map_view';

function leggiVistaSalvata(): VistaSalvata | null {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<VistaSalvata>;
    if (typeof v?.lat !== 'number' || typeof v?.lng !== 'number' || typeof v?.z !== 'number') {
      return null;
    }
    return { lat: v.lat, lng: v.lng, z: v.z };
  } catch {
    // JSON malformato o sessionStorage non disponibile: vale "nessuna vista salvata".
    return null;
  }
}

/**
 * Decide cosa guardare all'apertura, e se seguire il GPS quando arriva.
 *
 * Le regole stanno in `lib/vista-iniziale.ts`, senza Leaflet; qui c'è solo il fare. La
 * novità del task-61 è che un **itinerario ripristinato viene inquadrato**: prima la mappa
 * restava sul centro predefinito, e chi apriva l'app senza segnale e senza posizione — la
 * situazione per cui esiste il pre-caricamento delle mattonelle — si trovava lontano dal
 * proprio percorso, e per raggiungerlo doveva trascinare la mappa a mano attraverso aree
 * mai scaricate.
 *
 * ## Le due cose che qui NON vanno confuse
 *
 * `tt_map_view` non è «dove si trova la mappa»: è **dove l'utente ha scelto di guardare**,
 * ed è anche il segnale che fa saltare la geolocalizzazione. Registrarci dentro gli
 * spostamenti automatici rompe l'app in modo silenzioso — misurato con una sonda mentre
 * scrivevo questo task, dopo aver "sistemato" l'ordine degli ascoltatori: il GPS smetteva
 * di essere interrogato del tutto, e sul sentiero la mappa avrebbe smesso di seguire chi
 * cammina.
 *
 * Da qui due guardie con scopi diversi, che sembrano la stessa cosa e non lo sono:
 * - `nostroMovimento` — «questo `movestart` è nostro, non è un gesto». Vale per **tutti**
 *   i nostri spostamenti, GPS compreso: nessuno di essi è una scelta dell'utente.
 * - `apertura` — «non registrare questa vista». Vale **solo** per l'inquadramento
 *   iniziale. Lo spostamento verso il GPS invece si registra, perché da lì in poi è lì
 *   che si sta guardando davvero.
 */
export function GeolocateOnMount() {
  const map = useMap();
  const ripristini = useItineraryStore((s) => s.ripristiniItinerario);

  const utenteHaMosso = useRef(false);
  const nostroMovimento = useRef(false);
  const apertura = useRef(false);
  const partenza = useRef<VistaIniziale>({ tipo: 'predefinita' });
  const giaInquadrato = useRef(false);

  /** Uno spostamento deciso da noi: non è un gesto dell'utente. */
  const muoviNoi = (azione: (m: LeafletMap) => void) => {
    nostroMovimento.current = true;
    try {
      azione(map);
    } finally {
      // Leaflet emette `movestart` in modo sincrono dentro setView/fitBounds/flyTo:
      // verificato con una sonda, non dedotto.
      nostroMovimento.current = false;
    }
  };

  /**
   * Sposta la mappa **senza dichiararlo una scelta dell'utente**.
   *
   * La guardia si libera al frame successivo e non subito: `moveend` con `animate: false`
   * arriva sincrono o entro lo stesso frame, e legarsi al solo caso sincrono sarebbe una
   * scommessa sul funzionamento interno di Leaflet.
   */
  const senzaRegistrare = (azione: (m: LeafletMap) => void) => {
    apertura.current = true;
    muoviNoi(azione);
    requestAnimationFrame(() => { apertura.current = false; });
  };

  const inquadra = (r: Rettangolo) => {
    senzaRegistrare((m) => m.fitBounds(
      [[r.south, r.west], [r.north, r.east]],
      // `maxZoom` non e' cosmetico: con un waypoint solo il rettangolo ha dimensione
      // zero, e senza tetto Leaflet andrebbe all'ingrandimento massimo — l'app si
      // aprirebbe incollata a un tetto, senza contesto.
      { padding: [40, 40], maxZoom: MAX_ZOOM_INQUADRAMENTO, animate: false },
    ));
  };

  useEffect(() => {
    let unmounted = false;
    const onMove = () => { if (!nostroMovimento.current) utenteHaMosso.current = true; };

    // Persisti la vista (centro+zoom) ad ogni spostamento: così un eventuale remount o
    // reload della pagina NON ri-centra bruscamente sul GPS — ripristiniamo dov'eravamo.
    const saveView = () => {
      if (apertura.current) return;
      try {
        const c = map.getCenter();
        sessionStorage.setItem(VIEW_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, z: map.getZoom() }));
      } catch { /* sessionStorage non disponibile */ }
    };

    const salvata = leggiVistaSalvata();
    partenza.current = vistaIniziale(salvata, null);

    if (partenza.current.tipo === 'salvata') {
      const v = partenza.current.vista;
      senzaRegistrare((m) => m.setView([v.lat, v.lng], v.z, { animate: false }));
    }
    // L'itinerario lo inquadra l'effetto qui sotto, che e' l'unico posto in cui accade —
    // anche quando il ripristino e' gia' avvenuto prima che la mappa esistesse.

    map.on('movestart', onMove);
    map.on('moveend', saveView);
    map.on('zoomend', saveView);

    // Geolocalizzazione solo alla PRIMA apertura della sessione (nessuna vista salvata).
    if (salvata == null && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Pubblica la posizione: chi ne ha bisogno la legge da qui invece di
          // richiederla, evitando un secondo fix GPS e qualunque nuovo prompt.
          const posizione = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          usePositionStore.getState().setLastKnown({ ...posizione, accuracy: pos.coords.accuracy });
          if (unmounted) return;

          /*
            L'itinerario viene rimesso in piedi da un effetto di `page.tsx`, e il fix GPS
            arriva quando arriva: quale dei due sia pronto per primo non e' garantito da
            nulla. Invece di fidarsi dell'ordine, si rilegge l'itinerario **adesso**.
          */
          const attuale = partenza.current.tipo === 'salvata'
            ? partenza.current
            : vistaIniziale(null, rettangoloDaPunti(useItineraryStore.getState().waypoints));

          if (seguireLaPosizione({ posizione, partenza: attuale, utenteHaMosso: utenteHaMosso.current })) {
            muoviNoi((m) => m.flyTo([posizione.lat, posizione.lon], DEFAULT_ZOOM, { duration: 1.5 }));
          }
        },
        () => { /* permesso negato o errore — resta dov'e' */ }
      );
    }

    return () => {
      unmounted = true;
      map.off('movestart', onMove);
      map.off('moveend', saveView);
      map.off('zoomend', saveView);
    };
    // Volutamente solo `map`: questo effetto e' l'apertura, e deve girare una volta sola.
    // L'itinerario che arriva dopo e' gestito dall'effetto qui sotto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  /**
   * Inquadra il percorso quando un itinerario viene **ripreso dall'autosalvataggio**.
   *
   * Si ascolta il conteggio dei ripristini e non i waypoint, e la differenza non è
   * stilistica: guardando i waypoint, la mappa si sposterebbe anche quando l'utente tocca
   * per creare il **primo** punto a mano — un salto sotto le dita, nel momento peggiore.
   * Il conteggio dice esattamente la cosa che interessa: «è tornato un itinerario da
   * prima».
   *
   * Vale anche quando il ripristino è già avvenuto prima che la mappa esistesse:
   * `hydrateCurrent` gira in un effetto di `page.tsx`, e chi dei due arrivi per primo non
   * è garantito da nulla. Un effetto che parte da un conteggio già maggiore di zero fa
   * la cosa giusta in entrambi gli ordini, mentre presumerne uno avrebbe prodotto il
   * difetto peggiore: una funzione che sembra esserci e non fa niente.
   */
  useEffect(() => {
    if (ripristini === 0 || giaInquadrato.current || utenteHaMosso.current) return;
    if (partenza.current.tipo === 'salvata') return;
    const r = rettangoloDaPunti(useItineraryStore.getState().waypoints);
    if (r == null) return;
    giaInquadrato.current = true;
    partenza.current = { tipo: 'itinerario', rettangolo: r };
    inquadra(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ripristini, map]);

  return null;
}
