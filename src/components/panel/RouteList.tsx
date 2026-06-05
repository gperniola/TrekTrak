'use client';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouteLibraryStore, type SortMode } from '@/stores/routeLibraryStore';
import { toast } from '@/stores/notificationStore';
import type { Itinerary } from '@/lib/types';

const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Posizione', name: 'Nome', distance: 'Distanza',
  gain: 'Dislivello +', updated: 'Aggiornato', completions: 'Completamenti',
};

function Row({ route, index }: { route: Itinerary; index: number }) {
  const select = useRouteLibraryStore((s) => s.select);
  const selectedId = useRouteLibraryStore((s) => s.selectedRouteId);
  const sortMode = useRouteLibraryStore((s) => s.sortMode);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: route.id, disabled: sortMode !== 'manual',
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const km = route.metrics?.distanceKm ?? 0;
  const gain = route.metrics?.elevationGain ?? 0;
  const completions = route.completions?.length ?? 0;

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${selectedId === route.id ? 'bg-green-900/40 border border-green-600' : 'bg-gray-900 hover:bg-gray-800'}`}
      onClick={() => select(route.id)}
    >
      <span className="text-xs text-gray-500 w-5 text-right tabular-nums">{index + 1}</span>
      {sortMode === 'manual' && (
        <button {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
          className="text-gray-600 hover:text-gray-300 cursor-grab touch-none" aria-label="Trascina per riordinare">⠿</button>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{route.name || 'Senza nome'}</div>
        <div className="text-[11px] text-gray-500">{km.toFixed(1)} km · +{gain}m · 🥾{completions}</div>
      </div>
    </div>
  );
}

export function RouteList() {
  const routes = useRouteLibraryStore((s) => s.routes);
  const sortMode = useRouteLibraryStore((s) => s.sortMode);
  const setSortMode = useRouteLibraryStore((s) => s.setSortMode);
  const reorder = useRouteLibraryStore((s) => s.reorder);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = routes.map((r) => r.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    void reorder(arrayMove(ids, oldIndex, newIndex)).catch(() => toast.error('Errore nel riordino. Riprova quando sei online.'));
  };

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-gray-400">{routes.length} percorsi</span>
        <select
          value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="bg-gray-800 border border-gray-600 rounded text-xs px-1.5 py-1 text-gray-300"
          aria-label="Ordina per"
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
            <option key={m} value={m}>{SORT_LABELS[m]}</option>
          ))}
        </select>
      </div>
      {routes.length === 0 ? (
        <p className="text-gray-500 text-sm px-2 py-4">Nessun percorso salvato. Crea un itinerario e premi &ldquo;Salva&rdquo;.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={routes.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {routes.map((r, i) => <Row key={r.id} route={r} index={i} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
