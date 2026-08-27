/** @jest-environment node */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { asyncMock } from '../support/jest-mocks';

const mockFrom = jest.fn();
const mockListUsers = asyncMock();
const mockSignInWithOtp = asyncMock();
const mockInvite = asyncMock();
jest.mock('@/lib/supabase-admin', () => ({
  getAdminClient: () => ({
    from: mockFrom,
    auth: { signInWithOtp: mockSignInWithOtp, admin: { listUsers: mockListUsers, inviteUserByEmail: mockInvite } },
  }),
}));

import { POST } from '@/app/api/shared/request-access/route';

function req(body: unknown) {
  return new Request('http://localhost/api/shared/request-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function inviteLookup(data: unknown) {
  const maybeSingle = jest.fn<() => Promise<{ data: unknown }>>().mockResolvedValue({ data });
  mockFrom.mockImplementation(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }),
  }));
}

beforeEach(() => {
  mockFrom.mockReset();
  mockListUsers.mockReset();
  mockSignInWithOtp.mockReset();
  mockInvite.mockReset();
});

describe('request-access route', () => {
  test('400 se mancano campi', async () => {
    const res = await POST(req({ email: 'a@b.it' }));
    expect(res.status).toBe(400);
  });

  test('403 token invito non valido', async () => {
    inviteLookup(null);
    const res = await POST(req({ email: 'a@b.it', token: 'wrong' }));
    expect(res.status).toBe(403);
    expect(mockInvite).not.toHaveBeenCalled();
  });

  test('nuovo utente → inviteUserByEmail', async () => {
    inviteLookup({ id: 'i1' });
    mockListUsers.mockResolvedValue({ data: { users: [] } });
    mockInvite.mockResolvedValue({ error: null });
    const res = await POST(req({ email: 'new@b.it', token: 'whatever' }));
    expect(res.status).toBe(200);
    expect(mockInvite).toHaveBeenCalled();
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  test('utente esistente → invia magic-link di login (signInWithOtp)', async () => {
    inviteLookup({ id: 'i1' });
    mockListUsers.mockResolvedValue({ data: { users: [{ email: 'OLD@b.it' }] } });
    mockSignInWithOtp.mockResolvedValue({ error: null });
    const res = await POST(req({ email: 'old@b.it', token: 'whatever' }));
    expect(res.status).toBe(200);
    expect(mockSignInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: 'old@b.it', options: expect.objectContaining({ shouldCreateUser: false }) }));
    expect(mockInvite).not.toHaveBeenCalled();
  });
});
