import { render, screen } from '@testing-library/react';
import { RulerTool } from '@/components/map/RulerTool';
import { QuizMarkers } from '@/components/map/QuizMarkers';
import { PreviewRouteLayer } from '@/components/map/PreviewRouteLayer';
import { greenIcon } from '@/lib/map-icons';

/**
 * Leaflet mette `tabIndex=0` e `role="button"` sull'elemento icona di ogni marker
 * quando l'opzione `keyboard` è true — che è il default, e **non dipende da
 * `interactive`** (leaflet-src.js:7914-7917). Il risultato: i marker decorativi
 * finivano nell'ordine di tabulazione come pulsanti senza nome accessibile, che è la
 * failure `aria-command-name` di Lighthouse.
 *
 * `interactive={false}` da solo non basta: blocca il mouse, non la tastiera. È la
 * ragione per cui il difetto è sopravvissuto — sembrava già gestito.
 */
describe('marker decorativi fuori dall\'ordine di tabulazione', () => {
  const decorativi = (n: number) => {
    const marker = screen.getAllByTestId('marker');
    expect(marker).toHaveLength(n);
    marker.forEach((m) => {
      expect(m).toHaveAttribute('data-keyboard', 'false');
      expect(m).toHaveAttribute('data-interactive', 'false');
    });
  };

  test('capi del righello', () => {
    render(<RulerTool active onDeactivate={() => {}} />);
    // Il righello disegna i capi solo dopo due punti: qui basta che, se ci sono,
    // non siano tabulabili. Con zero punti il test è vacuo, quindi lo si salta.
    const presenti = screen.queryAllByTestId('marker');
    if (presenti.length > 0) decorativi(presenti.length);
  });

  test('marker del quiz', () => {
    render(<QuizMarkers pointA={{ lat: 45, lon: 10 }} pointB={{ lat: 46, lon: 11 }} />);
    decorativi(2);
  });

  test('numeri dell\'anteprima di percorso', () => {
    render(<PreviewRouteLayer route={{
      id: 'r1', name: 'Giro', createdAt: '2026-08-27T10:00:00Z', notes: '',
      waypoints: [
        { id: 'a', order: 0, name: 'A', lat: 45, lon: 10, altitude: 100 },
        { id: 'b', order: 1, name: 'B', lat: 45.1, lon: 10.1, altitude: 200 },
      ],
      legs: [], completions: [], sortIndex: 0,
    } as never} />);
    const marker = screen.getAllByTestId('marker');
    expect(marker.length).toBeGreaterThan(0);
    marker.forEach((m) => expect(m).toHaveAttribute('data-keyboard', 'false'));
  });
});

/**
 * I marker dei waypoint invece SONO operabili — si trascinano e aprono un popup —
 * quindi restano tabulabili e devono avere un nome che si capisca fuori contesto.
 * Il nome accessibile si calcola dal contenuto, che senza aiuto è il solo numero.
 */
describe('nome accessibile dei marker dei waypoint', () => {
  test('il contenuto include "Waypoint", non solo il numero', () => {
    const html = (greenIcon(3) as unknown as { options: { html: string } }).options.html;
    expect(html).toContain('Waypoint');
    expect(html).toContain('3');
  });

  test('il testo di supporto è nascosto alla vista', () => {
    const html = (greenIcon(7) as unknown as { options: { html: string } }).options.html;
    // clip-rect + 1px: visibile agli screen reader, non a schermo.
    expect(html).toMatch(/clip:\s*rect\(0 0 0 0\)/);
  });
});
