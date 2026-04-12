import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, test, beforeEach } from '@jest/globals';
import { ValidationBadge } from '@/components/validation/ValidationBadge';
import type { ValidationResult } from '@/lib/types';

describe('ValidationBadge', () => {
  test('renders nothing when result is undefined', () => {
    const { container } = render(<ValidationBadge />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when status is unverified', () => {
    const result: ValidationResult = {
      status: 'unverified',
      realValue: 100,
      delta: 10,
      tolerance: { strict: 50, loose: 100 },
    };
    const { container } = render(<ValidationBadge result={result} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders badge with checkmark for valid result', () => {
    const result: ValidationResult = {
      status: 'valid',
      realValue: 100,
      delta: 5,
      tolerance: { strict: 50, loose: 100 },
    };
    render(<ValidationBadge result={result} />);
    expect(screen.getByRole('button')).toHaveTextContent('✓');
  });

  test('renders badge with tilde for warning result', () => {
    const result: ValidationResult = {
      status: 'warning',
      realValue: 100,
      delta: 60,
      tolerance: { strict: 50, loose: 100 },
    };
    render(<ValidationBadge result={result} />);
    expect(screen.getByRole('button')).toHaveTextContent('~');
  });

  test('click opens popover showing "Calcolato"', () => {
    const result: ValidationResult = {
      status: 'valid',
      realValue: 1234,
      delta: 10,
      tolerance: { strict: 50, loose: 100 },
    };
    render(<ValidationBadge result={result} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText(/Calcolato/)).toBeInTheDocument();
  });

  test('popover shows didactic tip for warning with altitude field (curva di livello)', () => {
    // delta > strict but <= loose → 'small' band
    // altitude.small tip contains "curva di livello"
    const result: ValidationResult = {
      status: 'warning',
      realValue: 500,
      delta: 80,
      tolerance: { strict: 50, loose: 100 },
    };
    render(<ValidationBadge result={result} fieldType="altitude" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText(/curva di livello/i)).toBeInTheDocument();
  });
});
