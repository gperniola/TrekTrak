/**
 * Il **cielo** di un'ora: l'iconcina classica, e la parola che la spiega.
 *
 * Chiesto il 2026-09-02: «per ogni waypoint appaia anche la previsione per quel punto
 * per quell'ora (la classica iconcina che indica sereno, nuvoloso, ecc.)».
 *
 * Il codice arriva da Open-Meteo — la stessa richiesta che il pannello fa gia' per CAPE,
 * raffiche e pioggia, quindi l'icona non costa una riga di rete in piu'. È la tabella
 * **WMO 4677**, quella standard: i codici non li inventa il servizio, e l'unico lavoro
 * da fare è raggrupparli per quello che cambia a chi cammina — quanto vedi
 * (sereno/nuvoloso/nebbia), se ti bagni e quanto, se è neve, se è un temporale.
 *
 * ## Un codice che non si conosce non è "sereno"
 *
 * `null` vuol dire **non lo so**, e chi lo riceve deve scrivere "n/d". La direzione
 * sbagliata dell'errore, qui, è disegnare un sole: questo progetto ha già corretto più
 * volte lo stesso difetto — un dato mancante presentato come buona notizia — e in un'app
 * di montagna un sole immaginario è esattamente il modo di far partire qualcuno.
 */

export interface Cielo {
  /** L'iconcina. Decorativa: accanto ci va sempre `testo`, se non a schermo per i lettori di schermo. */
  icona: string;
  /** La parola, in italiano e minuscola: va in mezzo a una frase o in una legenda. */
  testo: string;
}

/** WMO 4677 come la restituisce Open-Meteo. I codici che non ci sono restano ignoti. */
const CIELI: Record<number, Cielo> = {
  0: { icona: '☀️', testo: 'sereno' },
  1: { icona: '🌤️', testo: 'poco nuvoloso' },
  2: { icona: '⛅', testo: 'parzialmente nuvoloso' },
  3: { icona: '☁️', testo: 'coperto' },
  45: { icona: '🌫️', testo: 'nebbia' },
  48: { icona: '🌫️', testo: 'nebbia che gela' },
  51: { icona: '🌦️', testo: 'pioviggine leggera' },
  53: { icona: '🌦️', testo: 'pioviggine' },
  55: { icona: '🌦️', testo: 'pioviggine intensa' },
  56: { icona: '🧊', testo: 'pioviggine che gela' },
  57: { icona: '🧊', testo: 'pioviggine che gela, intensa' },
  61: { icona: '🌧️', testo: 'pioggia debole' },
  63: { icona: '🌧️', testo: 'pioggia' },
  65: { icona: '🌧️', testo: 'pioggia forte' },
  66: { icona: '🧊', testo: 'pioggia che gela' },
  67: { icona: '🧊', testo: 'pioggia che gela, forte' },
  71: { icona: '🌨️', testo: 'neve debole' },
  73: { icona: '🌨️', testo: 'neve' },
  75: { icona: '🌨️', testo: 'neve forte' },
  77: { icona: '🌨️', testo: 'granelli di neve' },
  80: { icona: '🌦️', testo: 'rovesci deboli' },
  81: { icona: '🌦️', testo: 'rovesci' },
  82: { icona: '🌦️', testo: 'rovesci violenti' },
  85: { icona: '🌨️', testo: 'rovesci di neve' },
  86: { icona: '🌨️', testo: 'rovesci di neve forti' },
  95: { icona: '⛈️', testo: 'temporale' },
  96: { icona: '⛈️', testo: 'temporale con grandine' },
  99: { icona: '⛈️', testo: 'temporale con grandine forte' },
};

/**
 * Il cielo per un codice WMO, o `null` se non si sa.
 *
 * `null` anche per un codice **finito ma sconosciuto**: che sia mancante o
 * incomprensibile, la cosa vera da dire è la stessa — non lo so.
 */
export function cielo(codice: number | null | undefined): Cielo | null {
  if (codice == null || !Number.isFinite(codice)) return null;
  return CIELI[codice] ?? null;
}

/**
 * Quando la corsa del modello non fa piovere ma la **probabilita'** dice il contrario.
 *
 * Non e' un codice WMO: e' la dichiarazione onesta di un disaccordo fra due variabili
 * dello stesso servizio.
 */
const POSSIBILE_PIOGGIA: Cielo = { icona: '🌦️', testo: 'possibile pioggia' };

/** Codici che descrivono un cielo **senza** precipitazione: quelli che si possono correggere. */
const CIELO_ASCIUTTO = new Set([0, 1, 2, 3]);

/**
 * **Il cielo da mostrare per un'ora**, che non e' sempre quello del codice.
 *
 * Segnalato dall'utente il 2026-09-09: la riga diceva «pioggia 78% · possibili temporali
 * forti» e l'iconcina mostrava il **sole**. Non e' un codice strano — «temporali con
 * schiarite» non esiste nella WMO: sono due domande diverse. Il `weather_code` e' il cielo
 * di **una** corsa del modello; la probabilita' viene da un ensemble di simulazioni. Quella
 * corsa era capitata fra le asciutte, mentre la maggioranza bagnava.
 *
 * Misurato sui due mesi della verifica: succede nel **6,4%** delle ore con ECMWF, e
 * nell'**1,6%** con l'iconcina proprio del sole — concentrato nei giorni convettivi, cioe'
 * quelli che contano.
 *
 * Quando la probabilita' raggiunge la soglia d'attenzione **di quel modello** e il codice
 * non dichiara precipitazione, si mostra il disaccordo invece di uno dei due lati. Non e'
 * inventare un cielo: fra due variabili entrambe reali si sceglie quella meglio fondata, ed
 * e' la stessa che decide il colore del pallino.
 *
 * **La nebbia no**: in montagna e' un pericolo suo, e coprirla con la pioggia toglierebbe
 * un'informazione invece di aggiungerla.
 */
export function cieloDellOra(
  codice: number | null | undefined,
  precipProb: number | null | undefined,
  sogliaArancione: number,
): Cielo | null {
  const base = cielo(codice);
  // Senza un codice non si mostra niente: la probabilita' da sola non dice che cielo c'e'.
  if (base == null) return null;
  const probNota = precipProb != null && Number.isFinite(precipProb);
  if (probNota && precipProb >= sogliaArancione && CIELO_ASCIUTTO.has(codice as number)) {
    return POSSIBILE_PIOGGIA;
  }
  return base;
}

/**
 * I cieli **distinti** che compaiono in un elenco di codici, in ordine di comparsa.
 *
 * Serve alla legenda sotto la tabella: le icone da spiegare sono quelle che si vedono
 * davvero, non tutte e ventotto. Un'iconcina senza la sua parola è un indovinello, e il
 * `title` del mouse al tocco non esiste — lezione già pagata in questo progetto.
 */
export function cieliPresenti(cieli: Array<Cielo | null | undefined>): Cielo[] {
  const visti = new Set<string>();
  const out: Cielo[] = [];
  for (const v of cieli) {
    if (v == null || visti.has(v.testo)) continue;
    visti.add(v.testo);
    out.push(v);
  }
  return out;
}
