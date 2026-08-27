/** @jest-environment node */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { asyncMock } from '../support/jest-mocks';

const mockFrom = jest.fn();
const mockGetUser = asyncMock();
jest.mock('@/lib/supabase-admin', () => ({
  getAdminClient: () => ({ from: mockFrom, auth: { getUser: mockGetUser } }),
}));

import { POST } from '@/app/api/shared/claim-username/route';

function req(body: unknown, auth = 'Bearer jwt') {
  return new Request('http://localhost/api/shared/claim-username', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockFrom.mockReset();
  mockGetUser.mockReset();
});

describe('claim-username route', () => {
  test('401 senza JWT', async () => {
    const res = await POST(req({ username: 'gio' }, ''));
    expect(res.status).toBe(401);
  });

  test('400 username troppo corto', async () => {
    const res = await POST(req({ username: 'ab' }));
    expect(res.status).toBe(400);
  });

  test('crea membro, il primo diventa admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const maybeSingle = asyncMock()
      .mockResolvedValueOnce({ data: null }) // già membro? no
      .mockResolvedValueOnce({ data: null }); // username preso? no
    const select = jest.fn(() => ({
      eq: () => ({ maybeSingle }),
      ilike: () => ({ maybeSingle }),
    }));
    // La firma dichiara l'argomento perché il test lo asserisce più sotto.
    const insert = jest.fn((_row: unknown) => ({ error: null }));
    mockFrom.mockImplementation(() => ({
      select: (_cols: string, opts?: { count?: string; head?: boolean }) =>
        opts?.head ? { count: 0 } : select(),
      insert,
    }));
    const res = await POST(req({ username: 'gio' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.role).toBe('admin');
    expect(insert).toHaveBeenCalledWith({ id: 'u1', username: 'gio', role: 'admin' });
  });

  test('409 se username già preso', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null });
    const maybeSingle = asyncMock()
      .mockResolvedValueOnce({ data: null }) // già membro? no
      .mockResolvedValueOnce({ data: { id: 'other' } }); // username preso? sì
    const select = jest.fn(() => ({
      eq: () => ({ maybeSingle }),
      ilike: () => ({ maybeSingle }),
    }));
    mockFrom.mockImplementation(() => ({ select: () => select(), insert: jest.fn() }));
    const res = await POST(req({ username: 'gio' }));
    expect(res.status).toBe(409);
  });
});
