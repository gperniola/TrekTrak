import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase con privilegi elevati (service_role).
 * USARE SOLO nelle API routes server-side. La service_role bypassa la RLS:
 * NON importare mai questo modulo da codice client. L'import di `server-only`
 * fa fallire la build se ciò accade.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin env mancante (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
