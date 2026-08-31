import { render, screen, fireEvent } from '@testing-library/react';
import { TrackWaypointRow } from '@/components/panel/TrackWaypointRow';
import { WaypointList } from '@/components/panel/WaypointList';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Leg, Waypoint } from '@/lib/types';

/**
 * Segnalazione dell'utente: «in modalità "vado in montagna" l'interfaccia editor è
 * ancora molto confusionaria, ad esempio sono presenti un sacco di textbox che ora non
 * servono dato che non dobbiamo inserire i dati a mano».
 *
 * Misurato nel browser su un itinerario di quattro waypoint in Track: **25 campi a
 * schermo, 24 di sola lettura**, ciascuno col suo bordo e il suo pulsante ⓘ, 24 in
 * tutto. Il difetto in una riga: **un campo in cui non si può scrivere non è un campo.**
 *
 * La condizione è `appMode === 'track'`, non il profilo d'uso: è la modalità che decide
 * chi compila i valori, quindi migliora anche chi sta in «Imparo» e passa a Track per
 * guardare i valori veri.
 */

const wp = (i: number, nome: string, alt: number | null, lat: number | null = 42.4419, lon: number | null = 13.5595): Waypoint =>
  ({ id: `w${i}`, name: nome, lat, lon, altitude: alt, order: i });

const leg = (i: number, over: Partial<Leg> = {}): Leg => ({
  id: `l${i}`,
  fromWaypointId: `w${i}`,
  toWaypointId: `w${i + 1}`,
  distance: 1.42,
  azimuth: 34,
  elevationGain: 205,
  elevationLoss: 0,
  ...over,
} as Leg);

describe('riga compatta in Track', () => {
  test('mostra i valori come testo, senza nemmeno un campo', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'Campo Imperatore', 2130)} leg={leg(0)} aperta={false} onApri={() => {}} />);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByText('Campo Imperatore')).toBeInTheDocument();
    expect(screen.getByText('2.130 m')).toBeInTheDocument();
  });

  /** I numeri si scrivono all'italiana: era la lezione della v0.13.3, e nei campi di
   *  sola lettura sopravviveva `String(value)`, cioè «1.42» e «2130». */
  test('i numeri sono scritti all italiana', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'A', 2130)} leg={leg(0, { distance: 1.42, elevationGain: 1205 })} aperta={false} onApri={() => {}} />);
    expect(screen.getByText('1,42 km')).toBeInTheDocument();
    expect(screen.getByText('+1.205 m')).toBeInTheDocument();
    expect(screen.getByText('2.130 m')).toBeInTheDocument();
  });

  test('l azimut porta il punto cardinale', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'A', 100)} leg={leg(0, { azimuth: 34 })} aperta={false} onApri={() => {}} />);
    expect(screen.getByText('34° NE')).toBeInTheDocument();
  });

  /** Un valore che non c'è si dice: la lezione della v0.13.2 sul tempo «zero». */
  test('un valore mancante e n/d, non zero', () => {
    render(
      <TrackWaypointRow
        waypoint={wp(0, 'A', null)}
        leg={leg(0, { distance: null, elevationGain: null, elevationLoss: null })}
        aperta={false}
        onApri={() => {}}
      />
    );
    expect(screen.getAllByText('n/d').length).toBeGreaterThanOrEqual(4);
    // «non lo so» e «zero» sono cose diverse, e vanno scritte diverse
    expect(screen.queryByText('0 m')).not.toBeInTheDocument();
  });

  test('l ultimo waypoint non ha tratta e non inventa una riga', () => {
    render(<TrackWaypointRow waypoint={wp(3, 'Corno Grande', 2912)} aperta={false} onApri={() => {}} />);
    expect(screen.getByText('Corno Grande')).toBeInTheDocument();
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  /** Coordinate, pendenza e tempo servono a volte: si chiedono. */
  test('chiusa non mostra le coordinate, aperta si', () => {
    const { rerender } = render(
      <TrackWaypointRow waypoint={wp(2, 'Rifugio', 2388, 42.4551, 13.5702)} leg={leg(2, { slope: 24.1 })} aperta={false} onApri={() => {}} />
    );
    expect(screen.queryByText(/42,4551/)).not.toBeInTheDocument();
    rerender(
      <TrackWaypointRow waypoint={wp(2, 'Rifugio', 2388, 42.4551, 13.5702)} leg={leg(2, { slope: 24.1 })} aperta onApri={() => {}} />
    );
    expect(screen.getByText(/42,4551° N/)).toBeInTheDocument();
    expect(screen.getByText(/13,5702° E/)).toBeInTheDocument();
    expect(screen.getByText('pendenza 24,1%')).toBeInTheDocument();
  });

  test('coordinate a sud e a ovest hanno la lettera giusta', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'A', 0, -33.9, -18.4)} aperta onApri={() => {}} />);
    expect(screen.getByText(/33,9000° S/)).toBeInTheDocument();
    expect(screen.getByText(/18,4000° O/)).toBeInTheDocument();
  });

  test('senza coordinate lo dice invece di scrivere 0', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'A', 100, null, null)} aperta onApri={() => {}} />);
    expect(screen.getByText('coordinate non ancora note')).toBeInTheDocument();
  });

  /**
   * Apri, trascina e rimuovi sono tre bersagli AFFIANCATI: annidarli dentro un unico
   * pulsante era il difetto corretto nel pannello dei layer della v0.14.0.
   */
  test('i tre comandi non sono annidati uno nell altro', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'Campo Imperatore', 2130)} aperta={false} onApri={() => {}} />);
    const apri = screen.getByRole('button', { expanded: false });
    const rimuovi = screen.getByRole('button', { name: /Rimuovi Campo Imperatore/ });
    expect(apri.contains(rimuovi)).toBe(false);
    expect(rimuovi.contains(apri)).toBe(false);
  });

  test('il nome si cambia dal dettaglio', () => {
    useItineraryStore.setState({ waypoints: [wp(0, 'Campo Imperatore', 2130)] });
    render(<TrackWaypointRow waypoint={wp(0, 'Campo Imperatore', 2130)} aperta onApri={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Modifica nome/ }));
    const campo = screen.getByRole('textbox');
    fireEvent.change(campo, { target: { value: 'Campo Imp.' } });
    expect(useItineraryStore.getState().waypoints[0].name).toBe('Campo Imp.');
  });
});

describe('la lista sceglie la forma in base alla modalita', () => {
  const quattro = [
    wp(0, 'Campo Imperatore', 2130),
    wp(1, 'Sella di Monte Aquila', 2335),
    wp(2, 'Rifugio Duca degli Abruzzi', 2388),
    wp(3, 'Corno Grande', 2912),
  ];
  const tratte = [leg(0), leg(1), leg(2)];

  test('in Track non resta nessun campo di sola lettura', () => {
    useItineraryStore.setState({ waypoints: quattro, legs: tratte, appMode: 'track' });
    render(<WaypointList />);
    const campi = screen.queryAllByRole('textbox') as HTMLInputElement[];
    expect(campi.filter((c) => c.readOnly)).toHaveLength(0);
    // e i valori si leggono comunque
    expect(screen.getByText('2.130 m')).toBeInTheDocument();
    expect(screen.getAllByText(/km$/).length).toBe(3);
  });

  test('in Learn le schede coi campi restano intatte', () => {
    useItineraryStore.setState({ waypoints: quattro, legs: tratte, appMode: 'learn' });
    render(<WaypointList />);
    expect(screen.getAllByLabelText('Lat').length).toBe(4);
    expect(screen.getAllByLabelText('Dist (km)').length).toBe(3);
  });

  /** Una riga per volta: due aperte insieme rifarebbero il muro di prima. */
  test('aprendo una riga si chiude la precedente', () => {
    useItineraryStore.setState({ waypoints: quattro, legs: tratte, appMode: 'track' });
    render(<WaypointList />);
    const righe = screen.getAllByRole('button', { expanded: false });
    fireEvent.click(righe[0]);
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0]);
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
  });

  test('toccando di nuovo la stessa riga si chiude', () => {
    useItineraryStore.setState({ waypoints: quattro, legs: tratte, appMode: 'track' });
    render(<WaypointList />);
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0]);
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
  });
});

/**
 * Visto solo guardando lo schermo: una tratta in piano scriveva «−0 m», che si legge
 * «meno zero». Nei test i numeri erano diversi da zero e la riga sembrava a posto.
 */
describe('il segno dei dislivelli', () => {
  test('zero si scrive zero, senza segno', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'A', 100)} leg={leg(0, { elevationGain: 0, elevationLoss: 0 })} aperta={false} onApri={() => {}} />);
    expect(screen.queryByText('−0 m')).not.toBeInTheDocument();
    expect(screen.queryByText('+0 m')).not.toBeInTheDocument();
    expect(screen.getAllByText('0 m')).toHaveLength(2);
  });

  test('un dislivello vero porta il suo segno', () => {
    render(<TrackWaypointRow waypoint={wp(0, 'A', 100)} leg={leg(0, { elevationGain: 205, elevationLoss: 12 })} aperta={false} onApri={() => {}} />);
    expect(screen.getByText('+205 m')).toBeInTheDocument();
    expect(screen.getByText('−12 m')).toBeInTheDocument();
  });
});
