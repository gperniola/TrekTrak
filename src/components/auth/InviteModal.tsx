'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { RequestAccessForm } from './RequestAccessForm';

/**
 * Popup di benvenuto mostrato all'apertura del link di invito.
 * Contiene il form di accesso all'area condivisa. Chiudendolo senza inviare,
 * lo stesso form resta disponibile nella tab Libreria.
 */
export function InviteModal() {
  const dismissInvite = useAuthStore((s) => s.dismissInvite);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissInvite(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissInvite]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4" onClick={dismissInvite}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        className="bg-gray-800 rounded-lg w-96 max-w-[90vw] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismissInvite}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Chiudi"
        >
          &times;
        </button>
        <div id="invite-modal-title" className="sr-only">Accesso area condivisa</div>
        <RequestAccessForm />
      </div>
    </div>
  );
}
