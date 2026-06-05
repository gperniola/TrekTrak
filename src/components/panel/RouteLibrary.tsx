'use client';

import { RouteList } from './RouteList';
import { RouteDetailCard } from './RouteDetailCard';
import { LibraryAuthGate } from '@/components/auth/LibraryAuthGate';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';

export function RouteLibrary() {
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  return (
    <LibraryAuthGate>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <RouteList />
        {selectedId && <RouteDetailCard key={selectedId} />}
      </div>
    </LibraryAuthGate>
  );
}
