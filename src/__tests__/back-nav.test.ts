import { describe, expect, test } from '@jest/globals';
import { nextBackAction, type BackNavState } from '@/lib/back-nav';

const base: BackNavState = {
  moreMenuOpen: false, mapSettingsOpen: false, settingsOpen: false,
  progressOpen: false, quizActive: false, searchOpen: false, mobileTab: 'map',
  emergencyPanelOpen: false,
  toolsFabOpen: false,
};

describe('nextBackAction (priorità tasto Indietro)', () => {
  test('mappa, nulla aperto → exit', () => {
    expect(nextBackAction(base)).toBe('exit');
  });
  test('scheda non-mappa → toMap', () => {
    expect(nextBackAction({ ...base, mobileTab: 'editor' })).toBe('toMap');
  });
  test('overlay aperto ha precedenza sul cambio scheda', () => {
    expect(nextBackAction({ ...base, mobileTab: 'editor', searchOpen: true })).toBe('closeSearch');
  });
  test('ordine di priorità degli overlay', () => {
    expect(nextBackAction({ ...base, moreMenuOpen: true, mapSettingsOpen: true })).toBe('closeMore');
    expect(nextBackAction({ ...base, mapSettingsOpen: true, settingsOpen: true })).toBe('closeMapSettings');
    expect(nextBackAction({ ...base, settingsOpen: true, progressOpen: true })).toBe('closeSettings');
    expect(nextBackAction({ ...base, progressOpen: true, quizActive: true })).toBe('closeProgress');
    expect(nextBackAction({ ...base, quizActive: true, searchOpen: true })).toBe('closeQuiz');
  });
  test('pannello emergenza aperto → closeEmergencyPanel, con priorità dopo moreMenu', () => {
    expect(nextBackAction({ ...base, emergencyPanelOpen: true })).toBe('closeEmergencyPanel');
    expect(nextBackAction({ ...base, emergencyPanelOpen: true, moreMenuOpen: true })).toBe('closeMore');
    expect(nextBackAction({ ...base, emergencyPanelOpen: true, mapSettingsOpen: true })).toBe('closeEmergencyPanel');
  });
});
