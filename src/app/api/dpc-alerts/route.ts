import { NextResponse } from 'next/server';
import { discoverLatestBulletin } from '@/lib/dpc-discovery';

export async function GET() {
  const result = await discoverLatestBulletin();
  if (result.status === 200) return NextResponse.json(result.data);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
