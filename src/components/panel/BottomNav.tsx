'use client';

import { useUIStore } from '@/stores/uiStore';
import { useRouteLibraryStore } from '@/stores/routeLibraryStore';

const TABS = [
  { key: 'map', label: 'Mappa', icon: '🗺️' },
  { key: 'editor', label: 'Editor', icon: '✏️' },
  { key: 'library', label: 'Libreria', icon: '📚' },
] as const;

/** Bottom navigation mobile (solo <lg). 3 destinazioni + menu "Altro". */
export function BottomNav() {
  const mobileTab = useUIStore((s) => s.mobileTab);
  const setMobileTab = useUIStore((s) => s.setMobileTab);
  const moreMenuOpen = useUIStore((s) => s.moreMenuOpen);
  const setMoreMenuOpen = useUIStore((s) => s.setMoreMenuOpen);
  const refresh = useRouteLibraryStore((s) => s.refresh);

  const go = (key: 'map' | 'editor' | 'library') => {
    if (key === 'library') refresh();
    setMoreMenuOpen(false);
    setMobileTab(key);
  };

  const itemCls = (active: boolean) =>
    `flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
      active ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
    }`;

  return (
    <nav className="lg:hidden flex border-t border-gray-700 bg-gray-900 shrink-0" aria-label="Navigazione principale">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => go(t.key)}
          aria-current={mobileTab === t.key ? 'page' : undefined}
          className={itemCls(mobileTab === t.key && !moreMenuOpen)}
        >
          <span aria-hidden="true" className="text-lg leading-none">{t.icon}</span>
          {t.label}
        </button>
      ))}
      <button
        onClick={() => setMoreMenuOpen(!moreMenuOpen)}
        aria-haspopup="menu"
        aria-expanded={moreMenuOpen}
        aria-label="Altro"
        className={itemCls(moreMenuOpen)}
      >
        <span aria-hidden="true" className="text-lg leading-none">⋯</span>
        Altro
      </button>
    </nav>
  );
}
