'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function UserHeader() {
  const member = useAuthStore((s) => s.member);
  const signOut = useAuthStore((s) => s.signOut);
  const updateUsername = useAuthStore((s) => s.updateUsername);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member?.username ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!member) return null;

  const saveName = async () => {
    setError(null);
    const v = name.trim();
    if (v.length < 3 || v.length > 30) { setError('3-30 caratteri'); return; }
    const res = await updateUsername(v);
    if (res.ok) { setEditing(false); setOpen(false); }
    else setError(res.error === 'username_taken' ? 'Già in uso' : 'Errore');
  };

  return (
    <div className="relative flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900">
      <span className="text-xs text-gray-400">Libreria condivisa</span>
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-green-400 font-medium"
        aria-label="Menu utente"
        aria-expanded={open}
      >
        @{member.username} &#9662;
      </button>
      {open && (
        <div className="absolute right-2 top-full mt-1 z-[1300] bg-gray-800 border border-gray-600 rounded shadow-lg p-2 w-56 space-y-2">
          {editing ? (
            <>
              <input
                value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Nuovo username"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-1">
                <button onClick={() => { setEditing(false); setName(member.username); }} className="flex-1 py-1 bg-gray-700 rounded text-xs">Annulla</button>
                <button onClick={saveName} className="flex-1 py-1 bg-green-600 text-black rounded text-xs font-bold">Salva</button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="w-full text-left text-xs text-gray-300 hover:text-white py-1">Cambia username</button>
              <button onClick={() => signOut()} className="w-full text-left text-xs text-red-400 hover:text-red-300 py-1" aria-label="Esci">Esci</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
