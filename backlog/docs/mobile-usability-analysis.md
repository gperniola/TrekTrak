# Analisi usabilità mobile — TrekTrak (TASK-39)

**Data:** 2026-06-05 · **Versione analizzata:** v0.9.1 (prod `trektrak.vercel.app`) · **Viewport:** 390×844 (iPhone, touch)

Audit empirico condotto su produzione a viewport telefono (screenshot in `backlog/docs/screenshots/mobile-*`). Obiettivo: capire perché l'app risulta **caotica e poco intuitiva** su mobile e proporre direzioni di ridisegno. Questo documento copre **audit + attriti + direzioni**; i task implementativi derivano dalla direzione scelta.

> ⚠️ **Gap da colmare:** l'audit copre gli stati pubblici (mappa, top bar, drawer Editor, tutorial, invito). Gli stati **autenticati** (Libreria con lista/diario, scelta username, scheda percorso) vanno verificati in una seconda passata con sessione loggata — non automatizzabile via magic-link.

---

## 1. Inventario dei controlli su mobile

### Top bar (sempre visibile, sopra la mappa) — 2 righe
- **Riga 1:** ☰ menu · *TrekTrak* (brand) · 🔍 ricerca · ⚙️ impostazioni mappa
- **Riga 2 (`ModeSwitch`):** ◎ bussola · ↕ righello · ? quiz · [ **Learn** | **Track** ] segmented

### Drawer (tap su ☰) — overlay a tutto schermo
- **Header:** "Menu" · *Mappa* · *Impostazioni* · ✕
- **`MainViewSwitch`:** Editor (la tab **Libreria appare solo se invited/member/session** → un nuovo utente non loggato non la vede)
- **`ModeSwitch` (ripetuto):** ◎ · ↕ · ? · [Learn | Track]
- **Azioni itinerario:** Salva · Carica · Nuovo · ↓ · ↑
- Input "Nome itinerario…"
- **Sotto-tab:** Modifica | Tabella
- Lista waypoint / "Clicca sulla mappa per aggiungere waypoint"
- **`SummaryBar`:** km · D+ · D− · tempo · Difficoltà SAC
- **`ActionBar`:** PDF Sintetico · PDF Roadbook · GPX · Copia link · Progresso

### Overlay sulla mappa
- FAB "La mia posizione" (basso-dx) · riga attribuzione (Leaflet/Thunderforest/OSM/Waymarked) · pannello profilo altimetrico (~100px, sempre presente anche vuoto con hint)

**Totale controlli interattivi nel solo drawer Editor: ~22.**

---

## 2. Problemi di usabilità (per gravità)

### 🔴 Alta
1. **Sovraccarico del drawer Editor.** Una singola schermata impila mode switch, tool, 5 azioni itinerario, input nome, 2 sotto-tab, lista waypoint, summary, 5 export → ~22 controlli. Nessuna gerarchia: per un nuovo utente è muro di pulsanti.
2. **Il workflow centrale è nascosto dietro l'hamburger.** Mappa + top bar non comunicano che creazione itinerario, libreria, salvataggio e username vivono nel drawer. Un nuovo utente resta sulla mappa senza capire dove andare (origine di TASK-39 e del fix v0.9.1).
3. **Tool e modalità collocati in modo incoerente.** ◎/↕/? + Learn/Track stanno **sia** nella top bar (sopra la mappa) **sia** dentro il drawer (`ModeSwitch` montato in due punti). Dove "vivono" i tool? E i tool della mappa, dentro un drawer che copre la mappa, sono poco utili lì.
4. **Tool icon-only ambigui.** ◎ (bussola), ↕ (righello), **? (quiz)** senza etichetta — "?" sembra "aiuto", non "quiz". Discoverability bassa.

### 🟡 Media
5. **Duplicazione impostazioni.** ⚙️ in top bar = "Mappa"/"Impostazioni" nell'header del drawer (stessi due pannelli, due punti d'accesso).
6. **Export sempre in evidenza anche a vuoto.** PDF Sintetico / PDF Roadbook / GPX / Copia link sono prominenti con 0 waypoint, quando non producono nulla di utile. "Progresso" (statistiche didattiche) è mescolato con gli export, concetto diverso.
7. **Onboarding pesante.** Tutorial a **8 passi** all'avvio + scelta profilo Learn/esperto: molto testo prima di toccare l'app, su schermo piccolo.
8. **Profilo altimetrico occupa ~100px fissi** anche quando vuoto (solo hint), togliendo spazio alla mappa.

### 🟢 Bassa
9. Attribuzione mappa su riga intera in basso (spazio verticale prezioso su mobile).
10. Densità verticale top bar: 2 righe (~22% dell'altezza) prima della mappa.

---

## 3. Direzioni di ridisegno (da discutere)

Tre approcci, dal meno al più invasivo:

### A. Riordino incrementale (basso rischio)
Mantiene la struttura, riduce rumore: rimuovere le duplicazioni (un solo punto per tool e per impostazioni), nascondere gli export quando non applicabili, etichettare i tool, alleggerire il tutorial. Migliora senza ripensare la navigazione.

### B. Bottom navigation mobile-first (medio)
Introdurre una **bottom nav** a 3-4 voci (es. Mappa · Editor · Libreria · Altro) come navigazione primaria su mobile, al posto di hamburger+top bar densa. I tool mappa diventano un cluster contestuale sulla mappa (FAB espandibile). Separa nettamente "naviga" da "modifica". Pattern nativo su mobile, più scopribile.

### C. Ripensamento per task / progressive disclosure (alto)
Riprogettare attorno ai flussi ("crea itinerario", "consulta libreria", "verifica/quiz") mostrando solo i controlli del task corrente, con disclosure progressiva del resto. Massimo guadagno di chiarezza, massimo lavoro.

---

## 4. Decisione (2026-06-05)

**Sequenza scelta: A → B.**
- **Prima A** (riordino incrementale): basso rischio e — punto chiave — agisce su **componenti condivisi**, quindi pulisce **anche il desktop**.
- **Poi B** (bottom navigation): **solo mobile**, gated sotto il breakpoint `lg`. Il desktop conserva la sidebar fissa, **intatta**.

**Accorgimento di scoping (per non rifare lavoro):** B ridisegnerà la *shell di navigazione mobile* (top-bar + drawer). Quindi A si limita ai **contenuti/componenti condivisi** e **non** tocca la shell mobile.
- Conseguenza: le **duplicazioni mobile** (`ModeSwitch` top-bar+drawer, ⚙️ vs header drawer) sono artefatti della shell → **rimandate a B**, non incluse in A.

### A — task atomici derivati
- **TASK-40** — Affordance/etichette ai tool della toolbar (bussola/righello/**quiz**), oggi icon-only e ambigui.
- **TASK-41** — `ActionBar`: nascondere/disabilitare gli export (PDF/GPX/Copia link) quando l'itinerario è vuoto; valutare raggruppamento sotto "Esporta".
- **TASK-42** — Separare **"Progresso"** dagli export (è didattica, non export): collocazione propria.
- **TASK-43** — Alleggerire il **tutorial iniziale** (oggi 8 passi) a 3-4 essenziali / disclosure progressiva.

### B — successiva (placeholder)
Bottom navigation mobile-first + tool mappa in FAB contestuale + dedup shell mobile. Da scomporre quando si parte con B.

## 5. Prossimi passi
1. Implementare A (TASK-40 → 43) in TDD.
2. Seconda passata di audit sugli **stati autenticati** (Libreria/diario/username) con sessione loggata — propedeutica a B.
3. (Opz.) Persona usability test mobile in `persona-usability-tests.md`.
4. Avviare B sulla base dell'audit autenticato.

## Riferimenti
- Screenshot: `backlog/docs/screenshots/mobile-{drawer-editor,invite}.png` (gitignored)
- `src/app/page.tsx` (top bar, drawer, ModeSwitch duplicato), `src/components/panel/{LeftPanel,MainViewSwitch,ModeSwitch,ActionBar,SummaryBar,ItineraryHeader}.tsx`
- TASK-39, affine a TASK-38 (onboarding), TASK-20 (UI cues)
