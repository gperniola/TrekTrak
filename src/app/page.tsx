'use client';

import { useState } from 'react';
import { LeftPanel } from '@/components/panel/LeftPanel';
import { MapWrapper } from '@/components/map/MapWrapper';
import { ElevationProfile } from '@/components/map/ElevationProfile';
import { ToleranceSettings } from '@/components/settings/ToleranceSettings';

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="h-screen flex flex-col lg:flex-row">
      {/* Left Panel */}
      <LeftPanel />

      {/* Right Panel: Map + Elevation Profile */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          <MapWrapper />
          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-3 left-3 z-[1000] bg-gray-800/90 px-2 py-1 rounded text-xs text-gray-400 hover:text-white"
            aria-label="Apri impostazioni"
          >
            Impostazioni
          </button>
        </div>
        <div className="h-[120px] bg-gray-900 border-t border-gray-700">
          <ElevationProfile />
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && <ToleranceSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
