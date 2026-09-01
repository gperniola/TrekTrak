import type { Waypoint, Leg, AppSettings, AppMode } from '../../lib/types';
import type { AzioneStoria, Storia } from './storia';

/**
 * La forma completa dello store, dichiarata in un posto solo.
 *
 * Le slice la implementano a pezzi ma la vedono tutta: in Zustand ogni slice riceve
 * `set` e `get` tipati sull'intero stato, ed e' quello che permette a un'azione sui
 * waypoint di ricostruire le tratte senza passare per un intermediario.
 */
export interface ItineraryState {
  itineraryId: string;
  itineraryName: string;
  createdAt: string;
  waypoints: Waypoint[];
  legs: Leg[];
  settings: AppSettings;
  appMode: AppMode;

  setAppMode: (mode: AppMode) => void;
  setItineraryName: (name: string) => void;
  setItineraryId: (id: string) => void;
  addWaypoint: () => void;
  addWaypointAtPosition: (lat: number, lon: number) => void;
  removeWaypoint: (id: string) => void;
  /**
   * Svuota i waypoint mantenendo l'itinerario: nome, id e data restano. Diverso da
   * `resetItinerary`, che genera un itinerario nuovo e butta anche il nome.
   */
  clearWaypoints: () => void;
  /**
   * `calcolata` distingue una scrittura dell'APP da un gesto della persona: in Track
   * distanze, dislivelli e geometria arrivano dal calcolo, e non devono finire nella
   * storia di annulla/rifai — annullare un calcolo che il programma rifarebbe subito
   * non risponde a nessuna domanda.
   */
  updateWaypoint: (id: string, data: Partial<Waypoint>, opzioni?: { calcolata?: boolean }) => void;
  updateWaypointPosition: (id: string, lat: number, lon: number) => void;
  updateLeg: (id: string, data: Partial<Leg>, opzioni?: { calcolata?: boolean }) => void;
  reorderWaypoints: (newOrder: number[]) => void;
  clearAllValidation: () => void;
  updateSettings: (settings: AppSettings) => void;
  resetItinerary: () => void;
  loadItinerary: (id: string, name: string, waypoints: Waypoint[], legs: Leg[], createdAt?: string) => void;
  /**
   * Rimette in piedi l'itinerario autosalvato al riavvio.
   *
   * Diverso da `loadItinerary`, che ricostruisce la catena delle tratte e azzera le
   * validazioni perche' tratta un itinerario che arriva da fuori. Qui i dati sono i
   * nostri di un attimo prima: si rimettono come stavano, validazioni comprese.
   * E diverso da `setAppMode`, che scambierebbe i valori fra Learn e Track: la
   * modalita' salvata e' gia' quella a cui appartengono i valori salvati.
   */
  hydrateCurrent: (saved: {
    itineraryId: string; itineraryName: string; createdAt: string;
    appMode: AppMode; waypoints: Waypoint[]; legs: Leg[];
  }) => void;

  /** Annulla e rifai: vedi `sliceStoria`. */
  storia: Storia;
  registraGesto: (azione: AzioneStoria) => void;
  annulla: () => void;
  rifai: () => void;
  azzeraStoria: () => void;

  profileHover: { distance: number; source: 'chart' | 'map' } | null;
  setProfileHover: (distance: number, source: 'chart' | 'map') => void;
  clearProfileHover: () => void;
  profileFlyTo: number | null;
  setProfileFlyTo: (distance: number) => void;
  clearProfileFlyTo: () => void;
}
