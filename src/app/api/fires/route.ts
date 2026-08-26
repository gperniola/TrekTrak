import { NextResponse } from 'next/server';
import { fetchFiresUpstream } from '@/lib/fires-proxy';

// Next 14 prerenderizza staticamente le GET che non leggono la Request:
// questi dati DEVONO essere live a ogni richiesta (force-dynamic → anche fetch no-store).
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await fetchFiresUpstream();
  if (result.status === 200) return NextResponse.json(result.data);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
