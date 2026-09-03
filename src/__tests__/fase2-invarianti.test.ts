import {
  CATEGORY_ICONS, CATEGORY_NAMES, EMERGENCY_LAYERS, getEmergencyLayer, isEmergencyLayerId,
} from '@/lib/emergency-layers';
import {
  bboxDiGeometria, giorniDaProvare, improntaZone, parseRatings, regioniPerBbox,
  semplificaGeometria, tolleranzaPerZoom,
} from '@/lib/avalanche';
import { chiaveQuake, parseQuakes } from '@/lib/quakes-api';
import { templateNeve } from '@/lib/snow-cover';

/**
 * Terzo giro di review sulla fase 2: **invarianti e ingressi ostili**.
 *
 * I due giri precedenti hanno letto il codice e guardato lo schermo. Qui si prova quello
 * che nessuno dei due può coprire: che le regole valgano per **tutti** i layer e non solo
 * per quelli che ho in mente, e che una risposta malformata o malevola non passi per
 * buona. Un servizio pubblico che cambia formato è la norma, non l'eccezione.
 */

describe('invarianti del registro, per ogni layer', () => {
  test('ogni id si risolve e si valida', () => {
    for (const l of EMERGENCY_LAYERS) {
      expect(getEmergencyLayer(l.id).id).toBe(l.id);
      expect(isEmergencyLayerId(l.id)).toBe(true);
    }
  });

  test('ogni categoria ha icona e nome scritto', () => {
    for (const l of EMERGENCY_LAYERS) {
      expect(CATEGORY_ICONS[l.category]).toBeTruthy();
      // Il nome serve a chi non vede l'icona: senza, la categoria è un geroglifico.
      expect(CATEGORY_NAMES[l.category]?.length ?? 0).toBeGreaterThan(2);
    }
  });

  test('ogni voce di legenda ha un colore esadecimale vero', () => {
    for (const l of EMERGENCY_LAYERS) {
      for (const v of l.legend) {
        expect(v.color).toMatch(/^#[0-9a-f]{3,8}$/i);
        expect(v.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Le descrizioni dei layer nuovi devono dire **il limite**, non solo la funzione: sono
   * dati di sicurezza, e la parte che cambia una decisione è quella che il dato non copre.
   */
  test('i layer nuovi dichiarano il proprio limite', () => {
    expect(getEmergencyLayer('avalanche-danger').description).toMatch(/non per il singolo pendio|fuori stagione/i);
    expect(getEmergencyLayer('snow-cover').description).toMatch(/nuvola|nubi/i);
    expect(getEmergencyLayer('earthquakes').description).toMatch(/magnitudo/i);
  });

  test('nessun layer promette di essere una previsione quando non lo è', () => {
    // Il radar mostra pioggia già caduta, l'instabilità è misurata: entrambi lo dicono.
    expect(getEmergencyLayer('rain-radar').description).toMatch(/non previsione|gi. cadute/i);
    expect(getEmergencyLayer('storm-instability').description).toMatch(/non prevista/i);
  });
});

describe('ingressi ostili al bollettino valanghe', () => {
  /**
   * `maxDangerRatings` è un oggetto che arriva da fuori: se contiene `__proto__` o
   * `constructor`, un parser scritto con un oggetto normale al posto di una `Map`
   * scriverebbe sul prototipo. Qui il risultato è una `Map`, e la prova è che quelle
   * chiavi non diventano proprietà di nessun oggetto.
   */
  test('chiavi che tentano di inquinare il prototipo non fanno danni', () => {
    const m = parseRatings({
      maxDangerRatings: { __proto__: 3, constructor: 2, 'IT-21-01': 3 },
    });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Quel che conta è che la zona vera ci sia e che nulla sia finito sul prototipo.
    expect(m.get('IT-21-01')?.pericolo).toBe(3);
    expect(Object.prototype.hasOwnProperty.call({}, 'IT-21-01')).toBe(false);
  });

  /**
   * `typeof [] === 'object'`, quindi senza un controllo esplicito un
   * `maxDangerRatings: [3, 2, 1]` — cioe' un formato cambiato — produceva tre zone con id
   * "0", "1" e "2": spazzatura presentata come bollettino. Se la forma non e' quella, e'
   * un errore, e l'errore si vede.
   */
  test('un array al posto dell oggetto e un formato cambiato, quindi un errore', () => {
    expect(() => parseRatings({ maxDangerRatings: [] })).toThrow(/formato/i);
    expect(() => parseRatings({ maxDangerRatings: [3, 2, 1] })).toThrow(/formato/i);
  });

  test('chiavi vuote o strane non diventano zone', () => {
    const m = parseRatings({ maxDangerRatings: { '': 3, ' ': 2, 'IT-21-01': 1 } });
    // Una zona senza id non è disegnabile né spiegabile: resta fuori.
    expect(m.has('')).toBe(false);
    expect(m.get('IT-21-01')?.pericolo).toBe(1);
  });

  test('geometrie spazzatura non fanno cadere la semplificazione', () => {
    const casi: unknown[] = [
      { type: 'Polygon', coordinates: null },
      { type: 'Polygon', coordinates: [[]] },
      { type: 'Polygon', coordinates: [[['a', 'b'], ['c', 'd'], ['e', 'f'], ['a', 'b']]] },
      { type: 'MultiPolygon', coordinates: 'niente' },
      { type: 'Polygon', coordinates: [[[Number.NaN, 45], [11, 46], [10.5, 45.5], [Number.NaN, 45]]] },
      { type: '', coordinates: [] },
    ];
    for (const c of casi) {
      expect(() => semplificaGeometria(c as { type: string; coordinates: unknown }, 0.001)).not.toThrow();
    }
  });

  /**
   * Un vertice `NaN` non deve diventare un poligono disegnato: Leaflet lo renderizzerebbe
   * come una forma degenere in un punto qualunque della mappa, cioè un confine inventato.
   */
  test('un vertice illeggibile non si trasforma in un confine inventato', () => {
    const s = semplificaGeometria({
      type: 'Polygon',
      coordinates: [[[Number.NaN, 45], [11, 46], [10.5, 45.5], [Number.NaN, 45]]],
    }, 0.001);
    if (s != null) {
      const punti = (s.coordinates as number[][][])[0];
      expect(punti.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))).toBe(true);
    }
  });

  test('un rettangolo con coordinate non finite è ignoto, non enorme', () => {
    expect(bboxDiGeometria([[Number.NaN, Number.NaN]])).toBeNull();
    const b = bboxDiGeometria([[10, 45], [Number.POSITIVE_INFINITY, 46]]);
    // Se qualcosa passa, non deve essere un rettangolo che copre il mondo.
    if (b != null) expect(Number.isFinite(b.east)).toBe(true);
  });

  test('una vista assurda non seleziona regioni assurde', () => {
    expect(regioniPerBbox({ south: Number.NaN, west: Number.NaN, north: Number.NaN, east: Number.NaN })).toEqual([]);
    expect(regioniPerBbox({ south: 80, west: -170, north: 85, east: -160 })).toEqual([]);
  });

  test('la tolleranza resta un numero utile a qualunque zoom', () => {
    for (const z of [-5, 0, 1, 9, 22, 100, Number.POSITIVE_INFINITY, Number.NaN]) {
      const t = tolleranzaPerZoom(z);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(0.005);
    }
  });
});

/**
 * L'impronta è la chiave del layer: se due contenuti diversi la condividono, restano
 * disegnati i poligoni di prima ricolorati coi pericoli nuovi. La prima chiave —
 * `numeroZone-primoId` — collideva proprio nel caso comune del pan.
 */
describe('l impronta del contenuto', () => {
  const z = (id: string, pericolo: number) => ({ id, pericolo });

  test('stesso contenuto, stessa impronta', () => {
    expect(improntaZone([z('a', 1), z('b', 2)])).toBe(improntaZone([z('a', 1), z('b', 2)]));
  });

  test('cambia una zona e l impronta cambia', () => {
    expect(improntaZone([z('a', 1), z('b', 2)])).not.toBe(improntaZone([z('a', 1), z('c', 2)]));
  });

  test('cambia solo un pericolo e l impronta cambia', () => {
    expect(improntaZone([z('a', 1)])).not.toBe(improntaZone([z('a', 2)]));
  });

  test('l ordine conta: sono le stesse zone in posizioni diverse', () => {
    expect(improntaZone([z('a', 1), z('b', 2)])).not.toBe(improntaZone([z('b', 2), z('a', 1)]));
  });

  test('il caso che faceva collidere la vecchia chiave ora si distingue', () => {
    const prima = [z('IT-32-BZ-01-01', 3), z('IT-32-BZ-02-01', 2)];
    const dopo = [z('IT-32-BZ-01-01', 3), z('IT-32-BZ-09-09', 4)];
    // Stesso numero di zone, stesso primo id: la vecchia chiave era identica.
    expect(prima.length).toBe(dopo.length);
    expect(prima[0].id).toBe(dopo[0].id);
    expect(improntaZone(prima)).not.toBe(improntaZone(dopo));
  });

  test('nessuna collisione su cento insiemi plausibili', () => {
    const viste = Array.from({ length: 100 }, (_, i) =>
      Array.from({ length: 1 + (i % 12) }, (_, k) => z(`IT-32-BZ-${(i + k) % 40}-0${k % 5}`, 1 + ((i + k) % 5))));
    const impronte = new Set(viste.map(improntaZone));
    expect(impronte.size).toBe(100);
  });
});

describe('ingressi ostili ai terremoti', () => {
  const evento = (over: Record<string, unknown> = {}) => ({
    properties: { eventId: 1, time: '2026-09-03T05:10:00', mag: 3, ...over },
    geometry: { coordinates: [13.5, 42.4, 9] },
  });

  test('due eventi con lo stesso id restano due eventi, con chiavi distinte', () => {
    const { quakes } = parseQuakes({ features: [evento(), evento({ mag: 4 })] });
    expect(quakes).toHaveLength(2);
    // L'id resta quello dell'INGV — non lo falsifichiamo — e la chiave per disegnarli
    // e' unica: chiavi React duplicate fanno sbagliare la riconciliazione.
    expect(quakes[0].id).toBe(quakes[1].id);
    expect(chiaveQuake(quakes[0], 0)).not.toBe(chiaveQuake(quakes[1], 1));
  });

  test('coordinate fuori dal mondo non finiscono sulla mappa', () => {
    const { quakes } = parseQuakes({
      features: [
        { properties: { eventId: 2, time: '2026-09-03T05:10:00', mag: 3 }, geometry: { coordinates: [400, 200, 5] } },
        evento({ eventId: 3 }),
      ],
    });
    expect(quakes.every((q) => Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180)).toBe(true);
  });

  test('un luogo con markup non arriva come markup', () => {
    const { quakes } = parseQuakes({ features: [evento({ place: '<img src=x onerror=alert(1)>' })] });
    // Il popup dei terremoti è JSX, quindi React scrive il testo e non lo interpreta:
    // qui si verifica che il valore arrivi intatto, non ripulito a metà.
    expect(quakes[0].place).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('i giorni, ai bordi del calendario', () => {
  test('a cavallo di fine mese', () => {
    expect(giorniDaProvare(new Date('2026-01-31T08:00:00Z')))
      .toEqual(['2026-01-31', '2026-02-01', '2026-01-30']);
  });

  test('a cavallo di fine anno, dopo le 16', () => {
    expect(giorniDaProvare(new Date('2026-12-31T18:00:00Z')))
      .toEqual(['2027-01-01', '2026-12-31', '2026-12-30']);
  });

  test('il 29 febbraio di un anno bisestile esiste', () => {
    expect(giorniDaProvare(new Date('2028-02-28T08:00:00Z'))[1]).toBe('2028-02-29');
  });

  test('l URL della neve regge qualunque giorno', () => {
    for (const g of ['2026-01-01', '2026-12-31', '2028-02-29']) {
      expect(templateNeve(g)).toContain(`/${g}/`);
    }
  });
});
