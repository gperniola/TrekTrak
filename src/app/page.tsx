'use client';

import { useState } from 'react';
import { LeftPanel } from '@/components/panel/LeftPanel';
import { MapWrapper } from '@/components/map/MapWrapper';
import { ElevationProfile } from '@/components/map/ElevationProfile';
import { ToleranceSettings } from '@/components/settings/ToleranceSettings';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col lg:flex-row">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <LeftPanel />
      </div>

      {/* Right Panel: Map + Elevation Profile */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          <MapWrapper />

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden absolute top-3 left-3 z-[1000] bg-gray-800/90 px-2.5 py-1.5 rounded text-lg text-gray-300 hover:text-white"
            aria-label="Apri menu"
          >
            ☰
          </button>

          {/* Settings toggle — desktop only (on mobile it's inside the drawer) */}
          <button
            onClick={() => setShowSettings(true)}
            className="hidden lg:block absolute top-3 left-3 z-[1000] bg-gray-800/90 px-2 py-1 rounded text-xs text-gray-400 hover:text-white"
            aria-label="Apri impostazioni"
          >
            Impostazioni
          </button>
        </div>
        <div className="h-[120px] bg-gray-900 border-t border-gray-700">
          <ElevationProfile />
        </div>
      </div>

      {/* Mobile drawer — full screen overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[1100] bg-gray-950 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <span className="text-sm font-medium text-gray-300">Menu</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setDrawerOpen(false); setShowSettings(true); }}
                className="text-xs text-gray-400 hover:text-white"
              >
                Impostazioni
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-gray-400 hover:text-white text-xl leading-none"
                aria-label="Chiudi menu"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <LeftPanel className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && <ToleranceSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
