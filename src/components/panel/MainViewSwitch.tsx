'use client';

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { mostra } from '@/lib/profilo';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useAuthStore } from '@/stores/authStore';

export function MainViewSwitch() {
  const mainView = useUIStore((s) => s.mainView);
  const setMainView = useUIStore((s) => s.setMainView);
  const refresh = useRouteLibraryStore((s) => s.refresh);

  const invited = useAuthStore((s) => s.invited);
  const isMember = useAuthStore((s) => s.member != null);
  const hasSession = useAuthStore((s) => s.session != null);
  // Mostra la tab anche con sola sessione attiva: al ritorno dal magic-link
  // l'utente è autenticato ma non ancora membro e deve poter scegliere lo username,
  // anche su un browser dove il flag d'invito non è presente.
  /*
   * Il profilo ha l'ultima parola. Prima questa riga guardava solo l'accesso, mentre
   * `LeftPanel` ha una guardia che in Imparo mostra l'editor al posto della libreria:
   * la scheda si accendeva — `aria-selected` vero, sottolineatura verde — e a schermo
   * non cambiava niente. Un comando che dice di aver funzionato senza aver funzionato
   * e' peggio sia di averlo che di non averlo.
   */
  const profilo = useUIStore((s) => s.profilo);
  const showLibrary = (invited || isMember || hasSession) && mostra('libreria', profilo);
  const authed = (isMember || hasSession) && mostra('libreria', profilo);

  // Defensive fallback: if the library becomes inaccessible while it's the
  // active view, switch back to the editor. Done in an effect (not during
  // render) to avoid a render-phase setState.
  useEffect(() => {
    if (!showLibrary && mainView === 'library') setMainView('editor');
  }, [showLibrary, mainView, setMainView]);

  // Landing predefinita per chi è autenticato: la libreria condivisa, non l'editor.
  // Scatta una sola volta alla transizione "non loggato → loggato" (ref guard), così
  // non sovrascrive un'eventuale scelta manuale dell'utente nel resto della sessione.
  const didDefault = useRef(false);
  useEffect(() => {
    if (!didDefault.current && authed) {
      didDefault.current = true;
      refresh();
      setMainView('library');
    }
  }, [authed, refresh, setMainView]);

  const go = (view: 'editor' | 'library') => {
    if (view === 'library') refresh();
    setMainView(view);
  };

  return (
    <div className="flex border-b border-gray-700" role="tablist" aria-label="Vista principale">
      <button
        onClick={() => go('editor')} role="tab" aria-selected={mainView === 'editor'}
        className={`flex-1 py-2 text-xs font-medium transition-colors ${mainView === 'editor' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
      >
        Editor
      </button>
      {showLibrary && (
        <button
          onClick={() => go('library')} role="tab" aria-selected={mainView === 'library'}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${mainView === 'library' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Libreria
        </button>
      )}
    </div>
  );
}
