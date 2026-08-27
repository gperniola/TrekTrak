import { render, screen, fireEvent } from '@testing-library/react';
import { QuizQuestionView } from '@/components/quiz/QuizQuestion';
import { ToleranceSettings } from '@/components/settings/ToleranceSettings';
import { EmergencyWmsLayer } from '@/components/map/emergency/EmergencyWmsLayer';
import { getEmergencyLayer } from '@/lib/emergency-layers';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { QuizQuestion } from '@/lib/quiz';

/**
 * Terzo giro di review. Il filo comune dei tre difetti: la correzione della virgola
 * decimale era stata applicata **solo** ai campi dell'itinerario, e lo stesso difetto
 * viveva ancora in due altri posti che leggono numeri. Quando un difetto riguarda un
 * modo di scrivere, va cercato in ogni punto dove si scrive.
 */
describe('review 3: il quiz e il separatore delle migliaia', () => {
  const domandaMetri: QuizQuestion = {
    type: 'altitude', prompt: 'Stima l’altitudine', realValue: 1500, unit: 'm',
    pointA: { lat: 46.4, lon: 11.8 },
  };
  const domandaKm: QuizQuestion = {
    type: 'distance', prompt: 'Stima la distanza', realValue: 1.5, unit: 'km',
    pointA: { lat: 46.4, lon: 11.8 }, pointB: { lat: 46.41, lon: 11.81 },
  };

  const rispondi = (q: QuizQuestion, testo: string) => {
    const risposte: { userValue: number; score: number }[] = [];
    render(
      <QuizQuestionView
        question={q} questionNumber={1} totalQuestions={5}
        onAnswer={(a) => risposte.push(a as { userValue: number; score: number })}
      />
    );
    fireEvent.change(screen.getByLabelText(new RegExp(`risposta in ${q.unit}`, 'i')), { target: { value: testo } });
    fireEvent.click(screen.getByRole('button', { name: /conferma/i }));
    fireEvent.click(screen.getByRole('button', { name: /avanti|prossima|fine|continua/i }));
    return risposte[0];
  };

  /**
   * Prima: "1.500" valeva 1,5, quindi il punteggio era **zero su una risposta giusta**.
   * Essere bocciati da un separatore, in un'app didattica, è il peggio che possa
   * capitare.
   */
  test('«1.500» a una domanda in metri vale millecinquecento', () => {
    const r = rispondi(domandaMetri, '1.500');
    expect(r.userValue).toBe(1500);
    expect(r.score).toBeGreaterThan(90);
  });

  test('«1.500» a una domanda in km resta uno e mezzo', () => {
    const r = rispondi(domandaKm, '1.500');
    expect(r.userValue).toBe(1.5);
    expect(r.score).toBeGreaterThan(90);
  });

  // Due render nello stesso test darebbero due pulsanti "Prossima": un test per caso.
  test('un intero senza separatori resta se stesso', () => {
    expect(rispondi(domandaMetri, '1500').userValue).toBe(1500);
  });

  test('la virgola continua a funzionare nei km', () => {
    expect(rispondi(domandaKm, '1,5').userValue).toBe(1.5);
  });
});

/**
 * La tolleranza delle coordinate vale 0,001 gradi: con un campo `type="number"` il
 * browser scartava la virgola, quindi all'italiana quel valore non era impostabile.
 */
describe('review 3: le tolleranze accettano la virgola', () => {
  test('«0,002» imposta la tolleranza delle coordinate', () => {
    render(<ToleranceSettings onClose={() => {}} />);
    const campo = screen.getByLabelText(/tolleranza coordinate/i) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '0,002' } });
    expect(campo.value).toBe('0,002');
    // il valore arriva allo stato del pannello: si salva con il pulsante, ma il campo
    // non deve piu' svuotarsi mentre si scrive
    fireEvent.change(campo, { target: { value: '0,0025' } });
    expect(campo.value).toBe('0,0025');
  });

  test('chiede la tastiera decimale', () => {
    render(<ToleranceSettings onClose={() => {}} />);
    expect(screen.getByLabelText(/tolleranza altitudine/i)).toHaveAttribute('inputmode', 'decimal');
  });
});

/**
 * Il pulsante "Riprova" aggiunto nel secondo giro lasciava i layer WMS in
 * "Caricamento..." **per sempre**: lo stato di un WMS lo decidono i tile, e senza
 * rimontare il layer nessun tile viene richiesto. Un difetto nato dal miglioramento
 * dell'ora precedente.
 */
describe('review 3: riprovare rimonta anche i layer WMS', () => {
  const fwi = getEmergencyLayer('fires-fwi');

  test('il contatore dei tentativi cambia la chiave, quindi i tile si richiedono', () => {
    useEmergencyStore.setState({ nowTick: Date.UTC(2026, 7, 28, 10, 0, 0) });
    const { rerender } = render(<EmergencyWmsLayer def={fwi} />);
    const prima = screen.getByTestId('wms-tile-layer');

    useEmergencyStore.getState().retryLayer('fires-fwi');
    rerender(<EmergencyWmsLayer def={fwi} />);
    expect(screen.getByTestId('wms-tile-layer')).not.toBe(prima);
  });

  test('e il layer riparte da "loading", non resta in errore', () => {
    useItineraryStore.setState({
      settings: {
        ...useItineraryStore.getState().settings,
        mapDisplay: { ...useItineraryStore.getState().settings.mapDisplay, emergencyLayers: ['fires-fwi'] },
      },
    });
    useEmergencyStore.setState({
      layers: {
        ...useEmergencyStore.getState().layers,
        'fires-fwi': { status: 'error', error: 'EFFIS non raggiungibile', lastFetch: null },
      },
    });
    useEmergencyStore.getState().retryLayer('fires-fwi');
    expect(useEmergencyStore.getState().layers['fires-fwi'].status).toBe('loading');
  });
});
