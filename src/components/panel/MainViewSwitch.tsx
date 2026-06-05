'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
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
  const showLibrary = invited || isMember || hasSession;

  // Defensive fallback: if the library becomes inaccessible while it's the
  // active view, switch back to the editor. Done in an effect (not during
  // render) to avoid a render-phase setState.
  useEffect(() => {
    if (!showLibrary && mainView === 'library') setMainView('editor');
  }, [showLibrary, mainView, setMainView]);

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
