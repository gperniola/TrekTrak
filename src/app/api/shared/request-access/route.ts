import { getAdminClient } from '@/lib/supabase-admin';
import { createHash } from 'crypto';

/**
 * Gating dell'accesso all'area condivisa.
 * Verifica il token di invito (hash) e, se valido, invia un magic-link:
 * - utente già esistente → magic-link di login;
 * - email nuova → invito che crea l'utente.
 * I signup pubblici sono disabilitati in Supabase Auth: questa è l'unica via.
 */
export async function POST(req: Request) {
  try {
    const { email, token } = await req.json();
    if (!email || !token) return json({ error: 'missing_fields' }, 400);

    const admin = getAdminClient();
    const hash = createHash('sha256').update(String(token)).digest('hex');
    const { data: invite } = await admin
      .from('invites').select('id').eq('token_hash', hash).eq('active', true).maybeSingle();
    if (!invite) return json({ error: 'invalid_invite' }, 403);

    const redirectTo = process.env.SITE_URL ?? 'http://localhost:3000';
    const { data: list } = await admin.auth.admin.listUsers();
    const exists = list?.users?.some(
      (u: { email?: string }) => u.email?.toLowerCase() === String(email).toLowerCase(),
    );

    if (exists) {
      const { error } = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
      if (error) return json({ error: 'send_failed' }, 500);
    } else {
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (error) return json({ error: 'invite_failed' }, 500);
    }
    return json({ ok: true }, 200);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
