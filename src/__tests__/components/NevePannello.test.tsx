import { render, screen } from '@testing-library/react';
import { AvvisiLayer } from '@/components/map/emergency/AvvisiLayer';
import { useEmergencyStore, type LayerRuntime } from '@/stores/emergencyStore';
import { getEmergencyLayer } from '@/lib/emergency-layers';
import type { RiassuntoVista } from '@/lib/neve-composito';

/**
 * La riga della neve nel pannello: di che giorni e da quali sensori e' la mappa. Il layer
 * e' un composito di tre giorni, quindi la data non e' una sola, e un'immagine di ieri
 * presentata come di oggi e' la classe di difetto piu' ripetuta del progetto.
 */
const def = getEmergencyLayer('snow-cover');
const pronto: LayerRuntime = { status: 'ready', error: null, lastFetch: Date.now() };

const mostra = (runtime: LayerRuntime) => render(
  <AvvisiLayer
    def={def} runtime={runtime} online stantio={false}
    finestraFocolai={null} focolaiVecchi={false} giornataCalma={false}
  />,
);

const riassunto = (over: Partial<RiassuntoVista> = {}): RiassuntoVista => ({
  stato: 'ready', da: '2026-10-15', a: '2026-10-17', sensori: ['aqua', 'terra'], parziale: false, ...over,
});

describe('la riga della neve nel pannello', () => {
  test('dice i giorni e i sensori delle mattonelle a schermo', () => {
    useEmergencyStore.setState({ neve: riassunto() });
    mostra(pronto);
    expect(screen.getByText('Viste dal 15 al 17 ottobre · MODIS Terra, Aqua')).toBeInTheDocument();
  });

  /*
    Tutte le mattonelle coperte dalle nubi: nessun giorno ha vinto un pixel, e una riga
    «Viste» senza date non direbbe niente. Lo dicono gia' il velo e la legenda.
  */
  test('senza nessun giorno che ha contribuito, nessuna riga vuota', () => {
    useEmergencyStore.setState({ neve: riassunto({ da: null, a: null, sensori: [] }) });
    const { container } = mostra(pronto);
    const righe = Array.from((container.firstElementChild as HTMLElement).children);
    expect(righe.every((r) => (r.textContent ?? '').trim() !== '')).toBe(true);
    expect(container.textContent).not.toMatch(/Viste/);
  });

  test('un passaggio in errore lo dice con parole sue', () => {
    useEmergencyStore.setState({ neve: riassunto({ parziale: true }) });
    mostra({ ...pronto, partial: true });
    expect(screen.getByText('⚠ alcune immagini non sono arrivate')).toBeInTheDocument();
    expect(screen.queryByText(/alcune fonti non hanno risposto/)).not.toBeInTheDocument();
  });

  test('a layer non pronto la riga dei giorni non compare', () => {
    useEmergencyStore.setState({ neve: riassunto() });
    const { container } = mostra({ status: 'loading', error: null, lastFetch: null });
    expect(container.textContent).not.toMatch(/Viste/);
  });
});
