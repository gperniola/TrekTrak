# Profilo d'uso Imparo/Montagna — piano di attuazione

> **Per chi esegue:** i passi usano caselle (`- [ ]`). Ogni task finisce con un
> deliverable verificabile da solo e un commit.

**Goal:** un profilo d'uso `imparo` | `montagna` che decide **quali aree dell'app
esistono a schermo**, per togliere di mezzo le funzioni che non servono a chi sta
imparando e viceversa.

**Architettura:** una tabella dichiarativa (`src/lib/profilo.ts`) dice quale area
appartiene a quale profilo; i componenti la interrogano con `mostra(area, profilo)`.
Lo stato vive in `uiStore`, è persistito in `localStorage`, e viene deciso all'avvio da
una funzione pura. Nessun `if` sul profilo scritto a mano nei componenti: solo
`mostra()`.

**Tech stack:** Next 14 App Router, TypeScript, Zustand, Tailwind, Jest + ts-jest +
Testing Library.

**Spec:** `backlog/docs/profilo-uso-design.md`

## Vincoli globali

- **Italiano** per ogni testo che l'utente legge. Accenti veri (`è`, `più`): il test
  `src/__tests__/accenti-italiani.test.ts` rifiuta l'apostrofo al posto dell'accento.
- **Nessun dato si cancella** cambiando profilo: layer attivi, itinerario in
  lavorazione, storico verifiche e quiz restano. Il profilo cambia la vista, non i dati.
- **L'interruttore del profilo è visibile e nominato**, non sepolto nelle impostazioni.
- Numeri con `src/lib/formato.ts`, orari con `oraItaliana` dello stesso file. Mai un
  `toLocaleTimeString` nuovo.
- Bersagli tattili ≥ 44 px su mobile (`max-lg:min-h-[44px]`).
- `npm run check` (typecheck + typecheck:tests + lint + jest) deve passare alla fine di
  ogni task.
- Niente `<input type="number">` senza la giustificazione `campo-numerico-ok:`
  (guardia in `src/__tests__/campi-numerici.test.ts`).

---

### Task 1: La tabella delle aree e `mostra`

**Files:**
- Create: `src/lib/profilo.ts`
- Test: `src/__tests__/profilo.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `type Profilo = 'imparo' | 'montagna'`; `AREE` (oggetto costante);
  `type Area = keyof typeof AREE`; `mostra(area: Area, profilo: Profilo): boolean`;
  `PROFILI: readonly Profilo[]`; `ETICHETTE_PROFILO: Record<Profilo, string>`.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/__tests__/profilo.test.ts
import { AREE, mostra, PROFILI, ETICHETTE_PROFILO, type Area } from '@/lib/profilo';

describe('la tabella delle aree', () => {
  test('le aree didattiche stanno solo in Imparo', () => {
    for (const a of ['validazione', 'quiz', 'progresso', 'tipsDidattici', 'switchLearnTrack'] as Area[]) {
      expect(mostra(a, 'imparo')).toBe(true);
      expect(mostra(a, 'montagna')).toBe(false);
    }
  });

  test('le aree da campo stanno solo in Montagna', () => {
    for (const a of ['layerEmergenza', 'meteo', 'allertaPosizione', 'libreria', 'exportDati'] as Area[]) {
      expect(mostra(a, 'montagna')).toBe(true);
      expect(mostra(a, 'imparo')).toBe(false);
    }
  });

  test('bussola, righello e PDF stanno in entrambi', () => {
    for (const a of ['bussola', 'righello', 'pdf'] as Area[]) {
      expect(mostra(a, 'imparo')).toBe(true);
      expect(mostra(a, 'montagna')).toBe(true);
    }
  });

  test('ogni area dichiara almeno un profilo: un area invisibile a tutti sarebbe morta', () => {
    for (const [nome, profili] of Object.entries(AREE)) {
      expect(profili.length).toBeGreaterThan(0);
      expect(nome).not.toBe('');
    }
  });

  test('i profili e le loro etichette in italiano', () => {
    expect(PROFILI).toEqual(['imparo', 'montagna']);
    expect(ETICHETTE_PROFILO.imparo).toBe('Imparo');
    expect(ETICHETTE_PROFILO.montagna).toBe('Vado in montagna');
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/profilo.test.ts`
Atteso: FAIL, `Cannot find module '@/lib/profilo'`.

- [ ] **Step 3: Scrivere l'implementazione minima**

```ts
// src/lib/profilo.ts
/**
 * Quali aree dell'app esistono, per profilo d'uso.
 *
 * Con quindici aree sparse in una dozzina di componenti, la domanda «questo pulsante in
 * quale profilo si vede?» deve avere UNA sola risposta in UN solo posto. Altrimenti il
 * difetto tipico e' nascondere un ingresso e lasciarne un altro allo stesso posto.
 */
export type Profilo = 'imparo' | 'montagna';

export const PROFILI: readonly Profilo[] = ['imparo', 'montagna'];

export const ETICHETTE_PROFILO: Record<Profilo, string> = {
  imparo: 'Imparo',
  montagna: 'Vado in montagna',
};

export const AREE = {
  validazione: ['imparo'],
  quiz: ['imparo'],
  progresso: ['imparo'],
  tipsDidattici: ['imparo'],
  switchLearnTrack: ['imparo'],
  layerEmergenza: ['montagna'],
  meteo: ['montagna'],
  allertaPosizione: ['montagna'],
  libreria: ['montagna'],
  exportDati: ['montagna'],
  bussola: ['imparo', 'montagna'],
  righello: ['imparo', 'montagna'],
  pdf: ['imparo', 'montagna'],
} as const satisfies Record<string, readonly Profilo[]>;

export type Area = keyof typeof AREE;

export function mostra(area: Area, profilo: Profilo): boolean {
  return (AREE[area] as readonly Profilo[]).includes(profilo);
}
```

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/profilo.test.ts`
Atteso: PASS, 5 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profilo.ts src/__tests__/profilo.test.ts
git commit -m "feat(profilo): la tabella che dice quale area vive in quale profilo"
```

---

### Task 2: Il profilo scelto all'avvio

**Files:**
- Create: `src/lib/startup-profilo.ts`
- Test: `src/__tests__/startup-profilo.test.ts`

**Interfaces:**
- Consumes: `Profilo` da `@/lib/profilo`.
- Produces: `profiloIniziale(input: { salvato: string | null; livello: string | null }): Profilo`.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/__tests__/startup-profilo.test.ts
import { profiloIniziale } from '@/lib/startup-profilo';

describe('quale profilo all avvio', () => {
  test('il profilo salvato vince su tutto', () => {
    expect(profiloIniziale({ salvato: 'imparo', livello: 'expert' })).toBe('imparo');
    expect(profiloIniziale({ salvato: 'montagna', livello: 'beginner' })).toBe('montagna');
  });

  /** Chi usava l'app prima di questa versione ha solo il livello dichiarato. */
  test('senza profilo salvato lo deduce dal livello dell onboarding', () => {
    expect(profiloIniziale({ salvato: null, livello: 'beginner' })).toBe('imparo');
    expect(profiloIniziale({ salvato: null, livello: 'expert' })).toBe('montagna');
  });

  /**
   * Senza nulla: Montagna. Il default NON nasconde la sicurezza — in Imparo l'avviso di
   * allerta alla posizione non c'e', e sceglierlo per chi non ha ancora risposto
   * significherebbe togliere un avviso a qualcuno che potrebbe essere fuori. Il tutorial
   * chiede subito, quindi il default dura pochi secondi.
   */
  test('senza niente parte da Montagna, che non nasconde gli avvisi', () => {
    expect(profiloIniziale({ salvato: null, livello: null })).toBe('montagna');
  });

  test('valori illeggibili si trattano come assenti', () => {
    expect(profiloIniziale({ salvato: 'boh', livello: 'boh' })).toBe('montagna');
    expect(profiloIniziale({ salvato: '', livello: 'beginner' })).toBe('imparo');
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/startup-profilo.test.ts`
Atteso: FAIL, `Cannot find module '@/lib/startup-profilo'`.

- [ ] **Step 3: Scrivere l'implementazione minima**

```ts
// src/lib/startup-profilo.ts
import { PROFILI, type Profilo } from './profilo';

/**
 * Il profilo con cui parte l'app.
 *
 * Funzione pura, come `startup-itinerary.ts` fa per l'itinerario: la decisione si
 * verifica senza DOM e senza storage.
 */
export function profiloIniziale(input: { salvato: string | null; livello: string | null }): Profilo {
  if (input.salvato != null && PROFILI.includes(input.salvato as Profilo)) {
    return input.salvato as Profilo;
  }
  if (input.livello === 'beginner') return 'imparo';
  if (input.livello === 'expert') return 'montagna';
  // Nessuna informazione: il default non nasconde gli avvisi di sicurezza.
  return 'montagna';
}
```

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/startup-profilo.test.ts`
Atteso: PASS, 4 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/startup-profilo.ts src/__tests__/startup-profilo.test.ts
git commit -m "feat(profilo): il profilo iniziale come funzione pura"
```

---

### Task 3: Lo stato nello store, persistito e idratato

**Files:**
- Modify: `src/stores/uiStore.ts` (interfaccia `UIState` righe 3-33, e il corpo dello store)
- Modify: `src/lib/storage.ts` (oggetto `KEYS`, righe 8-19)
- Modify: `src/app/page.tsx` (l'effetto di avvio, accanto a quello che ripristina l'itinerario)
- Test: `src/__tests__/profilo-store.test.ts`

**Interfaces:**
- Consumes: `profiloIniziale`, `Profilo`.
- Produces: `useUIStore().profilo: Profilo`; `useUIStore().setProfilo(p: Profilo): void`;
  `KEYS.profilo === 'trektrak_profilo'`.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// src/__tests__/profilo-store.test.ts
import { useUIStore } from '@/stores/uiStore';
import { KEYS } from '@/lib/storage';

describe('il profilo nello store', () => {
  beforeEach(() => localStorage.clear());

  test('la chiave di persistenza esiste', () => {
    expect(KEYS.profilo).toBe('trektrak_profilo');
  });

  test('setProfilo cambia lo stato e lo scrive su storage', () => {
    useUIStore.getState().setProfilo('imparo');
    expect(useUIStore.getState().profilo).toBe('imparo');
    expect(localStorage.getItem(KEYS.profilo)).toBe('imparo');
  });

  test('cambiare profilo non cancella le impostazioni ne l itinerario', () => {
    localStorage.setItem(KEYS.settings, '{"tenuto":true}');
    localStorage.setItem('trektrak_current_itinerary', '{"tenuto":true}');
    useUIStore.getState().setProfilo('montagna');
    expect(localStorage.getItem(KEYS.settings)).toBe('{"tenuto":true}');
    expect(localStorage.getItem('trektrak_current_itinerary')).toBe('{"tenuto":true}');
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/profilo-store.test.ts`
Atteso: FAIL, `KEYS.profilo` è `undefined`.

- [ ] **Step 3: Aggiungere la chiave, lo stato e l'azione**

In `src/lib/storage.ts`, dentro `KEYS`:

```ts
  /** Profilo d'uso: decide quali aree dell'app esistono a schermo. */
  profilo: 'trektrak_profilo',
```

In `src/stores/uiStore.ts`, nell'interfaccia `UIState`:

```ts
  /**
   * Profilo d'uso. Diverso da `appMode` dell'itinerario: quello decide come si
   * compilano i valori, questo quali aree si vedono.
   */
  profilo: Profilo;
  setProfilo: (p: Profilo) => void;
```

e nel corpo dello store:

```ts
  profilo: 'montagna',
  setProfilo: (p) => {
    set({ profilo: p });
    try { localStorage.setItem(KEYS.profilo, p); } catch { /* storage non disponibile */ }
  },
```

con gli import `import { type Profilo } from '@/lib/profilo';` e
`import { KEYS } from '@/lib/storage';`.

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/profilo-store.test.ts`
Atteso: PASS, 3 test.

- [ ] **Step 5: Idratare all'avvio**

In `src/app/page.tsx`, accanto all'effetto che ripristina l'itinerario:

```tsx
  // Profilo d'uso all'avvio. La decisione e' in `profiloIniziale`, qui c'e' solo la
  // lettura dello storage: cosi' la logica si verifica senza DOM.
  useEffect(() => {
    let salvato: string | null = null;
    let livello: string | null = null;
    try {
      salvato = localStorage.getItem(KEYS.profilo);
      livello = localStorage.getItem(KEYS.userLevel);
    } catch { /* storage non disponibile */ }
    useUIStore.getState().setProfilo(profiloIniziale({ salvato, livello }));
  }, []);
```

- [ ] **Step 6: Controllo completo e commit**

Run: `npm run check`
Atteso: tutto verde.

```bash
git add src/stores/uiStore.ts src/lib/storage.ts src/app/page.tsx src/__tests__/profilo-store.test.ts
git commit -m "feat(profilo): stato nello store, persistenza e idratazione all'avvio"
```

---

### Task 4: L'onboarding imposta il profilo

**Files:**
- Modify: `src/components/tutorial/LearnTutorial.tsx:225-235` (`handleChooseLevel`)
- Test: `src/__tests__/components/OnboardingProfilo.test.tsx`

**Interfaces:**
- Consumes: `useUIStore().setProfilo`.
- Produces: niente di nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/OnboardingProfilo.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LearnTutorial } from '@/components/tutorial/LearnTutorial';
import { useUIStore } from '@/stores/uiStore';
import { useItineraryStore } from '@/stores/itineraryStore';

describe('la scelta dell onboarding decide il profilo', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ profilo: 'montagna' });
  });

  test('"Sto imparando" imposta profilo Imparo e modalita Learn', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /Sto imparando/ }));
    expect(useUIStore.getState().profilo).toBe('imparo');
    expect(useItineraryStore.getState().appMode).toBe('learn');
  });

  test('"Sono esperto" imposta profilo Montagna e modalita Track', () => {
    render(<LearnTutorial />);
    fireEvent.click(screen.getByRole('button', { name: /Sono esperto/ }));
    expect(useUIStore.getState().profilo).toBe('montagna');
    expect(useItineraryStore.getState().appMode).toBe('track');
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/OnboardingProfilo.test.tsx`
Atteso: FAIL sul primo test, `profilo` resta `montagna`.

- [ ] **Step 3: Collegare la risposta al profilo**

In `handleChooseLevel`:

```tsx
  const handleChooseLevel = (level: 'beginner' | 'expert') => {
    setAppMode(level === 'beginner' ? 'learn' : 'track');
    // La stessa risposta decide anche QUALI AREE esistono: prima impostava solo il
    // modo di compilare i valori, e restava a meta' del suo mestiere.
    setProfilo(level === 'beginner' ? 'imparo' : 'montagna');
    try {
      localStorage.setItem(KEYS.userLevel, level);
    } catch {
      // localStorage unavailable
    }
    setLivelloScelto(level);
  };
```

con `const setProfilo = useUIStore((s) => s.setProfilo);` fra gli hook del componente.

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/OnboardingProfilo.test.tsx`
Atteso: PASS, 2 test.

- [ ] **Step 5: Commit**

```bash
git add src/components/tutorial/LearnTutorial.tsx src/__tests__/components/OnboardingProfilo.test.tsx
git commit -m "feat(profilo): la domanda dell'onboarding decide anche cosa si vede"
```

---

### Task 5: In Imparo la mappa perde emergenza e avviso di allerta

**Files:**
- Modify: `src/components/map/InteractiveMap.tsx:227-228` (`EmergencyLayersButton`, `EmergencyLayersPanel`)
- Modify: `src/app/page.tsx:291` (`DpcPositionWarning`)
- Test: `src/__tests__/components/ProfiloMappa.test.tsx`

**Interfaces:**
- Consumes: `mostra`, `useUIStore().profilo`.
- Produces: niente di nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/ProfiloMappa.test.tsx
import { render, screen } from '@testing-library/react';
import { EmergencyLayersButton } from '@/components/map/emergency/EmergencyLayersButton';
import { useUIStore } from '@/stores/uiStore';

describe('in Imparo la mappa non offre i layer di emergenza', () => {
  test('in Montagna il pulsante c e', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<EmergencyLayersButton />);
    expect(screen.getByRole('button', { name: /Layer di emergenza/ })).toBeInTheDocument();
  });

  test('in Imparo il pulsante non e nel DOM', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<EmergencyLayersButton />);
    expect(screen.queryByRole('button', { name: /Layer di emergenza/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/ProfiloMappa.test.tsx`
Atteso: FAIL sul secondo test, il pulsante c'è comunque.

- [ ] **Step 3: Applicare il profilo**

In `src/components/map/emergency/EmergencyLayersButton.tsx`, in cima al componente:

```tsx
  const profilo = useUIStore((s) => s.profilo);
  // In Imparo si sta a casa su una carta: i layer di emergenza non si montano affatto,
  // cosi' non partono nemmeno le loro chiamate di rete.
  if (!mostra('layerEmergenza', profilo)) return null;
```

Lo stesso in `EmergencyLayersPanel.tsx` (subito prima di `if (!open) return null;`) e in
`src/components/shared/DpcPositionWarning.tsx` con l'area `allertaPosizione`.

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/ProfiloMappa.test.tsx`
Atteso: PASS, 2 test.

- [ ] **Step 5: Controllo completo e commit**

Run: `npm run check`

```bash
git add src/components/map/emergency/EmergencyLayersButton.tsx src/components/map/emergency/EmergencyLayersPanel.tsx src/components/shared/DpcPositionWarning.tsx src/__tests__/components/ProfiloMappa.test.tsx
git commit -m "feat(profilo): in Imparo la mappa non offre emergenza ne avviso di allerta"
```

---

### Task 6: In Imparo spariscono Meteo e gli export dei dati

**Files:**
- Modify: `src/components/panel/MoreMenu.tsx` (voce Meteo, voce GPX)
- Modify: `src/components/panel/ActionBar.tsx` (pulsanti GPX, Esporta/Importa JSON, Copia link)
- Test: `src/__tests__/components/ProfiloExport.test.tsx`

**Interfaces:**
- Consumes: `mostra`, `useUIStore().profilo`.
- Produces: niente di nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/ProfiloExport.test.tsx
import { render, screen } from '@testing-library/react';
import { ActionBar } from '@/components/panel/ActionBar';
import { useUIStore } from '@/stores/uiStore';

const conProfilo = (p: 'imparo' | 'montagna') => {
  useUIStore.setState({ profilo: p });
  render(<ActionBar />);
};

describe('gli export in Imparo', () => {
  test('il PDF resta: serve a portarsi l esercizio su carta', () => {
    conProfilo('imparo');
    expect(screen.getByRole('button', { name: /PDF Sintetico/i })).toBeInTheDocument();
  });

  test('GPX e copia link non ci sono', () => {
    conProfilo('imparo');
    expect(screen.queryByRole('button', { name: /^GPX$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copia link/i })).not.toBeInTheDocument();
  });

  test('in Montagna ci sono tutti', () => {
    conProfilo('montagna');
    expect(screen.getByRole('button', { name: /^GPX$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copia link/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/ProfiloExport.test.tsx`
Atteso: FAIL sul secondo test.

- [ ] **Step 3: Applicare il profilo**

In `ActionBar.tsx`, avvolgere i pulsanti GPX, Esporta JSON, Importa JSON e Copia link:

```tsx
  const profilo = useUIStore((s) => s.profilo);
  const datiVisibili = mostra('exportDati', profilo);
```

```tsx
  {datiVisibili && (
    <button onClick={handleGPX} /* ...invariato... */>GPX</button>
  )}
```

In `MoreMenu.tsx`, la voce Meteo con `mostra('meteo', profilo)` e la voce GPX con
`mostra('exportDati', profilo)`. Le due voci PDF restano sempre.

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/ProfiloExport.test.tsx`
Atteso: PASS, 3 test.

- [ ] **Step 5: Controllo completo e commit**

Run: `npm run check`

```bash
git add src/components/panel/ActionBar.tsx src/components/panel/MoreMenu.tsx src/__tests__/components/ProfiloExport.test.tsx
git commit -m "feat(profilo): in Imparo restano i PDF, spariscono meteo e export dati"
```

---

### Task 7: In Imparo sparisce la libreria condivisa

**Files:**
- Modify: `src/components/panel/BottomNav.tsx:7-9` (elenco destinazioni)
- Modify: `src/components/panel/LeftPanel.tsx` (vista `library`)
- Modify: `src/components/panel/ActionBar.tsx` (pulsanti Salva e Carica)
- Test: `src/__tests__/components/ProfiloLibreria.test.tsx`

**Interfaces:**
- Consumes: `mostra`, `useUIStore().profilo`.
- Produces: niente di nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/ProfiloLibreria.test.tsx
import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/panel/BottomNav';
import { useUIStore } from '@/stores/uiStore';

describe('la libreria per profilo', () => {
  test('in Montagna la Libreria e una destinazione', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: /Libreria/ })).toBeInTheDocument();
  });

  test('in Imparo non c e', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<BottomNav />);
    expect(screen.queryByRole('button', { name: /Libreria/ })).not.toBeInTheDocument();
  });

  /** Le altre destinazioni restano: togliere una voce non deve rompere la barra. */
  test('Mappa, Editor e Altro restano in entrambi', () => {
    for (const p of ['imparo', 'montagna'] as const) {
      useUIStore.setState({ profilo: p });
      const { unmount } = render(<BottomNav />);
      expect(screen.getByRole('button', { name: /Mappa/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Editor/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Altro/ })).toBeInTheDocument();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/ProfiloLibreria.test.tsx`
Atteso: FAIL sul secondo test.

- [ ] **Step 3: Filtrare le destinazioni**

In `BottomNav.tsx`:

```tsx
  const profilo = useUIStore((s) => s.profilo);
  // La Libreria e' la libreria CONDIVISA dei percorsi: roba da gita vera.
  const destinazioni = TABS.filter((t) => t.key !== 'library' || mostra('libreria', profilo));
```

e iterare su `destinazioni` invece di `TABS`.

In `LeftPanel.tsx`, se la vista richiesta è `library` e `mostra('libreria', profilo)` è
falso, mostrare l'editor: è la guardia per chi cambia profilo mentre è in libreria.

In `ActionBar.tsx`, avvolgere Salva e Carica in `mostra('libreria', profilo)`.

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/ProfiloLibreria.test.tsx`
Atteso: PASS, 3 test.

- [ ] **Step 5: Controllo completo e commit**

Run: `npm run check`

```bash
git add src/components/panel/BottomNav.tsx src/components/panel/LeftPanel.tsx src/components/panel/ActionBar.tsx src/__tests__/components/ProfiloLibreria.test.tsx
git commit -m "feat(profilo): in Imparo la libreria condivisa non compare"
```

---

### Task 8: In Montagna spariscono validazione e tips dalle schede

**Files:**
- Modify: `src/components/panel/WaypointCard.tsx` (badge di validazione)
- Modify: `src/components/panel/LegCard.tsx` (badge di validazione)
- Modify: `src/components/validation/ValidationBadge.tsx` (guardia unica)
- Test: `src/__tests__/components/ProfiloValidazione.test.tsx`

**Interfaces:**
- Consumes: `mostra`, `useUIStore().profilo`.
- Produces: niente di nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/ProfiloValidazione.test.tsx
import { render, screen } from '@testing-library/react';
import { ValidationBadge } from '@/components/validation/ValidationBadge';
import { useUIStore } from '@/stores/uiStore';
import type { ValidationResult } from '@/lib/types';

const risultato: ValidationResult = {
  status: 'error', realValue: 3.161, userValue: 2.4, delta: 0.761,
  tolerance: { strict: 0.05, loose: 0.1 },
};

describe('i badge di validazione per profilo', () => {
  test('in Imparo il badge c e', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ValidationBadge result={risultato} fieldType="distance" />);
    expect(screen.getByRole('button', { name: /valore sbagliato/i })).toBeInTheDocument();
  });

  test('in Montagna non c e: i valori li calcola l app, non c e nulla da verificare', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ValidationBadge result={risultato} fieldType="distance" />);
    expect(screen.queryByRole('button', { name: /valore sbagliato/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/ProfiloValidazione.test.tsx`
Atteso: FAIL sul secondo test.

- [ ] **Step 3: Una guardia sola, nel badge**

In `ValidationBadge.tsx`, in cima al componente:

```tsx
  const profilo = useUIStore((s) => s.profilo);
  // Una guardia sola qui invece di una in ogni scheda: il badge e' l'unico punto da cui
  // la validazione arriva a schermo, e cosi' non se ne dimentica una.
  if (!mostra('validazione', profilo)) return null;
```

Nei `WaypointCard`/`LegCard` non serve altro: i tips vivono dentro il popover del badge.

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/ProfiloValidazione.test.tsx`
Atteso: PASS, 2 test.

- [ ] **Step 5: Controllo completo e commit**

Run: `npm run check`
Atteso: verde. Se un test esistente di `WaypointCard`/`LegCard` fallisce perché si
aspetta i badge, impostare `profilo: 'imparo'` nel suo `beforeEach` e scrivere nel test
perché.

```bash
git add src/components/validation/ValidationBadge.tsx src/__tests__/components/ProfiloValidazione.test.tsx
git commit -m "feat(profilo): in Montagna non ci sono badge di validazione"
```

---

### Task 9: In Montagna spariscono Verifica, Progresso e quiz

**Files:**
- Modify: `src/components/panel/ActionBar.tsx` (pulsanti Verifica e Progresso)
- Modify: `src/components/map/MapToolsFab.tsx:6-8` (elenco strumenti)
- Test: `src/__tests__/components/ProfiloDidattica.test.tsx`

**Interfaces:**
- Consumes: `mostra`, `useUIStore().profilo`.
- Produces: niente di nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/ProfiloDidattica.test.tsx
import { render, screen } from '@testing-library/react';
import { ActionBar } from '@/components/panel/ActionBar';
import { MapToolsFab } from '@/components/map/MapToolsFab';
import { useUIStore } from '@/stores/uiStore';

describe('le funzioni didattiche per profilo', () => {
  test('in Montagna Verifica e Progresso non ci sono', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ActionBar />);
    expect(screen.queryByRole('button', { name: /^Verifica$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Progresso/ })).not.toBeInTheDocument();
  });

  test('in Imparo ci sono', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ActionBar />);
    expect(screen.getByRole('button', { name: /^Verifica$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Progresso/ })).toBeInTheDocument();
  });

  test('il quiz sparisce dagli strumenti in Montagna, bussola e righello restano', () => {
    useUIStore.setState({ profilo: 'montagna', toolsFabOpen: true });
    render(<MapToolsFab />);
    expect(screen.queryByRole('button', { name: /Attiva quiz/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attiva bussola/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attiva righello/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/ProfiloDidattica.test.tsx`
Atteso: FAIL sul primo e sul terzo test.

- [ ] **Step 3: Applicare il profilo**

In `ActionBar.tsx`, avvolgere Verifica in `mostra('validazione', profilo)` e Progresso
in `mostra('progresso', profilo)`.

In `MapToolsFab.tsx`:

```tsx
  const profilo = useUIStore((s) => s.profilo);
  const strumenti = TOOLS.filter((t) => t.key !== 'quiz' || mostra('quiz', profilo));
```

e iterare su `strumenti`.

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/ProfiloDidattica.test.tsx`
Atteso: PASS, 3 test.

- [ ] **Step 5: Controllo completo e commit**

Run: `npm run check`

```bash
git add src/components/panel/ActionBar.tsx src/components/map/MapToolsFab.tsx src/__tests__/components/ProfiloDidattica.test.tsx
git commit -m "feat(profilo): in Montagna via Verifica, Progresso e quiz"
```

---

### Task 10: In Montagna l'interruttore Learn/Track non si mostra e il modo è Track

**Files:**
- Modify: `src/components/panel/ModeSwitch.tsx`
- Modify: `src/app/page.tsx` (effetto che allinea `appMode` al profilo)
- Test: `src/__tests__/components/ProfiloModo.test.tsx`

**Interfaces:**
- Consumes: `mostra`, `useUIStore().profilo`, `useItineraryStore().setAppMode`.
- Produces: niente di nuovo.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/ProfiloModo.test.tsx
import { render, screen } from '@testing-library/react';
import { ModeSwitch } from '@/components/panel/ModeSwitch';
import { useUIStore } from '@/stores/uiStore';

describe('l interruttore Learn/Track per profilo', () => {
  test('in Imparo c e: il confronto stimato-vs-reale vive in quel passaggio', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ModeSwitch />);
    expect(screen.getByRole('tab', { name: 'Learn' })).toBeInTheDocument();
  });

  test('in Montagna non c e', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ModeSwitch />);
    expect(screen.queryByRole('tab', { name: 'Learn' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/ProfiloModo.test.tsx`
Atteso: FAIL sul secondo test.

- [ ] **Step 3: Nascondere l'interruttore e allineare il modo**

In `ModeSwitch.tsx`, in cima:

```tsx
  const profilo = useUIStore((s) => s.profilo);
  if (!mostra('switchLearnTrack', profilo)) return null;
```

In `page.tsx`, un effetto:

```tsx
  // In Montagna i valori li calcola l'app. I valori inseriti a mano NON si perdono:
  // `learnValues` e `trackValues` stanno in parallelo dalla v0.7.0, quindi tornando in
  // Imparo si rivedono.
  useEffect(() => {
    if (profilo === 'montagna' && appMode !== 'track') setAppMode('track');
  }, [profilo, appMode, setAppMode]);
```

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/ProfiloModo.test.tsx`
Atteso: PASS, 2 test.

- [ ] **Step 5: Controllo completo e commit**

Run: `npm run check`

```bash
git add src/components/panel/ModeSwitch.tsx src/app/page.tsx src/__tests__/components/ProfiloModo.test.tsx
git commit -m "feat(profilo): in Montagna il modo e sempre Track, senza perdere i valori a mano"
```

---

### Task 11: L'interruttore visibile, con l'avviso al primo cambio

**Files:**
- Create: `src/components/shared/ProfiloSwitch.tsx`
- Modify: `src/components/panel/MoreMenu.tsx` (voce su mobile)
- Modify: `src/components/panel/LeftPanel.tsx` (voce su desktop)
- Test: `src/__tests__/components/ProfiloSwitch.test.tsx`

**Interfaces:**
- Consumes: `useUIStore().profilo` e `setProfilo`, `ETICHETTE_PROFILO`.
- Produces: componente `<ProfiloSwitch />`.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
// src/__tests__/components/ProfiloSwitch.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfiloSwitch } from '@/components/shared/ProfiloSwitch';
import { useUIStore } from '@/stores/uiStore';

describe('l interruttore del profilo', () => {
  beforeEach(() => useUIStore.setState({ profilo: 'montagna' }));

  test('dice il profilo corrente per nome', () => {
    render(<ProfiloSwitch />);
    expect(screen.getByRole('button', { name: /Vado in montagna/ })).toBeInTheDocument();
  });

  test('cambiarlo passa all altro profilo', () => {
    render(<ProfiloSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /Vado in montagna/ }));
    expect(useUIStore.getState().profilo).toBe('imparo');
  });

  /** Funzioni nascoste sono funzioni non scoperte: al primo cambio si dice cosa cambia. */
  test('al primo cambio spiega cosa e comparso e cosa e sparito', () => {
    render(<ProfiloSwitch />);
    fireEvent.click(screen.getByRole('button', { name: /Vado in montagna/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/quiz|verifica|emergenza/i);
  });
});
```

- [ ] **Step 2: Lanciarlo per vederlo fallire**

Run: `npx jest src/__tests__/components/ProfiloSwitch.test.tsx`
Atteso: FAIL, `Cannot find module`.

- [ ] **Step 3: Scrivere il componente**

```tsx
// src/components/shared/ProfiloSwitch.tsx
'use client';

import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { ETICHETTE_PROFILO, type Profilo } from '@/lib/profilo';

const SPIEGAZIONE: Record<Profilo, string> = {
  imparo: 'Ora ci sono verifica, quiz e progressi. Layer di emergenza, meteo e libreria sono nascosti.',
  montagna: 'Ora ci sono layer di emergenza, meteo e libreria. Verifica, quiz e progressi sono nascosti.',
};

/**
 * Cambia profilo d'uso.
 *
 * Sta in vista e dice il profilo per nome, non sepolto nelle impostazioni: un modo che
 * nasconde funzioni deve rendere evidente che esiste l'altro modo.
 */
export function ProfiloSwitch() {
  const profilo = useUIStore((s) => s.profilo);
  const setProfilo = useUIStore((s) => s.setProfilo);
  const [spiegazione, setSpiegazione] = useState<string | null>(null);

  const cambia = () => {
    const nuovo: Profilo = profilo === 'imparo' ? 'montagna' : 'imparo';
    setProfilo(nuovo);
    setSpiegazione(SPIEGAZIONE[nuovo]);
  };

  return (
    <div>
      <button
        onClick={cambia}
        className="w-full text-left px-3 min-h-[44px] flex items-center gap-2 text-sm text-gray-200 rounded hover:bg-white/5"
      >
        🎛️ Modalità: {ETICHETTE_PROFILO[profilo]}
      </button>
      {spiegazione && (
        <p role="status" className="px-3 py-2 text-[11px] text-amber-300/90 leading-snug">
          {spiegazione}
        </p>
      )}
    </div>
  );
}
```

Montarlo in `MoreMenu.tsx` come prima voce e in `LeftPanel.tsx` (visibile da `lg:`).

- [ ] **Step 4: Lanciare i test**

Run: `npx jest src/__tests__/components/ProfiloSwitch.test.tsx`
Atteso: PASS, 3 test.

- [ ] **Step 5: Controllo completo e commit**

Run: `npm run check`

```bash
git add src/components/shared/ProfiloSwitch.tsx src/components/panel/MoreMenu.tsx src/components/panel/LeftPanel.tsx src/__tests__/components/ProfiloSwitch.test.tsx
git commit -m "feat(profilo): l'interruttore in vista, con la spiegazione al primo cambio"
```

---

### Task 12: La guardia contro l'area dichiarata e mai applicata

**Files:**
- Create: `src/__tests__/aree-applicate.test.ts`

**Interfaces:**
- Consumes: `AREE`.
- Produces: niente.

- [ ] **Step 1: Scrivere il test**

```ts
// src/__tests__/aree-applicate.test.ts
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { AREE } from '@/lib/profilo';

/**
 * Un'area dichiarata nella tabella e mai usata da nessun componente e' un pulsante che
 * credo di aver nascosto e che invece e' ancora a schermo.
 *
 * E' la forma che prenderebbe qui il difetto che in questo progetto e' gia' passato due
 * volte: il campo scritto e mai riletto (`trektrak_user_level` nella v0.11.8, `slim`
 * nella v0.13.1). Quando un mio errore si ripete, la risposta e' un controllo
 * automatico, non piu' attenzione.
 */
function sorgenti(dir: string, out: string[] = []): string[] {
  for (const voce of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === '__tests__' || voce.name === 'node_modules') continue;
      sorgenti(p, out);
    } else if (voce.name.endsWith('.tsx') || voce.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

describe('ogni area della tabella e applicata da qualcuno', () => {
  const testo = sorgenti(join(process.cwd(), 'src'))
    .filter((f) => !f.endsWith(join('lib', 'profilo.ts')))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  test.each(Object.keys(AREE))('l area %s e usata in un componente', (area) => {
    expect(testo).toContain(`'${area}'`);
  });
});
```

- [ ] **Step 2: Lanciarlo**

Run: `npx jest src/__tests__/aree-applicate.test.ts`
Atteso: PASS per tutte le aree applicate nei Task 5-10. Se una fallisce, l'area è
dichiarata e non applicata: applicarla o togliere la riga dalla tabella.

- [ ] **Step 3: Verificarlo per mutazione**

Aggiungere temporaneamente a `AREE` la riga `inventata: ['imparo'],`, rilanciare il
test e vederlo fallire su `inventata`. Poi togliere la riga e rilanciare: verde.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/aree-applicate.test.ts
git commit -m "test(profilo): un area dichiarata e mai applicata fa fallire la suite"
```

---

### Task 13: Novità, misura a schermo, rilascio

**Files:**
- Modify: `src/components/tutorial/WhatsNew.tsx` (nuova voce in `RELEASES`)
- Modify: `CHANGELOG.md`, `package.json`

**Interfaces:** niente.

- [ ] **Step 1: Aggiungere la voce delle novità**

In `RELEASES`, come primo elemento, una voce con `version` della release in uscita e i
passi che spiegano il profilo: cos'è, dove si cambia, che nulla è stato rimosso.

- [ ] **Step 2: Costruire e misurare a schermo**

```bash
npx kill-port 3000 && npm run build && npm start
```

Nel browser, a 412×823, per ciascun profilo contare i comandi visibili nella vista
Mappa e nell'Editor con 4 waypoint, e confrontarli con i valori di partenza: **21** e
**112**. Attese: in Imparo la vista Mappa perde 3 dei 12 ingressi nominati; in Montagna
l'Editor perde i badge di validazione (una ventina con 4 waypoint) più Verifica e
Progresso.

Registrare i numeri misurati nel messaggio di commit: se una differenza è zero, un'area
non è stata applicata e il Task 12 non l'ha preso.

- [ ] **Step 3: Provare a mano il giro completo**

- Onboarding da storage pulito: "Sto imparando" → nessun pulsante emergenza, nessun
  Meteo, nessuna Libreria, ma Verifica e quiz presenti.
- Cambiare in "Vado in montagna" dall'interruttore: comparsa dei layer, sparizione di
  Verifica, avviso che lo spiega.
- Tornare in Imparo: i valori inseriti a mano ci sono ancora, i layer che erano accesi
  sono ancora accesi nelle impostazioni.

- [ ] **Step 4: Controllo completo**

Run: `npm run check` e `TZ=UTC npx jest`
Atteso: verde entrambi.

- [ ] **Step 5: Rilascio**

Aggiornare `CHANGELOG.md` e `package.json`, commit `chore(release)`, merge su `master`
con `--no-ff`, tag annotato, push di `master`, del tag e di `develop`.

---

## Autoverifica del piano

**Copertura della spec:**

| Requisito della spec | Task |
|---|---|
| Tabella dichiarativa e `mostra` | 1 |
| Profilo iniziale, con migrazione da `user_level` | 2, 3 |
| Stato, persistenza, idratazione | 3 |
| L'onboarding imposta il profilo | 4 |
| Imparo: via layer emergenza e allerta posizione | 5 |
| Imparo: via meteo ed export dati, PDF resta | 6 |
| Imparo: via libreria | 7 |
| Montagna: via validazione e tips | 8 |
| Montagna: via Verifica, Progresso, quiz | 9 |
| Montagna: via switch Learn/Track, `appMode` = track | 10 |
| Interruttore visibile e avviso al primo cambio | 11 |
| Guardia sull'area dichiarata e mai applicata | 12 |
| Nessun dato cancellato | 3 (test), 13 (prova a mano) |
| Misura a schermo | 13 |

**Nessun segnaposto:** ogni passo porta il codice o il comando da eseguire.

**Coerenza dei nomi:** `mostra(area, profilo)`, `AREE`, `Area`, `Profilo`,
`PROFILI`, `ETICHETTE_PROFILO`, `profiloIniziale({ salvato, livello })`,
`useUIStore().profilo`, `setProfilo`, `KEYS.profilo` — usati con gli stessi nomi dal
Task 1 al Task 13.
