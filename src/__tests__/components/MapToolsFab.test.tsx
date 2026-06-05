import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { MapToolsFab } from '@/components/map/MapToolsFab';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ compassActive: false, rulerActive: false, quizActive: false });
});

describe('MapToolsFab', () => {
  test('di default mostra solo il FAB, i tool sono nascosti', () => {
    render(<MapToolsFab />);
    expect(screen.getByRole('button', { name: /strumenti mappa/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^bussola$/i })).toBeNull();
  });

  test('toccando il FAB si espandono i tre tool', () => {
    render(<MapToolsFab />);
    fireEvent.click(screen.getByRole('button', { name: /strumenti mappa/i }));
    expect(screen.getByRole('button', { name: /bussola/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /righello/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quiz/i })).toBeInTheDocument();
  });

  test('scegliere un tool lo attiva nello store e richiude il dial', () => {
    render(<MapToolsFab />);
    fireEvent.click(screen.getByRole('button', { name: /strumenti mappa/i }));
    fireEvent.click(screen.getByRole('button', { name: /bussola/i }));
    expect(useUIStore.getState().compassActive).toBe(true);
    expect(screen.queryByRole('button', { name: /^bussola$/i })).toBeNull();
  });

  test('quando un tool è attivo il FAB mostra lo stato attivo (aria-pressed)', () => {
    useUIStore.setState({ compassActive: true });
    render(<MapToolsFab />);
    expect(screen.getByRole('button', { name: /strumenti mappa/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
