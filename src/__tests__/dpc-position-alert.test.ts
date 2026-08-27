import type { Feature } from 'geojson';
import type { DpcLevel, DpcZone } from '@/lib/dpc';
import {
  checkPosition, positionAlertMessage, positionAlertSeverity,
} from '@/lib/dpc-position-alert';

function quadrato(lon: number, lat: number, d = 0.5): Feature {
  return {
    type: 'Feature', properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d],
      ]],
    },
  };
}

function zona(over: Partial<DpcZone> & { name: string; feature: Feature }): DpcZone {
  const idraulico = (over.idraulico ?? 0) as DpcLevel;
  const temporali = (over.temporali ?? 0) as DpcLevel;
  const idrogeologico = (over.idrogeologico ?? 0) as DpcLevel;
  return {
    name: over.name, idraulico, temporali, idrogeologico,
    maxLevel: (over.maxLevel ?? Math.max(idraulico, temporali, idrogeologico)) as DpcLevel,
    feature: over.feature,
  };
}

describe('checkPosition', () => {
  test('posizione in zona in allerta → esito alert, coi rischi e i loro livelli', () => {
    const zones = [zona({ name: 'Collina bolognese', feature: quadrato(11.34, 44.49), idraulico: 1, temporali: 2 })];
    const r = checkPosition(zones, 44.49, 11.34);
    expect(r.outcome).toBe('alert');
    if (r.outcome !== 'alert') return;
    expect(r.alert.zoneName).toBe('Collina bolognese');
    expect(r.alert.level).toBe(2);
    expect(r.alert.risks).toEqual([
      { label: 'idraulico', level: 1 },
      { label: 'temporali', level: 2 },
    ]);
  });

  test('zona senza allerta → clear', () => {
    const zones = [zona({ name: 'Arno-Firenze', feature: quadrato(11.25, 43.77) })];
    expect(checkPosition(zones, 43.77, 11.25).outcome).toBe('clear');
  });

  test('fuori da tutte le zone → clear', () => {
    const zones = [zona({ name: 'Z', feature: quadrato(11.34, 44.49), idraulico: 2 })];
    expect(checkPosition(zones, 38.11, 13.36).outcome).toBe('clear');
  });

  /**
   * `parseDpcTopology` torna `[]` a ogni fallimento morbido: leggerlo come "nessuna
   * allerta" trasformava geometrie illeggibili in un falso "tutto a posto".
   */
  test('elenco vuoto → unknown, non clear', () => {
    expect(checkPosition([], 44.49, 11.34).outcome).toBe('unknown');
  });

  // Le zone possono sovrapporsi: prendere la prima potrebbe declassare una rossa a
  // gialla, che è l'errore più grave dei due possibili.
  test('zone sovrapposte → vince la più grave, non la prima dell\'elenco', () => {
    const zones = [
      zona({ name: 'Gialla', feature: quadrato(11.34, 44.49), idraulico: 1 }),
      zona({ name: 'Rossa', feature: quadrato(11.34, 44.49), idrogeologico: 3 }),
    ];
    const r = checkPosition(zones, 44.49, 11.34);
    if (r.outcome !== 'alert') throw new Error('atteso alert');
    expect(r.alert.zoneName).toBe('Rossa');
    expect(r.alert.level).toBe(3);
  });

  // Una zona in allerta con geometria non interrogabile non deve diventare "clear".
  test('zona in allerta con geometria non interrogabile → unknown', () => {
    const zones = [zona({
      name: 'Ignota', idraulico: 3,
      feature: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [11.34, 44.49] } },
    })];
    expect(checkPosition(zones, 44.49, 11.34).outcome).toBe('unknown');
  });

  // I nomi reali arrivano a 146 caratteri e finiscono in un banner.
  test('nome di zona molto lungo → accorciato', () => {
    const lungo = 'Bassa Valle d\'Aosta, dalla Gola di Montjovet a Pont-Saint-Martin, Valle del torrente Chalamy, Valle d\'Ayas, Valle di Champorcher e Valle di Gresso';
    const zones = [zona({ name: lungo, feature: quadrato(11.34, 44.49), idraulico: 1 })];
    const r = checkPosition(zones, 44.49, 11.34);
    if (r.outcome !== 'alert') throw new Error('atteso alert');
    expect(r.alert.zoneName.length).toBeLessThan(lungo.length);
    expect(r.alert.zoneName.endsWith('…')).toBe(true);
  });
});

describe('positionAlertMessage', () => {
  /**
   * Il difetto della prima versione: il livello massimo della zona veniva attribuito a
   * TUTTI i rischi elencati. Con idraulico giallo e idrogeologico rosso si leggeva
   * "Allerta rossa per rischio idraulico, idrogeologico": falso allarme su uno e falsa
   * rassicurazione sull'altro, nella stessa frase.
   */
  test('ogni rischio porta il proprio livello, non il massimo della zona', () => {
    const m = positionAlertMessage({
      zoneName: 'Z', level: 3,
      risks: [{ label: 'idraulico', level: 1 }, { label: 'idrogeologico', level: 3 }],
    }, 'oggi');
    expect(m).toContain('idraulico gialla');
    expect(m).toContain('idrogeologico rossa');
    expect(m).not.toMatch(/rischio idraulico, idrogeologico\./);
  });

  test('dice il livello della zona, il giorno e la zona', () => {
    const m = positionAlertMessage({ zoneName: 'Collina bolognese', level: 1, risks: [] }, 'oggi');
    expect(m).toContain('Allerta gialla');
    expect(m).toContain('per oggi');
    expect(m).toContain('Collina bolognese');
  });

  // Spec §5: il richiamo ai canali ufficiali e il 112 non vanno persi, e la fonte va
  // citata anche qui — è l'unica superficie DPC per chi non apre mai il pannello.
  test('non perde il 112, il richiamo ai canali ufficiali e l\'attribuzione', () => {
    const m = positionAlertMessage({ zoneName: 'Z', level: 2, risks: [] }, 'oggi');
    expect(m).toContain('112');
    expect(m).toContain('non sostituisce');
    expect(m).toContain('non una misura sul posto');
    expect(m).toContain('Dipartimento Protezione Civile');
    expect(m).toContain('CC-BY 4.0');
  });

  test('livelli nominati correttamente', () => {
    const base = { zoneName: 'Z', risks: [] };
    expect(positionAlertMessage({ ...base, level: 2 }, 'oggi')).toContain('Allerta arancione');
    expect(positionAlertMessage({ ...base, level: 3 }, 'oggi')).toContain('Allerta rossa');
  });
});

describe('positionAlertSeverity', () => {
  test('giallo avvisa, arancione e rosso allarmano', () => {
    expect(positionAlertSeverity({ zoneName: 'Z', level: 1, risks: [] })).toBe('warning');
    expect(positionAlertSeverity({ zoneName: 'Z', level: 2, risks: [] })).toBe('severe');
    expect(positionAlertSeverity({ zoneName: 'Z', level: 3, risks: [] })).toBe('severe');
  });
});
