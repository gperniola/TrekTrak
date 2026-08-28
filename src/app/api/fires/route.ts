import { NextResponse } from 'next/server';
import { fetchFiresUpstream } from '@/lib/fires-proxy';

/*
 * Next 14 prerenderizza staticamente le GET che non leggono la Request, quindi
 * `force-dynamic` serve perche' la risposta sia calcolata a ogni richiesta.
 *
 * NON basta pero' a tenere fresche le fetch verso FIRMS: quelle finiscono nella
 * Data Cache su disco a meno che non dichiarino `cache: 'no-store'` una per una
 * (cosi' fanno, vedi la lib). `fetchCache` qui e' la seconda cintura, perche' il
 * difetto che ne nasce e' invisibile: dati di giorni prima presentati come freschi.
 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  const result = await fetchFiresUpstream();
  if (result.status === 200) return NextResponse.json(result.data);
  return NextResponse.json({ error: result.error }, { status: result.status });
}
