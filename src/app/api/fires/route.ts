import { NextResponse } from 'next/server';
import { fetchFiresUpstream } from '@/lib/fires-proxy';

export async function GET() {
  const result = await fetchFiresUpstream();
  if (result.status === 200) return NextResponse.json(result.data);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
