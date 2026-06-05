import { getSupabase } from './supabase';
import type { Itinerary, RouteCompletion } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteRow { id: string; data: Record<string, unknown>; created_by: string; sort_index: number; created_at: string; updated_at: string; }
interface CompletionRow { id: string; route_id: string; created_by: string; person: string; date: string; duration_minutes: number | null; notes: string; }

function mapCompletion(r: CompletionRow): RouteCompletion {
  return { id: r.id, personName: r.person, date: r.date, durationMinutes: r.duration_minutes ?? undefined, notes: r.notes ?? '' };
}

export async function fetchRoutes(): Promise<Itinerary[]> {
  const supabase = getSupabase();
  const [routesRes, compsRes, membersRes] = await Promise.all([
    supabase.from('routes').select('*').order('sort_index'),
    supabase.from('completions').select('*'),
    supabase.from('members').select('id, username'),
  ]);
  const routeRows = (routesRes.data ?? []) as RouteRow[];
  const compRows = (compsRes.data ?? []) as CompletionRow[];
  const memberRows = (membersRes.data ?? []) as { id: string; username: string }[];

  const members = new Map(memberRows.map((m) => [m.id, m.username]));
  const compsByRoute = new Map<string, RouteCompletion[]>();
  for (const c of compRows) {
    const list = compsByRoute.get(c.route_id) ?? [];
    list.push(mapCompletion(c));
    compsByRoute.set(c.route_id, list);
  }
  return routeRows.map((row) => {
    const d = row.data ?? {};
    return {
      id: row.id,
      name: (d.name as string) ?? 'Senza nome',
      createdAt: (d.createdAt as string) ?? row.created_at,
      updatedAt: row.updated_at,
      waypoints: (d.waypoints as Itinerary['waypoints']) ?? [],
      legs: (d.legs as Itinerary['legs']) ?? [],
      notes: (d.notes as string) ?? '',
      metrics: d.metrics as Itinerary['metrics'],
      sortIndex: row.sort_index,
      completions: compsByRoute.get(row.id) ?? [],
      createdByUsername: members.get(row.created_by),
    };
  });
}

function dataPayload(it: Itinerary): Record<string, unknown> {
  return { name: it.name, createdAt: it.createdAt, waypoints: it.waypoints, legs: it.legs, notes: it.notes ?? '', metrics: it.metrics };
}

export async function saveRouteToCloud(it: Itinerary, memberId: string): Promise<string> {
  const supabase = getSupabase();
  if (UUID_RE.test(it.id)) {
    const { data: row } = await supabase.from('routes').select('id, created_by').eq('id', it.id).maybeSingle();
    if (row && (row as { created_by: string }).created_by === memberId) {
      const { error } = await supabase.from('routes').update({ data: dataPayload(it), updated_at: new Date().toISOString() }).eq('id', it.id);
      if (error) throw new Error((error as { message: string }).message);
      return it.id;
    }
  }
  const id = crypto.randomUUID();
  const { data: maxRows } = await supabase.from('routes').select('sort_index').order('sort_index', { ascending: false });
  const maxSort = maxRows && maxRows[0] ? (maxRows[0] as { sort_index: number }).sort_index : -1;
  const { error } = await supabase.from('routes').insert({ id, data: dataPayload(it), created_by: memberId, sort_index: maxSort + 1 });
  if (error) throw new Error((error as { message: string }).message);
  return id;
}

export async function deleteRoute(id: string): Promise<void> {
  const { error } = await getSupabase().from('routes').delete().eq('id', id);
  if (error) throw new Error((error as { message: string }).message);
}

export async function updateRouteNotes(id: string, notes: string): Promise<void> {
  const supabase = getSupabase();
  const { data: row } = await supabase.from('routes').select('data').eq('id', id).maybeSingle();
  const data = ((row as { data?: Record<string, unknown> } | null)?.data) ?? {};
  const { error } = await supabase.from('routes').update({ data: { ...data, notes }, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error((error as { message: string }).message);
}

export async function reorderRoutes(orderedIds: string[]): Promise<void> {
  const supabase = getSupabase();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('routes').update({ sort_index: i }).eq('id', orderedIds[i]);
    if (error) throw new Error((error as { message: string }).message);
  }
}

export async function addCompletion(routeId: string, memberId: string, c: Omit<RouteCompletion, 'id'>): Promise<void> {
  const { error } = await getSupabase().from('completions').insert({
    route_id: routeId, created_by: memberId, person: c.personName, date: c.date,
    duration_minutes: c.durationMinutes ?? null, notes: c.notes ?? '',
  });
  if (error) throw new Error((error as { message: string }).message);
}

export async function updateCompletion(completionId: string, patch: Partial<RouteCompletion>): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.personName !== undefined) upd.person = patch.personName;
  if (patch.date !== undefined) upd.date = patch.date;
  if (patch.durationMinutes !== undefined) upd.duration_minutes = patch.durationMinutes ?? null;
  if (patch.notes !== undefined) upd.notes = patch.notes;
  const { error } = await getSupabase().from('completions').update(upd).eq('id', completionId);
  if (error) throw new Error((error as { message: string }).message);
}

export async function deleteCompletion(completionId: string): Promise<void> {
  const { error } = await getSupabase().from('completions').delete().eq('id', completionId);
  if (error) throw new Error((error as { message: string }).message);
}
