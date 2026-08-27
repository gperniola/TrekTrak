/** Stato rilevante per decidere l'azione del tasto Indietro su mobile. */
export interface BackNavState {
  moreMenuOpen: boolean;
  mapSettingsOpen: boolean;
  settingsOpen: boolean;
  progressOpen: boolean;
  quizActive: boolean;
  searchOpen: boolean;
  mobileTab: 'map' | 'editor' | 'library';
  emergencyPanelOpen: boolean;
  toolsFabOpen: boolean;
  weatherOpen: boolean;
}

export type BackNavAction =
  | 'closeMore' | 'closeMapSettings' | 'closeSettings' | 'closeProgress'
  | 'closeQuiz' | 'closeSearch' | 'toMap' | 'exit' | 'closeEmergencyPanel'
  | 'closeToolsFab' | 'closeWeather';

/**
 * Priorità del tasto Indietro (mobile): prima chiude eventuali overlay/menu aperti,
 * poi torna alla Mappa se si è su un'altra scheda, infine (mappa + nulla aperto) esce.
 */
export function nextBackAction(s: BackNavState): BackNavAction {
  // Il meteo e' l'overlay piu' "sopra" di tutti: se e' aperto, Indietro chiude quello.
  if (s.weatherOpen) return 'closeWeather';
  if (s.moreMenuOpen) return 'closeMore';
  if (s.toolsFabOpen) return 'closeToolsFab';
  if (s.emergencyPanelOpen) return 'closeEmergencyPanel';
  if (s.mapSettingsOpen) return 'closeMapSettings';
  if (s.settingsOpen) return 'closeSettings';
  if (s.progressOpen) return 'closeProgress';
  if (s.quizActive) return 'closeQuiz';
  if (s.searchOpen) return 'closeSearch';
  if (s.mobileTab !== 'map') return 'toMap';
  return 'exit';
}
