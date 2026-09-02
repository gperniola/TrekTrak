import {
  AREA_MASSIMA_KM2,
  SPAN_MINIMO_GRADI,
  areaLeggibile,
  tessereLungoIlPercorso,
  urlDaScaricare,
  SOTTODOMINI,
  TETTO_TESSERE,
  ZOOM_MASSIMO,
  ZOOM_MINIMO,
  areaKm2,
  pesoLeggibile,
  pianifica,
  quanteTessere,
  rettangoloConMargine,
  rettangoloDaPunti,
  tesseraDa,
  tessereNelRettangolo,
  type Rettangolo,
  urlTessera,
} from '@/lib/tile-offline';

/**
 * TASK-37. Il service worker conserva già le mattonelle **guardate almeno una volta**:
 * basta per riaprire l'app dov'era, non basta per la situazione per cui l'app esiste — si
 * è in quota, il telefono non ha segnale, e la mappa deve esserci comunque.
 */

/** Un rettangolo attorno a Campo Imperatore, l'area di prova del progetto. */
/**
 * `pianifica` riceve **come** scegliere le mattonelle di un livello: la logica del tetto
 * e' la stessa per il rettangolo e per il corridoio, e tenerla in un posto solo evita due
 * copie che divergono. Questi casi parlano del tetto, quindi passano il rettangolo.
 */
const perRettangolo = (r: Rettangolo) => (z: number) => tessereNelRettangolo(r, z);

const GRAN_SASSO = { south: 42.42, west: 13.53, north: 42.48, east: 13.58 };

describe('dal punto alla mattonella', () => {
  /** Riferimento noto: allo zoom 0 tutto il mondo è una mattonella sola. */
  test('allo zoom 0 c e una mattonella e basta', () => {
    expect(tesseraDa(42.44, 13.55, 0)).toEqual({ x: 0, y: 0 });
    expect(tessereNelRettangolo(GRAN_SASSO, 0)).toHaveLength(1);
  });

  test('l origine dei quadranti sta dove deve', () => {
    expect(tesseraDa(0.001, 0.001, 1)).toEqual({ x: 1, y: 0 });
    expect(tesseraDa(-0.001, -0.001, 1)).toEqual({ x: 0, y: 1 });
  });

  test('un valore fissato: il Gran Sasso allo zoom 14', () => {
    expect(tesseraDa(42.44, 13.55, 14)).toEqual({ x: 8808, y: 6054 });
  });

  /**
   * La prova che vale piu' del numero fissato qui sopra: **il punto deve cadere dentro la
   * mattonella che gli viene assegnata**. Si torna indietro dall'indice ai gradi e si
   * verifica il contenimento, su punti sparsi e a piu' zoom.
   *
   * Il numero fissato l'avevo scritto a memoria e **era sbagliato** (8792/6060): il codice
   * era giusto e il test lo accusava. Una proprieta' non si puo' inventare.
   */
  test('il punto cade dentro la mattonella che gli viene data', () => {
    const gradiDa = (x: number, y: number, z: number) => {
      const n = 2 ** z;
      const lon = (x / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
      return { lat, lon };
    };
    const punti = [
      { lat: 42.44, lon: 13.55 },   // Gran Sasso
      { lat: 45.83, lon: 6.86 },    // Monte Bianco
      { lat: -33.92, lon: 18.42 },  // emisfero sud
      { lat: 60.17, lon: 24.94 },   // nord
      { lat: 0, lon: 0 },           // origine
    ];
    for (const p of punti) {
      for (const z of [8, 12, 14, 16]) {
        const t = tesseraDa(p.lat, p.lon, z);
        const nw = gradiDa(t.x, t.y, z);
        const se = gradiDa(t.x + 1, t.y + 1, z);
        expect(p.lon).toBeGreaterThanOrEqual(nw.lon);
        expect(p.lon).toBeLessThan(se.lon);
        expect(p.lat).toBeLessThanOrEqual(nw.lat);
        expect(p.lat).toBeGreaterThan(se.lat);
      }
    }
  });

  /**
   * L'inversione che sbaglia chi scrive questo codice la prima volta: la latitudine cresce
   * verso nord, ma l'indice **y decresce**. Il nord dà la y minore.
   */
  test('il nord ha la y piu piccola del sud', () => {
    const nord = tesseraDa(GRAN_SASSO.north, GRAN_SASSO.west, 14);
    const sud = tesseraDa(GRAN_SASSO.south, GRAN_SASSO.west, 14);
    expect(nord.y).toBeLessThan(sud.y);
  });

  test('oltre i poli non si esce dalla griglia', () => {
    const z = 5;
    const limite = 2 ** z - 1;
    expect(tesseraDa(89.9, 0, z).y).toBeLessThanOrEqual(limite);
    expect(tesseraDa(-89.9, 0, z).y).toBeLessThanOrEqual(limite);
    expect(tesseraDa(0, 179.99, z).x).toBeLessThanOrEqual(limite);
  });
});

describe('coprire un rettangolo', () => {
  test('le mattonelle sono senza doppioni', () => {
    const t = tessereNelRettangolo(GRAN_SASSO, 14);
    const chiavi = t.map((x) => x.x + '/' + x.y);
    expect(new Set(chiavi).size).toBe(chiavi.length);
    expect(t.length).toBe(quanteTessere(GRAN_SASSO, 14));
  });

  test('il conteggio cresce con lo zoom', () => {
    const a = quanteTessere(GRAN_SASSO, 13);
    const b = quanteTessere(GRAN_SASSO, 14);
    expect(b).toBeGreaterThan(a * 2);
    expect(b).toBeLessThan(a * 8);
  });

  test('tutte le mattonelle portano lo zoom richiesto', () => {
    expect(tessereNelRettangolo(GRAN_SASSO, 15).every((t) => t.z === 15)).toBe(true);
  });
});

describe('il margine attorno all itinerario', () => {
  test('allarga il rettangolo, e non lo sposta', () => {
    const largo = rettangoloConMargine(GRAN_SASSO, 0.2);
    expect(largo.north).toBeGreaterThan(GRAN_SASSO.north);
    expect(largo.south).toBeLessThan(GRAN_SASSO.south);
    const centroPrima = (GRAN_SASSO.north + GRAN_SASSO.south) / 2;
    const centroDopo = (largo.north + largo.south) / 2;
    expect(centroDopo).toBeCloseTo(centroPrima, 6);
  });

  test('non esce dai limiti del mondo', () => {
    const estremo = rettangoloConMargine({ south: -84, west: -179, north: 84, east: 179 }, 0.5);
    expect(estremo.south).toBeGreaterThanOrEqual(-85);
    expect(estremo.north).toBeLessThanOrEqual(85);
    expect(estremo.west).toBeGreaterThanOrEqual(-180);
    expect(estremo.east).toBeLessThanOrEqual(180);
  });
});

describe('il rettangolo dai waypoint', () => {
  test('contiene tutti i punti', () => {
    const r = rettangoloDaPunti([
      { lat: 42.44, lon: 13.55 },
      { lat: 42.47, lon: 13.52 },
      { lat: 42.42, lon: 13.58 },
    ])!;
    expect(r.south).toBeCloseTo(42.42, 6);
    expect(r.north).toBeCloseTo(42.47, 6);
    expect(r.west).toBeCloseTo(13.52, 6);
    expect(r.east).toBeCloseTo(13.58, 6);
  });

  /** Un waypoint senza coordinate non è un punto: non allarga niente e non fa danni. */
  test('i punti senza coordinate non contano', () => {
    const r = rettangoloDaPunti([
      { lat: 42.44, lon: 13.55 },
      { lat: null, lon: null },
      { lat: 42.46, lon: 13.57 },
    ])!;
    expect(r.north).toBeCloseTo(42.46, 6);
  });

  test('senza nessun punto valido non c e rettangolo', () => {
    expect(rettangoloDaPunti([])).toBeNull();
    expect(rettangoloDaPunti([{ lat: null, lon: null }])).toBeNull();
    expect(rettangoloDaPunti([{ lat: NaN, lon: 12 }])).toBeNull();
  });
});

describe('il piano di scaricamento', () => {
  test('parte dallo zoom largo e scende finche ci sta', () => {
    const p = pianifica(perRettangolo(GRAN_SASSO));
    expect(p.tessere.length).toBeLessThanOrEqual(TETTO_TESSERE);
    expect(p.zoomRaggiunto).toBeGreaterThanOrEqual(ZOOM_MINIMO);
    expect(p.zoomRaggiunto).toBeLessThanOrEqual(ZOOM_MASSIMO);
  });

  /**
   * **Un livello si prende per intero o non si prende.** Mezzo livello darebbe una mappa
   * che si sfoca a chiazze — peggio di una che si sfoca uniformemente oltre un certo
   * ingrandimento, perché non si capisce se manca il dato o manca la rete.
   */
  test('non scarica mezzo livello', () => {
    const p = pianifica(perRettangolo(GRAN_SASSO), 12, 18, 300);
    const perZoom = new Map<number, number>();
    for (const t of p.tessere) perZoom.set(t.z, (perZoom.get(t.z) ?? 0) + 1);
    perZoom.forEach((quante, z) => {
      expect(quante).toBe(quanteTessere(GRAN_SASSO, z));
    });
  });

  test('col tetto strettissimo lo dice, invece di scaricare a meta', () => {
    const p = pianifica(perRettangolo(GRAN_SASSO), 12, 16, 1);
    expect(p.tessere).toHaveLength(0);
    expect(p.limitatoDalTetto).toBe(true);
    expect(p.zoomRaggiunto).toBe(ZOOM_MINIMO - 1);
  });

  test('con un tetto larghissimo arriva in fondo e non si dichiara limitato', () => {
    const p = pianifica(perRettangolo(GRAN_SASSO), 12, 14, 100000);
    expect(p.limitatoDalTetto).toBe(false);
    expect(p.zoomRaggiunto).toBe(14);
  });

  test('gli zoom del piano sono consecutivi dal minimo', () => {
    const p = pianifica(perRettangolo(GRAN_SASSO));
    const zoom = p.tessere.map((t) => t.z).filter((z, i, a) => a.indexOf(z) === i).sort((a, b) => a - b);
    expect(zoom[0]).toBe(ZOOM_MINIMO);
    zoom.forEach((z, i) => expect(z).toBe(ZOOM_MINIMO + i));
  });
});

describe('area del rettangolo', () => {
  test('il Gran Sasso di prova e un area da escursione', () => {
    const a = areaKm2(GRAN_SASSO);
    expect(a).toBeGreaterThan(10);
    expect(a).toBeLessThan(AREA_MASSIMA_KM2);
  });

  test('un grado quadrato all equatore sta intorno ai 12.300 km2', () => {
    const a = areaKm2({ south: 0, west: 0, north: 1, east: 1 });
    expect(a).toBeGreaterThan(11000);
    expect(a).toBeLessThan(13000);
  });

  /** Alle nostre latitudini un grado di longitudine è più corto: l'area si restringe. */
  test('piu a nord la stessa finestra in gradi copre meno terra', () => {
    const equatore = areaKm2({ south: 0, west: 0, north: 1, east: 1 });
    const alpi = areaKm2({ south: 46, west: 7, north: 47, east: 8 });
    expect(alpi).toBeLessThan(equatore * 0.8);
  });
});

/**
 * **Il dettaglio che decide se questa funzione serve a qualcosa.** Leaflet scegli il
 * sottodominio in modo deterministico e la chiave della cache è l'URL intero: scaricare da
 * `a.tile...` una mattonella che poi verrà chiesta a `b.tile...` riempie il disco e lascia
 * il vuoto in quota, dove non c'è modo di accorgersene.
 */
describe('l URL della mattonella', () => {
  const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  test('sostituisce zoom, x e y', () => {
    expect(urlTessera(OSM, { z: 14, x: 8808, y: 6054 }))
      .toBe('https://a.tile.openstreetmap.org/14/8808/6054.png');
  });

  /** La stessa regola di Leaflet: `subdomains[abs(x + y) % 3]`. */
  test('il sottodominio segue la regola di Leaflet', () => {
    const casi = [{ z: 14, x: 8808, y: 6054 }, { z: 14, x: 8809, y: 6054 }, { z: 14, x: 8810, y: 6054 }];
    for (const t of casi) {
      const atteso = SOTTODOMINI[Math.abs(t.x + t.y) % 3];
      expect(urlTessera(OSM, t)).toContain('https://' + atteso + '.');
    }
  });

  test('le tre lettere vengono usate tutte, su una griglia vera', () => {
    const usati = new Set(tessereNelRettangolo(GRAN_SASSO, 14).map((t) => urlTessera(OSM, t).slice(8, 9)));
    expect(usati.size).toBe(3);
  });

  test('un modello senza sottodominio resta intatto', () => {
    const tf = 'https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=K';
    expect(urlTessera(tf, { z: 12, x: 1, y: 2 }))
      .toBe('https://tile.thunderforest.com/outdoors/12/1/2.png?apikey=K');
  });
});

describe('il peso in parole', () => {
  test('byte, kilobyte e megabyte', () => {
    expect(pesoLeggibile(512)).toBe('512 B');
    expect(pesoLeggibile(1024 * 700)).toBe('700 kB');
    expect(pesoLeggibile(1024 * 1024 * 12.34)).toBe('12,3 MB');
    expect(pesoLeggibile(1024 * 1024 * 250)).toBe('250 MB');
  });

  test('i decimali sono all italiana', () => {
    expect(pesoLeggibile(1024 * 1024 * 3.5)).toContain(',');
    expect(pesoLeggibile(1024 * 1024 * 3.5)).not.toContain('.');
  });

  test('un valore che non c e si dice', () => {
    expect(pesoLeggibile(NaN)).toBe('n/d');
    expect(pesoLeggibile(-1)).toBe('n/d');
  });
});

/**
 * **«Su un'area di 0 km²».** Il pannello scriveva l'area senza decimali, quindi qualunque
 * itinerario sotto il mezzo chilometro quadrato — un giro di cresta breve, un
 * avvicinamento — si presentava come area nulla. Non e' un errore di calcolo: e' una
 * frase che dice il falso su un numero giusto, ed e' la classe di difetto che questo
 * progetto ha gia' incontrato con le distanze arrotondate al chilometro (v0.13.3).
 */
describe('l area scritta a parole', () => {
  test('un area piccola non diventa zero', () => {
    expect(areaLeggibile(0.04)).not.toMatch(/^0 /);
    expect(areaLeggibile(0.4)).not.toMatch(/^0 /);
  });

  test('i decimali si diradano man mano che il numero cresce', () => {
    expect(areaLeggibile(0.04)).toBe('0,04 km²');
    expect(areaLeggibile(2.94)).toBe('2,9 km²');
    expect(areaLeggibile(45.2)).toBe('45 km²');
    expect(areaLeggibile(412)).toBe('412 km²');
  });

  test('scrive i numeri all italiana', () => {
    // Il punto separa le migliaia, la virgola i decimali: in un testo italiano
    // «1.024 km²» sono milleventiquattro, non uno virgola zero due quattro.
    expect(areaLeggibile(1024)).toBe('1.024 km²');
    expect(areaLeggibile(2.5)).toContain(',');
  });

  test('un valore che non c e si dice, invece di scrivere NaN', () => {
    expect(areaLeggibile(NaN)).toBe('n/d');
  });
});

/**
 * **«10353 MB».** Il pannello dichiarava lo spazio concesso dal browser fermandosi ai
 * megabyte e senza separatore delle migliaia: dieci gigabyte si leggevano come un numero
 * di cinque cifre che nessuno decifra a colpo d'occhio. Il numero era giusto; la riga
 * serviva a far capire se lo scaricamento ci stava, e non lo faceva capire.
 */
describe('il peso scritto a parole', () => {
  test('oltre il migliaio di megabyte si passa ai gigabyte', () => {
    expect(pesoLeggibile(10353 * 1024 * 1024)).toBe('10,1 GB');
    expect(pesoLeggibile(2 * 1024 * 1024 * 1024)).toBe('2,0 GB');
  });

  test('sotto il gigabyte restano i megabyte, con le migliaia separate', () => {
    expect(pesoLeggibile(113 * 1024 * 1024)).toBe('113 MB');
    expect(pesoLeggibile(5 * 1024 * 1024)).toBe('5,0 MB');
  });

  test('nessun numero esce senza separatore delle migliaia', () => {
    // Qualunque taglia, la parte intera non deve mai avere quattro cifre di fila.
    for (const byte of [1e6, 1e8, 1e9, 5e9, 1e10, 9e10]) {
      const s = pesoLeggibile(byte);
      expect(s).not.toMatch(/\d{4}/);
    }
  });

  test('i kilobyte e i byte restano come prima', () => {
    expect(pesoLeggibile(500)).toBe('500 B');
    expect(pesoLeggibile(20 * 1024)).toBe('20 kB');
  });
});

/**
 * **Il pannello prometteva 35 mattonelle e ne scaricava 70.**
 *
 * Il numero mostrato contava solo la mappa base; lo scaricamento aggiungeva anche
 * l'overlay dei sentieri, quando acceso. Chi guardava vedeva «35 mattonelle» e subito
 * dopo «Scaricamento 1 di 70», e il controllo dello spazio veniva fatto sulla meta' del
 * fabbisogno — cioe' proprio la difesa che doveva evitare di scoprire a meta' che non ci
 * stava.
 *
 * La causa non era una svista nel numero: erano **due conti in due posti diversi**, uno
 * per dire e uno per fare. Ora l'elenco delle URL e' uno solo, e il pannello mostra la
 * lunghezza di quello che scarichera' davvero.
 */
describe('l elenco di cio che si scarica', () => {
  const tessere = [
    { z: 12, x: 1, y: 1 },
    { z: 16, x: 2, y: 2 },
  ];
  const BASE = 'https://tile.esempio.org/{z}/{x}/{y}.png';
  const SENTIERI = 'https://sentieri.esempio.org/{z}/{x}/{y}.png';

  test('senza sentieri, una URL per mattonella', () => {
    expect(urlDaScaricare(tessere, BASE, null)).toHaveLength(2);
  });

  test('coi sentieri accesi, il conto raddoppia — ed e questo il numero da mostrare', () => {
    const url = urlDaScaricare(tessere, BASE, SENTIERI);
    expect(url).toHaveLength(4);
    expect(url.filter((u) => u.includes('sentieri.'))).toHaveLength(2);
  });

  test('i sentieri non si chiedono oltre il loro zoom nativo', () => {
    // L'overlay dei sentieri e' dichiarato fino allo zoom 17: oltre, il servizio non ha
    // mattonelle e le chiederemmo per niente.
    const alte = [{ z: 18, x: 1, y: 1 }, { z: 16, x: 1, y: 1 }];
    const url = urlDaScaricare(alte, BASE, SENTIERI);
    expect(url.filter((u) => u.includes('sentieri.'))).toHaveLength(1);
  });

  test('nessuna URL resta con un segnaposto dentro', () => {
    for (const u of urlDaScaricare(tessere, BASE, SENTIERI)) {
      expect(u).not.toMatch(/\{[a-z]\}/);
    }
  });
});

/**
 * **Un solo waypoint dava un rettangolo di area zero.** Il margine e' una frazione della
 * dimensione, e una frazione di zero resta zero: chi segna il punto di partenza e chiede
 * la mappa senza rete si vedeva offrire «5 mattonelle su un'area di 0,00 km²». Una
 * colonna di mattonelle larga quanto un punto non serve a camminare.
 */
describe('il rettangolo minimo', () => {
  const punto = { south: 42.47, north: 42.47, west: 13.56, east: 13.56 };

  test('un punto solo diventa comunque un area percorribile', () => {
    const r = rettangoloConMargine(punto);
    expect(r.north - r.south).toBeGreaterThanOrEqual(SPAN_MINIMO_GRADI);
    expect(r.east - r.west).toBeGreaterThanOrEqual(SPAN_MINIMO_GRADI);
    expect(areaKm2(r)).toBeGreaterThan(0.5);
  });

  test('resta centrato sul punto', () => {
    const r = rettangoloConMargine(punto);
    expect((r.north + r.south) / 2).toBeCloseTo(42.47, 6);
    expect((r.east + r.west) / 2).toBeCloseTo(13.56, 6);
  });

  test('un itinerario vero non viene allargato', () => {
    const vero = { south: 42.40, north: 42.60, west: 13.50, east: 13.70 };
    const r = rettangoloConMargine(vero);
    // 0,2 di margine su 0,2 gradi: 0,04 per lato, molto oltre il minimo
    expect(r.north - r.south).toBeCloseTo(0.28, 6);
    expect(r.east - r.west).toBeCloseTo(0.28, 6);
  });
});

/**
 * **Il corridoio, non il rettangolo** (segnalato il 2026-09-02: «il numero di tile sembra
 * eccessivo»).
 *
 * Coprire il rettangolo che *contiene* il percorso vuol dire scaricare anche tutto quello
 * che il percorso non attraversa, e per una traversata e' la maggior parte. Misurato
 * sommando gli zoom da 12 a 16:
 *
 * | percorso | rettangolo | corridoio | risparmio |
 * |---|---|---|---|
 * | diagonale 8 km | 611 | 219 | 64% |
 * | a L, 10 km | 843 | 240 | 72% |
 * | cresta a zigzag | 857 | 306 | 64% |
 * | anello 12 km | 589 | 298 | 49% |
 * | **traversata 25 km** | **5.372** | **558** | **90%** |
 *
 * Sulla traversata non e' solo spreco: col rettangolo il tetto di cinquecento mattonelle
 * si esaurisce allo **zoom 13**, cioe' si torna con una mappa sfocata; col corridoio ci
 * sta tutto il percorso alla scala che serve per camminare. Il rettangolo trasformava un
 * percorso lungo in una mappa inutile.
 */
describe('le mattonelle lungo il percorso', () => {
  const diagonale = [
    { lat: 42.09, lon: 14.08 },
    { lat: 42.15, lon: 14.16 },
  ];

  test('ne servono molte meno che a coprire tutto il rettangolo', () => {
    const rett = rettangoloConMargine(rettangoloDaPunti(diagonale)!);
    const conRettangolo = tessereNelRettangolo(rett, 15).length;
    const conCorridoio = tessereLungoIlPercorso(diagonale, 15).length;
    expect(conCorridoio).toBeLessThan(conRettangolo);
    // Su una diagonale il guadagno e' sostanzioso, non marginale.
    expect(conCorridoio).toBeLessThan(conRettangolo * 0.6);
  });

  /** Le mattonelle che il tracciato **attraversa** ci devono essere tutte. */
  test('ogni punto del percorso e coperto', () => {
    const tessere = tessereLungoIlPercorso(diagonale, 15);
    const dentro = new Set(tessere.map((t) => `${t.x},${t.y}`));
    // Si campiona la tratta e si pretende che ogni campione cada in una mattonella presa.
    for (let k = 0; k <= 50; k++) {
      const lat = 42.09 + (42.15 - 42.09) * (k / 50);
      const lon = 14.08 + (14.16 - 14.08) * (k / 50);
      const t = tesseraDa(lat, lon, 15);
      expect(dentro.has(`${t.x},${t.y}`)).toBe(true);
    }
  });

  /**
   * Un anello di margine attorno al tracciato: allo zoom piu' fine e' circa 450 metri,
   * che e' quanto si puo' sbagliare un sentiero senza accorgersene.
   */
  test('c e un anello di margine attorno al tracciato', () => {
    const unPunto = [{ lat: 42.10, lon: 14.10 }];
    const t = tessereLungoIlPercorso(unPunto, 15);
    // Un punto solo: la sua mattonella piu' l'anello = 3x3.
    expect(t).toHaveLength(9);
  });

  test('senza punti con coordinate non torna niente', () => {
    expect(tessereLungoIlPercorso([], 15)).toEqual([]);
    expect(tessereLungoIlPercorso([{ lat: null, lon: null }], 15)).toEqual([]);
  });

  test('nessuna mattonella e ripetuta', () => {
    const t = tessereLungoIlPercorso(diagonale, 16);
    expect(new Set(t.map((x) => `${x.x},${x.y}`)).size).toBe(t.length);
  });

  /**
   * **La geometria vera del sentiero, quando c'e'.** Un percorso su sentiero non va in
   * linea d'aria: seguire i tornanti calcolati da OpenRouteService copre quello che si
   * cammina davvero, invece della corda fra due punti.
   */
  test('usa la geometria del sentiero invece della linea d aria', () => {
    // Un tracciato che si allontana molto dalla corda fra i due estremi.
    const geometria: [number, number][] = [
      [42.09, 14.08], [42.09, 14.16], [42.15, 14.16],
    ];
    const conGeometria = tessereLungoIlPercorso(diagonale, 15, { geometria });
    const soloEstremi = tessereLungoIlPercorso(diagonale, 15);
    const insieme = new Set(conGeometria.map((t) => `${t.x},${t.y}`));
    // L'angolo del tracciato — che la linea d'aria non attraversa — deve essere coperto.
    const angolo = tesseraDa(42.09, 14.16, 15);
    expect(insieme.has(`${angolo.x},${angolo.y}`)).toBe(true);
    expect(conGeometria.length).toBeGreaterThan(soloEstremi.length * 0.8);
  });
});
