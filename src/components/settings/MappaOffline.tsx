'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/stores/notificationStore';
import {
  AREA_MASSIMA_KM2,
  TETTO_TESSERE,
  ZOOM_MASSIMO,
  ZOOM_MINIMO,
  areaLeggibile,
  pesoLeggibile,
} from '@/lib/tile-offline';
import {
  COSTO_QUOTA_PER_TESSERA,
  spazioOrigine,
  spazioTessere,
  svuotaTessere,
} from '@/lib/tile-download';
import { useTessereOffline } from '@/lib/useTessereOffline';
import { numero } from '@/lib/formato';

/**
 * Scarica in anticipo le mattonelle dell'itinerario, per averle senza segnale (task-37).
 *
 * Il service worker conserva già quelle **guardate almeno una volta**: basta per riaprire
 * l'app dov'era, non basta per la situazione per cui questa app esiste. Qui si chiede in
 * anticipo l'area dell'itinerario, con un margine, e si dice **fin dove** si arriva —
 * perché il tetto di cinquecento mattonelle non è una difesa dal nostro codice ma un patto
 * con chi ci regala le mappe.
 */
export function MappaOffline() {
  /*
    Piano, elenco e scaricamento arrivano dal modulo condiviso: lo stesso lo usa il
    pulsante nell'editor. Quando i due erano separati, il conto mostrato e il lavoro
    fatto sono divergiti — 35 dichiarate, 70 scaricate.
  */
  const { piano, area, daScaricare, nomeMappa, conSentieri, avanzamento, inCorso, scarica, interrompi } =
    useTessereOffline();
  const [conservate, setConservate] = useState<{ quante: number } | null>(null);
  const [spazio, setSpazio] = useState<{ usato: number; disponibile: number } | null>(null);

  const aggiornaSpazio = useCallback(() => {
    void spazioTessere().then(setConservate);
    void spazioOrigine().then(setSpazio);
  }, []);

  useEffect(() => { aggiornaSpazio(); }, [aggiornaSpazio]);
  // Lo spazio si rilegge quando lo scaricamento finisce.
  useEffect(() => { if (!inCorso) aggiornaSpazio(); }, [inCorso, aggiornaSpazio]);

  const svuota = async () => {
    const quante = await svuotaTessere();
    aggiornaSpazio();
    toast.info(quante > 0 ? 'Mappe offline liberate.' : 'Non c’era niente da liberare.');
  };



  return (
    <div className="space-y-2">
      <div className="text-xs uppercase text-gray-400">Mappa senza rete</div>

      {piano == null ? (
        /* Il motivo va scritto, non lasciato a un pulsante grigio: e' la lezione della v0.11.8. */
        <p className="text-[11px] text-gray-400">
          Aggiungi almeno un waypoint con coordinate: l&rsquo;area da scaricare si ricava dall&rsquo;itinerario.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-gray-300 leading-snug">
            {piano != null && daScaricare.length > 0 ? (
              <>
                <strong className="font-medium">{numero(daScaricare.length)} mattonelle</strong>
                {conSentieri
                  ? <> di {nomeMappa} e dei sentieri</>
                  : <> di {nomeMappa}</>}
                , fino allo zoom {piano.zoomRaggiunto}, su un&rsquo;area di {areaLeggibile(area)}.
                {piano.limitatoDalTetto && (
                  <>
                    {' '}Oltre lo zoom {piano.zoomRaggiunto} non si scarica: il tetto è di{' '}
                    {numero(TETTO_TESSERE)} mattonelle per servizio, per rispetto di chi offre le mappe.
                  </>
                )}
              </>
            ) : (
              <>
                L&rsquo;area è troppo grande perfino per lo zoom {ZOOM_MINIMO}: servirebbero più di{' '}
                {numero(TETTO_TESSERE)} mattonelle. Riduci l&rsquo;itinerario o scarica a tappe.
              </>
            )}
          </p>

          {area > AREA_MASSIMA_KM2 && (
            <p className="text-[11px] text-amber-300">
              {areaLeggibile(area)} non è più un&rsquo;escursione: quello che scarichi coprirà l&rsquo;area
              solo alle scale più larghe.
            </p>
          )}

          {daScaricare.length > 0 && spazio != null
            && (spazio.disponibile - spazio.usato) < daScaricare.length * COSTO_QUOTA_PER_TESSERA && (
            /*
              Il conto va fatto PRIMA: a meta' scaricata una scrittura rifiutata non si
              distingue da un problema di rete, e chi sta preparando la gita non ha modo
              di capire cosa sia andato storto.
            */
            <p className="text-[11px] text-amber-300">
              Potrebbe non starci: il browser concede ancora{' '}
              {pesoLeggibile(spazio.disponibile - spazio.usato)} a questo sito, e le mappe di
              altri siti vengono contate con un forte arrotondamento in eccesso — circa{' '}
              {pesoLeggibile(COSTO_QUOTA_PER_TESSERA)} a mattonella, anche se sul disco ne
              pesano una quindicina di kilobyte. Libera lo spazio o riduci l&rsquo;area.
            </p>
          )}

          {avanzamento != null ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-gray-300">
                <span>
                  Scaricamento {numero(avanzamento.fatte)} di {numero(avanzamento.totali)}
                  {avanzamento.fallite > 0 && <> · {numero(avanzamento.fallite)} non arrivate</>}
                </span>
                <button
                  onClick={interrompi}
                  className="text-gray-400 hover:text-white underline decoration-dotted px-2 max-lg:min-h-[44px]"
                >
                  interrompi
                </button>
              </div>
              {/* La barra e' decorativa: il numero sopra e' la sostanza, e lo legge anche
                  chi non vede. */}
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden" aria-hidden>
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${Math.round((avanzamento.fatte / Math.max(1, avanzamento.totali)) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => { void scarica(); }}
              disabled={daScaricare.length === 0}
              className="w-full py-2 bg-green-500 text-black rounded-lg text-xs font-bold min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-400"
            >
              Scarica per l&rsquo;uso senza rete
            </button>
          )}
        </>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-700/60">
        <span className="text-[11px] text-gray-400">
          {conservate == null
            ? 'Spazio non interrogabile su questo browser.'
            : conservate.quante === 0
              ? 'Nessuna mappa conservata.'
              : <>
                  {conservate.quante === 1
                    ? 'Una mattonella conservata'
                    : `${numero(conservate.quante)} mattonelle conservate`}
                  {spazio != null && (
                    <>. In tutto l&rsquo;app occupa {pesoLeggibile(spazio.usato)} dei{' '}
                    {pesoLeggibile(spazio.disponibile)} concessi dal browser</>
                  )}
                </>}
        </span>
        {conservate != null && conservate.quante > 0 && (
          <button
            onClick={svuota}
            disabled={inCorso}
            className="text-[11px] text-gray-400 hover:text-white underline decoration-dotted shrink-0 px-2 min-h-[32px] max-lg:min-h-[44px] disabled:opacity-40"
          >
            libera
          </button>
        )}
      </div>

      {/*
        Il limite fisico da dire prima, non dopo: lo zoom oltre il quale le mattonelle non
        ci sono. In quota non c'e' modo di scoprirlo se non ingrandendo e trovando il grigio.
      */}
      {/*
        `text-gray-400` e non `text-gray-400`: sul fondo di questo dialogo il 500 fa
        **3,67:1**, sotto il 4,5:1 che serve a un testo di questa taglia. E' lo stesso
        contrasto gia' corretto due volte in questo progetto, e sarebbe la terza.
      */}
      <p className="text-[10px] text-gray-400 leading-snug">
        Si scaricano gli zoom da {ZOOM_MINIMO} a {ZOOM_MASSIMO}: più vicino di così la mappa
        senza rete resterà sfocata. Le mattonelle scadono dopo trenta giorni. Sul disco pesano
        pochi kilobyte l&rsquo;una, ma il browser le conta molto di più: è il modo in cui
        nasconde la dimensione delle immagini che arrivano da altri siti.
      </p>
    </div>
  );
}
