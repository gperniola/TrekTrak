/** @jest-environment node */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockFrom = jest.fn();
const mockListUsers = jest.fn();
const mockGenerateLink = jest.fn();
const mockInvite = jest.fn();
jest.mock('@/lib/supabase-admin', () => ({
  getAdminClient: () => ({
    from: mockFrom,
    auth: { admin: { listUsers: mockListUsers, generateLink: mockGenerateLink, inviteUserByEmail: mockInvite } },
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
  mockGenerateLink.mockReset();
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
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  test('utente esistente → magic-link di login', async () => {
    inviteLookup({ id: 'i1' });
    mockListUsers.mockResolvedValue({ data: { users: [{ email: 'OLD@b.it' }] } });
    mockGenerateLink.mockResolvedValue({ error: null });
    const res = await POST(req({ email: 'old@b.it', token: 'whatever' }));
    expect(res.status).toBe(200);
    expect(mockGenerateLink).toHaveBeenCalled();
    expect(mockInvite).not.toHaveBeenCalled();
  });
});
