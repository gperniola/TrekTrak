'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function ChooseUsername() {
  const claimUsername = useAuthStore((s) => s.claimUsername);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const name = username.trim();
    if (name.length < 3 || name.length > 30) { setError('Lo username deve avere 3-30 caratteri'); return; }
    setBusy(true);
    const res = await claimUsername(name);
    setBusy(false);
    if (!res.ok) {
      setError(res.error === 'username_taken' ? 'Username già in uso' : 'Errore, riprova');
    }
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-bold text-green-400">Scegli il tuo username</h3>
      <p className="text-xs text-gray-400">Sarà il nome visibile a tutti nel gruppo.</p>
      <label className="block text-xs text-gray-400" htmlFor="cu-name">Username</label>
      <input
        id="cu-name" type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30}
        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm focus:border-green-500 focus:outline-none"
        autoComplete="off"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        onClick={submit} disabled={busy}
        className="w-full py-2 bg-green-600 text-black rounded text-sm font-bold hover:bg-green-500 disabled:opacity-50"
      >
        {busy ? 'Salvataggio…' : 'Conferma'}
      </button>
    </div>
  );
}
