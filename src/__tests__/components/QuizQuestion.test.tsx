import { render, screen, fireEvent } from '@testing-library/react';
import { QuizQuestionView } from '@/components/quiz/QuizQuestion';
import type { QuizQuestion } from '@/lib/quiz';

const domanda: QuizQuestion = {
  type: 'distance',
  prompt: 'Stima la distanza fra i due punti indicati',
  realValue: 1.6,
  unit: 'km',
  pointA: { lat: 46.4, lon: 11.8 },
  pointB: { lat: 46.41, lon: 11.81 },
};

/**
 * Il campo delle risposte del quiz era `type="number"`, come quelli dell'editor: chi
 * rispondeva "1,5" a una domanda in chilometri vedeva il campo svuotarsi. La
 * correzione dei campi dell'editor non lo copriva, perche' il quiz ha un input suo —
 * il tipo di buco che si vede solo provando l'app, non leggendo il diff.
 */
describe('risposta del quiz', () => {
  test('accetta la virgola decimale', () => {
    const risposte: unknown[] = [];
    render(
      <QuizQuestionView
        question={domanda}
        questionNumber={1}
        totalQuestions={5}
        onAnswer={(a) => risposte.push(a)}
      />
    );
    fireEvent.change(screen.getByLabelText(/risposta in km/i), { target: { value: '1,5' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    // la risposta viene registrata subito, poi si passa avanti
    fireEvent.click(screen.getByRole('button', { name: /avanti|prossima|fine|continua/i }));
    expect(risposte).toHaveLength(1);
    expect((risposte[0] as { userValue: number }).userValue).toBe(1.5);
  });

  test('accetta anche il punto', () => {
    const risposte: unknown[] = [];
    render(
      <QuizQuestionView question={domanda} questionNumber={1} totalQuestions={5} onAnswer={(a) => risposte.push(a)} />
    );
    fireEvent.change(screen.getByLabelText(/risposta in km/i), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    fireEvent.click(screen.getByRole('button', { name: /avanti|prossima|fine|continua/i }));
    expect((risposte[0] as { userValue: number }).userValue).toBe(1.5);
  });

  test('chiede la tastiera decimale', () => {
    render(
      <QuizQuestionView question={domanda} questionNumber={1} totalQuestions={5} onAnswer={() => {}} />
    );
    expect(screen.getByLabelText(/risposta in km/i)).toHaveAttribute('inputmode', 'decimal');
  });
});
