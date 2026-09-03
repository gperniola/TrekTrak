'use client';

import { useEffect, useMemo, useState } from 'react';
import { Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import { usePositionStore } from '@/stores/positionStore';
import { etaPosizione, nomePosizione, type EtaPosizione } from '@/lib/eta-posizione';

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
 *
 * ## Un punto vecchio non dice «sei qui»
 *
 * Un punto su una mappa si legge «sei qui, adesso». Dopo qualche minuto di cammino non è
 * più vero, e il rilevamento può restare quello di prima per ore — l'app non insegue il
 * GPS quando nessuno strumento è acceso. Quindi il punto **cambia aspetto**: pieno
 * finché è attuale, vuoto quando è vecchio, e il nome accessibile dice sempre quanto
 * tempo è passato. Cancellarlo sarebbe peggio: «eri lì» è un'informazione vera e utile.
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

/** Ogni minuto: l'età del punto va rivalutata anche se nessuno tocca niente. */
const PASSO_OROLOGIO_MS = 60_000;

/**
 * Il punto: anello bianco fuori, colore dentro.
 *
 * Il bianco non è decorazione, è **il modo in cui un punto si vede su qualunque sfondo**:
 * la mappa escursionistica sotto è piena di verdi, arancioni e rossi, e un pallino
 * colorato senza contorno si perde nel disegno dei sentieri. Stesso motivo per l'ombra.
 *
 * Vuoto quando la posizione è vecchia: la stessa forma, senza il pieno, che è il modo
 * cartografico di dire «rilevato, non attuale».
 */
function iconaPosizione(eta: EtaPosizione): L.DivIcon {
  const nome = nomePosizione(eta);
  const cuore = eta.attuale
    ? '<div style="position:absolute;inset:4px;border-radius:50%;background:#2563eb"></div>'
    : '<div style="position:absolute;inset:4px;border-radius:50%;background:#fff;'
      + 'border:2.5px solid #64748b"></div>';
  return L.divIcon({
    className: '',
    html: '<div style="position:relative;width:20px;height:20px">'
      + '<div style="position:absolute;inset:0;border-radius:50%;background:#fff;'
      + 'box-shadow:0 1px 4px rgba(0,0,0,.55)"></div>'
      + cuore
      // Il nome accessibile di un marker si calcola dal contenuto: senza questo testo
      // nascosto sarebbe un elemento senza nome sulla mappa — e per chi non vede è
      // l'unico posto dove l'età della posizione si legge a parole.
      + '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);'
      + `white-space:nowrap">${nome}</span>`
      + '</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function PosizioneUtente() {
  const posizione = usePositionStore((s) => s.lastKnown);

  /*
    Un orologio grossolano: l'età del punto va rivalutata col passare del tempo, non solo
    quando cambia qualcos'altro. Senza, un punto rilevato adesso resterebbe «attuale»
    per tutta la sessione — che è esattamente il difetto da cui questo codice nasce.
  */
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    if (posizione == null) return;
    const t = setInterval(() => setAdesso(Date.now()), PASSO_OROLOGIO_MS);
    return () => clearInterval(t);
  }, [posizione]);

  const eta = useMemo(
    () => (posizione == null ? null : etaPosizione(posizione.at, adesso)),
    [posizione, adesso],
  );

  const incertezza = useMemo(() => {
    if (posizione?.accuracy == null || eta == null) return null;
    if (!Number.isFinite(posizione.accuracy) || posizione.accuracy <= 0) return null;
    /*
      Il cerchio dell'incertezza vale solo per una posizione attuale: disegnarlo attorno a
      un rilevamento di un'ora fa dichiarerebbe una precisione su un punto che non è più
      dove sei — due affermazioni sbagliate invece di una.
    */
    if (!eta.attuale) return null;
    return posizione.accuracy <= INCERTEZZA_MASSIMA_M ? posizione.accuracy : null;
  }, [posizione, eta]);

  if (posizione == null || eta == null) return null;

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
        icon={iconaPosizione(eta)}
        // Decorativo: non si clicca e non si raggiunge con la tastiera. `interactive`
        // da solo NON basta — Leaflet mette `role=button` e `tabIndex=0` per default,
        // lezione della v0.11.6.
        interactive={false}
        keyboard={false}
        // Sopra i tracciati, sotto il mirino della bussola (600): è il punto che si
        // cerca con l'occhio, ma quando si mira il mirino viene prima.
        zIndexOffset={500}
      />
    </>
  );
}
