import { describe, expect, test, beforeEach } from '@jest/globals';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ mobileTab: 'map', mainView: 'editor' });
});

test('moreMenuOpen: default false e setter', () => {
  useUIStore.setState({ moreMenuOpen: false });
  expect(useUIStore.getState().moreMenuOpen).toBe(false);
  useUIStore.getState().setMoreMenuOpen(true);
  expect(useUIStore.getState().moreMenuOpen).toBe(true);
});

describe('uiStore.mobileTab', () => {
  test('default tab is map', () => {
    expect(useUIStore.getState().mobileTab).toBe('map');
  });

  test('setMobileTab(library) selects tab and syncs mainView', () => {
    useUIStore.getState().setMobileTab('library');
    expect(useUIStore.getState().mobileTab).toBe('library');
    expect(useUIStore.getState().mainView).toBe('library');
  });

  test('setMobileTab(editor) selects tab and syncs mainView', () => {
    useUIStore.getState().setMobileTab('editor');
    expect(useUIStore.getState().mainView).toBe('editor');
  });

  test('setMobileTab(map) does not change mainView', () => {
    useUIStore.setState({ mainView: 'library' });
    useUIStore.getState().setMobileTab('map');
    expect(useUIStore.getState().mobileTab).toBe('map');
    expect(useUIStore.getState().mainView).toBe('library');
  });
});
