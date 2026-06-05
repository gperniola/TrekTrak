'use client';

import { RouteList } from './RouteList';
import { RouteDetailCard } from './RouteDetailCard';
import { LibraryAuthGate } from '@/components/auth/LibraryAuthGate';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';
import { useUIStore } from '@/stores/uiStore';

export function RouteLibrary() {
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  const select = useRouteLibraryStore((s) => s.select);
  const setMobileTab = useUIStore((s) => s.setMobileTab);

  return (
    <LibraryAuthGate>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Lista: sempre su desktop; su mobile solo quando nessun percorso è selezionato. */}
        <div className={selectedId ? 'hidden lg:block' : undefined}>
          <RouteList />
        </div>
        {selectedId && (
          <>
            {/* Header del dettaglio — solo mobile (su desktop la lista resta affiancata sopra). */}
            <div className="lg:hidden flex items-center justify-between border-b border-gray-700">
              <button
                onClick={() => select(null)}
                className="flex items-center gap-1 px-3 min-h-[44px] text-sm text-green-400 hover:text-green-300"
              >
                &larr; Tutti i percorsi
              </button>
              <button
                onClick={() => setMobileTab('map')}
                className="px-3 min-h-[44px] text-sm text-gray-300 hover:text-white"
              >
                Sulla mappa &#128506;&#65039;
              </button>
            </div>
            <RouteDetailCard key={selectedId} />
          </>
        )}
      </div>
    </LibraryAuthGate>
  );
}
