import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { ModeSwitch } from '@/components/panel/ModeSwitch';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useUIStore } from '@/stores/uiStore';
import type { AppMode } from '@/lib/types';

beforeEach(() => {
  useItineraryStore.setState({ appMode: 'learn' as AppMode });
  useUIStore.setState({ compassActive: false, rulerActive: false, quizActive: false });
});

describe('ModeSwitch (TASK-40)', () => {
  test('i tool mostrano etichette testuali visibili (Bussola/Righello/Quiz)', () => {
    render(<ModeSwitch />);
    expect(screen.getByText('Bussola')).toBeInTheDocument();
    expect(screen.getByText('Righello')).toBeInTheDocument();
    expect(screen.getByText('Quiz')).toBeInTheDocument();
  });

  test('i tool restano accessibili e Learn/Track presenti', () => {
    render(<ModeSwitch />);
    expect(screen.getByRole('button', { name: /bussola/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /righello/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quiz/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Learn' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Track' })).toBeInTheDocument();
  });
});
