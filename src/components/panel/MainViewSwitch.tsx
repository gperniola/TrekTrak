'use client';

import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';

export function MainViewSwitch() {
  const mainView = useUIStore((s) => s.mainView);
  const setMainView = useUIStore((s) => s.setMainView);
  const refresh = useRouteLibraryStore((s) => s.refresh);

  const go = (view: 'editor' | 'library') => {
    if (view === 'library') refresh();
    setMainView(view);
  };

  return (
    <div className="flex border-b border-gray-700" role="tablist" aria-label="Vista principale">
      <button
        onClick={() => go('editor')} role="tab" aria-selected={mainView === 'editor'}
        className={`flex-1 py-2 text-xs font-medium ${mainView === 'editor' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
      >
        Editor
      </button>
      <button
        onClick={() => go('library')} role="tab" aria-selected={mainView === 'library'}
        className={`flex-1 py-2 text-xs font-medium ${mainView === 'library' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
      >
        Libreria
      </button>
    </div>
  );
}
