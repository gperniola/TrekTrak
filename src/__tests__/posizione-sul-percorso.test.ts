import { describe, expect, test } from '@jest/globals';
import { proiettaSulPercorso } from '@/lib/calculations';
import {
  INCERTEZZA_UTILE_M,
  TOLLERANZA_SUL_PERCORSO_M,
  posizioneSulProfilo,
} from '@/lib/posizione-sul-percorso';
import { quotaA } from '@/lib/profilo-altimetrico';
import type { Leg, Waypoint } from '@/lib/types';

/**
 * Una tratta di ~11,1 km verso nord (un decimo di grado di latitudine), poi una di ~7,8 km
 * verso est. Gli stessi numeri dei test di `distanceToPosition`, cosi' le due famiglie si
 * leggono insieme.
 */
const WPS: Waypoint[] = [
  { id: 'a', name: 'A', lat: 46.0, lon: 11.0, altitude: 1000, order: 0 },
  { id: 'b', name: 'B', lat: 46.1, lon: 11.0, altitude: 1500, order: 1 },
  { id: 'c', name: 'C', lat: 46.1, lon: 11.1, altitude: 1200, order: 2 },
];
const LEGS: Leg[] = [
  { id: 'l1', fromWaypointId: 'a', toWaypointId: 'b', distance: 11.119, elevationGain: 500, elevationLoss: 0, azimuth: 0 },
  { id: 'l2', fromWaypointId: 'b', toWaypointId: 'c', distance: 7.762, elevationGain: 0, elevationLoss: 300, azimuth: 90 },
];

const ADESSO = 1_700_000_000_000;
const posizione = (lat: number, lon: number, accuracy: number | null = 10, at = ADESSO) => ({ lat, lon, accuracy, at });

describe('proiettare una posizione sul percorso', () => {
  test('un punto sul tracciato ha scostamento zero e la distanza cumulata giusta', () => {
    const p = proiettaSulPercorso(46.05, 11.0, WPS, LEGS);
    expect(p).not.toBeNull();
    expect(p!.distanza).toBeCloseTo(11.119 / 2, 1);
    expect(p!.scostamentoM).toBeCloseTo(0, 0);
  });

  test('un punto a lato del tracciato dice di quanto e lontano', () => {
    // 0,001 gradi di longitudine a 46 di latitudine sono circa 77 m.
    const p = proiettaSulPercorso(46.05, 11.001, WPS, LEGS);
    expect(p).not.toBeNull();
    expect(p!.scostamentoM).toBeGreaterThan(70);
    expect(p!.scostamentoM).toBeLessThan(85);
    expect(p!.distanza).toBeCloseTo(11.119 / 2, 1);
  });

  test('sulla seconda tratta la distanza cumulata include la prima', () => {
    const p = proiettaSulPercorso(46.1, 11.05, WPS, LEGS);
    expect(p!.distanza).toBeCloseTo(11.119 + 7.762 / 2, 0);
  });

  test('senza tratte non c e proiezione', () => {
    expect(proiettaSulPercorso(46.0, 11.0, WPS, [])).toBeNull();
  });
});

describe('la posizione sul profilo', () => {
  test('senza posizione non c e niente da disegnare', () => {
    expect(posizioneSulProfilo(null, WPS, LEGS, ADESSO)).toBeNull();
  });

  test('sul tracciato, adesso, con un buon fix: si disegna alla distanza giusta', () => {
    const r = posizioneSulProfilo(posizione(46.05, 11.0), WPS, LEGS, ADESSO);
    expect(r).not.toBeNull();
    expect(r!.distanza).toBeCloseTo(11.119 / 2, 1);
  });

  test('lontano dal tracciato non si disegna: non sei sul percorso', () => {
    // 0,02 gradi di longitudine: circa 1,5 km di lato.
    expect(posizioneSulProfilo(posizione(46.05, 11.02), WPS, LEGS, ADESSO)).toBeNull();
  });

  test('la tolleranza cresce con l incertezza del fix', () => {
    // ~77 m di lato: entro la tolleranza base, dentro.
    expect(posizioneSulProfilo(posizione(46.05, 11.001, 10), WPS, LEGS, ADESSO)).not.toBeNull();
    // ~155 m di lato: fuori dalla tolleranza base...
    expect(posizioneSulProfilo(posizione(46.05, 11.002, 10), WPS, LEGS, ADESSO)).toBeNull();
    // ...ma dentro se il fix dichiara 100 m di incertezza.
    expect(posizioneSulProfilo(posizione(46.05, 11.002, 100), WPS, LEGS, ADESSO)).not.toBeNull();
  });

  test('un fix troppo incerto non dice «sei qui», nemmeno sul tracciato', () => {
    expect(posizioneSulProfilo(posizione(46.05, 11.0, INCERTEZZA_UTILE_M + 1), WPS, LEGS, ADESSO)).toBeNull();
  });

  test('un incertezza sconosciuta vale come zero: si usa la sola tolleranza base', () => {
    expect(posizioneSulProfilo(posizione(46.05, 11.001, null), WPS, LEGS, ADESSO)).not.toBeNull();
    expect(posizioneSulProfilo(posizione(46.05, 11.002, null), WPS, LEGS, ADESSO)).toBeNull();
  });

  test('una posizione vecchia non si disegna: il profilo dice «sei qui», non «eri qui»', () => {
    const vecchia = posizione(46.05, 11.0, 10, ADESSO - 6 * 60_000);
    expect(posizioneSulProfilo(vecchia, WPS, LEGS, ADESSO)).toBeNull();
  });

  test('le costanti sono quelle dichiarate', () => {
    expect(TOLLERANZA_SUL_PERCORSO_M).toBe(100);
    expect(INCERTEZZA_UTILE_M).toBe(500);
  });
});

describe('la quota a una distanza del profilo', () => {
  const profilo = [
    { distance: 0, altitude: 1000 },
    { distance: 2, altitude: 1400 },
    { distance: 5, altitude: 1100 },
  ];

  test('su un punto della spezzata e la sua quota', () => {
    expect(quotaA(profilo, 2)).toBe(1400);
  });

  test('fra due punti interpola in linea retta', () => {
    expect(quotaA(profilo, 1)).toBe(1200);
    expect(quotaA(profilo, 3.5)).toBe(1250);
  });

  test('agli estremi prende il primo e l ultimo punto', () => {
    expect(quotaA(profilo, 0)).toBe(1000);
    expect(quotaA(profilo, 5)).toBe(1100);
  });

  test('fuori dal profilo non lo sa', () => {
    expect(quotaA(profilo, -1)).toBeNull();
    expect(quotaA(profilo, 5.01)).toBeNull();
    expect(quotaA([], 1)).toBeNull();
  });
});
