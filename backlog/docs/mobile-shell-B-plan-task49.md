# Mobile Shell B — TASK-49 (tap-friendly completion diary) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the completion diary comfortable to use with a thumb: enlarge & space the edit/delete actions (≥44px) and add a **confirmation on delete** (the §6 #2 critical risk), enlarge the editable difficulty boots (≥44px), and give the completion form comfortable input/button heights. Shared components → desktop benefits too; keep it from bloating desktop.

**Architecture:** Pure presentational + a delete-confirm gate. `CompletionList` ✎/✕ become ≥44px tap targets and ✕ goes through `confirm()` (notificationStore) before `deleteCompletion`. `DifficultyRating` editable buttons become ≥44px. `CompletionForm` inputs/buttons get ≥44px heights. No store/logic changes beyond the confirm gate.

**Tech Stack:** Next.js 15 + TS + Zustand + Tailwind + Jest. Branch `develop`. Spec `backlog/docs/mobile-shell-B-design.md` §6/§7. Depends on TASK-46/47/48 (landed).

---

## File Structure
- **Modify** `src/components/panel/CompletionList.tsx` — bigger ✎/✕ + delete confirmation.
- **Modify** `src/components/panel/DifficultyRating.tsx` — bigger editable boots.
- **Modify** `src/components/panel/CompletionForm.tsx` — comfortable inputs/buttons.
- **Modify** `src/__tests__/components/CompletionList.test.tsx` — add delete-confirm tests.

---

## Task 49.1: CompletionList — bigger actions + delete confirmation

**Files:** Modify `src/components/panel/CompletionList.tsx`; tests in `src/__tests__/components/CompletionList.test.tsx`.

- [ ] **Step 1: Write failing tests.** Add to `src/__tests__/components/CompletionList.test.tsx` a module mock for notificationStore and two tests. Add at the very top (before the other imports of CompletionList):

```tsx
import { jest } from '@jest/globals';
const mockConfirm = jest.fn();
jest.mock('@/stores/notificationStore', () => ({
  confirm: (...a: unknown[]) => mockConfirm(...a),
  toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));
```
Add `import { useRouteLibraryStore } from '@/stores/routeLibraryStore';` and `import { fireEvent, waitFor } from '@testing-library/react';` (merge with the existing `render, screen` import). In `beforeEach` add `mockConfirm.mockReset();`. Then add:

```tsx
describe('CompletionList — conferma eliminazione (TASK-49)', () => {
  test('annullando la conferma NON elimina', async () => {
    const del = jest.fn(async () => {});
    useRouteLibraryStore.setState({ deleteCompletion: del as never });
    mockConfirm.mockResolvedValue(false);
    render(<CompletionList route={routeWith([
      { id: 'c1', personName: 'gio', date: '2026-05-01', notes: '', createdBy: 'me' },
    ])} />);
    fireEvent.click(screen.getByRole('button', { name: /elimina completamento/i }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(del).not.toHaveBeenCalled();
  });

  test('confermando elimina il completamento', async () => {
    const del = jest.fn(async () => {});
    useRouteLibraryStore.setState({ deleteCompletion: del as never });
    mockConfirm.mockResolvedValue(true);
    render(<CompletionList route={routeWith([
      { id: 'c1', personName: 'gio', date: '2026-05-01', notes: '', createdBy: 'me' },
    ])} />);
    fireEvent.click(screen.getByRole('button', { name: /elimina completamento/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('r1', 'c1'));
  });
});
```

- [ ] **Step 2: Run, confirm FAIL** — `npx jest CompletionList --silent` (delete currently has no confirm → `mockConfirm` not called).

- [ ] **Step 3: Implement.** In `src/components/panel/CompletionList.tsx`:
  - Change the import `import { toast } from '@/stores/notificationStore';` to `import { confirm as appConfirm, toast } from '@/stores/notificationStore';`
  - Add a handler (near `guard`):
    ```tsx
    const askDelete = async (id: string) => {
      const ok = await appConfirm({ title: 'Eliminare questa uscita?', message: "L'azione è irreversibile.", variant: 'error', confirmText: 'Elimina' });
      if (ok) await guard(() => deleteCompletion(route.id, id));
    };
    ```
  - Replace the actions block:
    ```tsx
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditingId(c.id)} className="text-gray-500 hover:text-gray-300" aria-label="Modifica completamento">✎</button>
                  <button onClick={() => void guard(() => deleteCompletion(route.id, c.id))} className="text-gray-500 hover:text-red-400" aria-label="Elimina completamento">✕</button>
                </div>
    ```
    with:
    ```tsx
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditingId(c.id)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-gray-400 hover:text-gray-200 hover:bg-white/5" aria-label="Modifica completamento">✎</button>
                  <button onClick={() => void askDelete(c.id)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-white/5" aria-label="Elimina completamento">✕</button>
                </div>
    ```

- [ ] **Step 4: Run, confirm PASS** — `npx jest CompletionList --silent` → all green (existing 4 + 2 new).

---

## Task 49.2: DifficultyRating — bigger editable boots

**Files:** Modify `src/components/panel/DifficultyRating.tsx`.

- [ ] **Step 1:** In the editable branch, change the button className from:
  `className={`text-lg leading-none transition-transform active:scale-90 ${value && lvl <= value ? 'opacity-100' : 'opacity-30 grayscale'}`}`
  to:
  `className={`min-w-[44px] min-h-[44px] flex items-center justify-center text-xl transition-transform active:scale-90 ${value && lvl <= value ? 'opacity-100' : 'opacity-30 grayscale'}`}`
  (readOnly branch unchanged — it's display-only.)
- [ ] **Step 2:** `npx jest DifficultyRating --silent` → existing tests still green.

---

## Task 49.3: CompletionForm — comfortable inputs & buttons

**Files:** Modify `src/components/panel/CompletionForm.tsx`.

- [ ] **Step 1:** Bump the four `<input>`/`<select>`/`<textarea>` field paddings from `py-1` to `py-2` (taller, easier to tap). The Annulla/Salva buttons: change `py-1.5` to `py-2.5 min-h-[44px]`. Leave the date+hours+minutes row layout as-is (it already wraps acceptably); just the heights change. Do not change ids, handlers, or labels.
- [ ] **Step 2:** `npx jest CompletionForm --silent` → existing tests still green.

---

## Wrap-up
- [ ] Full suite: `npx jest --silent` → all green (expect ~553).
- [ ] Build: `npm run build` → ✓ Compiled successfully.

## Self-review notes (author)
- **Spec coverage (§6 #2, §7):** ✎/✕ ≥44px + spacing + delete confirm (49.1), difficulty boots ≥44px editable (49.2), form comfortable (49.3). aria-labels preserved → existing CompletionList tests stay green. Shared components → desktop also gets bigger targets (acceptable; no layout break expected).
- **Placeholders:** none.
- **No store/logic changes** beyond routing delete through `confirm()`.
