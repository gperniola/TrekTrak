'use client';

import { useMemo } from 'react';
import { Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import { usePositionStore } from '@/stores/positionStore';

/**
 * **Dove sono**: il punto della propria posizione sulla mappa.
 *
 * Mancava. Lo store della posizione esisteva dalla v0.11.5 e lo alimentano già i due
 * punti che la chiedono — l'avvio e il tasto «La mia posizione» — ma nessuno la
 * **disegnava**: si concedeva il permesso, la mappa volava lì, e sul posto non c'era
 * niente. Segnalato il 2026-09-03: «pensavo che quando tappiamo per trovare la nostra
 * posizione il nostro punto appaia già in mappa».
 *
 * ## Non chiede mai la posizione
 *
 * Legge da `positionStore` e basta. È la stessa garanzia strutturale dell'avviso allerte:
 * se nessuno ha ottenuto una posizione, qui non c'è niente e non si disegna nulla. Non
 * esiste percorso per cui questo componente faccia comparire un prompt del browser.
 */

/**
 * Oltre questa incertezza il cerchio non si disegna.
 *
 * Un fix da rete cellulare può dichiarare chilometri di incertezza: un cerchio così
 * copre mezza mappa e non dice niente di utile, mentre il punto al centro continua a
 * dire «più o meno qui». Meglio il punto solo che un cerchio che sembra un'area di
 * interesse.
 */
export const INCERTEZZA_MASSIMA_M = 2_000;

/**
 * Il punto: anello bianco fuori, colore dentro.
 *
 * Il bianco non è decorazione, è **il modo in cui un punto si vede su qualunque sfondo**:
 * la mappa escursionistica sotto è piena di verdi, arancioni e rossi, e un pallino
 * colorato senza contorno si perde nel disegno dei sentieri. Stesso motivo per l'ombra.
 */
const iconaPosizione = L.divIcon({
  className: '',
  html: '<div style="position:relative;width:20px;height:20px">'
    + '<div style="position:absolute;inset:0;border-radius:50%;background:#fff;'
    + 'box-shadow:0 1px 4px rgba(0,0,0,.55)"></div>'
    + '<div style="position:absolute;inset:4px;border-radius:50%;background:#2563eb"></div>'
    // Il nome accessibile di un marker si calcola dal contenuto: senza questo testo
    // nascosto sarebbe un elemento senza nome sulla mappa.
    + '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);'
    + 'white-space:nowrap">La tua posizione</span>'
    + '</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export function PosizioneUtente() {
  const posizione = usePositionStore((s) => s.lastKnown);

  const incertezza = useMemo(() => {
    if (posizione?.accuracy == null) return null;
    if (!Number.isFinite(posizione.accuracy) || posizione.accuracy <= 0) return null;
    return posizione.accuracy <= INCERTEZZA_MASSIMA_M ? posizione.accuracy : null;
  }, [posizione]);

  if (posizione == null) return null;

  return (
    <>
      {incertezza != null && (
        <Circle
          center={[posizione.lat, posizione.lon]}
          radius={incertezza}
          interactive={false}
          pathOptions={{ color: '#2563eb', weight: 1, opacity: 0.5, fillColor: '#3b82f6', fillOpacity: 0.12 }}
        />
      )}
      <Marker
        position={[posizione.lat, posizione.lon]}
        icon={iconaPosizione}
        // Decorativo: non si clicca e non si raggiunge con la tastiera. `interactive`
        // da solo NON basta — Leaflet mette `role=button` e `tabIndex=0` per default,
        // lezione della v0.11.6.
        interactive={false}
        keyboard={false}
        // Sopra i tracciati, sotto i pannelli: è il punto che si cerca con l'occhio.
        zIndexOffset={500}
      />
    </>
  );
}
