'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_PANE, type EmergencyLayerDef } from '@/lib/emergency-layers';

/**
 * Mattonelle XYZ statiche con una **data** nel percorso: è il caso di NASA GIBS.
 *
 * Non è un WMS: non c'è nessun `GetMap` da comporre, la data è un pezzo dell'URL. Perciò
 * "non ci sono dati per quel giorno" non arriva come un campo di una risposta, ma come
 * mattonelle che non caricano — e l'unica cosa sensata da fare è **provare il giorno
 * prima**.
 *
 * Il passaggio del satellite copre una fascia alla volta: nelle prime ore della giornata
 * il mosaico globale è incompleto, e senza il ripiego il layer sarebbe vuoto proprio la
 * mattina, quando lo si guarda per decidere se partire.
 */
export function EmergencyXyzLayer({ def }: { def: EmergencyLayerDef }) {
  /*
    **Il «Riprova» deve poter ricominciare da capo.**

    `retryLayer` spegne e riaccende il layer, ma questo componente resta montato: senza
    rimontarlo, l'elenco dei giorni e l'indice restavano quelli di prima, nessun effetto
    ripartiva, e lo stato dichiarato dallo store non tornava mai da 'loading' — cioe' il
    pannello restava in «Caricamento...» per sempre, che e' peggio dell'errore da cui si
    veniva. E' lo stesso difetto dei layer WMS, corretto allora con `retryTick`: qui la
    chiave lo applica a tutto il componente, cosi' riparte anche la scelta del giorno —
    che e' proprio la cosa che si vuole riprovare quando le mattonelle di oggi mancano.
  */
  const tentativo = useEmergencyStore((s) => s.retryTick[def.id] ?? 0);
  return <MattonelleConData key={tentativo} def={def} />;
}

function MattonelleConData({ def }: { def: EmergencyLayerDef }) {
  const config = def.xyz;
  const report = useEmergencyStore((s) => s.reportXyzTile);
  const giorni = useMemo(() => config?.giorni(new Date()) ?? [], [config]);
  const [indice, setIndice] = useState(0);

  const giorno = giorni[indice] ?? null;

  /*
    Un errore sulle mattonelle fa scendere di un giorno. Oltre l'ultimo non si va: si
    dichiara che immagini non ce ne sono, invece di restare su un giorno che non risponde
    con la mappa vuota — che si leggerebbe come "niente neve".
  */
  const [esaurito, setEsaurito] = useState(false);
  const inErrore = useCallback(() => {
    setIndice((i) => {
      if (i + 1 < giorni.length) return i + 1;
      setEsaurito(true);
      return i;
    });
  }, [giorni.length]);

  // Il giorno usato va dichiarato: un'immagine di ieri presentata come di oggi è la
  // classe di difetto piu' ripetuta di questo progetto.
  useEffect(() => {
    if (esaurito) { report(def.id, { esaurito: true }); return; }
    if (giorno == null) return;
    report(def.id, { giorno });
  }, [def.id, giorno, esaurito, report]);

  if (config == null || giorno == null) return null;

  return (
    <TileLayer
      // La key cambia col giorno: cambiare `url` a un TileLayer montato non basta a
      // ripulire le mattonelle vecchie quando il template cambia del tutto.
      key={giorno}
      url={config.template(giorno)}
      pane={EMERGENCY_PANE}
      opacity={config.opacity}
      /*
        Il tetto NON è prudenza: il set di mattonelle di GIBS si chiama
        `GoogleMapsCompatible_Level8`, quindi sopra lo zoom 8 non esistono. Oltre, Leaflet
        stira l'ultimo livello vero — sfocato, ma vero.
      */
      maxNativeZoom={config.zoomNativoMassimo}
      eventHandlers={{ tileerror: inErrore }}
    />
  );
}
