import { NextResponse } from 'next/server';
import { zoneValanghe } from '@/lib/avalanche-proxy';
import { LATO_MASSIMO_VISTA_GRADI, vistaTroppoGrande } from '@/lib/avalanche';

/*
 * Come le altre route dei dati di emergenza: `force-dynamic` perché la risposta dipende
 * dalla vista, e `force-no-store` perché le fetch verso l'esterno non finiscano nella
 * Data Cache su disco. Il difetto che nasce da lì è invisibile — un bollettino di ieri
 * presentato come quello di oggi — e in questo progetto è già costato un rilascio.
 */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function numero(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const south = numero(p.get('south'));
  const west = numero(p.get('west'));
  const north = numero(p.get('north'));
  const east = numero(p.get('east'));
  const zoom = numero(p.get('zoom'));

  if (south == null || west == null || north == null || east == null || zoom == null) {
    return NextResponse.json({ error: 'Vista non indicata' }, { status: 400 });
  }
  if (north <= south || east <= west) {
    return NextResponse.json({ error: 'Vista non valida' }, { status: 400 });
  }
  // Il client non chiede mai tanto (sotto lo zoom 9 non interroga affatto): un rettangolo
  // cosi' grande e' un errore, e va detto invece di essere servito con megabyte.
  if (vistaTroppoGrande({ south, west, north, east })) {
    return NextResponse.json(
      { error: `Vista troppo grande: al massimo ${LATO_MASSIMO_VISTA_GRADI} gradi di lato` },
      { status: 400 },
    );
  }

  try {
    const dati = await zoneValanghe({ south, west, north, east }, zoom);
    return NextResponse.json(dati);
  } catch (e: unknown) {
    // 502: il guasto è a monte, non nella richiesta. Il pannello lo distingue da
    // "nessun bollettino", che è invece una risposta valida (fuori stagione).
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bollettino valanghe non disponibile' },
      { status: 502 },
    );
  }
}
