import { NextResponse } from 'next/server';
import { discoverLatestBulletin } from '@/lib/dpc-discovery';

// Next 14 prerenderizza staticamente le GET che non leggono la Request:
// questi dati DEVONO essere live a ogni richiesta (force-dynamic → anche fetch no-store).
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await discoverLatestBulletin();
  if (result.status === 200) return NextResponse.json(result.data);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
