import { EMERGENCY_LAYERS, getEmergencyLayer, isEmergencyLayerId } from '@/lib/emergency-layers';

describe('EMERGENCY_LAYERS registry', () => {
  test('contiene 7 layer con id univoci', () => {
    const ids = EMERGENCY_LAYERS.map((l) => l.id);
    expect(ids).toEqual([
      'fires-hotspots', 'fires-burned', 'fires-fwi', 'dpc-alerts',
      'rain-radar', 'shelters', 'storm-instability',
    ]);
    expect(new Set(ids).size).toBe(7);
  });

  test('i layer wms hanno config wms, gli altri no', () => {
    for (const l of EMERGENCY_LAYERS) {
      if (l.kind === 'wms') {
        expect(l.wms).toBeDefined();
        expect(l.wms!.url).toMatch(/^https:\/\//);
        /*
         * Per un WMS `refreshMinutes` NON avvia timer: i tile si ricaricano da soli
         * quando cambia la loro chiave. Serve a `isStale`, quindi va valorizzato solo
         * per i prodotti che invecchiano dentro la giornata — quelli `latest` — e resta
         * nullo per i prodotti giornalieri, dove il cambio di data fa già il suo
         * lavoro.
         */
        if (l.wms!.timeMode === 'latest') {
          expect(l.refreshMinutes).toBeGreaterThan(0);
        } else {
          expect(l.refreshMinutes).toBeNull();
        }
      } else if (l.kind === 'viewport') {
        // Si interroga sull'area inquadrata: un refresh a tempo tempesterebbe un
        // servizio pubblico condiviso, quindi `refreshMinutes` deve restare nullo.
        expect(l.wms).toBeUndefined();
        expect(l.refreshMinutes).toBeNull();
      } else {
        expect(l.wms).toBeUndefined();
        expect(l.refreshMinutes).toBeGreaterThan(0);
      }
    }
  });

  test('ogni layer ha label, description, attribution e legenda non vuoti', () => {
    for (const l of EMERGENCY_LAYERS) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.description.length).toBeGreaterThan(0);
      expect(l.attribution.length).toBeGreaterThan(0);
      expect(l.legend.length).toBeGreaterThan(0);
    }
  });

  test('getEmergencyLayer risolve un id, isEmergencyLayerId valida', () => {
    expect(getEmergencyLayer('fires-fwi').kind).toBe('wms');
    expect(isEmergencyLayerId('fires-hotspots')).toBe(true);
    expect(isEmergencyLayerId('nope')).toBe(false);
    expect(isEmergencyLayerId(42)).toBe(false);
  });
});
/**
 * Le legende dei due layer EFFIS devono combaciare con quella pubblicata dal servizio
 * (`REQUEST=GetLegendGraphic`), altrimenti l'utente vede sulla mappa colori che la
 * nostra legenda non spiega. E' esattamente quello che succedeva: le aree bruciate
 * dichiaravano una sola voce mentre il servizio ne disegna quattro per recenza, e il
 * FWI cinque su sei classi.
 *
 * Colori campionati dai PNG delle legende ufficiali il 2026-08-27.
 */
describe('legende allineate alla fonte EFFIS', () => {
  test('aree bruciate: quattro classi per recenza, coi colori del servizio', () => {
    const legend = getEmergencyLayer('fires-burned').legend;
    expect(legend.map((e) => e.color)).toEqual(['#fd7f7f', '#fdbe7f', '#8dc6fd', '#86de86']);
    expect(legend[0].label).toMatch(/ultimo giorno/);
    expect(legend[1].label).toMatch(/7 giorni/);
    expect(legend[2].label).toMatch(/30 giorni/);
    expect(legend[3].label).toMatch(/stagione/);
  });

  test('FWI: sei classi con gli intervalli numerici', () => {
    const legend = getEmergencyLayer('fires-fwi').legend;
    expect(legend).toHaveLength(6);
    expect(legend.map((e) => e.color)).toEqual(
      ['#9cffc0', '#cde24e', '#e6ac00', '#d97010', '#ad060e', '#3a0015']
    );
    // Senza gli intervalli, "Alto" e "Molto alto" non sono interpretabili.
    legend.forEach((e) => expect(e.label).toMatch(/\d/));
    // Le soglie ricalcano la fonte, decimali compresi: arrotondarle sposterebbe il
    // confine fra due classi rispetto al colore che il servizio disegna.
    expect(legend.map((e) => e.label)).toEqual([
      'Basso (< 11,2)', 'Moderato (11,2-21,3)', 'Alto (21,3-38)',
      'Molto alto (38-50)', 'Estremo (50-70)', 'Molto estremo (> 70)',
    ]);
  });

  test('nessuna legenda vuota su un layer attivabile', () => {
    EMERGENCY_LAYERS.forEach((l) => expect(l.legend.length).toBeGreaterThan(0));
  });
});
