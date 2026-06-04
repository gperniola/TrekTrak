import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

export interface Member { id: string; username: string; role: 'member' | 'admin'; }

interface AuthState {
  loading: boolean;
  invited: boolean;
  inviteToken: string | null;
  /** true solo quando l'invito è arrivato adesso dall'URL hash: pilota il popup di benvenuto. */
  justInvited: boolean;
  session: Session | null;
  member: Member | null;
  init: () => Promise<void>;
  refreshMember: () => Promise<void>;
  requestAccess: (email: string) => Promise<{ ok: boolean; error?: string }>;
  claimUsername: (username: string) => Promise<{ ok: boolean; error?: string }>;
  updateUsername: (username: string) => Promise<{ ok: boolean; error?: string }>;
  dismissInvite: () => void;
  signOut: () => Promise<void>;
}

function readInviteFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/[#&]invite=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Handle della sottoscrizione auth, a livello di modulo: evita listener
// duplicati se init() viene chiamato più volte (es. React StrictMode in dev).
let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  loading: true,
  invited: false,
  inviteToken: null,
  justInvited: false,
  session: null,
  member: null,

  init: async () => {
    let invited = false;
    let inviteToken: string | null = null;
    const fromHash = readInviteFromHash();
    if (fromHash) {
      invited = true; inviteToken = fromHash;
      try {
        localStorage.setItem('trektrak_invited', '1');
        localStorage.setItem('trektrak_invite_token', fromHash);
      } catch { /* storage non disponibile */ }
      window.location.hash = '';
    } else {
      try {
        invited = localStorage.getItem('trektrak_invited') === '1';
        inviteToken = localStorage.getItem('trektrak_invite_token');
      } catch { /* ignore */ }
    }
    // justInvited solo se l'invito arriva ORA dall'URL (clic sul link), non da localStorage.
    set({ invited, inviteToken, justInvited: !!fromHash });

    // Il client Supabase potrebbe non essere disponibile (es. env NEXT_PUBLIC mancanti
    // se il dev server non è stato riavviato). In tal caso non blocchiamo la UI:
    // `loading` viene comunque risolto nel finally così il popup di invito può comparire.
    try {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      set({ session: data.session ?? null });
      if (data.session) await get().refreshMember();

      if (!authSubscription) {
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          set({ session: session ?? null });
          if (session) void get().refreshMember();
          else set({ member: null });
        });
        authSubscription = sub.subscription;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Supabase auth init non riuscito (controlla le env NEXT_PUBLIC_SUPABASE_*):', e);
    } finally {
      set({ loading: false });
    }
  },

  refreshMember: async () => {
    const supabase = getSupabase();
    const uid = get().session?.user?.id;
    if (!uid) { set({ member: null }); return; }
    const { data } = await supabase.from('members').select('id, username, role').eq('id', uid).maybeSingle();
    set({ member: (data as Member) ?? null });
  },

  requestAccess: async (email) => {
    // token può essere null se non invitato: il server risponde 403 (gate voluto).
    const token = get().inviteToken;
    const res = await fetch('/api/shared/request-access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); return { ok: false, error: b.error ?? 'error' }; }
    return { ok: true };
  },

  claimUsername: async (username) => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return { ok: false, error: 'no_session' };
    const res = await fetch('/api/shared/claim-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ username }),
    });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: b.error ?? 'error' };
    await get().refreshMember();
    return { ok: true };
  },

  updateUsername: async (username) => {
    const supabase = getSupabase();
    const uid = get().session?.user?.id;
    if (!uid) return { ok: false, error: 'no_session' };
    const { error } = await supabase.from('members').update({ username: username.trim() }).eq('id', uid);
    if (error) return { ok: false, error: error.code === '23505' ? 'username_taken' : 'error' };
    await get().refreshMember();
    return { ok: true };
  },

  dismissInvite: () => set({ justInvited: false }),

  signOut: async () => {
    await getSupabase().auth.signOut();
    set({ session: null, member: null });
  },
}));
