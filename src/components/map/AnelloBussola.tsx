'use client';

import { Circle } from 'react-leaflet';

/**
 * **L'anello della bussola**: un cerchio che passa per il punto mirato.
 *
 * È il compasso, quello del disegno: si apre fino al bersaglio e si traccia il cerchio.
 * Il raggio **è** la distanza misurata, quindi spostando la mappa l'anello si allarga e si
 * restringe insieme al mirino, e dice una cosa che nessun numero dice da solo: *tutto
 * quello che sta su questo cerchio è lontano quanto ciò che sto puntando*. Quella cima là
 * in fondo è dentro o fuori? Si guarda, non si calcola.
 *
 * ## Perché uno solo, e non tre a distanze tonde
 *
 * La prima stesura disegnava tre anelli fissi a distanze tonde (500 m, 1 km, 1,5 km): utile
 * in astratto, ma non era la cosa chiesta e nemmeno la più utile. Tre anelli fissi
 * arredano la mappa; **un anello che segue il bersaglio** è uno strumento che si muove con
 * la mano, e la differenza è la stessa che passa fra una griglia stampata e un compasso.
 *
 * Nessuna etichetta: la distanza sta già nel pannello in basso, sempre a schermo. Due
 * copie dello stesso numero sono due occasioni di scriverlo in modi diversi.
 */

/** Sotto questo raggio non si disegna: un cerchio di pochi metri è un punto sporco. */
export const RAGGIO_MINIMO_M = 5;

const COLORE = '#0284c7';

export function AnelloBussola({ lat, lon, raggioMetri }: { lat: number; lon: number; raggioMetri: number }) {
  if (!Number.isFinite(raggioMetri) || raggioMetri < RAGGIO_MINIMO_M) return null;

  return (
    <>
      {/*
        Due tratti, bianco sotto e colore sopra: la mappa escursionistica è piena di linee
        colorate, e un cerchio sottile si confonde coi sentieri. È lo stesso motivo del
        contorno bianco dei marker, e la differenza fra un anello che si legge e uno che
        c'è ma non si vede.
      */}
      <Circle
        center={[lat, lon]}
        radius={raggioMetri}
        interactive={false}
        pathOptions={{ color: '#ffffff', weight: 4, opacity: 0.75, fill: false }}
      />
      <Circle
        center={[lat, lon]}
        radius={raggioMetri}
        interactive={false}
        pathOptions={{ color: COLORE, weight: 1.5, opacity: 0.9, dashArray: '5 5', fill: false }}
      />
    </>
  );
}
