import type { Feature } from 'geojson';
import { pointInRing, pointInPolygon, featureContainsPoint } from '@/lib/geo-contains';

/** Quadrato 10..11 lon, 45..46 lat. */
const quadrato = [[10, 45], [11, 45], [11, 46], [10, 46], [10, 45]];
/** Buco centrale 10.4..10.6, 45.4..45.6. */
const buco = [[10.4, 45.4], [10.6, 45.4], [10.6, 45.6], [10.4, 45.6], [10.4, 45.4]];

const poly = (coords: number[][][]): Feature => ({
  type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: coords },
});
const multi = (coords: number[][][][]): Feature => ({
  type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: coords },
});

describe('pointInRing', () => {
  test('dentro e fuori', () => {
    expect(pointInRing(10.5, 45.5, quadrato)).toBe(true);
    expect(pointInRing(9.9, 45.5, quadrato)).toBe(false);
    expect(pointInRing(10.5, 46.1, quadrato)).toBe(false);
  });

  // La latitudine di un vertice è il caso classico in cui il ray casting scritto male
  // conta due volte l'attraversamento e dà "fuori" per un punto interno.
  test('non conta due volte alla latitudine dei vertici', () => {
    expect(pointInRing(10.5, 45.0001, quadrato)).toBe(true);
    expect(pointInRing(9.5, 45, quadrato)).toBe(false);
    expect(pointInRing(12, 46, quadrato)).toBe(false);
  });

  /**
   * Sui punti esattamente sul bordo NON esiste un contratto: misurando, sud e ovest
   * danno "dentro", nord ed est "fuori", e su un anello interno il verso si ribalta.
   * Non asseriamo niente: con coordinate GPS reali la coincidenza esatta con un
   * vertice del bollettino non si presenta. La prima versione di questo test
   * affermava una garanzia falsa, e non poteva nemmeno cogliere la mutazione
   * classica `>` → `>=`.
   */
  test('un punto chiaramente interno resta interno anche vicinissimo al bordo', () => {
    expect(pointInRing(10.5, 45.000001, quadrato)).toBe(true);
    expect(pointInRing(10.5, 45.999999, quadrato)).toBe(true);
    expect(pointInRing(10.000001, 45.5, quadrato)).toBe(true);
    expect(pointInRing(10.999999, 45.5, quadrato)).toBe(true);
  });
});

describe('pointInPolygon', () => {
  test('anello esterno senza buchi', () => {
    expect(pointInPolygon(10.5, 45.5, [quadrato])).toBe(true);
  });

  // Dichiarare "sei in allerta" a chi sta in un buco è esattamente il tipo di errore
  // che rende inaffidabile un avviso di sicurezza.
  test('un punto nel buco è fuori', () => {
    expect(pointInPolygon(10.5, 45.5, [quadrato, buco])).toBe(false);
    expect(pointInPolygon(10.2, 45.2, [quadrato, buco])).toBe(true);
  });

  test('anelli assenti → fuori', () => {
    expect(pointInPolygon(10.5, 45.5, [])).toBe(false);
  });
});

describe('featureContainsPoint', () => {
  test('Polygon', () => {
    expect(featureContainsPoint(poly([quadrato]), 10.5, 45.5)).toBe(true);
    expect(featureContainsPoint(poly([quadrato]), 12, 45.5)).toBe(false);
  });

  // Il bollettino reale ha 53 MultiPolygon su 187 zone: ignorarli vorrebbe dire
  // mancare un quarto delle zone.
  test('MultiPolygon: basta essere in una delle parti', () => {
    const isole = multi([[quadrato], [[[20, 40], [21, 40], [21, 41], [20, 41], [20, 40]]]]);
    expect(featureContainsPoint(isole, 10.5, 45.5)).toBe(true);
    expect(featureContainsPoint(isole, 20.5, 40.5)).toBe(true);
    expect(featureContainsPoint(isole, 15, 43)).toBe(false);
  });

  /**
   * `null` = "non posso stabilirlo", distinto da `false` = "fuori". Un tipo inatteso
   * che ricadesse su `false` diventerebbe silenziosamente "non sei in nessuna zona in
   * allerta": la risposta pericolosa.
   */
  test('geometria assente o non areale → null, non false', () => {
    expect(featureContainsPoint(null, 10, 45)).toBeNull();
    expect(featureContainsPoint(undefined, 10, 45)).toBeNull();
    const punto: Feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [10, 45] } };
    expect(featureContainsPoint(punto, 10, 45)).toBeNull();
  });

  // Leaflet disegna anche le GeometryCollection: una zona così sarebbe colorata sulla
  // mappa sotto la posizione dell'utente, e senza ricorsione non produrrebbe avvisi.
  test('GeometryCollection: ricorre nelle geometrie interne', () => {
    const coll: Feature = {
      type: 'Feature', properties: {},
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [0, 0] },
          { type: 'Polygon', coordinates: [quadrato] },
        ],
      },
    };
    expect(featureContainsPoint(coll, 10.5, 45.5)).toBe(true);
    // fuori dal poligono, ma resta un Point non interrogabile: "non lo so"
    expect(featureContainsPoint(coll, 20, 20)).toBeNull();
  });
});
