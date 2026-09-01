import { render, screen, act, fireEvent } from '@testing-library/react';
import { MaxZoomHint, oltreIlDettaglio } from '@/components/map/MaxZoomHint';
import { __setMapZoom, __fireMapEvent, __resetMapEvents } from './__mocks__/react-leaflet';
import { BASE_MAPS } from '@/lib/types';
import type { BaseMapDef } from '@/lib/types';

/**
 * TASK-20 C. Su una carta si è abituati al contrario: più ci si avvicina, più si vede.
 * Qui oltre lo zoom nativo il server non ha altre mattonelle e Leaflet stira l'ultima —
 * l'immagine diventa più grande, non più precisa. La differenza conta se si sta leggendo
 * un sentiero per decidere dove passare.
 */

const mappa = (over: Partial<BaseMapDef> = {}): BaseMapDef =>
  ({ ...BASE_MAPS[1], ...over });   // OpenTopoMap: si ferma a 17

beforeEach(() => {
  __resetMapEvents();
  __setMapZoom(13);
});

describe('oltreIlDettaglio', () => {
  test('allo zoom nativo non si e ancora oltre', () => {
    expect(oltreIlDettaglio(17, 17)).toBe(false);
  });

  test('un livello sopra si e oltre', () => {
    expect(oltreIlDettaglio(18, 17)).toBe(true);
  });

  test('sotto non se ne parla', () => {
    expect(oltreIlDettaglio(10, 17)).toBe(false);
  });
});

describe('l avviso sull ingrandimento', () => {
  test('sotto il limite non c e', () => {
    render(<MaxZoomHint baseMap={mappa()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('ingrandendo oltre il limite compare e nomina mappa e limite', () => {
    render(<MaxZoomHint baseMap={mappa()} />);
    act(() => { __setMapZoom(19); __fireMapEvent('zoomend', {}); });
    const avviso = screen.getByRole('status');
    expect(avviso).toHaveTextContent('OpenTopoMap');
    expect(avviso).toHaveTextContent('fino a 17');
    expect(avviso).toHaveTextContent(/stirate, non più precise/);
  });

  test('tornando indietro sparisce da se', () => {
    render(<MaxZoomHint baseMap={mappa()} />);
    act(() => { __setMapZoom(19); __fireMapEvent('zoomend', {}); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { __setMapZoom(15); __fireMapEvent('zoomend', {}); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('si puo chiudere', () => {
    render(<MaxZoomHint baseMap={mappa()} />);
    act(() => { __setMapZoom(19); __fireMapEvent('zoomend', {}); });
    fireEvent.click(screen.getByRole('button', { name: /Nascondi/ }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /**
   * Chiuso una volta, resta chiuso finché si resta su quella mappa: riproporlo a ogni
   * scatto della rotellina sarebbe una molestia.
   */
  test('chiuso, non ritorna continuando a ingrandire sulla stessa mappa', () => {
    render(<MaxZoomHint baseMap={mappa()} />);
    act(() => { __setMapZoom(19); __fireMapEvent('zoomend', {}); });
    fireEvent.click(screen.getByRole('button', { name: /Nascondi/ }));
    act(() => { __setMapZoom(20); __fireMapEvent('zoomend', {}); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /**
   * Ma cambiando mappa il limite di cui parlava non è più quello: Thunderforest arriva a
   * 22, dove OpenTopoMap si era fermata a 17. Averlo letto una volta non vale per l'altra.
   */
  test('cambiando mappa l avviso torna disponibile', () => {
    const { rerender } = render(<MaxZoomHint baseMap={mappa()} />);
    act(() => { __setMapZoom(19); __fireMapEvent('zoomend', {}); });
    fireEvent.click(screen.getByRole('button', { name: /Nascondi/ }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // CyclOSM: si ferma a 20, quindi a zoom 19 non siamo oltre
    rerender(<MaxZoomHint baseMap={mappa({ id: 'cyclosm', label: 'CyclOSM', maxNativeZoom: 20 })} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => { __setMapZoom(21); __fireMapEvent('zoomend', {}); });
    expect(screen.getByRole('status')).toHaveTextContent('CyclOSM');
  });

  /** Le quattro mappe hanno limiti diversi: l'avviso deve dire quello giusto. */
  test('ogni mappa dichiara il suo limite', () => {
    for (const m of BASE_MAPS) {
      const { unmount } = render(<MaxZoomHint baseMap={m} />);
      act(() => { __setMapZoom(m.maxNativeZoom + 1); __fireMapEvent('zoomend', {}); });
      expect(screen.getByRole('status')).toHaveTextContent(`fino a ${m.maxNativeZoom}`);
      unmount();
    }
  });
});
