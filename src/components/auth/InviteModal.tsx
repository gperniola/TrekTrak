'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { RequestAccessForm } from './RequestAccessForm';

/**
 * Popup di benvenuto mostrato all'apertura del link di invito.
 * Hero a tema montagna + form di accesso all'area condivisa. Chiudendolo senza
 * inviare, lo stesso form resta disponibile nella tab Libreria.
 */
export function InviteModal() {
  const dismissInvite = useAuthStore((s) => s.dismissInvite);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissInvite(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissInvite]);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ animation: 'tt-invite-fade 200ms ease-out' }}
      onClick={dismissInvite}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Accesso area condivisa"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'tt-invite-pop 260ms cubic-bezier(0.16,1,0.3,1)' }}
        /*
          `max-h` + `overflow-y-auto`: un dialogo centrato piu' alto della finestra sborda
          anche dal bordo SUPERIORE, e quella parte non si raggiunge con nessuno
          scorrimento. Qui il rischio e' il telefono in orizzontale, dove restano poco
          piu' di trecento pixel d'altezza. `overflow-x` resta nascosto — serve agli
          angoli arrotondati — perche' `overflow-y-auto` cambia solo l'asse verticale.
        */
        className="relative w-[26rem] max-w-[92vw] max-h-[90dvh] overflow-hidden overflow-y-auto rounded-2xl bg-gray-900 border border-green-500/25 shadow-2xl shadow-black/60 ring-1 ring-white/5"
      >
        <button
          onClick={dismissInvite}
          className="absolute top-2.5 right-2.5 z-10 text-white/70 hover:text-white text-2xl leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          aria-label="Chiudi"
        >
          &times;
        </button>

        {/* Hero a montagne */}
        <div className="relative h-32 overflow-hidden">
          <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="tt-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#064e3b" />
                <stop offset="100%" stopColor="#0f1c17" />
              </linearGradient>
              <linearGradient id="tt-peak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#065f46" />
              </linearGradient>
            </defs>
            <rect width="400" height="140" fill="url(#tt-sky)" />
            <circle cx="320" cy="40" r="18" fill="#bbf7d0" opacity="0.85" />
            {/* contorni / curve di livello soffuse */}
            <g stroke="#34d399" strokeOpacity="0.12" fill="none">
              <path d="M0 96 Q 100 78 200 92 T 400 86" />
              <path d="M0 110 Q 110 92 210 106 T 400 100" />
            </g>
            {/* catena lontana */}
            <path d="M0 120 L70 70 L130 110 L200 58 L270 112 L330 76 L400 118 L400 140 L0 140 Z" fill="#10362a" />
            {/* catena vicina */}
            <path d="M0 140 L60 96 L120 128 L190 84 L250 126 L320 98 L400 132 L400 140 Z" fill="url(#tt-peak)" />
            {/* nevai */}
            <path d="M190 84 L205 100 L196 100 L190 92 L184 100 L176 100 Z" fill="#ecfdf5" opacity="0.9" />
          </svg>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/10 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-1.5 text-green-300/90 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <span aria-hidden="true">&#9650;</span> TrekTrak
            </div>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-white drop-shadow">
              Sei stato invitato
            </h2>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-1 pb-1">
          <p className="px-4 pt-3 text-xs leading-relaxed text-gray-400">
            Accedi alla <span className="text-green-300 font-medium">libreria condivisa</span> dei percorsi:
            inserisci la tua email e ti invieremo un link per entrare. Niente password.
          </p>
          <RequestAccessForm hideHeader />
        </div>
      </div>

      <style>{`
        @keyframes tt-invite-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tt-invite-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.96) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}
