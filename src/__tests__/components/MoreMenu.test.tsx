import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

jest.mock('@/lib/export-gpx', () => ({ downloadGPX: jest.fn() }));

import { MoreMenu } from '@/components/panel/MoreMenu';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadGPX } from '@/lib/export-gpx';

beforeEach(() => {
  useUIStore.setState({ moreMenuOpen: true });
  useItineraryStore.setState({ itineraryName: 'X', waypoints: [], legs: [] });
});

describe('MoreMenu', () => {
  test('chiuso non rende nulla', () => {
    useUIStore.setState({ moreMenuOpen: false });
    const { container } = render(<MoreMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  test('con 0 waypoint Meteo e GPX sono disabilitati', () => {
    render(<MoreMenu />);
    expect(screen.getByRole('menuitem', { name: /meteo/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /gpx/i })).toBeDisabled();
  });

  test('con 2 waypoint con coordinate, GPX scarica e chiude il menu', () => {
    useItineraryStore.setState({ waypoints: [
      { id: 'a', name: 'A', lat: 42, lon: 14 },
      { id: 'b', name: 'B', lat: 42.1, lon: 14.1 },
    ] as never, legs: [] });
    render(<MoreMenu />);
    const gpx = screen.getByRole('menuitem', { name: /gpx/i });
    expect(gpx).not.toBeDisabled();
    fireEvent.click(gpx);
    expect(downloadGPX).toHaveBeenCalled();
    expect(useUIStore.getState().moreMenuOpen).toBe(false);
  });
});
