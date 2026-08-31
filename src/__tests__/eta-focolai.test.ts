import {
  finestraRilevazioni,
  descriviEta,
  descriviFinestra,
  datoVecchio,
  SOGLIA_VECCHIO_MIN,
} from '@/lib/eta-focolai';
import type { FirePoint } from '@/lib/firms';

/**
 * Il pannello dichiarava "Aggiornato alle 09:29", che e' quando abbiamo chiesto NOI: chi
 * guarda la mappa prima di partire vuole sapere quando e' passato il satellite. Sono due
 * orari diversi e possono distare ore, perche' il satellite passa due volte al giorno.
 */
const punto = (acquiredAt: string): FirePoint => ({
  lat: 41.9, lon: 12.5, frp: 3, confidence: 'nominal', acquiredAt, satellite: 'N',
});

/** 28/08/2026, 13:40 UTC = 15:40 italiane. */
const ADESSO = Date.parse('2026-08-28T13:40:00Z');

describe('la finestra delle rilevazioni', () => {
  test('prende la piu vecchia e la piu recente', () => {
    const f = finestraRilevazioni([
      punto('2026-08-28T11:15:00Z'),
      punto('2026-08-27T23:52:00Z'),
      punto('2026-08-28T01:32:00Z'),
    ], ADESSO);
    expect(f).not.toBeNull();
    expect(f!.daISO).toBe('2026-08-27T23:52:00.000Z');
    expect(f!.aISO).toBe('2026-08-28T11:15:00.000Z');
    expect(f!.etaMinuti).toBe(145); // 11:15 -> 13:40 = 2 h 25
  });

  test('senza punti non si inventa un orario', () => {
    expect(finestraRilevazioni([], ADESSO)).toBeNull();
  });

  test('le date illeggibili si saltano, le altre valgono', () => {
    const f = finestraRilevazioni([punto('non-una-data'), punto('2026-08-28T12:00:00Z')], ADESSO);
    expect(f!.aISO).toBe('2026-08-28T12:00:00.000Z');
  });

  test('tutte illeggibili: nessuna finestra', () => {
    expect(finestraRilevazioni([punto('boh'), punto('')], ADESSO)).toBeNull();
  });

  /** Orologio locale indietro: un'acquisizione "nel futuro" non diventa un numero negativo. */
  test('un acquisizione nel futuro vale adesso', () => {
    const f = finestraRilevazioni([punto('2026-08-28T14:00:00Z')], ADESSO);
    expect(f!.etaMinuti).toBe(0);
  });
});

describe('l eta a parole', () => {
  test('i casi che si incontrano davvero', () => {
    expect(descriviEta(0)).toBe('adesso');
    expect(descriviEta(1)).toBe('adesso');
    expect(descriviEta(45)).toBe('45 min fa');
    expect(descriviEta(89)).toBe('89 min fa');
    expect(descriviEta(90)).toBe('2 h fa');
    expect(descriviEta(145)).toBe('2 h fa');
    expect(descriviEta(400)).toBe('7 h fa');
  });

  test('oltre due giorni si conta in giorni', () => {
    expect(descriviEta(60 * 60)).toBe('3 giorni fa');
  });
});

describe('la frase mostrata', () => {
  test('dice la finestra in ora italiana e l eta del piu recente', () => {
    const f = finestraRilevazioni([
      punto('2026-08-27T23:52:00Z'),
      punto('2026-08-28T11:15:00Z'),
    ], ADESSO)!;
    const frase = descriviFinestra(f);
    // 23:52 UTC = 01:52 italiane, 11:15 UTC = 13:15 italiane
    expect(frase).toContain('01:52');
    expect(frase).toContain('13:15');
    expect(frase).toContain('2 h fa');
  });

  /**
   * Il fuso si applica una volta sola, quando si scrive: gli istanti restano UTC.
   * E' la lezione piu' ripetuta di questo progetto.
   */
  test('gli orari sono italiani, non UTC', () => {
    const f = finestraRilevazioni([punto('2026-08-28T11:15:00Z')], ADESSO)!;
    expect(descriviFinestra(f)).not.toContain('11:15');
  });
});

describe('quando il dato e abbastanza vecchio da dirlo subito', () => {
  test('sotto le sei ore resta nel dettaglio', () => {
    const f = finestraRilevazioni([punto('2026-08-28T11:15:00Z')], ADESSO)!;
    expect(datoVecchio(f)).toBe(false);
  });

  test('oltre le sei ore va detto senza aprire nulla', () => {
    const f = finestraRilevazioni([punto('2026-08-28T04:00:00Z')], ADESSO)!;
    expect(f.etaMinuti).toBeGreaterThanOrEqual(SOGLIA_VECCHIO_MIN);
    expect(datoVecchio(f)).toBe(true);
  });

  /** La soglia e' la stessa che la legenda usa per il colore dei marker. */
  test('la soglia e sei ore', () => {
    expect(SOGLIA_VECCHIO_MIN).toBe(360);
  });
});
