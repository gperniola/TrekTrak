import { soloUltime24h, FINESTRA_ORE } from '@/lib/fires-proxy';
import type { FirePoint } from '@/lib/firms';

/**
 * Il layer si chiama "Focolai attivi (24h)" e per mesi non ha mostrato 24 ore.
 *
 * `dayRange=1` nell'API FIRMS non significa "ultime 24 ore" ma "dalla mezzanotte UTC
 * di oggi". Il passaggio notturno del satellite sull'Italia sta **a cavallo della
 * mezzanotte UTC**: le rilevazioni delle 23:5x UTC — l'01:5x italiano della notte
 * appena passata — cadevano nel giorno prima e sparivano.
 *
 * Misurato il 28/08/2026 alle 13:40 UTC (VIIRS_NOAA20, bbox Italia):
 * `dayRange=1` -> 584 rilevazioni, tutte del 28.
 * `dayRange=2` -> 1854, con quelle di ieri alle 23:52 e 23:54 UTC.
 *
 * Segnalato da chi usa l'app: "alcuni incendi appiccati ierisera non appaiono ancora".
 */
const punto = (acquiredAt: string): FirePoint => ({
  lat: 41.9, lon: 12.5, frp: 5, confidence: 'nominal', acquiredAt, satellite: 'N',
});

describe('la finestra dei focolai e davvero di 24 ore', () => {
  /** Adesso: 28/08/2026, 13:40 UTC. */
  const adesso = Date.parse('2026-08-28T13:40:00Z');

  test('tiene la rilevazione notturna timbrata ieri sera in UTC', () => {
    // 23:52 UTC del 27 = 01:52 italiane del 28: e' la notte appena passata
    const notturno = punto('2026-08-27T23:52:00Z');
    expect(soloUltime24h([notturno], adesso)).toEqual([notturno]);
  });

  test('tiene tutto quello che sta dentro le 24 ore, anche di ieri', () => {
    const dentro = [
      punto('2026-08-27T14:00:00Z'),
      punto('2026-08-27T23:54:00Z'),
      punto('2026-08-28T01:32:00Z'),
      punto('2026-08-28T11:13:00Z'),
    ];
    expect(soloUltime24h(dentro, adesso)).toHaveLength(4);
  });

  test('scarta quello che e piu vecchio di 24 ore', () => {
    const vecchi = [
      punto('2026-08-27T13:39:00Z'), // un minuto oltre il limite
      punto('2026-08-26T12:00:00Z'),
    ];
    expect(soloUltime24h(vecchi, adesso)).toEqual([]);
  });

  test('il confine e esattamente 24 ore', () => {
    const alLimite = punto('2026-08-27T13:40:00Z');
    expect(soloUltime24h([alLimite], adesso)).toEqual([alLimite]);
    expect(FINESTRA_ORE).toBe(24);
  });

  /**
   * Una data illeggibile e' un focolaio che esiste: scartarlo in silenzio sarebbe
   * nascondere un incendio per un difetto di formato.
   */
  test('una data illeggibile non fa sparire il focolaio', () => {
    const rotto = punto('non-una-data');
    expect(soloUltime24h([rotto], adesso)).toEqual([rotto]);
  });
});
