'use client';

import { useState } from 'react';
import type { RouteCompletion } from '@/lib/types';
import { DifficultyRating } from './DifficultyRating';
import { WEATHER_OPTIONS } from '@/lib/weather';

export function CompletionForm({
  initial, onSubmit, onCancel, idPrefix = 'cf',
}: {
  initial?: RouteCompletion;
  onSubmit: (c: Omit<RouteCompletion, 'id' | 'personName'>) => void;
  onCancel: () => void;
  /** Unique prefix so multiple forms on screen don't collide on DOM ids. */
  idPrefix?: string;
}) {
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(initial?.durationMinutes != null ? String(Math.floor(initial.durationMinutes / 60)) : '');
  const [minutes, setMinutes] = useState(initial?.durationMinutes != null ? String(initial.durationMinutes % 60) : '');
  const [difficulty, setDifficulty] = useState<RouteCompletion['difficulty']>(initial?.difficulty);
  const [weather, setWeather] = useState(initial?.weather ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const submit = () => {
    const h = parseInt(hours, 10);
    const mm = parseInt(minutes, 10);
    const total = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
    onSubmit({
      date,
      durationMinutes: total > 0 ? total : undefined,
      difficulty,
      weather, // stringa vuota = "non specificato" → l'update la azzera nel DB
      notes: notes.trim(),
    });
  };

  return (
    <div className="bg-gray-900 rounded p-2 space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor={`${idPrefix}-date`}>Data</label>
          <input id={`${idPrefix}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div className="w-16">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor={`${idPrefix}-hours`}>Ore</label>
          <input id={`${idPrefix}-hours`} type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
        <div className="w-16">
          <label className="block text-[10px] text-gray-500 uppercase" htmlFor={`${idPrefix}-min`}>Minuti</label>
          <input id={`${idPrefix}-min`} type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 uppercase">Difficoltà percepita</label>
        <DifficultyRating value={difficulty} onChange={(v) => setDifficulty(v)} />
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 uppercase" htmlFor={`${idPrefix}-weather`}>Meteo</label>
        <select id={`${idPrefix}-weather`} value={weather} onChange={(e) => setWeather(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none">
          <option value="">— non specificato —</option>
          {WEATHER_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.icon} {o.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] text-gray-500 uppercase" htmlFor={`${idPrefix}-notes`}>Note</label>
        <textarea id={`${idPrefix}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Note aggiuntive..."
          className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:border-green-500 focus:outline-none resize-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-1.5 bg-gray-700 rounded text-xs hover:bg-gray-600">Annulla</button>
        <button onClick={submit} className="flex-1 py-1.5 bg-green-600 text-black rounded text-xs font-bold hover:bg-green-500">Salva</button>
      </div>
    </div>
  );
}
