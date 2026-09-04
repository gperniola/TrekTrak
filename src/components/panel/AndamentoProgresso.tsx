'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CategoryField, TrendDataPoint } from '@/lib/learning-stats';
import { CATEGORIE, ETICHETTE_CATEGORIA } from './SchedaCategoria';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '—';
  }
}

function etichettaGiorno(label: unknown): string {
  return typeof label === 'string' ? formatDate(label) : '—';
}

/**
 * **L'andamento nel tempo: verifiche e quiz sulla stessa scala da 0 a 100.**
 *
 * Compare da tre sessioni. Sotto le tre, una riga dice **perché** non c'è ancora — un
 * grafico che appare senza preavviso alla terza verifica sembra un difetto risolto da sé,
 * e uno spazio vuoto senza spiegazione sembra un difetto e basta.
 *
 * I pulsanti sotto filtrano per categoria: la stessa curva, ma solo per l'azimut o solo
 * per le quote. È lì che si vede su cosa si sta migliorando davvero.
 */
export function AndamentoProgresso(
  { punti, filtro, cambiaFiltro }: {
    punti: TrendDataPoint[];
    filtro: CategoryField | null;
    cambiaFiltro: (c: CategoryField | null) => void;
  },
) {
  if (punti.length === 0) return null;
  if (punti.length < 3) {
    return (
      <div className="text-gray-400 text-xs text-center py-3">
        Il grafico dell&apos;andamento compare da 3 sessioni; la freccia della tendenza da 10.
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs text-gray-400 font-medium mb-2">Andamento nel tempo</div>
      <ResponsiveContainer width="100%" height={160} minWidth={0}>
        <LineChart data={punti}>
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#9ca3af' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} width={30} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
            labelFormatter={etichettaGiorno}
          />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Line type="monotone" dataKey="verifyPercent" name="Verifiche %" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="quizScore" name="Quiz" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-1 mt-2">
        <button
          onClick={() => cambiaFiltro(null)}
          className={`px-2 py-1 rounded text-[10px] ${!filtro ? 'bg-green-700 text-su-colore' : 'bg-gray-800 text-gray-400 hover:text-su-colore'}`}
        >
          Tutte
        </button>
        {CATEGORIE.map((cat) => (
          <button
            key={cat}
            onClick={() => cambiaFiltro(cat === filtro ? null : cat)}
            className={`px-2 py-1 rounded text-[10px] ${filtro === cat ? 'bg-green-700 text-su-colore' : 'bg-gray-800 text-gray-400 hover:text-su-colore'}`}
          >
            {ETICHETTE_CATEGORIA[cat]}
          </button>
        ))}
      </div>
    </div>
  );
}
