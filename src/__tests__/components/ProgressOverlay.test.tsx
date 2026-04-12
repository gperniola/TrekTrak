import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, jest } from '@jest/globals';

// Mock storage and quiz history so the component sees no data
jest.mock('@/lib/storage', () => ({
  loadValidationHistory: jest.fn(() => []),
  clearValidationHistory: jest.fn(),
  saveValidationSession: jest.fn(),
}));

jest.mock('@/lib/quiz', () => ({
  loadQuizHistory: jest.fn(() => []),
  clearQuizHistory: jest.fn(),
  saveQuizSession: jest.fn(),
  generateQuestionSet: jest.fn(() => []),
  generateRandomPoint: jest.fn(),
  pickQuizPoint: jest.fn(),
}));

// Mock scroll lock hook (jsdom doesn't support it)
jest.mock('@/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: jest.fn(),
}));

import { ProgressOverlay } from '@/components/panel/ProgressOverlay';

describe('ProgressOverlay', () => {
  test('renders empty state message when no history', () => {
    render(<ProgressOverlay onClose={jest.fn()} />);
    expect(screen.getByText(/Inizia a verificare/i)).toBeInTheDocument();
  });

  test('renders dialog with close button', () => {
    render(<ProgressOverlay onClose={jest.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chiudi/i })).toBeInTheDocument();
  });

  test('close button calls onClose', () => {
    const onClose = jest.fn();
    render(<ProgressOverlay onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Chiudi/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
