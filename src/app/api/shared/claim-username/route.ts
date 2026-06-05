import { getAdminClient } from '@/lib/supabase-admin';

/**
 * Crea la riga `members` per l'utente autenticato che sceglie il suo username.
 * Il primo membro registrato diventa `admin`. Username univoco (case-insensitive).
 */
export async function POST(req: Request) {
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const { username } = await req.json();
    const name = (username ?? '').trim();
    if (name.length < 3 || name.length > 30) return json({ error: 'invalid_username' }, 400);

    const admin = getAdminClient();
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
    const userId = userData.user.id;

    const { data: existing } = await admin.from('members').select('id').eq('id', userId).maybeSingle();
    if (existing) return json({ error: 'already_member' }, 409);

    const { data: taken } = await admin.from('members').select('id').ilike('username', name).maybeSingle();
    if (taken) return json({ error: 'username_taken' }, 409);

    const { count } = await admin.from('members').select('id', { count: 'exact', head: true });
    const role = (count ?? 0) === 0 ? 'admin' : 'member';

    const { error: insErr } = await admin.from('members').insert({ id: userId, username: name, role });
    if (insErr) return json({ error: 'insert_failed' }, 500);

    return json({ ok: true, username: name, role }, 200);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
