import { render, screen, fireEvent } from '@testing-library/react';
import { UndoRedo } from '@/components/panel/UndoRedo';
import { useItineraryStore } from '@/stores/itineraryStore';

const store = () => useItineraryStore.getState();

beforeEach(() => {
  useItineraryStore.setState({ waypoints: [], legs: [], itineraryName: '' });
  store().azzeraStoria();
});

describe('i pulsanti di annulla e rifai', () => {
  test('a itinerario appena aperto sono spenti e lo dicono', () => {
    render(<UndoRedo />);
    expect(screen.getByRole('button', { name: 'Niente da annullare' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Niente da rifare' })).toBeDisabled();
  });

  /**
   * «Annulla» da solo costringe a ricordarsi cosa si e' appena fatto, e chi preme quel
   * tasto di solito lo fa proprio perche' non ne e' piu' sicuro.
   */
  test('dicono COSA annullano', () => {
    store().addWaypointAtPosition(45, 7);
    render(<UndoRedo />);
    expect(screen.getByRole('button', { name: 'Annulla: aggiunta del waypoint' })).not.toBeDisabled();
  });

  test('dicono cosa rifanno, dopo un annullamento', () => {
    store().addWaypointAtPosition(45, 7);
    store().annulla();
    render(<UndoRedo />);
    expect(screen.getByRole('button', { name: 'Rifai: aggiunta del waypoint' })).not.toBeDisabled();
  });

  test('il clic annulla davvero', () => {
    store().addWaypointAtPosition(45, 7);
    render(<UndoRedo />);
    fireEvent.click(screen.getByRole('button', { name: /^Annulla/ }));
    expect(store().waypoints).toHaveLength(0);
  });
});

describe('le scorciatoie da tastiera', () => {
  test('Ctrl+Z annulla', () => {
    store().addWaypointAtPosition(45, 7);
    render(<UndoRedo />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(store().waypoints).toHaveLength(0);
  });

  test('Ctrl+Maiusc+Z rifa', () => {
    store().addWaypointAtPosition(45, 7);
    store().annulla();
    render(<UndoRedo />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(store().waypoints).toHaveLength(1);
  });

  test('Cmd+Z vale come Ctrl+Z', () => {
    store().addWaypointAtPosition(45, 7);
    render(<UndoRedo />);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(store().waypoints).toHaveLength(0);
  });

  /**
   * Mentre si scrive in un campo, Ctrl+Z deve annullare le LETTERE battute: e' quello che
   * fa il browser da se' ed e' quello che chi scrive si aspetta. Rubargli la scorciatoia
   * per annullare un waypoint sarebbe una sorpresa sgradevole in mezzo a una parola.
   */
  test('dentro un campo di testo la scorciatoia non viene rubata', () => {
    store().addWaypointAtPosition(45, 7);
    render(<><UndoRedo /><input aria-label="campo" /></>);
    const campo = screen.getByLabelText('campo');
    campo.focus();
    fireEvent.keyDown(campo, { key: 'z', ctrlKey: true });
    expect(store().waypoints).toHaveLength(1);
  });

  test('senza il tasto di comando non succede niente', () => {
    store().addWaypointAtPosition(45, 7);
    render(<UndoRedo />);
    fireEvent.keyDown(window, { key: 'z' });
    expect(store().waypoints).toHaveLength(1);
  });
});
