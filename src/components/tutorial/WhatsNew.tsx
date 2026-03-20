'use client';

import { useState, useEffect, useRef } from 'react';
import { KEYS } from '@/lib/storage';

/**
 * Release notes shown once per version. Add new entries at the TOP of the array.
 * The component compares the latest version here with the one stored in localStorage.
 */
const RELEASES: { version: string; date: string; items: string[] }[] = [
  {
    version: '0.1.0',
    date: '2026-03-20',
    items: [
      'Profilo altimetrico colorato per pendenza (verde/giallo/arancio/rosso)',
      'Menu mobile a schermo intero con drawer',
      'Barra superiore con ricerca località e switch Learn/Track',
      'Validazione D+/D- con campionatura elevazione cumulativa',
      'Tutorial interattivo per la modalità Learn',
      'Icone ⓘ informative su tutti i campi',
      'Popup valore calcolato al tap sulle icone di validazione',
      'Profilo "stimato" evidenziato in modalità Learn',
    ],
  },
];

const CURRENT_VERSION = RELEASES[0].version;

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [displayVersion, setDisplayVersion] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(KEYS.whatsNewVersion);
      if (seen === CURRENT_VERSION) return;
      // Also skip if tutorial hasn't been seen yet (let tutorial go first)
      if (!localStorage.getItem(KEYS.tutorialSeen)) return;
      setDisplayVersion(CURRENT_VERSION);
      setOpen(true);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);

    dialogRef.current?.focus();

    const dialogEl = dialogRef.current;
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogEl) return;
      const focusable = dialogEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    dialogEl?.addEventListener('keydown', trapFocus);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
      dialogEl?.removeEventListener('keydown', trapFocus);
    };
  }, [open]);

  function handleClose() {
    setOpen(false);
    try {
      localStorage.setItem(KEYS.whatsNewVersion, CURRENT_VERSION);
    } catch {
      // localStorage unavailable
    }
  }

  if (!open || !displayVersion) return null;

  const release = RELEASES.find((r) => r.version === displayVersion);
  if (!release) return null;

  return (
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/60"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Novità versione ${release.version}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-sm w-full p-5 shadow-2xl outline-none overflow-y-auto max-h-[calc(100vh-2rem)]"
      >
        <div className="text-3xl mb-3">🎉</div>
        <h2 className="text-base font-bold text-green-400 mb-1">
          Novità v{release.version}
        </h2>
        <p className="text-[10px] text-gray-500 mb-3">{release.date}</p>

        <ul className="space-y-2 mb-4">
          {release.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-300">
              <span className="text-green-400 shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={handleClose}
          className="w-full py-2 min-h-[44px] bg-green-600 rounded text-sm text-white font-bold hover:bg-green-500"
        >
          Ho capito!
        </button>
      </div>
    </div>
  );
}
