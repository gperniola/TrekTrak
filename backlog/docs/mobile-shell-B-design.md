# Design — Shell mobile B (bottom navigation)

**Data:** 2026-06-05 · **TASK:** 45 (fase B di TASK-39) · **Stato:** approvato (design)

Ridisegno della navigazione **solo mobile** (`<lg`): sostituisce top-bar densa a 2 righe + hamburger + drawer a tutto schermo con una **bottom navigation**. Il **desktop resta invariato** (sidebar fissa `LeftPanel`). Spec di partenza: `backlog/docs/mobile-usability-analysis.md` (§3 dir. B, §6 stati autenticati, §7 touch target).

## Obiettivi / non-obiettivi

**Obiettivi:** ridurre il carico cognitivo su mobile; rendere scopribili i 3 luoghi dell'app (mappa/editor/libreria); eliminare duplicazioni di shell; portare i tool nel contesto mappa; touch target ≥44px.

**Non-obiettivi:** toccare il layout desktop; cambiare la logica di dominio (calcoli, validazione, sync); riprogettare i singoli form oltre a renderli tap-friendly.

## Decisioni

| # | Tema | Decisione |
|---|---|---|
| 1 | Navigazione | **Bottom nav a 3 schede** (Mappa · Editor · Libreria) + icona **⚙️** in alto a destra |
| 2 | Mappa | Tela **sempre visibile** con profilo altimetrico; Editor/Libreria affiancano/coprono la mappa |
| 3 | Learn/Track | Segmented **nell'header dell'Editor** (non sulla mappa) |
| 4 | Tool mappa | **FAB speed-dial** verticale sulla mappa (Bussola/Righello/Quiz etichettati) |
| 5 | ⚙️ | Solo **impostazioni** (mappa + tolleranze + rivedi tutorial + Info/Novità). Progresso → contestuale a Learn; Account → header Libreria |
| 6 | Trasversale | Touch target ≥44px (TASK-44); libreria lista↔dettaglio (TASK-48); diario tap-friendly (TASK-49) |

## Wireframe testuali (viewport ~390px)

### Scheda "Mappa" (default)
```
┌─────────────────────────────┐
│                          ⚙️ │  ← solo ingranaggio (impostazioni)
│                             │
│           M A P P A         │
│         (tela piena)        │
│                       ╭───╮ │
│                       │🧭 │ │  ← FAB speed-dial (tool)
│                       ╰───╯ │
├─────────────────────────────┤
│  profilo altimetrico        │
├─────────────────────────────┤
│  🗺️ Mappa  ✏️ Editor  📚 Libreria │  ← bottom nav (Mappa attiva)
└─────────────────────────────┘
```
FAB aperto → speed-dial verticale:
```
                 [Quiz]    ❓
                 [Righello]📏
                 [Bussola] 🧭
                           ✕   ← il FAB diventa "chiudi"
```
Tool attivo evidenziato (colore pieno). Mutua esclusione invariata (`uiStore`).

### Scheda "Editor"
```
┌─────────────────────────────┐
│        (mappa ridotta)    ⚙️│  ← mappa resta visibile sopra
├─────────────────────────────┤
│  [ Learn │ Track ]          │  ← segmented modalità (header Editor)
│  Nome itinerario…           │
│  [ Modifica | Tabella ]     │
│  WAYPOINT …                 │
│  ── riepilogo: km/D+/D-/⏱ ──│
│  Esporta ▾   |  Verifica*   │  ← *Verifica+Progresso solo in Learn
├─────────────────────────────┤
│  🗺️ Mappa  ✏️ Editor  📚 Libreria │
└─────────────────────────────┘
```
"Esporta ▾" raggruppa PDF/GPX/Copia link (già disabilitati a vuoto — v0.9.2). In Learn compaiono **Verifica** e **Progresso** (Progresso resta qui, contestuale).

### Scheda "Libreria" (lista ↔ dettaglio — TASK-48)
```
LISTA                          DETTAGLIO (push, con ← indietro)
┌───────────────────────┐      ┌───────────────────────┐
│ Libreria   @utente ▾  │      │ ← Nome percorso        │
│ {n} percorsi   ⇅ordina│      │ km · D+ · D- · ⏱      │
│ ① Percorso A  …       │      │ Note…                  │
│ ② Percorso B  …       │ ───▶ │ Diario uscite          │
│ ③ …                   │      │  · uscita ✎ ✕ (≥44px)  │
│                       │      │ Carica · PDF · Meteo · ⋯│
├───────────────────────┤      ├───────────────────────┤
│ 🗺️  ✏️  📚            │      │ 🗺️  ✏️  📚            │
└───────────────────────┘      └───────────────────────┘
```
Account (`UserHeader`: cambia username / esci) resta in cima alla Libreria. Selezione → anteprima sulla mappa + accesso diretto al dettaglio, senza il giro "chiudi drawer → banner → riapri".

### ⚙️ Impostazioni (sheet/overlay)
```
Impostazioni
 · Mappa (base, sentieri, griglia, percorso colorato, trail routing)
 · Tolleranze (didattica)
 · Rivedi tutorial
 · Novità / Info
```

## Mappatura dei controlli (da → a)

| Oggi (mobile) | Domani |
|---|---|
| Hamburger ☰ + drawer a tutto schermo | **rimosso** (bottom nav) |
| Top-bar riga 2: tool ◎↕? | **FAB speed-dial** sulla mappa |
| Top-bar: Learn/Track | **header Editor** |
| ⚙️ top-bar + "Mappa"/"Impostazioni" nel drawer (duplicati) | **un solo ⚙️** |
| Ricerca 🔍 | icona sulla scheda Mappa (resta) |
| `ModeSwitch` montato in 2 punti | **un solo punto** (dedup) |
| Progresso negli export | contestuale a Learn (Editor) |
| Account `UserHeader` | invariato (header Libreria) |

## Vincoli da preservare
- **Desktop**: `LeftPanel` sidebar fissa, nessuna regressione; la shell B vive sotto `lg`.
- **Flusso invito**: `InviteModal` al clic del link; fix v0.9.1 (atterraggio su Libreria al primo login senza username) — adattare alla nuova navigazione.
- **Onboarding**: tutorial (4 passi, v0.9.2) e What's New non sovrapposti al flusso invito.
- Logica dominio, store e sync invariati.

## Scomposizione (task)
- **TASK-46** — bottom navigation + dedup shell (core).
- **TASK-47** — FAB speed-dial tool.
- **TASK-48** — libreria lista↔dettaglio.
- **TASK-49** — diario tap-friendly.
- **TASK-44** — touch target ≥44px (trasversale, applicato in 46-49).

Ordine: 46 → (47 ‖ 48 ‖ 49), con 44 in ciascuno. Learn/Track-in-Editor e ⚙️ rientrano in TASK-46.

## Riferimenti
- `backlog/docs/mobile-usability-analysis.md`
- `src/app/page.tsx`; `src/components/panel/{LeftPanel,MainViewSwitch,ModeSwitch,ActionBar,RouteLibrary,RouteList,RouteDetailCard,CompletionList,CompletionForm,DifficultyRating}.tsx`; `src/components/auth/{UserHeader,LibraryAuthGate}.tsx`
- Wireframe interattivi: `.superpowers/brainstorm/.../content/*.html` (gitignored)
