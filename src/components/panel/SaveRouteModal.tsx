'use client';

import { useState, useEffect } from 'react';

export function SaveRouteModal({
  initialName, onConfirm, onClose,
}: {
  initialName: string;
  onConfirm: (name: string, notes: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-route-title"
        className="bg-gray-800 rounded-lg p-6 w-96 max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="save-route-title" className="text-lg font-bold text-green-400 mb-4">Salva in libreria</h3>
        <label className="block text-xs text-gray-400 mb-1">Titolo</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm mb-3 focus:border-green-500 focus:outline-none"
          autoFocus
        />
        <label className="block text-xs text-gray-400 mb-1">Note (opzionali)</label>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm mb-4 focus:border-green-500 focus:outline-none resize-none"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded-lg text-sm transition-all active:scale-[0.98] hover:bg-gray-600">Annulla</button>
          <button
            onClick={() => onConfirm(name.trim() || 'Senza nome', notes)}
            className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-gray-950 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-[0.98] hover:from-green-400 hover:to-emerald-500"
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
