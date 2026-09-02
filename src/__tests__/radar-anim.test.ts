import {
  ATTESA_MASSIMA_MS,
  PASSO_MS,
  altro,
  chiedi,
  fotogrammaVisibile,
  inCaricamento,
  mostraComunque,
  pronto,
  prossimo,
  scadutaLaPazienza,
  statoIniziale,
} from '@/lib/radar-anim';

/**
 * **La pioggia non deve lampeggiare.**
 *
 * Segnalato il 2026-09-02: «tra un frame e l'altro c'è l'effetto che la zona di pioggia
 * sparisce e riappare». La causa era nel codice che la produceva: il layer veniva
 * **rimontato** a ogni fotogramma, perché altrimenti Leaflet riusava i tile in cache e
 * l'animazione restava ferma. Ma rimontare toglie lo strato vecchio prima che il nuovo
 * abbia scaricato, e fra i due a schermo non c'è nulla.
 *
 * Qui c'è la macchina a due strati che lo evita, e le regole sono tutte casi in cui una
 * versione ingenua sbaglierebbe.
 */
describe('l animazione del radar a due strati', () => {
  test('si parte con un fotogramma visibile e l altro strato vuoto', () => {
    const s = statoIniziale(5);
    expect(fotogrammaVisibile(s)).toBe(5);
    expect(inCaricamento(s)).toBeNull();
  });

  test('chiedere un fotogramma lo carica sullo strato nascosto, non su quello visibile', () => {
    const s = chiedi(statoIniziale(5), 6, 1000);
    // A schermo resta il 5: e' il punto di tutta la faccenda.
    expect(fotogrammaVisibile(s)).toBe(5);
    expect(inCaricamento(s)).toBe(6);
  });

  test('quando il nascosto e pronto, si scambia', () => {
    const s = pronto(chiedi(statoIniziale(5), 6, 1000), 'b');
    expect(fotogrammaVisibile(s)).toBe(6);
    expect(s.visibile).toBe('b');
  });

  /**
   * **Anche lo strato visibile emette l'evento di caricamento** — a ogni spostamento
   * della mappa ricarica i suoi tile. Scambiare allora significherebbe tornare indietro
   * al fotogramma precedente, cioè un'animazione che sussulta.
   */
  test('il caricamento dello strato VISIBILE non fa scambiare', () => {
    const s = chiedi(statoIniziale(5), 6, 1000);
    expect(fotogrammaVisibile(pronto(s, 'a'))).toBe(5);
  });

  test('un caricamento su uno strato vuoto non fa scambiare', () => {
    const s = statoIniziale(5);
    expect(pronto(s, 'b')).toBe(s);
  });

  /**
   * Con lo slider in mano si generano molte richieste in fretta: vince l'ultima, non la
   * prima, o si vedrebbe comparire un fotogramma che l'utente ha già superato.
   */
  test('una nuova richiesta sostituisce quella in preparazione', () => {
    let s = chiedi(statoIniziale(5), 6, 1000);
    s = chiedi(s, 9, 1100);
    expect(inCaricamento(s)).toBe(9);
    expect(fotogrammaVisibile(s)).toBe(5);
  });

  test('chiedere quello che si vede gia non carica niente', () => {
    const s = chiedi(statoIniziale(5), 5, 1000);
    expect(inCaricamento(s)).toBeNull();
    expect(fotogrammaVisibile(s)).toBe(5);
  });

  /**
   * Tornare al fotogramma visibile mentre un altro sta caricando deve **abbandonare** il
   * precaricamento: se restasse in attesa, alla sua scadenza si scambierebbe verso un
   * fotogramma che nessuno ha più chiesto.
   */
  test('tornare indietro abbandona il precaricamento in corso', () => {
    let s = chiedi(statoIniziale(5), 6, 1000);
    s = chiedi(s, 5, 1100);
    expect(inCaricamento(s)).toBeNull();
    expect(scadutaLaPazienza(s, 1100 + ATTESA_MASSIMA_MS + 1)).toBe(false);
  });

  /**
   * Il caricamento abbandonato **arriva comunque**, qualche istante dopo: mostrarlo
   * significherebbe far comparire un fotogramma che l'utente ha smesso di chiedere.
   */
  test('un caricamento abbandonato che arriva non fa scambiare', () => {
    let s = chiedi(statoIniziale(5), 6, 1000);
    s = chiedi(s, 5, 1100);
    expect(fotogrammaVisibile(pronto(s, 'b'))).toBe(5);
  });

  /**
   * **Il difetto che fermava l'animazione dopo il primo scambio.**
   *
   * Dopo uno scambio lo strato nascosto tiene ancora il fotogramma di prima: chi legge
   * «lo strato nascosto ha un indice» come «sta caricando» aspetta per sempre qualcosa
   * che e' gia' arrivato. Trovato guardando l'animazione scorrere, non dai test — che
   * infatti passavano tutti.
   */
  test('dopo uno scambio non risulta piu nulla in attesa', () => {
    let s = chiedi(statoIniziale(5), 6, 1000);
    s = pronto(s, 'b');
    expect(fotogrammaVisibile(s)).toBe(6);
    expect(inCaricamento(s)).toBeNull();
    expect(scadutaLaPazienza(s, 1e9)).toBe(false);
    // E il giro continua: si puo' chiedere il successivo.
    s = chiedi(s, 7, 2000);
    expect(inCaricamento(s)).toBe(7);
    expect(fotogrammaVisibile(s)).toBe(6);
  });

  /**
   * Chiedere il fotogramma che lo strato nascosto tiene **gia' caricato** — cioe' quello
   * che si vedeva prima dello scambio — non passa dalla rete: l'URL non cambierebbe, e
   * Leaflet non emetterebbe nessun `load`. Aspettarlo vorrebbe dire restare fermi fino
   * alla scadenza della pazienza, tre secondi sul fotogramma sbagliato: e' il caso dello
   * slider trascinato avanti e indietro fra due fotogrammi vicini.
   */
  test('chiedere un fotogramma gia caricato sull altro strato scambia subito', () => {
    // `pronto(s, 'a')` e' il caricamento dello strato di partenza: senza di quello il suo
    // contenuto non risulta arrivato, ed e' giusto che non si scambi a occhi chiusi.
    let s = pronto(statoIniziale(5), 'a');
    s = pronto(chiedi(s, 6, 1000), 'b'); // 6 visibile, 5 caricato sotto
    s = chiedi(s, 5, 2000);
    expect(fotogrammaVisibile(s)).toBe(5);
    expect(inCaricamento(s)).toBeNull();
  });

  /**
   * Lo stesso caso, ma con lo strato nascosto **non** caricato (mostrato a pazienza
   * scaduta): li' non si puo' scambiare a occhi chiusi, o si mostrerebbero tile mancanti.
   */
  test('se l altro strato non ha finito di caricare, si aspetta', () => {
    let s = mostraComunque(chiedi(statoIniziale(5), 6, 1000)); // 6 mostrato incompleto
    s = chiedi(s, 5, 2000);
    expect(fotogrammaVisibile(s)).toBe(6);
    expect(inCaricamento(s)).toBe(5);
  });

  describe('la pazienza', () => {
    test('non scade se non c e niente in arrivo', () => {
      expect(scadutaLaPazienza(statoIniziale(5), 1e9)).toBe(false);
    });

    test('non scade subito', () => {
      const s = chiedi(statoIniziale(5), 6, 1000);
      expect(scadutaLaPazienza(s, 1000 + ATTESA_MASSIMA_MS - 1)).toBe(false);
    });

    /**
     * **Un'animazione ferma per sempre è un guasto**, uno strato un po' incompleto no: se
     * l'evento di caricamento non arriva — rete interrotta, un tile che non risponde — si
     * mostra comunque, o il radar resterebbe su un fotogramma senza che nulla lo spieghi.
     */
    test('scade, e allora si mostra comunque', () => {
      const s = chiedi(statoIniziale(5), 6, 1000);
      expect(scadutaLaPazienza(s, 1000 + ATTESA_MASSIMA_MS)).toBe(true);
      expect(fotogrammaVisibile(mostraComunque(s))).toBe(6);
    });
  });

  describe('il giro dell animazione', () => {
    test('avanza di uno e torna all inizio', () => {
      expect(prossimo(statoIniziale(0), 13)).toBe(1);
      expect(prossimo(statoIniziale(12), 13)).toBe(0);
    });

    /**
     * Si conta dal fotogramma **a schermo**, non da quello in arrivo: contando da
     * quest'ultimo, con una rete lenta l'animazione salterebbe avanti a due a due.
     */
    test('conta dal fotogramma a schermo, non da quello in preparazione', () => {
      const s = chiedi(statoIniziale(5), 6, 1000);
      expect(prossimo(s, 13)).toBe(6);
    });

    test('con un solo fotogramma non si va da nessuna parte', () => {
      expect(prossimo(statoIniziale(0), 1)).toBe(0);
      expect(prossimo(statoIniziale(0), 0)).toBe(0);
    });
  });

  test('gli strati sono due e si alternano', () => {
    expect(altro('a')).toBe('b');
    expect(altro('b')).toBe('a');
  });

  /**
   * Il passo deve stare fra «si segue con l'occhio» e «si fa in tempo a scaricare».
   * Sette decimi di secondo su tredici fotogrammi fanno un giro in nove secondi.
   */
  test('il passo e dell ordine del mezzo secondo', () => {
    expect(PASSO_MS).toBeGreaterThanOrEqual(400);
    expect(PASSO_MS).toBeLessThanOrEqual(1200);
    // E la pazienza deve valere piu' passi, o scadrebbe prima di dare una possibilita'.
    expect(ATTESA_MASSIMA_MS).toBeGreaterThan(PASSO_MS * 2);
  });
});
