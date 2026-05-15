# v0.4.0 — "Didattica Evoluta" Design Spec

## Obiettivo

Completare le feature didattiche mancanti dalla Phase 2 della spec originale (Feature 11 e 12) e applicare polish UX/funzionale mirato. Questa release trasforma TrekTrak da buon tool cartografico a strumento educativo completo.

## Scope

3 aree di intervento:

1. **Suggerimenti didattici contestuali** (Feature 11)
2. **Report di apprendimento** (Feature 12)
3. **Polish UX + funzionale** (5 interventi mirati)

---

## 1. Suggerimenti Didattici Contestuali

### Comportamento

Il popover del `ValidationBadge` viene esteso. Oggi mostra "Calcolato: X" e "Scarto: Y". Nella v0.4.0, sotto i dati numerici appare una riga di suggerimento adattivo con icona lampadina.

Il suggerimento appare **solo** per status `warning` e `error` (non per `valid`).

### Logica di selezione

Il testo del suggerimento dipende da due variabili:

- **Campo**: `altitude`, `distance`, `elevationGain`, `elevationLoss`, `azimuth`
- **Fascia di scarto**: 3 livelli basati sul delta rispetto alle tolleranze

Fasce:

| Fascia | Condizione |
|--------|-----------|
| Piccolo | `delta <= tolerance.loose` (è un warning) |
| Medio | `delta <= tolerance.loose * 2` |
| Grande | `delta > tolerance.loose * 2` |

Questo produce ~15 combinazioni (5 campi × 3 fasce).

### Contenuto suggerimenti

#### Altitudine

| Fascia | Testo |
|--------|-------|
| Piccolo | "Verifica quale curva di livello hai letto — l'equidistanza tra le curve potrebbe ingannarti." |
| Medio | "Controlla di aver identificato la curva direttrice corretta (le linee più spesse, ogni 4-5 curve)." |
| Grande | "Potresti aver letto il valore di una cima o valle adiacente. Riparti dalla curva direttrice più vicina e conta le curve intermedie." |

#### Distanza

| Fascia | Testo |
|--------|-------|
| Piccolo | "Prova a verificare la scala della carta e il fattore di conversione che stai usando." |
| Medio | "Stai usando la scala corretta? Ricorda: 1 cm sulla carta a scala 1:25000 = 250 m reali." |
| Grande | "Il percorso potrebbe seguire un sentiero curvo — la distanza reale lungo il tracciato è maggiore di quella in linea d'aria. Prova a misurare seguendo le curve." |

#### Dislivello (D+ e D-)

| Fascia | Testo |
|--------|-------|
| Piccolo | "Attenzione ai piccoli saliscendi intermedi: ogni risalita va contata nel dislivello positivo, ogni discesa nel negativo." |
| Medio | "Ricontrolla il profilo tra i due punti: potresti aver trascurato un cambio di pendenza intermedio." |
| Grande | "Il dislivello cumulativo è la somma di TUTTE le salite (o discese), non solo la differenza tra quota iniziale e finale." |

#### Azimut

| Fascia | Testo |
|--------|-------|
| Piccolo | "Verifica la declinazione magnetica della zona — può introdurre uno scarto di qualche grado." |
| Medio | "Controlla di misurare l'angolo dal Nord geografico (verso l'alto sulla carta), non dal bordo o da un riferimento arbitrario." |
| Grande | "Potresti aver invertito la direzione di lettura. L'azimut si misura dal punto di partenza verso il punto di arrivo, in senso orario dal Nord." |

### Implementazione

- **Nuovo file**: `src/lib/didactic-tips.ts`
  - Export: `getTip(field: FieldType, delta: number, tolerance: { strict: number; loose: number }) → string | null`
  - `FieldType = 'altitude' | 'distance' | 'elevationGain' | 'elevationLoss' | 'azimuth'`
  - Ritorna `null` se delta è `undefined`, `NaN`, o `<= tolerance.strict` (cioè status valid)
- **Modifica**: `src/components/validation/ValidationBadge.tsx`
  - Importa `getTip`
  - Sotto la riga "Scarto", aggiunge `💡 {tip}` in `text-amber-300 text-[10px] italic`
  - Il tip viene calcolato da `getTip(field, result.delta, result.tolerance)`
  - Il campo `field` deve essere passato come nuova prop a ValidationBadge

### Prop aggiuntiva ValidationBadge

```typescript
interface ValidationBadgeProps {
  result?: ValidationResult;
  field: 'altitude' | 'distance' | 'elevationGain' | 'elevationLoss' | 'azimuth';
  // ... existing props
}
```

I componenti che usano ValidationBadge (LegCard, WaypointCard, NumberInput) dovranno passare il nuovo prop `field`.

---

## 2. Report di Apprendimento

### Dati — ValidationSession

Ogni volta che l'utente clicca "Verifica" e la validazione completa con successo, salviamo una sessione:

```typescript
interface ValidationSessionResult {
  field: 'altitude' | 'distance' | 'elevationGain' | 'elevationLoss' | 'azimuth';
  status: 'valid' | 'warning' | 'error';
  delta: number;
  tolerance: { strict: number; loose: number };
}

interface ValidationSession {
  date: string;              // ISO timestamp
  itineraryName: string;
  results: ValidationSessionResult[];
}
```

### Persistenza

- **Chiave localStorage**: `trektrak_learning_history` (già riservata in `KEYS` di storage.ts)
- **Max sessioni**: 100 (FIFO — le più vecchie scartate)
- **Funzioni in storage.ts**:
  - `saveValidationSession(session: ValidationSession): void`
  - `loadValidationHistory(): ValidationSession[]`
  - `clearValidationHistory(): void`

### Salvataggio automatico

In `ActionBar.tsx`, alla fine di `handleVerify()` (dopo che tutte le validazioni sono state applicate allo store), raccogliere i `ValidationResult` da tutti i waypoint e leg e salvare come `ValidationSession`.

### UI — Overlay "Progresso"

Overlay full-screen, stessa struttura del QuizOverlay (fixed inset-0, z-[1400], sfondo scuro semi-trasparente, pannello centrale scrollabile).

#### Sezione 1: Riepilogo rapido (top)

3 card affiancate (grid a 3 colonne, 1 colonna su mobile):

| Card | Contenuto |
|------|-----------|
| **Verifiche** | Totale sessioni · % campi "valid" nell'ultima sessione |
| **Quiz** | Totale sessioni · Media score dell'ultima sessione |
| **Trend** | Freccia ↑/↓/→ basata su media ultimi 5 vs 5 precedenti (verifiche e quiz combinati, normalizzati: % valid per verifiche, score/100 per quiz). ↑ se migliorato >5%, ↓ se peggiorato >5%, → altrimenti |

Se non ci sono abbastanza dati per il trend (meno di 10 sessioni totali tra verifiche e quiz), mostrare "—" con testo "Completa almeno 10 sessioni".

#### Sezione 2: Grafico trend (centro)

Recharts `LineChart` con:
- **Asse X**: data sessione (formattata DD/MM)
- **Linea blu**: % campi "valid" per sessione di verifica
- **Linea verde**: media score quiz per sessione
- **Tooltip**: mostra dettaglio al hover
- **Legenda**: "Verifiche" e "Quiz"

Sotto il grafico: **toggle per categoria** (5 bottoni: Altitudine, Distanza, D+, D-, Azimut). Quando attivo un filtro, le linee mostrano solo i dati di quella categoria. Per i quiz, i filtri D+ e D- non si applicano (i quiz non hanno queste categorie) — la linea quiz scompare quando si filtra per D+ o D-. Per Altitudine, Distanza, Azimut entrambe le linee vengono filtrate. Default: tutte le categorie aggregate.

Se non ci sono dati sufficienti (<3 sessioni totali), mostrare placeholder: "Inizia a verificare i tuoi itinerari e completare quiz per vedere il tuo progresso qui."

#### Sezione 3: Dettaglio per categoria (bottom)

Griglia responsive (5 colonne desktop, scroll orizzontale mobile). Per ogni campo (altitudine, distanza, D+, D-, azimut):

- **Label** del campo
- **Errore medio** (media dei delta su tutte le sessioni)
- **Distribuzione**: barra segmentata verde/giallo/rosso (% valid/warning/error)
- **Mini-sparkline**: Recharts `Sparkline` ultime 10 sessioni (altezza ~30px), mostra trend del delta medio

Se una categoria non ha dati, mostrare "—".

#### Bottone Reset

In fondo all'overlay: "Cancella storico" con conferma (dialog "Sei sicuro? Questa azione è irreversibile."). Cancella sia `learningHistory` che `quizHistory`.

### Accesso

Nuovo bottone nell'ActionBar:
- **Icona**: 📊 (o SVG chart-bar)
- **Label**: "Progresso"
- **Posizione**: dopo il bottone "Verifica" (solo in Learn mode) oppure sempre visibile (entrambe le modalità, dato che i dati quiz sono disponibili anche in Track)
- **Sempre visibile** in entrambe le modalità Learn e Track

### File coinvolti

- **Nuovo**: `src/components/panel/ProgressOverlay.tsx` — overlay completo
- **Nuovo**: `src/lib/learning-stats.ts` — funzioni di calcolo statistiche (aggregazioni, trend, sparkline data)
- **Modifica**: `src/lib/storage.ts` — aggiunta funzioni save/load/clear per ValidationSession
- **Modifica**: `src/lib/types.ts` — aggiunta interfacce ValidationSession, ValidationSessionResult
- **Modifica**: `src/components/panel/ActionBar.tsx` — salvataggio sessione post-verifica + bottone "Progresso"
- **Modifica**: `src/app/page.tsx` — stato `progressOpen` e prop drilling verso ActionBar e ProgressOverlay

---

## 3. Polish

### 3.1 Feedback post-Verifica

Dopo che `handleVerify()` completa, mostrare un banner riassuntivo sopra l'ActionBar:

- Contenuto: "Verifica completata: N ✓ · N ~ · N ✗"
- Stile: `bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm`
- I conteggi colorati: ✓ verde, ~ giallo, ✗ rosso
- Auto-fade dopo 4 secondi (CSS `opacity` transition + `setTimeout`)
- Dismissibile con click

**Implementazione**: stato `verifyBanner` in ActionBar con `{ valid: number, warning: number, error: number } | null`. Popolato alla fine di `handleVerify()`, azzerato con setTimeout.

### 3.2 Animazione ValidationBadge

Quando il badge appare (transizione da `result === undefined` a `result !== undefined`), animazione CSS:

```css
@keyframes badge-pop {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
```

Durata: 300ms, ease-out. Solo alla prima apparizione dopo "Verifica" (non a ogni re-render).

**Implementazione**: `useRef` per tracciare se il badge è appena apparso. Classe CSS `animate-badge-pop` aggiunta in `globals.css`.

### 3.3 Popover posizionamento mobile

Logica di posizionamento adattivo nel popover del ValidationBadge:

- Default: popover sopra il badge (`bottom-full`)
- Se il badge è nel 25% superiore del viewport: popover sotto il badge (`top-full`)
- Calcolo con `getBoundingClientRect()` nel handler di apertura

**Implementazione**: `useRef` sul badge button, calcolo posizione in `handleClick`, stato `position: 'above' | 'below'`.

### 3.4 What's New v0.4.0

Aggiornare `WhatsNew.tsx` con le novità della v0.4.0:

- Step 1: "Suggerimenti didattici" — dopo la verifica, clicca sui badge per ricevere consigli su come migliorare
- Step 2: "Report Progresso" — traccia il tuo miglioramento nel tempo con il nuovo pannello Progresso
- Step 3: "Feedback Verifica" — ora vedi subito un riepilogo dei risultati dopo ogni verifica

Aggiornare la versione check da `0.3` a `0.4`.

### 3.5 Link "Vedi report completo" nel QuizSummary

Nel `QuizSummary.tsx`, nella sezione storico, aggiungere un bottone link sotto la lista:

- Testo: "Vedi report completo →"
- Stile: `text-blue-400 hover:text-blue-300 text-sm underline`
- Azione: chiude il quiz overlay e apre il ProgressOverlay
- Richiede una callback prop `onOpenProgress` passata dal page.tsx

---

## File nuovi

| File | Responsabilità |
|------|---------------|
| `src/lib/didactic-tips.ts` | `getTip(field, delta, tolerance) → string \| null` |
| `src/lib/learning-stats.ts` | Aggregazioni statistiche, trend, dati per grafici |
| `src/components/panel/ProgressOverlay.tsx` | Overlay report di apprendimento |

## File modificati

| File | Modifica |
|------|----------|
| `src/lib/types.ts` | Interfacce `ValidationSession`, `ValidationSessionResult` |
| `src/lib/storage.ts` | `saveValidationSession`, `loadValidationHistory`, `clearValidationHistory` |
| `src/components/validation/ValidationBadge.tsx` | Prop `field`, tip didattico, animazione pop, posizionamento adattivo |
| `src/components/panel/ActionBar.tsx` | Salvataggio sessione, banner post-verifica, bottone Progresso |
| `src/components/panel/LegCard.tsx` | Passare prop `field` a ValidationBadge |
| `src/components/panel/WaypointCard.tsx` | Passare prop `field` a ValidationBadge |
| `src/components/shared/NumberInput.tsx` | Passare prop `field` a ValidationBadge (se usa ValidationBadge) |
| `src/components/quiz/QuizSummary.tsx` | Link "Vedi report completo →" |
| `src/components/tutorial/WhatsNew.tsx` | Contenuto v0.4.0 |
| `src/app/page.tsx` | Stato `progressOpen`, callback per quiz→progresso |
| `src/app/globals.css` | Keyframe `badge-pop` |
| `package.json` | Versione → 0.4.0 |

## Non in scope

- Refactoring InteractiveMap.tsx (v0.6.0)
- Test componenti React (v0.6.0)
- Migrazione next-pwa (v0.6.0)
- Griglia UTM, import GPX, schede stampabili (skippati)
- Gamification/badge/obiettivi (valutabile post-release)
