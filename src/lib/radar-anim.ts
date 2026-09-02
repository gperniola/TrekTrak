/**
 * L'animazione del radar, a **doppio strato**.
 *
 * ## Il difetto che questo modulo esiste per risolvere
 *
 * Segnalato il 2026-09-02: «tra un frame e l'altro c'è l'effetto che la zona di pioggia
 * sparisce e riappare». La causa stava scritta nel codice che la produceva — il layer dei
 * tile veniva **rimontato** a ogni fotogramma (`key={frame.path}`), perché altrimenti
 * Leaflet riusava i tile già in cache e l'animazione restava ferma. Ma rimontare vuol dire
 * togliere lo strato vecchio *prima* che il nuovo abbia scaricato: fra i due non c'è nulla
 * a schermo, e la pioggia lampeggia.
 *
 * La tecnica è quella dei radar veri: **due strati**. Uno si vede, sull'altro — invisibile
 * — si carica il fotogramma successivo; quando ha finito, si scambiano. Non c'è mai un
 * istante senza pioggia a schermo, e le richieste sono le stesse di prima, solo anticipate.
 *
 * ## Perché il tempo non comanda da solo
 *
 * L'animazione avanza **quando il fotogramma è pronto**, non a scatti di orologio: con una
 * rete lenta un timer fisso chiederebbe fotogrammi che non fanno in tempo ad arrivare,
 * e si tornerebbe a lampeggiare. Un fotogramma che non arriva entro `ATTESA_MASSIMA_MS`
 * viene mostrato comunque, anche parziale: fermarsi per sempre su uno strato sarebbe
 * peggio che mostrarne uno incompleto.
 */

/** Quanto si aspetta fra un fotogramma e il successivo, a rete che regge. */
export const PASSO_MS = 700;

/**
 * Oltre questo tempo il fotogramma si mostra comunque, anche se non ha finito di
 * caricare: un'animazione ferma per sempre e' un guasto, una un po' incompleta no.
 */
export const ATTESA_MASSIMA_MS = 3000;

export type Strato = 'a' | 'b';

/**
 * Cosa c'e' su uno strato: quale fotogramma, e se i suoi tile sono **arrivati**.
 *
 * `caricato` non e' un dettaglio: dopo uno scambio lo strato nascosto continua a tenere il
 * fotogramma di prima, gia' caricato. Distinguere «tiene un fotogramma vecchio» da «sta
 * caricando quello nuovo» e' l'unico modo per sapere se si puo' scambiare subito o si deve
 * aspettare — e confonderli fermava l'animazione dopo il primo scambio.
 */
export interface Contenuto {
  indice: number;
  caricato: boolean;
}

export interface StatoRadar {
  /** Lo strato che si vede. */
  visibile: Strato;
  /** Cosa c'e' su ciascuno strato, o `null` se lo strato non ha ancora nulla. */
  a: Contenuto | null;
  b: Contenuto | null;
  /**
   * Da quando si **aspetta** lo strato nascosto, per la pazienza massima. `null` vuol dire
   * che nessuno lo sta aspettando: lo strato puo' avere del contenuto comunque.
   */
  daQuando: number | null;
}

export function statoIniziale(indice: number): StatoRadar {
  return { visibile: 'a', a: { indice, caricato: false }, b: null, daQuando: null };
}

/** L'altro strato: quello su cui si carica mentre il primo si vede. */
export const altro = (s: Strato): Strato => (s === 'a' ? 'b' : 'a');

/** Il fotogramma attualmente a schermo. */
export const fotogrammaVisibile = (s: StatoRadar): number | null => s[s.visibile]?.indice ?? null;

/** Il fotogramma che si sta **aspettando** sullo strato nascosto, se ce n'e' uno. */
export const inCaricamento = (s: StatoRadar): number | null =>
  (s.daQuando == null ? null : s[altro(s.visibile)]?.indice ?? null);

/**
 * Chiede di mostrare `indice`: lo si mette a caricare sullo strato **nascosto**.
 *
 * Tre casi, e ognuno e' un difetto se trattato come gli altri:
 *
 * - e' **gia' a schermo** (slider trascinato avanti e indietro sullo stesso valore): non si
 *   carica niente, e si smette di aspettare quello che stava arrivando — se restasse in
 *   attesa, alla sua scadenza si scambierebbe verso un fotogramma non piu' chiesto;
 * - lo strato nascosto **ce l'ha gia' caricato** (e' quello che si vedeva prima dello
 *   scambio): si scambia **subito**, senza rete. Senza questo caso, chiedere un fotogramma
 *   il cui URL non cambia significa aspettare un `load` che Leaflet non emettera' mai, e
 *   l'animazione si ferma fino alla scadenza della pazienza;
 * - altrimenti si mette a caricare, sostituendo quello che lo strato nascosto stava
 *   preparando: con lo slider in mano l'ultima richiesta e' quella che conta.
 */
export function chiedi(s: StatoRadar, indice: number, adesso: number): StatoRadar {
  if (fotogrammaVisibile(s) === indice) {
    return s.daQuando == null ? s : { ...s, daQuando: null };
  }
  const nascosto = altro(s.visibile);
  const contenuto = s[nascosto];
  if (contenuto?.indice === indice) {
    if (contenuto.caricato) return { ...s, visibile: nascosto, daQuando: null };
    // Sta gia' caricando questo: si aspetta. Se l'attesa era stata abbandonata, riparte.
    return s.daQuando == null ? { ...s, daQuando: adesso } : s;
  }
  return { ...s, [nascosto]: { indice, caricato: false }, daQuando: adesso } as StatoRadar;
}

/**
 * Uno strato ha finito di caricare i suoi tile.
 *
 * Si scambia **solo** se e' lo strato nascosto e lo si stava aspettando. Gli altri due casi
 * si annotano e basta, e servono entrambi:
 *
 * - anche lo strato **visibile** emette `load`, a ogni spostamento della mappa: scambiare
 *   allora vorrebbe dire tornare al fotogramma precedente, cioe' un'animazione che sussulta;
 * - un caricamento **abbandonato** (l'utente e' tornato al fotogramma che vedeva) arriva
 *   comunque: mostrarlo sarebbe mostrare un fotogramma che nessuno ha chiesto.
 */
export function pronto(s: StatoRadar, quale: Strato): StatoRadar {
  const contenuto = s[quale];
  if (contenuto == null || contenuto.caricato) return s;
  const aggiornato = { ...s, [quale]: { ...contenuto, caricato: true } } as StatoRadar;
  if (quale === s.visibile || s.daQuando == null) return aggiornato;
  return { ...aggiornato, visibile: quale, daQuando: null };
}

/**
 * Se la pazienza e' finita: il fotogramma atteso non arriva.
 *
 * Serve al caso in cui l'evento di caricamento non arriva — rete che si interrompe, un tile
 * che non risponde — e altrimenti l'animazione resterebbe ferma per sempre su un
 * fotogramma, senza che nulla lo spieghi.
 */
export function scadutaLaPazienza(s: StatoRadar, adesso: number): boolean {
  return s.daQuando != null && adesso - s.daQuando >= ATTESA_MASSIMA_MS;
}

/**
 * Mostra lo strato nascosto **anche se non ha finito**: si arriva qui solo a pazienza
 * scaduta. Il contenuto NON si segna come caricato — non lo e', e segnarlo farebbe
 * scambiare senza attesa la prossima volta che lo si chiede, mostrando tile mancanti.
 */
export function mostraComunque(s: StatoRadar): StatoRadar {
  const nascosto = altro(s.visibile);
  if (s[nascosto] == null) return s;
  return { ...s, visibile: nascosto, daQuando: null };
}

/**
 * Il prossimo fotogramma dell'animazione, a giro.
 *
 * Si parte da quello **a schermo**, non da quello in arrivo: se si contasse da
 * quest'ultimo, con una rete lenta l'animazione salterebbe avanti a due a due.
 */
export function prossimo(s: StatoRadar, quanti: number): number {
  const ora = fotogrammaVisibile(s) ?? 0;
  return quanti < 1 ? 0 : (ora + 1) % quanti;
}
