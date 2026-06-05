'use client';

import { useState } from 'react';
import { ItineraryHeader } from './ItineraryHeader';
import { WaypointList } from './WaypointList';
import { ItineraryTable } from './ItineraryTable';
import { SummaryBar } from './SummaryBar';
import { ActionBar } from './ActionBar';
import { ModeSwitch } from './ModeSwitch';
import { MainViewSwitch } from './MainViewSwitch';
import { RouteLibrary } from './RouteLibrary';
import { BrandMark } from '@/components/shared/BrandMark';
import { useUIStore } from '@/stores/uiStore';

export function LeftPanel({ className, showSwitch = true, viewOverride }: {
  className?: string;
  showSwitch?: boolean;
  viewOverride?: 'editor' | 'library';
}) {
  const [view, setView] = useState<'edit' | 'table'>('edit');
  const mainView = useUIStore((s) => s.mainView);
  const activeView = viewOverride ?? mainView;

  return (
    <div className={`${className ?? 'w-full h-[50vh] lg:h-full lg:w-[380px]'} flex flex-col bg-gray-900 border-r border-gray-700`}>
      <div className="hidden lg:block px-3 py-2.5 border-b border-gray-700 bg-gradient-to-b from-gray-800/60 to-gray-900">
        <BrandMark size="md" />
      </div>
      {showSwitch && <MainViewSwitch />}
      {activeView === 'library' ? (
        <RouteLibrary />
      ) : (
        <>
          <ModeSwitch />
          <ItineraryHeader />
          <div className="flex border-b border-gray-700" role="tablist" aria-label="Vista waypoint">
            <button
              onClick={() => setView('edit')}
              role="tab"
              aria-selected={view === 'edit'}
              className={`flex-1 py-2 text-xs text-center transition-colors ${view === 'edit' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Modifica
            </button>
            <button
              onClick={() => setView('table')}
              role="tab"
              aria-selected={view === 'table'}
              className={`flex-1 py-2 text-xs text-center transition-colors ${view === 'table' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Tabella
            </button>
          </div>
          {view === 'edit' ? <WaypointList /> : <ItineraryTable />}
          <SummaryBar />
          <ActionBar />
        </>
      )}
    </div>
  );
}
