import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { asyncMock } from './support/jest-mocks';

const mockGetSession = asyncMock();
const mockOnAuthStateChange = jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
const mockSignOut = asyncMock();
const mockMaybeSingle = asyncMock();
const mockFrom = jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange, signOut: mockSignOut },
    from: mockFrom,
  }),
}));

import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  mockGetSession.mockReset(); mockMaybeSingle.mockReset(); mockSignOut.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: null } });
  useAuthStore.setState({ loading: true, invited: false, inviteToken: null, justInvited: false, session: null, member: null });
  useAuthStore.getState().dismissInvite(); // reset del flag pendingInvitePopup a livello di modulo
  window.location.hash = '';
  localStorage.clear();
});

describe('authStore', () => {
  test('init: parse #invite dal hash, setta invited e persiste', async () => {
    window.location.hash = '#invite=beta-test';
    await useAuthStore.getState().init();
    const s = useAuthStore.getState();
    expect(s.invited).toBe(true);
    expect(s.inviteToken).toBe('beta-test');
    expect(localStorage.getItem('trektrak_invited')).toBe('1');
    expect(window.location.hash).toBe('');
    expect(s.justInvited).toBe(true); // popup di benvenuto attivo su clic del link
  });

  test('init: invited ripristinato da localStorage senza justInvited (no popup)', async () => {
    localStorage.setItem('trektrak_invited', '1');
    localStorage.setItem('trektrak_invite_token', 'beta-test');
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().invited).toBe(true);
    expect(useAuthStore.getState().justInvited).toBe(false);
  });

  test('dismissInvite azzera justInvited', () => {
    useAuthStore.setState({ justInvited: true });
    useAuthStore.getState().dismissInvite();
    expect(useAuthStore.getState().justInvited).toBe(false);
  });

  test('init: sessione presente + riga member → member popolato', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 't' } } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'u1', username: 'gio', role: 'admin' } });
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().member?.username).toBe('gio');
    expect(useAuthStore.getState().loading).toBe(false);
  });

  test('init: sessione presente ma nessuna riga member → member null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u2' }, access_token: 't' } } });
    mockMaybeSingle.mockResolvedValue({ data: null });
    await useAuthStore.getState().init();
    expect(useAuthStore.getState().member).toBeNull();
  });

  test('signOut azzera la sessione ma mantiene invited', async () => {
    useAuthStore.setState({ invited: true, session: { user: { id: 'u1' } } as never, member: { id: 'u1', username: 'g', role: 'member' } });
    mockSignOut.mockResolvedValue({ error: null });
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().member).toBeNull();
    expect(useAuthStore.getState().invited).toBe(true);
  });
});
