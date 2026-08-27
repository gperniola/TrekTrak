import { describesNoAlerts, isDpcManifest } from '@/lib/dpc-manifest';

/** Testi presi dai manifest reali del 25 e 26 agosto 2026. */
const CON_ALLERTE = "<p>Per la giornata di oggi,  martedì 25 agosto 2026:<br/><b>ORDINARIA CRITICITA' PER RISCHIO TEMPORALI / ALLERTA GIALLA</b>: Emilia Romagna : Montagna piacentino-parmense, Alta collina romagnola</p>";
const SENZA_ALLERTE = '<p>Per la giornata di oggi,  mercoledì 26 agosto 2026:<br/><b>ASSENZA DI FENOMENI SIGNIFICATIVI PREVEDIBILI / NESSUNA ALLERTA</b> </p>';

describe('describesNoAlerts', () => {
  test('giorno tranquillo reale → true, si può saltare il download', () => {
    expect(describesNoAlerts(SENZA_ALLERTE)).toBe(true);
  });

  test('giorno con allerta gialla reale → false', () => {
    expect(describesNoAlerts(CON_ALLERTE)).toBe(false);
  });

  test('arancione e rossa → false', () => {
    expect(describesNoAlerts('MODERATA CRITICITA\' / ALLERTA ARANCIONE: Lazio')).toBe(false);
    expect(describesNoAlerts('ELEVATA CRITICITA\' / ALLERTA ROSSA: Calabria')).toBe(false);
  });

  /**
   * La polarità è il punto di tutta la funzione. Si salta il controllo completo SOLO
   * su una corrispondenza positiva di "nessuna allerta": qualunque testo non
   * riconosciuto deve far scaricare le geometrie, non concludere "tranquillo".
   *
   * La logica opposta — cercare le allerte e concludere tranquillo se non le trovo —
   * trasformerebbe un cambio di frase in un falso "nessuna allerta", che è la
   * direzione di errore pericolosa.
   */
  describe('polarità sicura: l\'ignoto fa lavorare, non tacere', () => {
    test.each([
      ['stringa vuota', ''],
      ['formulazione nuova', 'Situazione meteorologica in evoluzione su tutto il territorio'],
      ['in inglese', 'No alerts issued for today'],
      ['solo il livello, senza la frase', 'ALLERTA GIALLA'],
      ['testo che parla di allerte in generale', 'Consulta i canali ufficiali di allerta'],
    ])('%s → false', (_nome, testo) => {
      expect(describesNoAlerts(testo)).toBe(false);
    });

    test('campo assente o non stringa → false', () => {
      expect(describesNoAlerts(undefined)).toBe(false);
      expect(describesNoAlerts(null)).toBe(false);
      expect(describesNoAlerts(42 as never)).toBe(false);
    });

    // Una zona che contiene entrambe le formule: prevale la presenza dell'allerta.
    test('"nessuna allerta" insieme a un livello nominato → false', () => {
      expect(describesNoAlerts('NESSUNA ALLERTA per il Nord; ALLERTA GIALLA in Sicilia')).toBe(false);
    });
  });
});

describe('isDpcManifest', () => {
  test('manifest reale riconosciuto', () => {
    expect(isDpcManifest({ name: 'Bollettino', today: { html_descrition: 'x' }, tomorrow: {} })).toBe(true);
  });

  test('solo uno dei due giorni basta', () => {
    expect(isDpcManifest({ today: {} })).toBe(true);
  });

  test('forme non riconosciute', () => {
    expect(isDpcManifest(null)).toBe(false);
    expect(isDpcManifest('stringa')).toBe(false);
    expect(isDpcManifest({})).toBe(false);
    expect(isDpcManifest({ today: 'non un oggetto' })).toBe(false);
  });
});
