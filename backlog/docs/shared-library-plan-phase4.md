# Libreria condivisa — Fase 4 (UI sociale + scheda) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps con checkbox (`- [ ]`). Logica/UI testate con mock; verifica e2e manuale.

**STATO: ✅ COMPLETATA (2026-06-05)** — difficoltà 🥾, creato-da (scheda+card), Meteo/PDF, completamenti in colonna; + rifiniture: rimosso "chi" (auto da utente loggato), rimossa stima Munter, meteo facoltativo (migration 0005), permessi owner-only su completamento/percorso con warning cascata. 517 test verdi, build ok. Richiede `db push` della migration 0005 per il meteo.

**Goal:** Arricchire la libreria condivisa: difficoltà percepita 🥾 1-5 nei completamenti, attribuzione "creato da @username", lista completamenti in colonna, e azioni **Meteo** / **PDF** per percorso direttamente in libreria.

**Architecture:** Si aggiunge `difficulty` al modello completamento (colonna DB già esistente) e lo si mappa in `lib/sync`. Un componente `DifficultyRating` (5 scarponi) gestisce input/visualizzazione. `RouteDetailCard` mostra il creatore e i pulsanti Meteo/PDF riusando `buildMeteoUrl` e `lib/export-pdf` (lazy). Niente nuove dipendenze.

**Tech Stack:** React/TS, Zustand, Jest. Riferimento spec: `backlog/docs/shared-library-design.md` (Sez. B/D).

---

## File Structure
- `src/lib/types.ts` — `RouteCompletion.difficulty?: 1|2|3|4|5`.
- `src/lib/sync.ts` — map `difficulty` in fetch/add/update.
- `src/components/panel/DifficultyRating.tsx` — NEW: selettore/visualizzatore 5 scarponi.
- `src/components/panel/CompletionForm.tsx` — integra il rating.
- `src/components/panel/CompletionList.tsx` — mostra difficoltà per entry.
- `src/components/panel/RouteDetailCard.tsx` — "creato da @username" + pulsanti Meteo/PDF + completamenti in colonna.
- Test relativi.

---

## Task 1: `difficulty` nel tipo + sync

**Files:** Modify `src/lib/types.ts`, `src/lib/sync.ts`; Test: extend `src/__tests__/sync.test.ts`

- [ ] **Step 1:** In `types.ts`, aggiungi a `RouteCompletion`:
```ts
  /** Difficoltà percepita 1-5 (1 passeggiata … 5 kitemmurt). */
  difficulty?: 1 | 2 | 3 | 4 | 5;
```

- [ ] **Step 2: Test** — estendi `src/__tests__/sync.test.ts` per verificare il mapping di `difficulty` in `fetchRoutes`:
```ts
test('mappa difficulty del completamento', async () => {
  tables['routes'] = [{ id: 'r1', sort_index: 0, updated_at: 'x', created_at: 'x', created_by: 'm1', data: { name: 'X', waypoints: [], legs: [] } }];
  tables['completions'] = [{ id: 'c1', route_id: 'r1', created_by: 'm1', person: 'Gio', date: '2026-05-01', duration_minutes: null, difficulty: 4, notes: '' }];
  tables['members'] = [];
  const routes = await fetchRoutes();
  expect(routes[0].completions![0].difficulty).toBe(4);
});
```

- [ ] **Step 3:** In `sync.ts`:
  - Aggiungi `difficulty: number | null` a `CompletionRow`.
  - In `mapCompletion`, aggiungi: `difficulty: (r.difficulty ?? undefined) as RouteCompletion['difficulty']`.
  - In `addCompletion` insert: aggiungi `difficulty: c.difficulty ?? null`.
  - In `updateCompletion`: aggiungi `if (patch.difficulty !== undefined) upd.difficulty = patch.difficulty ?? null;`.

- [ ] **Step 4:** `npm test -- sync` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add src/lib/types.ts src/lib/sync.ts src/__tests__/sync.test.ts
git commit -m "feat(library): completion difficulty 1-5 (type + sync mapping) (phase 4)"
```
End con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 2: `DifficultyRating`

**Files:** Create `src/components/panel/DifficultyRating.tsx`, Test `src/__tests__/components/DifficultyRating.test.tsx`

- [ ] **Step 1: Test**
```tsx
import { describe, expect, test, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { DifficultyRating, DIFFICULTY_LABELS } from '@/components/panel/DifficultyRating';

describe('DifficultyRating', () => {
  test('editable: click sul 3° scarpone chiama onChange(3)', () => {
    const onChange = jest.fn();
    render(<DifficultyRating value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(DIFFICULTY_LABELS[3], 'i') }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  test('readOnly: mostra la label del valore, nessun bottone', () => {
    render(<DifficultyRating value={5} readOnly />);
    expect(screen.getByText(new RegExp(DIFFICULTY_LABELS[5], 'i'))).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2:** Run, FAIL.

- [ ] **Step 3: Implementa `src/components/panel/DifficultyRating.tsx`**
```tsx
'use client';

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Passeggiata di salute',
  2: 'Facile',
  3: 'Medio',
  4: 'Difficile',
  5: 'Kitemmurt',
};

type Level = 1 | 2 | 3 | 4 | 5;

export function DifficultyRating({
  value, onChange, readOnly = false,
}: {
  value: Level | undefined;
  onChange?: (v: Level) => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    if (!value) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-300" title={DIFFICULTY_LABELS[value]}>
        <span aria-hidden="true">{'🥾'.repeat(value)}</span>
        <span className="text-gray-500">{DIFFICULTY_LABELS[value]}</span>
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex gap-1" role="group" aria-label="Difficoltà percepita">
        {([1, 2, 3, 4, 5] as Level[]).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange?.(lvl)}
            aria-label={`${lvl} — ${DIFFICULTY_LABELS[lvl]}`}
            aria-pressed={value === lvl}
            className={`text-lg leading-none transition-transform active:scale-90 ${value && lvl <= value ? 'opacity-100' : 'opacity-30 grayscale'}`}
          >
            🥾
          </button>
        ))}
      </div>
      {value && <div className="text-[11px] text-gray-400">{DIFFICULTY_LABELS[value]}</div>}
    </div>
  );
}
```

- [ ] **Step 4:** Run PASS; tsc clean.

- [ ] **Step 5: Commit**
```bash
git add src/components/panel/DifficultyRating.tsx src/__tests__/components/DifficultyRating.test.tsx
git commit -m "feat(library): DifficultyRating scarponi 1-5 component (phase 4)"
```

---

## Task 3: completamenti — rimuovi "chi" (auto = utente loggato) + difficoltà

**Files:** Modify `CompletionForm.tsx`, `CompletionList.tsx`, `routeLibraryStore.ts` (rimozione `knownPeople`); Test: riscrivi `CompletionForm.test.tsx`, aggiorna `routeLibraryStore.test.ts`.

**Razionale:** chi registra un completamento è l'utente loggato → il campo "chi" sparisce; `personName` = username del membro loggato (iniettato da `CompletionList`). `knownPeople`/autocomplete non servono più → rimossi.

- [ ] **Step 1: Riscrivi `CompletionForm.test.tsx`** (niente più person/autocomplete; aggiungi difficoltà). `CompletionForm` ora NON riceve `knownPeople` e il suo `onSubmit` NON include `personName`:
```tsx
import { describe, expect, test, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompletionForm } from '@/components/auth/../panel/CompletionForm';

describe('CompletionForm', () => {
  test('submit con ore/minuti → minuti totali, senza personName', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText(/ore/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/minuti/i), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 150 }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('personName');
  });

  test('include la difficoltà selezionata', () => {
    const onSubmit = jest.fn();
    render(<CompletionForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /3 — medio/i }));
    fireEvent.click(screen.getByRole('button', { name: /salva/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 3 }));
  });
});
```
(Il percorso import corretto è `@/components/panel/CompletionForm`.)

- [ ] **Step 2:** Run, FAIL.

- [ ] **Step 3: Riscrivi `CompletionForm.tsx`**
  - Rimuovi la prop `knownPeople`, il campo input "Chi" e il `<datalist>`.
  - Tipo: `onSubmit: (c: Omit<RouteCompletion, 'id' | 'personName'>) => void`.
  - Aggiungi `import { DifficultyRating } from './DifficultyRating';` e stato `const [difficulty, setDifficulty] = useState<RouteCompletion['difficulty']>(initial?.difficulty);`.
  - `submit` non valida più la persona; costruisce `{ date, durationMinutes, difficulty, notes }`.
  - UI: mantieni Data, Ore/Minuti, Note; aggiungi il blocco difficoltà:
```tsx
      <div>
        <label className="block text-[10px] text-gray-500 uppercase">Difficoltà percepita</label>
        <DifficultyRating value={difficulty} onChange={(v) => setDifficulty(v)} />
      </div>
```

- [ ] **Step 4: `CompletionList.tsx`**
  - Inietta `personName` dall'utente loggato per i NUOVI completamenti:
    - `import { useAuthStore } from '@/stores/authStore';` e `const member = useAuthStore((s) => s.member);`
    - add: `onSubmit={(c) => { void guard(() => addCompletion(route.id, { ...c, personName: member?.username ?? '' })); setAdding(false); }}`
    - edit (update): `onSubmit={(patch) => { void guard(() => updateCompletion(route.id, c.id, patch)); setEditingId(null); }}` (NON cambia `personName`).
  - Rimuovi la prop `knownPeople` dalle due `<CompletionForm>` e il selettore `knownPeople`.
  - Mostra `<DifficultyRating value={c.difficulty} readOnly />` in ogni entry (sotto persona/data/tempo). Continua a mostrare `c.personName` (lo username registrato).

- [ ] **Step 5: `routeLibraryStore.ts`** — rimuovi l'azione `knownPeople` dall'interfaccia e dall'implementazione (non più usata). Aggiorna `routeLibraryStore.test.ts` rimuovendo il test `knownPeople`.

- [ ] **Step 6:** `npm test` (CompletionForm, routeLibraryStore, full) PASS; `npx tsc --noEmit` clean.

- [ ] **Step 7: Commit**
```bash
git add src/components/panel/CompletionForm.tsx src/components/panel/CompletionList.tsx src/stores/routeLibraryStore.ts src/__tests__/components/CompletionForm.test.tsx src/__tests__/routeLibraryStore.test.ts
git commit -m "feat(library): auto person from logged-in user + difficulty in completions; drop knownPeople (phase 4)"
```

---

## Task 4: `RouteDetailCard` — creatore, Meteo, PDF, completamenti in colonna

**Files:** Modify `src/components/panel/RouteDetailCard.tsx`; Test: extend `src/__tests__/components/RouteDetailCard.test.tsx`

- [ ] **Step 1: Test** — aggiungi a `RouteDetailCard.test.tsx` (il `route` mock acquisisce `createdByUsername` e waypoint con coord):
```tsx
test('mostra il creatore', () => {
  useRouteLibraryStore.setState({ routes: [{ ...route, createdByUsername: 'gio' }], selectedRouteId: '1', sortMode: 'manual' });
  render(<RouteDetailCard />);
  expect(screen.getByText(/@gio/)).toBeInTheDocument();
});
```

- [ ] **Step 2:** Run, FAIL.

- [ ] **Step 3: `RouteDetailCard.tsx`**
  - **Creatore:** sotto il titolo, se `route.createdByUsername`:
```tsx
      {route.createdByUsername && <p className="text-xs text-gray-500">creato da <span className="text-green-400">@{route.createdByUsername}</span></p>}
```
  - **Meteo:** import `buildMeteoUrl` da `@/lib/meteo`. Aggiungi un pulsante (solo se `buildMeteoUrl(route.waypoints)` non-null) che apre l'URL:
```tsx
        {(() => { const u = buildMeteoUrl(route.waypoints); return u ? (
          <button onClick={() => window.open(u, '_blank')} className="px-3 py-2 bg-cyan-600 text-black rounded-lg text-xs font-bold transition-all active:scale-[0.97] hover:bg-cyan-500" aria-label="Meteo">Meteo</button>
        ) : null; })()}
```
  - **PDF:** lazy-import come in ActionBar. Aggiungi un pulsante "PDF" che costruisce il payload da metrics/waypoints/legs:
```tsx
  const handlePDF = async () => {
    if (route.waypoints.length < 2) { toast.warning('Servono almeno 2 waypoint'); return; }
    const { downloadPDF } = await import('@/lib/export-pdf');
    const { calculateDifficulty } = await import('@/lib/calculations');
    const m = route.metrics;
    downloadPDF({
      name: route.name, waypoints: route.waypoints, legs: route.legs,
      totalDistance: m?.distanceKm ?? 0, totalElevGain: m?.elevationGain ?? 0,
      totalElevLoss: m?.elevationLoss ?? 0, totalTime: m?.estimatedTimeMin ?? 0,
      difficulty: calculateDifficulty(m?.maxSlope ?? 0),
    }, 'summary');
  };
```
    e il pulsante: `<button onClick={handlePDF} className="px-3 py-2 bg-green-500 text-black rounded-lg text-xs font-bold transition-all active:scale-[0.97] hover:bg-green-400" aria-label="PDF">PDF</button>`.
  - **Completamenti in colonna:** assicurati che `<CompletionList route={route} />` sia reso a piena larghezza in colonna sotto la scheda (già lo è nello stack verticale `space-y-3`; verifica che non sia compresso). Se serve, racchiudilo in un blocco con intestazione "Diario uscite".
  > Verifica i tipi del payload PDF rispetto alla firma reale di `downloadPDF` (cfr. `ActionBar.handlePDF`); allinea i nomi dei campi.

- [ ] **Step 4:** `npm test -- RouteDetailCard` PASS; `npx tsc --noEmit` clean; full suite green; `npm run build` ok.

- [ ] **Step 5: Commit**
```bash
git add src/components/panel/RouteDetailCard.tsx src/__tests__/components/RouteDetailCard.test.tsx
git commit -m "feat(library): route detail — creator, Meteo & PDF actions, completions column (phase 4)"
```

---

## Task 5: Verifica e2e

- [ ] Salva un percorso, aggiungi un completamento con **difficoltà** → in `completions` la colonna `difficulty` è valorizzata; in scheda compaiono gli scarponi + label.
- [ ] La scheda mostra **"creato da @username"**.
- [ ] **Meteo** apre Meteoblue per i waypoint; **PDF** scarica il riepilogo del percorso.
- [ ] Full suite verde + build ok.

---

## Self-Review (esito)
**Copertura:** difficoltà (tipo+sync+UI) → Task 1-3; "chi" rimosso/auto da utente loggato + rimozione knownPeople → Task 3; creato-da + Meteo + PDF + colonna completamenti → Task 4; verifica → Task 5. ✔
**Note:** `difficulty` colonna DB già esistente (Fase 1). `personName` ora = username del membro loggato (iniettato da CompletionList); niente più input "chi"/autocomplete. Meteo/PDF riusano `buildMeteoUrl`/`export-pdf` (nessuna nuova dipendenza; jspdf lazy). La geometria del sentiero (linea d'aria vs tracciato) è **fuori scope** → Fase 5.
