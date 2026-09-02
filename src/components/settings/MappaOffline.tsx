'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/stores/notificationStore';
import {
  TETTO_TESSERE,
  ZOOM_MASSIMO,
  ZOOM_MINIMO,
  areaLeggibile,
  pesoLeggibile,
} from '@/lib/tile-offline';
import {
  PESO_MEDIO_TESSERA,
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
  /*
    Tre stati, non due: `undefined` = non lo so ancora, `null` = non si puo' sapere,
    l'oggetto = lo so. Confonderli faceva mostrare «Spazio non interrogabile su questo
    browser» per oltre un secondo a ogni apertura del pannello — un messaggio definitivo
    per uno stato transitorio.
  */
  const [conservate, setConservate] =
    useState<{ quante: number; byte: number; stimato: boolean } | null | undefined>(undefined);
  const [spazio, setSpazio] = useState<{ usato: number; disponibile: number } | null>(null);

  const aggiornaSpazio = useCallback(() => {
    void spazioTessere().then(setConservate);
    void spazioOrigine().then(setSpazio);
  }, []);

  /*
    Un solo effetto: si conta al montaggio e ogni volta che uno scaricamento finisce.
    Con due effetti separati partivano **due** letture al montaggio, e da quando il peso
    si legge dalle risposte una lettura non e' gratis.
  */
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
                Il percorso è troppo lungo perfino per lo zoom {ZOOM_MINIMO}: servirebbero
                più di {numero(TETTO_TESSERE)} mattonelle solo per quella scala. Dividilo in
                tappe e scarica una tappa per volta.
              </>
            )}
          </p>

          {daScaricare.length > 0 && (
            /* Quanto occupera', detto PRIMA: il peso medio e' misurato sui servizi veri. */
            <p className="text-[11px] text-gray-400">
              Occuperanno circa {pesoLeggibile(daScaricare.length * PESO_MEDIO_TESSERA)}.
            </p>
          )}
          {daScaricare.length > 0 && spazio != null
            && (spazio.disponibile - spazio.usato) < daScaricare.length * PESO_MEDIO_TESSERA && (
            /*
              Il conto va fatto PRIMA: a meta' scaricata una scrittura rifiutata non si
              distingue da un problema di rete, e chi sta preparando la gita non ha modo
              di capire cosa sia andato storto.
            */
            <p className="text-[11px] text-amber-300">
              Potrebbe non starci: il browser concede ancora{' '}
              {pesoLeggibile(spazio.disponibile - spazio.usato)} a questo sito. Libera lo
              spazio o riduci l&rsquo;area.
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
          {conservate === undefined
            ? 'Conto le mappe conservate…'
            : conservate === null
              ? 'Spazio non interrogabile su questo browser.'
              : conservate.quante === 0
              ? 'Nessuna mappa conservata.'
                : <>
                    {conservate.quante === 1
                      ? 'Una mattonella conservata'
                      : `${numero(conservate.quante)} mattonelle conservate`}
                    , {conservate.stimato ? 'circa ' : ''}{pesoLeggibile(conservate.byte)}
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
      <p className="text-[10px] text-gray-400 leading-snug">
        Si scaricano gli zoom da {ZOOM_MINIMO} a {ZOOM_MASSIMO} lungo il percorso, non su
        tutta l&rsquo;area che lo contiene: più vicino di così la mappa senza rete resterà
        sfocata. Le mattonelle scadono dopo trenta giorni.
      </p>
    </div>
  );
}
