import { useEmergencyStore } from '@/stores/emergencyStore';
import type { RiassuntoVista } from '@/lib/neve-composito';

/**
 * Lo stato del layer neve lo dichiarano le mattonelle a schermo, con un riassunto
 * (`riassumiVista`). Lo store lo traduce nella riga del pannello: qui si prova la
 * traduzione, e le due garanzie che il componente da solo non puo' dare — un riassunto
 * che arriva a layer spento non riaccende niente, e «Riprova» riparte da zero.
 */

const pronto = (over: Partial<RiassuntoVista> = {}): RiassuntoVista => ({
  stato: 'ready', da: '2026-10-15', a: '2026-10-17', sensori: ['terra', 'aqua'], parziale: false, ...over,
});

describe('lo store della neve', () => {
  beforeEach(() => {
    useEmergencyStore.getState().stopLayer('snow-cover');
  });

  test('un riassunto pronto fa ready e dice se e parziale', () => {
    const s = useEmergencyStore.getState();
    s.startLayer('snow-cover');
    expect(useEmergencyStore.getState().layers['snow-cover'].status).toBe('loading');

    const r = pronto({ parziale: true });
    s.reportNeve(r);
    let st = useEmergencyStore.getState();
    expect(st.layers['snow-cover'].status).toBe('ready');
    expect(st.layers['snow-cover'].partial).toBe(true);
    expect(st.layers['snow-cover'].error).toBeNull();
    expect(st.layers['snow-cover'].lastFetch).toEqual(expect.any(Number));
    expect(st.neve).toEqual(r);

    // Le immagini mancanti arrivano al giro dopo: l'avviso se ne va con loro.
    s.reportNeve(pronto());
    st = useEmergencyStore.getState();
    expect(st.layers['snow-cover'].partial).toBe(false);
  });

  test('nodata e error con i loro messaggi', () => {
    const s = useEmergencyStore.getState();
    s.startLayer('snow-cover');

    s.reportNeve({ stato: 'nodata', da: null, a: null, sensori: [], parziale: false });
    let rt = useEmergencyStore.getState().layers['snow-cover'];
    expect(rt.status).toBe('nodata');
    expect(rt.error).toBe('Nessuna immagine negli ultimi 3 giorni');

    /*
      404 ovunque non e' un cielo vuoto: GIBS non riconosce piu' i layer, o non risponde.
      Va detto come guasto, col «Riprova», non come «nessun dato».
    */
    s.reportNeve({ stato: 'error', da: null, a: null, sensori: [], parziale: false });
    rt = useEmergencyStore.getState().layers['snow-cover'];
    expect(rt.status).toBe('error');
    expect(rt.error).toBe('Il servizio NASA non risponde o non riconosce i layer della neve');
  });

  /**
   * **Review Focus 2.** Le mattonelle scaricano ancora quando il layer si spegne: il loro
   * riassunto arriva dopo. Se lo store lo accettasse, il layer spento tornerebbe «pronto»
   * nel pannello, con una data che non descrive nessuna mappa.
   */
  test('a layer spento un riassunto tardivo non riaccende niente', () => {
    const s = useEmergencyStore.getState();
    s.startLayer('snow-cover');
    s.stopLayer('snow-cover');

    s.reportNeve(pronto());
    const st = useEmergencyStore.getState();
    expect(st.layers['snow-cover'].status).toBe('idle');
    expect(st.neve).toBeNull();
  });

  /**
   * Il riassunto e' payload come i focolai e il radar: tenerlo vorrebbe dire, alla
   * riaccensione, mostrare le date di prima prima che le mattonelle nuove arrivino.
   */
  test('spegnere butta il riassunto', () => {
    const s = useEmergencyStore.getState();
    s.startLayer('snow-cover');
    s.reportNeve(pronto());
    expect(useEmergencyStore.getState().neve).not.toBeNull();

    s.stopLayer('snow-cover');
    const st = useEmergencyStore.getState();
    expect(st.neve).toBeNull();
    expect(st.layers['snow-cover'].status).toBe('idle');
  });

  test('Riprova ricomincia da capo', () => {
    const s = useEmergencyStore.getState();
    s.startLayer('snow-cover');
    s.reportNeve({ stato: 'error', da: null, a: null, sensori: [], parziale: false });
    const prima = useEmergencyStore.getState().retryTick['snow-cover'];

    s.retryLayer('snow-cover');
    const st = useEmergencyStore.getState();
    expect(st.neve).toBeNull();
    expect(st.layers['snow-cover'].status).toBe('loading');
    expect(st.layers['snow-cover'].error).toBeNull();
    // Il contatore entra nella chiave della sorgente: senza, «Riprova» non rimonta niente.
    expect(st.retryTick['snow-cover']).toBe(prima + 1);
  });
});
