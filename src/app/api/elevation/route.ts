import { NextRequest, NextResponse } from 'next/server';
import { fetchElevationUpstream } from '@/lib/elevation-proxy';

export async function GET(request: NextRequest) {
  const locations = request.nextUrl.searchParams.get('locations') ?? '';
  const result = await fetchElevationUpstream(locations);

  if (result.status === 200) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json({ error: result.error }, { status: result.status });
}
