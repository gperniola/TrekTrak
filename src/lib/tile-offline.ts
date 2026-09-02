/**
 * Pre-caricamento delle mattonelle per l'uso offline (task-37).
 *
 * Il service worker mette già in cache le mattonelle **che sono state guardate almeno una
 * volta** (`CacheFirst`, mille voci, trenta giorni). Basta per riaprire l'app sullo stesso
 * pezzo di mappa; non basta per la situazione per cui questa app esiste — si è in quota,
 * il telefono non ha segnale, e la mappa deve esserci comunque.
 *
 * Qui si calcola **quali** mattonelle servono per un itinerario e si chiedono in anticipo:
 * la richiesta passa dal service worker, che le conserva come farebbe con quelle guardate.
 *
 * Tutto ciò che sta in questo file è puro: si verifica senza rete e senza browser.
 */

/**
 * I nomi delle cache delle mattonelle, **uno per mappa base**.
 *
 * Stanno qui e non nel service worker perche' li usano in due: il worker per scriverci, e
 * il pannello dell'offline per dire quanto spazio occupano e per svuotarle. Due elenchi in
 * due file sono due elenchi che divergono — e' il difetto che ha reso necessaria la
 * v0.17.2, dove una definizione rimasta fuori dal commit ha spento venticinque classi.
 */
export const CACHE_TESSERE = [
  'tiles-osm',
  'tiles-opentopomap',
  'tiles-thunderforest',
  'tiles-cyclosm',
  'tiles-waymarked',
] as const;

/** Il rettangolo che contiene l'itinerario, in gradi. */
export interface Rettangolo {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface Tessera {
  z: number;
  x: number;
  y: number;
}

/**
 * Tetto al numero di mattonelle per scaricata.
 *
 * Non è una difesa dal nostro codice ma un patto con chi ci regala le mappe: le
 * condizioni d'uso di OpenStreetMap e degli altri chiedono esplicitamente di non fare
 * scaricate massicce. Cinquecento mattonelle sono un'escursione, non un atlante.
 */
export const TETTO_TESSERE = 500;

/** Sotto questo zoom la mappa non serve a camminare; sopra, il conto esplode. */
export const ZOOM_MINIMO = 12;
export const ZOOM_MASSIMO = 16;

/** Il margine attorno all'itinerario: si cammina anche appena fuori dalla riga. */
export const MARGINE = 0.2;

/**
 * L'estensione minima del rettangolo, in gradi (≈ 1,1 km di latitudine).
 *
 * Serve al caso degenere: **un waypoint solo**. Il margine è una frazione della
 * dimensione, e una frazione di zero resta zero — chi segnava il punto di partenza e
 * chiedeva la mappa senza rete si vedeva offrire «5 mattonelle su un'area di 0,00 km²»,
 * cioè una colonna larga quanto un punto. Un chilometro attorno è il minimo che abbia
 * senso portarsi dietro per un posto in cui si va a piedi.
 */
export const SPAN_MINIMO_GRADI = 0.01;

export function rettangoloConMargine(r: Rettangolo, frazione = MARGINE): Rettangolo {
  const dLat = Math.max((r.north - r.south) * frazione, (SPAN_MINIMO_GRADI - (r.north - r.south)) / 2);
  const dLon = Math.max((r.east - r.west) * frazione, (SPAN_MINIMO_GRADI - (r.east - r.west)) / 2);
  return {
    south: Math.max(-85, r.south - dLat),
    north: Math.min(85, r.north + dLat),
    west: Math.max(-180, r.west - dLon),
    east: Math.min(180, r.east + dLon),
  };
}

/** Il rettangolo che contiene tutti i punti dati, o `null` se non ce n'è nessuno. */
export function rettangoloDaPunti(punti: { lat: number | null; lon: number | null }[]): Rettangolo | null {
  const validi = punti.filter(
    (p): p is { lat: number; lon: number } =>
      p.lat != null && p.lon != null && Number.isFinite(p.lat) && Number.isFinite(p.lon),
  );
  if (validi.length === 0) return null;
  return {
    south: Math.min(...validi.map((p) => p.lat)),
    north: Math.max(...validi.map((p) => p.lat)),
    west: Math.min(...validi.map((p) => p.lon)),
    east: Math.max(...validi.map((p) => p.lon)),
  };
}

/** Coordinate della mattonella che contiene un punto, allo zoom dato (Web Mercator). */
export function tesseraDa(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (Math.min(85.05112878, Math.max(-85.05112878, lat)) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  const limite = n - 1;
  return { x: Math.min(limite, Math.max(0, x)), y: Math.min(limite, Math.max(0, y)) };
}

/** Le mattonelle che coprono il rettangolo a un dato zoom. */
export function tessereNelRettangolo(r: Rettangolo, z: number): Tessera[] {
  // In alto la latitudine cresce, ma l'indice y **decresce**: il nord da' la y minore.
  const alto = tesseraDa(r.north, r.west, z);
  const basso = tesseraDa(r.south, r.east, z);
  const tessere: Tessera[] = [];
  for (let x = alto.x; x <= basso.x; x++) {
    for (let y = alto.y; y <= basso.y; y++) {
      tessere.push({ z, x, y });
    }
  }
  return tessere;
}

/**
 * L'anello di mattonelle attorno al tracciato.
 *
 * Uno: allo zoom più fine è circa 450 metri per lato, che è quanto si può sbagliare un
 * sentiero senza accorgersene, e agli zoom più larghi diventa naturalmente più generoso
 * perché la mattonella copre più terreno. Due anelli quadruplicherebbero il contorno per
 * un margine che a piedi non serve.
 */
export const ANELLO_TESSERE = 1;

/**
 * Le mattonelle **lungo il percorso**, invece di tutte quelle del rettangolo che lo
 * contiene.
 *
 * Coprire il rettangolo significa scaricare anche ciò che il percorso non attraversa, e
 * per una traversata è la maggior parte. Misurato sommando gli zoom da 12 a 16: una
 * diagonale di 8 km passa da 611 mattonelle a 219, un percorso a L da 843 a 240, una
 * **traversata di 25 km da 5.372 a 558**.
 *
 * Sull'ultima non è solo spreco: col rettangolo il tetto di cinquecento si esaurisce allo
 * zoom 13 e si torna con una mappa sfocata; col corridoio ci sta tutto il percorso alla
 * scala che serve per camminare. Il rettangolo trasformava un percorso lungo in una mappa
 * inutile.
 *
 * `geometria`, quando c'è, è il tracciato **vero** calcolato sui sentieri: un percorso in
 * montagna non va in linea d'aria, e seguire i tornanti copre quello che si cammina
 * invece della corda fra due punti.
 */
export function tessereLungoIlPercorso(
  punti: { lat: number | null; lon: number | null }[],
  z: number,
  opzioni: { geometria?: [number, number][]; anello?: number } = {},
): Tessera[] {
  const anello = opzioni.anello ?? ANELLO_TESSERE;
  const linea: [number, number][] = opzioni.geometria != null && opzioni.geometria.length > 0
    ? opzioni.geometria
    : punti
      .filter((p): p is { lat: number; lon: number } =>
        p.lat != null && p.lon != null && Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map((p) => [p.lat, p.lon]);
  if (linea.length === 0) return [];

  const viste = new Set<string>();
  const fuori: Tessera[] = [];
  const aggiungi = (lat: number, lon: number) => {
    const c = tesseraDa(lat, lon, z);
    for (let dx = -anello; dx <= anello; dx++) {
      for (let dy = -anello; dy <= anello; dy++) {
        const x = c.x + dx;
        const y = c.y + dy;
        const limite = 2 ** z - 1;
        if (x < 0 || y < 0 || x > limite || y > limite) continue;
        const chiave = `${x},${y}`;
        if (viste.has(chiave)) continue;
        viste.add(chiave);
        fuori.push({ z, x, y });
      }
    }
  };

  aggiungi(linea[0][0], linea[0][1]);
  for (let i = 0; i < linea.length - 1; i++) {
    const [la1, lo1] = linea[i];
    const [la2, lo2] = linea[i + 1];
    /*
      Si campiona la tratta abbastanza fitto da non **saltare** una mattonella: il passo
      e' una frazione della larghezza di una mattonella in gradi, cosi' fra due campioni
      non ci sta mai una mattonella intera. Campionare in modo grossolano lascerebbe buchi
      lungo le diagonali, e un buco nel corridoio e' un pezzo di sentiero senza mappa.
      Il tetto sui passi evita che una geometria degenere (due punti agli antipodi) faccia
      girare un ciclo enorme.
    */
    const gradiPerTessera = 360 / 2 ** z;
    const passo = gradiPerTessera / 3;
    const passi = Math.min(4000, Math.max(1, Math.ceil(Math.hypot(la2 - la1, lo2 - lo1) / passo)));
    for (let k = 1; k <= passi; k++) {
      aggiungi(la1 + ((la2 - la1) * k) / passi, lo1 + ((lo2 - lo1) * k) / passi);
    }
  }
  return fuori;
}

export interface Piano {
  tessere: Tessera[];
  /** Fino a quale zoom si arriva col tetto disponibile. */
  zoomRaggiunto: number;
  /** `true` se il tetto ha impedito di scendere fino a `zoomMassimo`. */
  limitatoDalTetto: boolean;
}

/**
 * Decide **quali zoom** stanno nel tetto, partendo dal più largo.
 *
 * Si aggiunge un livello solo se ci sta per intero: mezzo livello scaricato darebbe una
 * mappa che a un certo punto si sfoca a chiazze, il che è peggio di una mappa che si
 * sfoca uniformemente oltre un certo ingrandimento. E il livello raggiunto si **dice**,
 * invece di lasciarlo scoprire in quota.
 */
export function pianifica(
  /**
   * **Come** si scelgono le mattonelle di un livello: il rettangolo che contiene tutto
   * (`tessereNelRettangolo`) o il corridoio lungo il percorso (`tessereLungoIlPercorso`).
   *
   * È un parametro e non due funzioni separate perché la logica del tetto — quali zoom ci
   * stanno, quello raggiunto, se il tetto ha morso — è la stessa in entrambi i casi, e due
   * copie di quella logica sarebbero due copie che divergono. Qui cambia solo la scelta.
   */
  livelloDi: (z: number) => Tessera[],
  zoomMin = ZOOM_MINIMO,
  zoomMax = ZOOM_MASSIMO,
  tetto = TETTO_TESSERE,
): Piano {
  const tessere: Tessera[] = [];
  let zoomRaggiunto = zoomMin - 1;
  let limitato = false;
  for (let z = zoomMin; z <= zoomMax; z++) {
    const livello = livelloDi(z);
    if (tessere.length + livello.length > tetto) {
      limitato = true;
      break;
    }
    tessere.push(...livello);
    zoomRaggiunto = z;
  }
  return { tessere, zoomRaggiunto, limitatoDalTetto: limitato };
}

/** Area del rettangolo in km², per avvertire quando non è più un'escursione. */
export function areaKm2(r: Rettangolo): number {
  const latMedia = ((r.north + r.south) / 2 * Math.PI) / 180;
  const altezza = (r.north - r.south) * 110.574;
  const larghezza = (r.east - r.west) * 111.32 * Math.cos(latMedia);
  return Math.abs(altezza * larghezza);
}

/**
 * L'URL di una mattonella, dallo stesso modello che usa Leaflet.
 *
 * **`{s}` non è libero.** Leaflet sceglie il sottodominio in modo deterministico —
 * `subdomains[abs(x + y) % subdomains.length]`, con `'abc'` per difetto — e la chiave
 * della cache è l'URL **intero**. Scaricare da `a.tile...` una mattonella che poi verrà
 * chiesta a `b.tile...` significa riempire il disco e trovare comunque il vuoto in quota:
 * il pre-caricamento non servirebbe a nulla, e senza rete non ci sarebbe modo di
 * accorgersene prima.
 */
export const SOTTODOMINI = ['a', 'b', 'c'] as const;

export function urlTessera(modello: string, t: Tessera): string {
  const s = SOTTODOMINI[Math.abs(t.x + t.y) % SOTTODOMINI.length];
  return modello
    .replace('{s}', s)
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
    .replace('{r}', '');
}

/**
 * Fin dove il servizio dei sentieri ha davvero mattonelle.
 *
 * Dichiarato in `InteractiveMap` come `maxNativeZoom` dell'overlay: oltre, Leaflet stira
 * quelle dello zoom 17 invece di chiederne di nuove, quindi chiederle noi vorrebbe dire
 * bussare per niente a un servizio gratuito.
 */
export const ZOOM_MASSIMO_SENTIERI = 17;

/**
 * **L'unico elenco di ciò che si scarica.**
 *
 * Prima il conto e il lavoro stavano in due posti: il pannello mostrava il numero delle
 * mattonelle della mappa base, e lo scaricamento aggiungeva anche i sentieri. Si leggeva
 * «35 mattonelle» e subito dopo «Scaricamento 1 di 70», e il controllo dello spazio
 * veniva fatto sulla metà del fabbisogno — cioè proprio la difesa che doveva evitare di
 * scoprire a metà strada che non ci stava.
 *
 * Non era una svista in un numero: erano due conti che potevano divergere. Adesso ce n'è
 * uno, e il pannello mostra la lunghezza esatta di ciò che chiederà.
 */
export function urlDaScaricare(
  tessere: Tessera[],
  modelloBase: string,
  modelloSentieri: string | null,
): string[] {
  const url = tessere.map((t) => urlTessera(modelloBase, t));
  if (modelloSentieri != null) {
    url.push(
      ...tessere
        .filter((t) => t.z <= ZOOM_MASSIMO_SENTIERI)
        .map((t) => urlTessera(modelloSentieri, t)),
    );
  }
  return url;
}

/**
 * L'area scritta a parole, coi decimali che si diradano man mano che il numero cresce.
 *
 * Senza questo, un itinerario breve — un avvicinamento, un giro di cresta — si presentava
 * come **«su un'area di 0 km²»**: numero giusto, frase falsa. È la stessa classe di
 * difetto delle distanze arrotondate al chilometro, dove ogni scarto sotto i cinquecento
 * metri si leggeva «Δ 0».
 *
 * Tre soglie perché tre sono gli ordini di grandezza che questa app incontra davvero:
 * frazioni di km² per un avvicinamento, unità per un'escursione, centinaia per un'area
 * che l'avviso dichiara ormai troppo grande.
 */
export function areaLeggibile(km2: number): string {
  if (!Number.isFinite(km2) || km2 < 0) return 'n/d';
  const decimali = km2 < 1 ? 2 : km2 < 10 ? 1 : 0;
  const fisso = km2.toFixed(decimali);
  const [intero, dec] = fisso.split('.');
  return `${conMigliaia(intero)}${dec ? `,${dec}` : ''} km²`;
}

/**
 * Byte in una forma leggibile, all'italiana.
 *
 * **Fino ai gigabyte, e con le migliaia separate.** La prima versione si fermava ai
 * megabyte: lo spazio che il browser concede a un sito è dell'ordine dei dieci gigabyte,
 * e la riga del pannello diceva «10353 MB» — cinque cifre attaccate, che nessuno decifra
 * a colpo d'occhio. Quella riga esiste per far capire se lo scaricamento ci sta, quindi
 * un numero illeggibile la rende inutile.
 */
export function pesoLeggibile(byte: number): string {
  if (!Number.isFinite(byte) || byte < 0) return 'n/d';
  if (byte < 1024) return `${byte} B`;
  const kb = byte / 1024;
  if (kb < 1024) return `${conMigliaia(kb.toFixed(0))} kB`;
  const mb = kb / 1024;
  if (mb < 1024) return mb < 100 ? `${virgola(mb.toFixed(1))} MB` : `${conMigliaia(mb.toFixed(0))} MB`;
  const gb = mb / 1024;
  return gb < 100 ? `${virgola(gb.toFixed(1))} GB` : `${conMigliaia(gb.toFixed(0))} GB`;
}

/** Il punto decimale diventa virgola: in italiano il punto separa le migliaia. */
function virgola(s: string): string {
  return s.replace('.', ',');
}

/** Il punto ogni tre cifre, da destra. */
function conMigliaia(intero: string): string {
  return intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
