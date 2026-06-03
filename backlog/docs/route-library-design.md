# Design — Libreria percorsi + diario completamenti

**Data:** 2026-06-03
**Stato:** Approvato (brainstorming) — pronto per il piano
**Versione target:** v0.8.0 (tentativa)

## Sommario

Trasformare l'attuale sistema salva/carica itinerari in una vera **Libreria percorsi**:
una vista dedicata con lista numerata e ordinabile dei percorsi salvati; selezionando un
percorso se ne vede l'anteprima read-only sulla mappa grande, con una scheda che mostra
le metriche (km, D+, D-, alt. min/max, pendenza media e max), le note del percorso e un
**diario dei completamenti** (chi, quando, tempo impiegato, note).

## Contesto: cosa esiste già

- `src/lib/storage.ts` persiste gli itinerari in localStorage (`trektrak_itineraries`) con
  `saveItinerary`/`loadItinerary`/`deleteItinerary` e migration versionate (schema v2).
- `ItineraryHeader.tsx` ha i pulsanti **Salva** (snapshot del percorso corrente) e **Carica**.
- **Carica** apre `SavedItinerariesModal.tsx`: una modale con nome, n° waypoint, data, e
  azioni Carica/Elimina.
- Le metriche aggregate (km, D+, D-, tempo Munter, pendenza max, difficoltà SAC) sono già
  calcolate inline in `SummaryBar.tsx` / `ActionBar.tsx` a partire da waypoint + leg.

La feature **estende e unifica** questo sistema invece di crearne uno parallelo.

## Decisioni di design (dal brainstorming)

1. **Estendere ed unificare** il modello `Itinerary` esistente; sostituire la modale con la tab.
2. **Click su un percorso = anteprima read-only** sulla mappa, con pulsante esplicito
   "Carica nell'editor".
3. **Lista numerata + riordino manuale drag-and-drop** (@dnd-kit, già presente) +
   sort-by "soft" che non distrugge l'ordine manuale.
4. **Switch top-level Editor ↔ Libreria** in cima al pannello sinistro.
5. **Campo persona = testo libero con autocomplete** (`<input list>` su nomi già usati).
6. **Pendenza media** = media delle pendenze di tratta pesata sulla distanza.
7. Il completamento include **tempo impiegato**; lo snapshot metriche include
   `estimatedTimeMin` per il confronto **reale vs stima Munter**.

---

## Sezione A — Modello dati e storage

### Nuovi tipi (`src/lib/types.ts`)

```ts
export interface RouteCompletion {
  id: string;
  personName: string;        // chi ha completato
  date: string;              // ISO "YYYY-MM-DD"
  durationMinutes?: number;  // tempo impiegato a percorrerlo (opzionale)
  notes: string;             // note aggiuntive
}

export interface RouteMetrics {
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
  minAltitude: number | null;
  maxAltitude: number | null;
  avgSlope: number;          // % — media pendenze di tratta pesata sulla distanza
  maxSlope: number;          // % — max pendenza di tratta (riusa calculateSlope)
  estimatedTimeMin: number;  // stima Munter totale, per confronto reale vs stima
}
```

`Itinerary` guadagna 4 campi **opzionali** (retrocompatibili):

```ts
notes?: string;
completions?: RouteCompletion[];
metrics?: RouteMetrics;
sortIndex?: number;
```

### Metriche (`src/lib/calculations.ts`)

Nuova funzione pura `computeRouteMetrics(waypoints, legs): RouteMetrics`:

> **Importante:** i campi derivati `leg.slope` e `leg.estimatedTime` vengono eliminati dai dati
> persistiti (slimming). `computeRouteMetrics` deve quindi **ricalcolarli internamente** via
> `calculateSlope`/`calculateMunterTime`, così funziona identicamente a save-time (legs completi
> in memoria) e durante la migration (legs slim da localStorage). Non legge `leg.slope`/`leg.estimatedTime`.

- `distanceKm`, `elevationGain`, `elevationLoss`: somma di `leg.distance`/`elevationGain`/`elevationLoss`.
- `estimatedTimeMin`: somma di `calculateMunterTime(distₗ, gainₗ, lossₗ, paceFactor)` (paceFactor
  passato come argomento, default 1).
- `maxSlope`: `max(calculateSlope(distₗ, gainₗ, lossₗ))`.
- `avgSlope`: `Σ(slopeₗ · distₗ) / Σ distₗ` con `slopeₗ = calculateSlope(...)` (media pesata sulla
  distanza; 0 se distanza totale = 0).
- `minAltitude`/`maxAltitude`: min/max tra le altitudini dei waypoint **e** i punti degli
  `elevationProfile` dei leg quando presenti in memoria. Calcolate a **save-time**, prima che
  lo slimming elimini i profili. `null` se nessuna quota disponibile.

### Storage (`src/lib/storage.ts`)

- `SCHEMA_VERSION` 2 → **3**.
- `migration[2]`: per ogni itinerario salvato → `notes ?? ''`, `completions ?? []`,
  `sortIndex` = indice corrente nella lista, e ricalcola `metrics` dai dati slim disponibili
  (min/max altitudine solo dalle quote dei waypoint, dato che i profili dei salvataggi vecchi
  sono già stati eliminati). Idempotente (salta se i campi esistono già).
- Validatori `loadItineraries`: i 4 nuovi campi sono opzionali → i percorsi vecchi **non**
  vengono scartati. `completions` malformati vengono filtrati elemento per elemento
  (`isValidCompletion`); `metrics` malformato → `undefined`.
- `saveItinerary`: persiste i nuovi campi insieme allo slim di leg/waypoint già esistente.
- Nuovi helper che operano sulla lista persistita (non sull'editor attivo):
  - `updateSavedItinerary(id, patch: Partial<Itinerary>): void`
  - `reorderSavedItineraries(orderedIds: string[]): void` (riscrive `sortIndex`)
  - `addCompletion(routeId, c: Omit<RouteCompletion,'id'>): void`
  - `updateCompletion(routeId, completionId, patch): void`
  - `deleteCompletion(routeId, completionId): void`
  - `getKnownPeople(): string[]` — nomi distinti (trim + dedupe case-insensitive) per autocomplete.

### Store libreria (`src/stores/routeLibraryStore.ts`)

Zustand, separato dall'editor:

- stato: `routes: Itinerary[]`, `selectedRouteId: string | null`, `sortMode`.
- azioni: `refresh()` (rilegge da storage), `select(id)`, `clearSelection()`,
  `reorder(orderedIds)`, `remove(id)`, e wrapper per le CRUD dei completamenti che
  invocano lo storage e poi `refresh()`.
- `sortMode`: `'manual' | 'name' | 'distance' | 'gain' | 'updated' | 'completions'`.
  Il sort è "soft" (solo visualizzazione/derivato): `'manual'` rispetta `sortIndex` ed è
  l'unico che il drag modifica.

---

## Sezione B — Layout e UI

### Switch top-level (`src/stores/uiStore.ts` + `MainViewSwitch.tsx`)

- `uiStore` guadagna `mainView: 'editor' | 'library'` + `setMainView`.
- `MainViewSwitch.tsx`: toggle in cima al pannello sinistro.
- `mainView==='editor'` → pannello attuale invariato (ModeSwitch, Modifica/Tabella, SummaryBar, ActionBar).
- `mainView==='library'` → il pannello sinistro mostra `RouteLibrary`.

### `RouteLibrary.tsx` (contenitore della vista Libreria)

Compone:

- **`RouteList.tsx`** — lista numerata (1,2,3…) trascinabile con @dnd-kit. Ogni riga:
  `n°`, handle di trascinamento, titolo, mini-stat (`km · +Dm · 🥾N`), e click → seleziona.
  Sopra la lista, dropdown **sort-by**. Vuota → messaggio "Nessun percorso salvato".
- **`RouteDetailCard.tsx`** — percorso selezionato: titolo, griglia metriche (km, D+, D-,
  alt min/max, pendenza media/max, stima Munter), **note editabili** (textarea con salvataggio
  on-blur via `updateSavedItinerary`), e il diario completamenti. Pulsanti:
  **Carica nell'editor**, **Esporta JSON**, **Elimina**.
- **`CompletionList.tsx`** — entry { persona, data, tempo, note }; badge "🥾 N completamenti"
  + "ultima: gg/mm/aaaa"; ogni entry editabile/eliminabile. Se presente `durationMinutes` e
  `metrics.estimatedTimeMin`, mostra "Xh Ym reali · stima Yh Zm → ±Δ".
- **`CompletionForm.tsx`** — campi: persona (`<input list="known-people">` con autocomplete),
  data (`<input type="date">`, default oggi), tempo (due input *ore* + *minuti* → minuti),
  note (textarea). Validazione: persona non vuota, data parseable. Tempo opzionale.

### Modifiche a componenti esistenti

- `LeftPanel.tsx`: renderizza `MainViewSwitch`; se `mainView==='library'` mostra `RouteLibrary`,
  altrimenti il contenuto editor attuale.
- `ItineraryHeader.tsx`: il pulsante **Carica** diventa `setMainView('library')`. Il pulsante
  **Salva** usa il flusso arricchito (Sezione C).
- **`SavedItinerariesModal.tsx` rimosso** (sostituito dalla Libreria).

---

## Sezione C — Anteprima mappa e salvataggio

### Anteprima read-only

- Nuovo **`PreviewRouteLayer.tsx`**: data una route, disegna polilinea + marker numerati +
  `fitBounds`, **senza** handler di editing. Se la route non ha waypoint con coordinate,
  salta `fitBounds`.
- `InteractiveMap`: se `mainView==='library'` e c'è una route selezionata, renderizza
  `PreviewRouteLayer` al posto dei layer dell'editor. I layer di editing restano invariati per
  `mainView==='editor'`.
- Striscia profilo altimetrico in basso: i percorsi salvati non hanno `elevationProfile`
  (eliminato in salvataggio) → in modalità Libreria mostra un placeholder
  ("Profilo non disponibile per percorsi salvati — vedi metriche").

### Salvataggio arricchito (`ItineraryHeader` "Salva")

- Calcola `computeRouteMetrics(waypoints, legs)` e lo congela in `metrics` **prima** dello slim.
- **Primo salvataggio** (id non presente nella lista): apre `SaveRouteModal.tsx` per confermare
  titolo (default = nome corrente) + note opzionali; assegna `sortIndex = max(sortIndex)+1`
  (append in coda), `completions = []`.
- **Ri-salvataggio** (id esistente): aggiorna waypoint/leg/metrics/`updatedAt` **preservando**
  `notes`, `completions`, `sortIndex`.

### Mobile

- Lo switch Editor/Libreria è nel drawer. Toccando una route in Libreria, il drawer si chiude
  per rivelare l'anteprima sulla mappa, con banner in alto:
  "Anteprima: «nome» — [Modifica] [Chiudi]".

---

## Sezione D — Test ed edge case

### Unit
- `computeRouteMetrics`: profili presenti/assenti, distanze a 0, route con 1 waypoint,
  avgSlope pesata corretta, min/max da waypoint+profili.
- Migration v2→v3: campi default, ricalcolo metrics da dati slim, idempotenza.
- Validatori: tollerano dati vecchi (senza i nuovi campi), filtrano `completions` malformati,
  scartano `metrics` non valido.
- Completion CRUD: add/update/delete, conversione ore+minuti ↔ minuti.
- `getKnownPeople`: trim, dedupe case-insensitive, ordine stabile.
- `reorderSavedItineraries`: riscrive `sortIndex` coerentemente.

### Componenti (smoke)
- `RouteList`: ordine numerato, selezione aggiorna anteprima, drag riordina.
- `CompletionForm`: persona obbligatoria, data valida, tempo opzionale.
- `SaveRouteModal`: precompila nome, salva note.

### Edge case
- Storage pieno → toast già esistente.
- Route senza coordinate → anteprima salta `fitBounds`.
- Date di completamento future ammesse (uso personale).
- Nomi duplicati nell'autocomplete dedotti.

---

## File previsti

**Nuovi:** `routeLibraryStore.ts`, `MainViewSwitch.tsx`, `RouteLibrary.tsx`, `RouteList.tsx`,
`RouteDetailCard.tsx`, `CompletionList.tsx`, `CompletionForm.tsx`, `PreviewRouteLayer.tsx`,
`SaveRouteModal.tsx` (+ relativi test).

**Modificati:** `types.ts`, `storage.ts`, `calculations.ts`, `uiStore.ts`, `LeftPanel.tsx`,
`ItineraryHeader.tsx`, `InteractiveMap.tsx` (+ `ElevationProfile.tsx` per il placeholder).

**Rimosso:** `SavedItinerariesModal.tsx`.
