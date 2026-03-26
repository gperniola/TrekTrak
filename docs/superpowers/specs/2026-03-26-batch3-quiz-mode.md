# Batch 3 — Quiz Mode

## Scopo
Modalità quiz overlay sulla mappa dove l'app seleziona punti casuali nel viewport e l'utente stima altitudine, distanza o azimuth. 5 domande per sessione, punteggio 0-100, storico salvato in localStorage.

## Tipi di domanda

### Altitudine
- L'app mostra un punto casuale sulla mappa
- L'utente inserisce la quota stimata in metri
- Risposta reale: fetchElevation dal DEM
- Tolleranza: ±100m (0 punti se errore ≥ 100m)

### Distanza
- L'app mostra due punti casuali sulla mappa
- L'utente stima la distanza in km
- Risposta reale: haversineDistance
- Tolleranza: ±20% della distanza reale (0 punti se errore ≥ 20%)

### Azimuth
- L'app mostra due punti casuali sulla mappa (A e B)
- L'utente stima l'azimuth da A a B in gradi
- Risposta reale: forwardAzimuth
- Tolleranza: ±30° (0 punti se errore ≥ 30°)
- Il confronto tiene conto della circolarità (350° vs 10° = delta 20°, non 340°)

## Flusso sessione

1. L'utente clicca "Quiz" nella ModeSwitch bar
2. Si apre overlay sopra la mappa con la prima domanda
3. L'app genera punti casuali nel viewport, li mostra come marker sulla mappa
4. L'utente inserisce la risposta e conferma
5. L'app mostra: risposta corretta, delta, punteggio (0-100)
6. Pulsante "Prossima" → domanda successiva
7. Dopo 5 domande: schermata riepilogo con punteggio totale e dettaglio per categoria
8. Pulsanti "Nuova sessione" e "Chiudi"

## Generazione domande

### Punti casuali
- Legge i bounds del viewport corrente dalla mappa
- Genera lat/lon casuali all'interno dei bounds con margine del 10% dai bordi
- Per distanza/azimuth: genera due punti con distanza minima 0.5 km
- Per altitudine: verifica che il DEM restituisca un valore non-null (retry se null, max 3 tentativi)

### Selezione tipo
- 5 domande per sessione
- Mix bilanciato: almeno 1 di ogni tipo, restanti 2 casuali
- Ordine randomizzato

## Punteggio

### Formula per domanda
```
score = max(0, Math.round(100 * (1 - |delta| / tolerance)))
```

### Tolleranze
- Altitudine: 100m (assoluta)
- Distanza: 20% della distanza reale (percentuale)
- Azimuth: 30° (assoluta, con wrap circolare)

### Delta azimuth circolare
```
delta = min(|userValue - realValue|, 360 - |userValue - realValue|)
```

### Punteggio sessione
Media aritmetica dei 5 punteggi individuali, arrotondata all'intero.

## Storico sessioni

### Persistenza
- Chiave localStorage: `trektrak_quiz_history`
- Formato:
```typescript
interface QuizSession {
  date: string;           // ISO date
  questions: {
    type: 'altitude' | 'distance' | 'azimuth';
    score: number;        // 0-100
    userValue: number;
    realValue: number;
  }[];
  average: number;        // 0-100
}
```
- Mantiene le ultime 50 sessioni (FIFO)

### Visualizzazione storico
- Accessibile dalla schermata riepilogo sessione
- Mostra: media per categoria (ultimi 10 sessioni), trend generale
- Formato semplice: lista con data + punteggio, medie per tipo

## Implementazione

### Nuovi file
- `src/lib/quiz.ts` — logica pura:
  - `generateRandomPoint(bounds, margin)`: genera punto casuale nel viewport
  - `generateQuestion(type, bounds, map)`: genera domanda con punti e risposta reale
  - `calculateQuizScore(userValue, realValue, type)`: calcola punteggio 0-100
  - `azimuthDelta(a, b)`: delta circolare tra due azimuth
  - `saveQuizSession(session)`: salva in localStorage
  - `loadQuizHistory()`: carica storico
- `src/__tests__/quiz.test.ts` — test per logica pura
- `src/components/quiz/QuizOverlay.tsx` — overlay principale, gestisce stato sessione (domanda corrente, punteggi, fase)
- `src/components/quiz/QuizQuestion.tsx` — singola domanda: tipo, input, feedback dopo risposta
- `src/components/quiz/QuizSummary.tsx` — riepilogo fine sessione + accesso storico
- `src/components/map/QuizMarkers.tsx` — marker sulla mappa per i punti del quiz

### File modificati
- `src/app/page.tsx` — stato `quizActive`, mutua esclusione con compass/ruler
- `src/components/panel/ModeSwitch.tsx` — pulsante Quiz
- `src/components/panel/LeftPanel.tsx` — forward props quiz
- `src/components/map/MapWrapper.tsx` — forward props quiz
- `src/components/map/InteractiveMap.tsx` — QuizMarkers + MapEvents sopprime waypoint click
- `src/lib/storage.ts` — aggiungere chiave `quizHistory` a KEYS

## Vincoli
- Il quiz NON chiede coordinate (solo altitudine, distanza, azimuth)
- L'overlay non blocca completamente la mappa: l'utente può zoomare/pannare per osservare i punti
- La mappa è visibile sotto l'overlay (overlay semitrasparente o posizionato lateralmente)
- Quando quiz attivo: compass, ruler, click waypoint sono tutti disabilitati
