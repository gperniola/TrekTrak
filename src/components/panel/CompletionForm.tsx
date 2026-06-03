'use client';

import { useState } from 'react';
import type { RouteCompletion } from '@/lib/types';

export function CompletionForm({
  knownPeople, initial, onSubmit, onCancel,
}: {
  knownPeople: string[];
  initial?: RouteCompletion;
  onSubmit: (c: Omit<RouteCompletion, 'id'>) => void;
  onCancel: () => void;
}) {
  const [personName, setPersonName] = useState(initial?.personName ?? '');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(initial?.durationMinutes != null ? String(Math.floor(initial.durationMinutes / 60)) : '');
  const [minutes, setMinutes] = useState(initial?.durationMinutes != null ? String(initial.durationMinutes % 60) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const submit = () => {
    const name = personName.trim();
    if (!name) return;
    const h = parseInt(hours, 10);
    const mm = parseInt(minutes, 10);
    const total = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
    onSubmit({
      personName: name,
      date,
      durationMinutes: total > 0 ? total : undefined,
      notes: notes.trim(),
    });
  };

  return (
    <div className="bg-gray-900 rounded p-2 space-y-2">
      <div>
        <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-person">Chi</label>
        <input id="cf-person" list="known-people" value={personName} onChange={(e) => setPersonName(e.target.value)}
          maxLength={120} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        <datalist id="known-people">{knownPeople.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-date">Data</label>
          <input id="cf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div className="w-16">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-hours">Ore</label>
          <input id="cf-hours" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div className="w-16">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor="cf-min">Minuti</label>
          <input id="cf-min" type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Note aggiuntive..."
        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none resize-none" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 bg-gray-700 rounded text-xs hover:bg-gray-600">Annulla</button>
        <button onClick={submit} className="flex-1 py-1.5 bg-green-600 text-black rounded text-xs font-bold hover:bg-green-500">Salva</button>
      </div>
    </div>
  );
}
