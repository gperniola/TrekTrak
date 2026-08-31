'use client';

import { useCallback, useState } from 'react';
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
import { toast } from '@/stores/notificationStore';
import { WaypointCard } from './WaypointCard';
import { LegCard } from './LegCard';
import { TrackWaypointRow } from './TrackWaypointRow';
import type { Leg, Waypoint } from '@/lib/types';

/**
 * In Track waypoint e tratta stanno in UNA riga compatta (`TrackWaypointRow`), perche'
 * i valori li calcola l'app e non c'e' niente da scriverci; in Learn restano le due
 * schede coi campi, che e' il mestiere di quella modalita'.
 */
function SortableWaypoint({ waypoint, leg, legAfter, compatta, aperta, onApri }: {
  waypoint: Waypoint;
  leg?: Leg;
  legAfter?: React.ReactNode;
  compatta: boolean;
  aperta: boolean;
  onApri: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: waypoint.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const maniglia = { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style}>
      {compatta ? (
        <TrackWaypointRow
          waypoint={waypoint}
          leg={leg}
          aperta={aperta}
          onApri={onApri}
          dragHandleProps={maniglia}
        />
      ) : (
        <>
          <WaypointCard waypoint={waypoint} dragHandleProps={maniglia} />
          {legAfter}
        </>
      )}
    </div>
  );
}

export function WaypointList() {
  const waypoints = useItineraryStore((s) => s.waypoints);
  const legs = useItineraryStore((s) => s.legs);
  const addWaypoint = useItineraryStore((s) => s.addWaypoint);
  const reorderWaypoints = useItineraryStore((s) => s.reorderWaypoints);
  const isTrack = useItineraryStore((s) => s.appMode) === 'track';
  /** Una riga aperta per volta: lo stesso schema del pannello dei layer (v0.14.0). */
  const [apertaId, setApertaId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
    <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-2 space-y-2">
      <div className="text-xs uppercase text-gray-400 px-2">Waypoint</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={wpIds} strategy={verticalListSortingStrategy}>
          {waypoints.map((wp, i) => {
            const nextWp = waypoints[i + 1];
            const leg = nextWp ? legs.find((l) => l.fromWaypointId === wp.id && l.toWaypointId === nextWp.id) : undefined;
            return (
              <SortableWaypoint
                key={wp.id}
                waypoint={wp}
                leg={leg}
                legAfter={leg ? <LegCard leg={leg} /> : undefined}
                compatta={isTrack}
                aperta={apertaId === wp.id}
                onApri={setApertaId}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      {isTrack ? (
        <div className="w-full border border-dashed border-gray-600 rounded-lg p-3 text-gray-400 text-sm text-center">
          Clicca sulla mappa per aggiungere waypoint
        </div>
      ) : (
        <button
          onClick={() => {
            if (waypoints.length >= maxWaypoints) {
              toast.warning(`Massimo ${maxWaypoints} waypoint per itinerario`);
              return;
            }
            addWaypoint();
          }}
          className="w-full border border-dashed border-gray-600 rounded-lg p-3 text-gray-400 hover:text-green-400 hover:border-green-400 transition text-sm"
        >
          + Aggiungi waypoint (o clicca sulla mappa)
        </button>
      )}
    </div>
  );
}
