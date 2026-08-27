import { create } from 'zustand';

export interface KnownPosition {
  lat: number;
  lon: number;
  /** Raggio di incertezza in metri, come lo riporta il browser. */
  accuracy: number | null;
  /** Quando è stata rilevata (epoch ms). */
  at: number;
}

interface PositionState {
  lastKnown: KnownPosition | null;
  setLastKnown: (p: Omit<KnownPosition, 'at'> & { at?: number }) => void;
}

/**
 * Ultima posizione nota, pubblicata da chi la ottiene già.
 *
 * Esiste per un motivo preciso: l'app chiede la posizione in due punti
 * (`GeolocateOnMount` alla prima apertura, `MyLocationButton` su richiesta) e poi la
 * butta. Chi ne ha bisogno dopo era costretto a richiederla, con due conseguenze
 * spiacevoli — un secondo fix GPS, e un possibile prompt del browser in un momento
 * in cui l'utente non ha chiesto niente.
 *
 * Consumare da qui invece di chiamare `getCurrentPosition` è una garanzia più forte
 * di qualunque controllo sui permessi: se nessuno ha ottenuto una posizione, qui non
 * c'è niente, e chi legge tace. Non c'è alcun percorso che possa far comparire un
 * prompt.
 *
 * La posizione non è persistita: vive quanto la sessione, e non finisce su disco.
 */
export const usePositionStore = create<PositionState>((set) => ({
  lastKnown: null,
  setLastKnown: (p) => set({
    lastKnown: { lat: p.lat, lon: p.lon, accuracy: p.accuracy ?? null, at: p.at ?? Date.now() },
  }),
}));
