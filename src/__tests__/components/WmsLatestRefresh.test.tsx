import { render, screen } from '@testing-library/react';
import { EmergencyWmsLayer } from '@/components/map/emergency/EmergencyWmsLayer';
import { getEmergencyLayer } from '@/lib/emergency-layers';
import { useEmergencyStore } from '@/stores/emergencyStore';

/**
 * La `key` di React non è leggibile dal DOM, ma il suo effetto sì: al cambio di key il
 * componente si smonta e rimonta, quindi il nodo è **un altro**. Confrontare l'identità
 * del nodo verifica il rimontaggio, che è ciò che fa ricaricare i tile.
 */
const nodoTile = () => screen.getByTestId('wms-tile-layer');

/**
 * Il layer dell'instabilità satellitare chiede i tile **senza** parametro TIME, per
 * avere l'istante più recente. Conseguenza non voluta: l'URL non cambiava mai, Leaflet
 * teneva i tile in cache e il layer mostrava per ore l'istante caricato all'accensione
 * — sotto l'etichetta "instabilità osservata adesso".
 *
 * È la classe di difetto dominante della campagna della v0.11.0: dato vecchio
 * presentato come attuale. Qui si verifica il rimedio, che a 15 minuti di distanza non
 * si può provare a mano.
 */
describe('layer WMS senza TIME: si rinfresca da solo', () => {
  const instabilita = getEmergencyLayer('storm-instability');
  const fwi = getEmergencyLayer('fires-fwi');

  test('la chiave cambia al passare del quarto d\'ora', () => {
    const t0 = Date.UTC(2026, 7, 28, 10, 2, 0);
    useEmergencyStore.setState({ nowTick: t0 });
    const { rerender } = render(<EmergencyWmsLayer def={instabilita} />);
    const prima = nodoTile();

    // dentro lo stesso quarto d'ora: nessun ricarico, altrimenti sarebbe traffico
    // inutile su un servizio pubblico
    useEmergencyStore.setState({ nowTick: t0 + 5 * 60000 });
    rerender(<EmergencyWmsLayer def={instabilita} />);
    expect(nodoTile()).toBe(prima);

    // passato il quarto d'ora, la chiave cambia e i tile si ricaricano
    useEmergencyStore.setState({ nowTick: t0 + 16 * 60000 });
    rerender(<EmergencyWmsLayer def={instabilita} />);
    expect(nodoTile()).not.toBe(prima);
  });

  // I prodotti giornalieri non devono ricaricarsi ogni quarto d'ora: il loro TIME
  // cambia a mezzanotte e quello basta.
  test('un layer giornaliero non si rinfresca a scatti di quarto d\'ora', () => {
    const t0 = Date.UTC(2026, 7, 28, 10, 2, 0);
    useEmergencyStore.setState({ nowTick: t0 });
    const { rerender } = render(<EmergencyWmsLayer def={fwi} />);
    const prima = nodoTile();
    useEmergencyStore.setState({ nowTick: t0 + 40 * 60000 });
    rerender(<EmergencyWmsLayer def={fwi} />);
    expect(nodoTile()).toBe(prima);
  });

  test('il layer senza TIME non manda il parametro', () => {
    useEmergencyStore.setState({ nowTick: Date.now() });
    render(<EmergencyWmsLayer def={instabilita} />);
    const params = nodoTile().getAttribute('data-params') ?? '';
    expect(params).not.toMatch(/"time"/);
    expect(params).toContain('gii_liftedindex');
  });

  test('un layer giornaliero manda TIME', () => {
    useEmergencyStore.setState({ nowTick: Date.UTC(2026, 7, 28, 10, 0, 0) });
    render(<EmergencyWmsLayer def={fwi} />);
    expect(nodoTile().getAttribute('data-params')).toMatch(/"time":"2026-08-28"/);
  });

  /**
   * Senza `refreshMinutes` valorizzato, `isStale` non può dichiarare vecchio un layer
   * che ha smesso di aggiornarsi: resterebbe "Aggiornato alle 20:06" per tutta la
   * serata.
   */
  test('lo stantio è dichiarabile', () => {
    expect(instabilita.refreshMinutes).toBeGreaterThan(0);
    useEmergencyStore.setState({
      nowTick: Date.now(),
      layers: {
        ...useEmergencyStore.getState().layers,
        'storm-instability': { status: 'ready', error: null, lastFetch: Date.now() - 60 * 60000 },
      },
    });
    expect(useEmergencyStore.getState().isStale('storm-instability')).toBe(true);
  });
});
