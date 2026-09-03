'use client';

import { useMemo, useState } from 'react';
import { Circle, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { anelliPerVista, type Anello } from '@/lib/anelli-distanza';

/**
 * **Gli anelli di distanza** attorno a un punto.
 *
 * Chiesto il 2026-09-03, e la ragione è didattica: la bussola dà **una** distanza, quella
 * del bersaglio. Gli anelli la danno per tutto quello che si vede — «quella cima è appena
 * oltre il secondo anello» diventa un numero senza misurare niente. È il trucco delle
 * carte militari, e leggere una distanza a occhio è precisamente il mestiere che questa
 * app insegna.
 *
 * I raggi si scelgono da una scala 1-2-5 in `lib/anelli-distanza.ts`, in modo che ce ne
 * stiano tre nella vista: la scelta è pura e verificabile, qui c'è solo il disegno.
 */

/**
 * Ogni anello si disegna **due volte**: prima bianco e più spesso, poi colorato sopra.
 *
 * È lo stesso motivo del contorno bianco dei marker: la mappa escursionistica sotto è
 * piena di linee colorate, e un cerchio sottile di un colore qualunque si confonde coi
 * sentieri. Due tratti costano due oggetti Leaflet per anello — sei in tutto — e sono la
 * differenza fra un anello che si legge e uno che c'è ma non si vede.
 */
const COLORE = '#0284c7';

function etichetta(a: Anello): L.DivIcon {
  return L.divIcon({
    className: '',
    // L'ombra del testo fa da contorno: senza, il numero sparisce sopra una macchia
    // chiara della mappa.
    html: `<span style="font-size:10px;font-weight:700;color:${COLORE};white-space:nowrap;`
      + 'text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">'
      + `${a.etichetta}</span>`,
    iconSize: [48, 14],
    iconAnchor: [24, 7],
  });
}

/** Un grado di latitudine, in metri: serve a mettere l'etichetta a nord dell'anello. */
const METRI_PER_GRADO_LAT = 111_320;

export function AnelliDistanza({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  /*
    Il passo degli anelli dipende da **quanto si vede**, quindi si ricalcola a fine
    movimento e a fine zoom. Non durante: ricalcolarlo a ogni fotogramma di uno zoom
    animato farebbe cambiare i numeri sotto gli occhi mentre la mano è ancora sul
    telefono.
  */
  const [tick, setTick] = useState(0);
  useMapEvents({ moveend: () => setTick((t) => t + 1), zoomend: () => setTick((t) => t + 1) });

  const anelli = useMemo(() => {
    const b = map.getBounds();
    const larghezza = map.distance(b.getNorthWest(), b.getNorthEast());
    const altezza = map.distance(b.getNorthWest(), b.getSouthWest());
    // Il raggio che ci sta davvero nella vista è metà del lato più corto.
    return anelliPerVista(Math.min(larghezza, altezza) / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, tick]);

  if (anelli.length === 0) return null;

  return (
    <>
      {anelli.map((a) => (
        <Circle
          key={`alone-${a.raggio}`}
          center={[lat, lon]}
          radius={a.raggio}
          interactive={false}
          pathOptions={{ color: '#ffffff', weight: 3.5, opacity: 0.75, fill: false }}
        />
      ))}
      {anelli.map((a) => (
        <Circle
          key={`anello-${a.raggio}`}
          center={[lat, lon]}
          radius={a.raggio}
          interactive={false}
          pathOptions={{ color: COLORE, weight: 1.5, opacity: 0.9, dashArray: '5 5', fill: false }}
        />
      ))}
      {anelli.map((a) => (
        <Marker
          key={`etichetta-${a.raggio}`}
          position={[lat + a.raggio / METRI_PER_GRADO_LAT, lon]}
          icon={etichetta(a)}
          interactive={false}
          keyboard={false}
        />
      ))}
    </>
  );
}
