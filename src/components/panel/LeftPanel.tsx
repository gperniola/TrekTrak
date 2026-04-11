'use client';

import { useState } from 'react';
import { ItineraryHeader } from './ItineraryHeader';
import { WaypointList } from './WaypointList';
import { ItineraryTable } from './ItineraryTable';
import { SummaryBar } from './SummaryBar';
import { ActionBar } from './ActionBar';
import { ModeSwitch } from './ModeSwitch';

export function LeftPanel({ className, compassActive, onCompassToggle, rulerActive, onRulerToggle, quizActive, onQuizToggle, onOpenProgress }: {
  className?: string;
  compassActive?: boolean;
  onCompassToggle?: () => void;
  rulerActive?: boolean;
  onRulerToggle?: () => void;
  quizActive?: boolean;
  onQuizToggle?: () => void;
  onOpenProgress?: () => void;
}) {
  const [view, setView] = useState<'edit' | 'table'>('edit');

  return (
    <div className={`${className ?? 'w-full h-[50vh] lg:h-full lg:w-[380px]'} flex flex-col bg-gray-900 border-r border-gray-700`}>
      <div className="hidden lg:block px-3 py-2 border-b border-gray-700">
        <span className="text-lg font-bold text-green-400">&#9650; TrekTrak</span>
      </div>
      <ModeSwitch compassActive={compassActive} onCompassToggle={onCompassToggle} rulerActive={rulerActive} onRulerToggle={onRulerToggle} quizActive={quizActive} onQuizToggle={onQuizToggle} />
      <ItineraryHeader />
      <div className="flex border-b border-gray-700" role="tablist">
        <button
          onClick={() => setView('edit')}
          role="tab"
          aria-selected={view === 'edit'}
          className={`flex-1 py-2 text-xs text-center ${view === 'edit' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
        >
          Modifica
        </button>
        <button
          onClick={() => setView('table')}
          role="tab"
          aria-selected={view === 'table'}
          className={`flex-1 py-2 text-xs text-center ${view === 'table' ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}
        >
          Tabella
        </button>
      </div>
      {view === 'edit' ? <WaypointList /> : <ItineraryTable />}
      <SummaryBar />
      <ActionBar onOpenProgress={onOpenProgress} />
    </div>
  );
}
