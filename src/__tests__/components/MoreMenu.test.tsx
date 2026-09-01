import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach, jest } from '@jest/globals';

// Dal task-28 la consegna del file passa dal registry, non piu' da `downloadGPX`.
jest.mock('@/lib/exporters/registro', () => ({
  ...(jest.requireActual('@/lib/exporters/registro') as object),
  downloadAs: jest.fn(),
}));

import { MoreMenu } from '@/components/panel/MoreMenu';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import { downloadAs } from '@/lib/exporters/registro';

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

  test('con 0 waypoint Meteo e i formati sono disabilitati', () => {
    render(<MoreMenu />);
    expect(screen.getByRole('menuitem', { name: /meteo/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /gpx/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /kml/i })).toBeDisabled();
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
    expect(downloadAs).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'gpx' }),
      expect.objectContaining({ name: 'X' }),
    );
    expect(useUIStore.getState().moreMenuOpen).toBe(false);
  });
});
