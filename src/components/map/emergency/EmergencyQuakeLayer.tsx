'use client';

import { useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, Popup } from 'react-leaflet';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import {
  chiaveQuake, coloreMagnitudo, quandoDetto, raggioMagnitudo, type Quake,
} from '@/lib/quakes-api';
import { numero } from '@/lib/formato';

/**
 * Terremoti delle ultime 48 ore, dall'INGV.
 *
 * Perché su un'app di trekking: una zona che si sta muovendo è una zona dove i sentieri
 * possono essere interrotti da crolli e dove un rifugio può essere chiuso. Il valore non
 * è il singolo evento ma il **quadro**: cinque scosse in due giorni sulla stessa dorsale
 * si vedono a colpo d'occhio e cambiano un programma.
 */
export function EmergencyQuakeLayer({ quakes }: { quakes: Quake[] }) {
  /*
    Renderer canvas come i focolai: sono fino a trecento cerchi, e su SVG sarebbero
    trecento nodi nel DOM.

    `bubblingMouseEvents: false` NON è decorativo: col renderer canvas il bersaglio del
    click è la tela, e Leaflet aggiunge la mappa come bersaglio di riserva — quindi un
    tocco apriva il popup **e** creava un waypoint. È il difetto della v0.11.1, corretto
    dopo essere finito in produzione: qui è messo dall'inizio.
  */
  const renderer = useMemo(() => L.canvas({ pane: EMERGENCY_PANE, padding: 0.3 }), []);
  // Non memorizzata: serve solo a scrivere "due ore fa" nei popup, e ricalcolarla a ogni
  // render costa nulla. Con `useMemo` legata a `quakes` era una dipendenza finta.
  const adesso = new Date();

  return (
    <>
      {quakes.map((q, indice) => (
        <CircleMarker
          key={chiaveQuake(q, indice)}
          center={[q.lat, q.lon]}
          radius={raggioMagnitudo(q.mag)}
          renderer={renderer}
          pane={EMERGENCY_PANE}
          bubblingMouseEvents={false}
          pathOptions={{
            color: '#1f2937',
            weight: 1,
            fillColor: coloreMagnitudo(q.mag),
            fillOpacity: 0.75,
          }}
        >
          <Popup>
            <div className="text-xs space-y-0.5">
              <div className="font-bold">
                Magnitudo {numero(q.mag, 1)}
                {q.magType != null && <span className="font-normal"> ({q.magType})</span>}
              </div>
              {q.place != null && <div>{q.place}</div>}
              <div>
                {/*
                  La profondità è la seconda cosa che conta dopo la magnitudo: la stessa
                  magnitudo a 8 km si sente e a 300 km quasi no.
                */}
                {q.depthKm != null
                  ? <>Profondità {numero(q.depthKm, 0)} km</>
                  : <span className="text-gray-400">profondità non indicata</span>}
              </div>
              <div className="text-gray-400">
                {quandoDetto(q.timeISO, adesso)}
                {' — '}
                {new Date(q.timeISO).toLocaleString('it-IT', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  timeZone: 'Europe/Rome',
                })}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
