'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestAccessForm({ hideHeader = false }: { hideHeader?: boolean }) {
  const requestAccess = useAuthStore((s) => s.requestAccess);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) { setError('Inserisci un\'email valida'); return; }
    setBusy(true);
    const res = await requestAccess(email.trim());
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error === 'invalid_invite' ? 'Invito non valido' : 'Errore, riprova');
  };

  if (sent) {
    return (
      <div className="p-4 text-center text-sm text-gray-300">
        📧 Controlla la tua mail: ti abbiamo inviato un link per accedere.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {!hideHeader && (
        <>
          <h3 className="text-sm font-bold text-green-400">Accesso area condivisa</h3>
          <p className="text-xs text-gray-400">Inserisci la tua email: riceverai un link per entrare.</p>
        </>
      )}
      <label className="block text-[11px] uppercase tracking-wider text-gray-400" htmlFor="ra-email">Email</label>
      <input
        id="ra-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="nome@email.it"
        className="w-full bg-gray-900/80 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500/40 focus:outline-none transition-colors"
        autoComplete="email"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit} disabled={busy}
        className="w-full py-2.5 bg-green-600 text-black rounded-lg text-sm font-bold hover:bg-green-500 active:scale-[0.99] disabled:opacity-50 transition-all"
      >
        {busy ? 'Invio…' : 'Invia link di accesso'}
      </button>
    </div>
  );
}
