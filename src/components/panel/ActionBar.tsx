'use client';

import { useState } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { buildMeteoUrl } from '@/lib/meteo';
import { encodeItinerary } from '@/lib/share-url';
import { loadValidationHistory } from '@/lib/storage';
import { loadQuizHistory } from '@/lib/quiz';
import { useUIStore } from '@/stores/uiStore';
import { toast } from '@/stores/notificationStore';
import { mostra } from '@/lib/profilo';
import { useVerifica } from '@/lib/useVerifica';
import { BannerVerifica } from '@/components/panel/BannerVerifica';
import { MenuEsporta } from '@/components/panel/MenuEsporta';
import { PulsanteOffline, PromemoriaOffline } from '@/components/panel/OfflineDelPercorso';

/**
 * **La barra in fondo al pannello: quello che si fa con l'itinerario finito.**
 *
 * Il file è tornato una barra di pulsanti. Conteneva anche la verifica (duecento righe di
 * orchestrazione di rete e regole didattiche), la tendina degli export, il pulsante delle
 * mattonelle e il banner degli esiti: cinque responsabilità, e nessuna delle quattro non
 * di presentazione si poteva provare senza montare mezza interfaccia. Ora ognuna sta in
 * casa sua — `lib/verifica-itinerario`, `lib/useVerifica`, `MenuEsporta`,
 * `OfflineDelPercorso`, `BannerVerifica` — e qui resta la disposizione.
 */
export function ActionBar() {
  const openProgress = useUIStore((s) => s.openProgress);
  const profilo = useUIStore((s) => s.profilo);
  const datiVisibili = mostra('exportDati', profilo);
  const setWeatherOpen = useUIStore((s) => s.setWeatherOpen);
  const itineraryName = useItineraryStore((s) => s.itineraryName);
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const appMode = useItineraryStore((s) => s.appMode);
  const [linkCopied, setLinkCopied] = useState(false);
  const verifica = useVerifica();

  // TASK-41: gli export non devono invitare ad azioni inutili quando non c'è nulla da esportare.
  const validCoordWaypoints = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  const canExportPdf = waypoints.length >= 2;
  const canExportGpx = validCoordWaypoints.length >= 2;

  const handleShareLink = () => {
    const hash = encodeItinerary(itineraryName, waypoints, legs);
    if (!hash) {
      toast.warning('Itinerario troppo grande per la condivisione via link. Usa Export JSON.');
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      toast.success('Link copiato negli appunti');
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {
      toast.error('Impossibile copiare il link. Riprova manualmente.');
    });
  };

  return (
    <div className="border-t border-gray-700 p-3 space-y-2">
      {verifica.banner && (
        <BannerVerifica
          riassunto={verifica.banner}
          inDissolvenza={verifica.inDissolvenza}
          chiudi={verifica.chiudiBanner}
        />
      )}
      {/* Export e condivisione del percorso. TASK-41: disabilitati quando non c'è nulla da esportare. */}
      {/*
        Il motivo del grigio va SCRITTO, non messo in un `title`: su un telefono il
        tooltip non esiste, quindi l'utente vedeva quattro pulsanti spenti e nessuna
        spiegazione. `aria-describedby` lo lega ai pulsanti per chi usa uno screen reader.
      */}
      {/*
        La nota guarda solo i pulsanti VISIBILI in questo profilo. In Imparo il GPX non
        c'e', quindi con due waypoint senza coordinate diceva «servono waypoint con
        coordinate» mentre le uniche voci a schermo — i due PDF — funzionavano: un
        messaggio che parla di funzioni che il profilo ha tolto di mezzo.
      */}
      {(!canExportPdf || (datiVisibili && !canExportGpx)) && (
        <p id="motivo-export" className="text-[11px] text-amber-300 bg-gray-800 border border-amber-800/60 rounded px-2 py-1.5">
          {waypoints.length < 2
            ? 'Aggiungi almeno 2 waypoint per esportare o condividere.'
            : 'Per il GPX servono almeno 2 waypoint con coordinate.'}
        </p>
      )}
      {/*
        **«Quando partire» sta fuori dal gruppo degli export, e in evidenza.**

        Non è un export ed è il passo finale del percorso: il pannello incrocia i waypoint
        con gli orari di Munter e dice a che ora sei in ogni punto e che tempo trovi lì a
        quell'ora, col verdetto sulla fascia critica. È l'unica cosa che questa app sa dire
        e un sito meteo no. Chiamarlo «Meteo» lo faceva passare per un widget fra cinque
        pastiglie uguali, e la funzione che decide *se e quando andare* non è una pastiglia.
      */}
      {mostra('meteo', profilo) && buildMeteoUrl(waypoints) != null && (
        <button
          onClick={() => setWeatherOpen(true)}
          className="w-full text-left px-3 py-2.5 bg-cyan-600 text-black rounded-lg shadow-sm transition-all active:scale-[0.99] hover:bg-cyan-500 max-lg:min-h-[44px]"
        >
          <span className="block text-sm font-bold">🕐 Quando partire</span>
          <span className="block text-[11px] leading-snug opacity-90">
            Orari lungo il percorso e meteo a quell&rsquo;ora
          </span>
        </button>
      )}
      {/*
        GPX, link condiviso e meteo sono roba da gita vera: in Imparo non compaiono.
        I due PDF nella tendina restano, perche' servono a portarsi l'esercizio su carta.
      */}
      <div role="group" aria-label="Esporta e condividi" className="flex flex-wrap gap-2">
        <MenuEsporta abilitato={canExportPdf} datiVisibili={datiVisibili} />
        {mostra('meteo', profilo) && <PulsanteOffline />}
        {datiVisibili && (
          <button
            onClick={handleShareLink}
            disabled={waypoints.length < 2}
            aria-describedby={waypoints.length < 2 ? 'motivo-export' : undefined}
            className="flex-1 py-2 bg-amber-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
          >
            {linkCopied ? 'Copiato!' : 'Copia link'}
          </button>
        )}
      </div>
      {/* Attività didattiche (verifica + progresso). TASK-42: separate dagli export. */}
      {/*
        Verifica e Progresso sono entrambe aree di Imparo: in Montagna il gruppo era
        SEMPRE vuoto. Un `div` vuoto dentro `space-y-2` si porta comunque il suo margine,
        e per chi usa uno screen reader era un gruppo annunciato col suo nome e senza
        niente dentro. Se non c'e' contenuto non c'e' contenitore.
      */}
      {mostra('progresso', profilo) && <div role="group" aria-label="Attività" className="flex flex-wrap gap-2">
        {appMode === 'learn' && mostra('validazione', profilo) && (
          <button
            onClick={verifica.verifica}
            disabled={verifica.verificando}
            className="flex-1 py-2 bg-purple-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
          >
            {verifica.verificando ? 'Verificando...' : 'Verifica'}
          </button>
        )}
        {mostra('progresso', profilo) && (() => {
          // TASK-20: il Progresso resta spento finché non c'è almeno una verifica o un quiz
          const hasHistory = loadValidationHistory().length > 0 || loadQuizHistory().length > 0;
          return (
            <button
              onClick={openProgress}
              disabled={!hasHistory}
              aria-describedby={hasHistory ? undefined : 'motivo-progresso'}
              className="flex-1 py-2 bg-indigo-500 text-black rounded-lg font-bold text-xs shadow-sm transition-all active:scale-[0.98] hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed max-lg:min-h-[44px]"
            >
              📊 Progresso
            </button>
          );
        })()}
      </div>}
      {mostra('progresso', profilo) && loadValidationHistory().length === 0 && loadQuizHistory().length === 0 && (
        <p id="motivo-progresso" className="text-[11px] text-gray-400">
          Il Progresso si sblocca dopo la prima verifica o il primo quiz.
        </p>
      )}
      {mostra('meteo', profilo) && <PromemoriaOffline />}
    </div>
  );
}
