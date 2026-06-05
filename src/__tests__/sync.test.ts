import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const tables: Record<string, unknown[]> = {};
function makeQuery(rows: unknown[]) {
  const result = { data: rows, error: null };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => Promise.resolve(result);
  chain.eq = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  chain.then = (res: (v: typeof result) => void) => res(result);
  return chain;
}
const from = jest.fn((table: string) => ({
  ...makeQuery(tables[table] ?? []),
  insert: jest.fn(() => Promise.resolve({ error: null })),
  update: jest.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
  delete: jest.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
}));
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ from }) }));

import { fetchRoutes } from '@/lib/sync';

beforeEach(() => { for (const k in tables) delete tables[k]; });

describe('fetchRoutes', () => {
  test('assembla routes + completions + username creatore', async () => {
    tables['routes'] = [{
      id: 'r1', sort_index: 0, updated_at: '2026-06-05T00:00:00Z', created_at: '2026-06-01T00:00:00Z',
      created_by: 'm1', data: { name: 'Monte X', waypoints: [], legs: [], notes: 'bella', metrics: { distanceKm: 5 } },
    }];
    tables['completions'] = [{ id: 'c1', route_id: 'r1', created_by: 'm1', person: 'Gio', date: '2026-05-01', duration_minutes: 120, notes: '' }];
    tables['members'] = [{ id: 'm1', username: 'gio' }];
    const routes = await fetchRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe('r1');
    expect(routes[0].name).toBe('Monte X');
    expect(routes[0].notes).toBe('bella');
    expect(routes[0].createdByUsername).toBe('gio');
    expect(routes[0].completions).toHaveLength(1);
    expect(routes[0].completions![0].personName).toBe('Gio');
    expect(routes[0].completions![0].durationMinutes).toBe(120);
  });
});
