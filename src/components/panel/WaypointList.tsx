'use client';

import { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useItineraryStore } from '@/stores/itineraryStore';
import { WaypointCard } from './WaypointCard';
import { LegCard } from './LegCard';
import type { Waypoint } from '@/lib/types';

function SortableWaypoint({ waypoint, legAfter }: { waypoint: Waypoint; legAfter?: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: waypoint.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      <WaypointCard waypoint={waypoint} dragHandleProps={{ ...attributes, ...listeners }} />
      {legAfter}
    </div>
  );
}

export function WaypointList() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const addWaypoint = useItineraryStore((s) => s.addWaypoint);
  const reorderWaypoints = useItineraryStore((s) => s.reorderWaypoints);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentWaypoints = useItineraryStore.getState().waypoints;
    const oldIndex = currentWaypoints.findIndex((wp) => wp.id === active.id);
    const newIndex = currentWaypoints.findIndex((wp) => wp.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = currentWaypoints.map((_, i) => i);
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, oldIndex);
    reorderWaypoints(newOrder);
  }, [reorderWaypoints]);

  const wpIds = waypoints.map((wp) => wp.id);
  const maxWaypoints = 50;

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      <div className="text-xs uppercase text-gray-500 px-2">Waypoint</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={wpIds} strategy={verticalListSortingStrategy}>
          {waypoints.map((wp, i) => (
            <SortableWaypoint
              key={wp.id}
              waypoint={wp}
              legAfter={i < legs.length ? <LegCard leg={legs[i]} /> : undefined}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        onClick={() => {
          if (waypoints.length >= maxWaypoints) {
            alert(`Massimo ${maxWaypoints} waypoint per itinerario`);
            return;
          }
          addWaypoint();
        }}
        className="w-full border border-dashed border-gray-600 rounded-lg p-3 text-gray-500 hover:text-green-400 hover:border-green-400 transition text-sm"
      >
        + Aggiungi waypoint (o clicca sulla mappa)
      </button>
    </div>
  );
}
