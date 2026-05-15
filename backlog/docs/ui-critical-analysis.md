# TrekTrak — Critical UI/UX Analysis

Documento di analisi critica dell'interfaccia, della grafica e dell'esperienza utente, prodotto durante la campagna polish/v0.6.2.

Severity:
- 🔴 **Critical** — bloccante / rotto
- 🟡 **Significant** — frizione, learning curve, inconsistenza
- 🟢 **Polish** — affinamento, opportunità di delight

---

## 1. Layout & Composizione

### 🟡 Mobile top bar — densità eccessiva
Top bar mobile (`page.tsx:106-137`) compone in 2 righe: hamburger + titolo + cerca + impostazioni + ModeSwitch. Su schermi piccoli (≤375px) i 4 bottoni + titolo lasciano poco respiro. Touch target rispettati (`min-w-[44px]`).
**Proposta:** spostare "Impostazioni mappa" dentro l'hamburger (già contenuto in drawer) per liberare spazio.

### 🟡 Profilo altimetrico 100px su mobile
`h-[100px]` su mobile (`page.tsx:163`), 120px desktop. Sotto i 120px è difficile leggere variazioni di 50-100m su tappe lunghe.
**Proposta:** toggle "espandi/comprimi profilo" che porta il chart al 35-45% dell'altezza in modalità "deep-dive".

### 🟡 LeftPanel desktop fissa a 380px
Su desktop ultrawide (≥1920px) il panel occupa una frazione minuscola dello schermo, lo spazio extra va tutto alla mappa.
**Proposta:** considera un breakpoint `2xl:w-[450px]` o un drag-handle per ridimensionare.

### 🟢 ModeSwitch — toolbar + tablist nella stessa riga
Dopo R5-07, compass/ruler/quiz sono in `role="toolbar"` separato dai tab Learn/Track in `role="tablist"`. Strutturalmente corretto ma visivamente sembrano la stessa "barra". Considera un piccolo separatore visivo (`border-l border-gray-700 mx-1`) tra toolbar e tablist per renderlo esplicito.

---

## 2. Gerarchia visiva, tipografia, colori

### 🟡 Icone miste: HTML entities + emoji + SVG
Top bar mobile usa `☰` (entity), `🔍`, `⚙️` (emoji). MyLocationButton usa SVG inline. RulerTool/CompassTool usano divIcon con HTML inline. Mix incoerente.
**Impatto.** Rendering varia tra device/OS (emoji su iOS ≠ Android ≠ Windows). Estetica disomogenea.
**Proposta:** standardizzare su un set SVG (Lucide React, ~6kB tree-shaken). Migliora coerenza e bundle.

### 🟢 Palette slope già coerente
`slopeColor` (`calculations.ts:131`) mappa pendenza a verde/giallo/arancio/rosso, riusato nel path colorato sulla mappa e nel grafico altimetrico.
**Proposta:** estrarre in `lib/colors.ts` un design token unico per evitare drift quando si aggiungono colori per la modalità Track.

### 🟢 Tab inattive — bg-gray-700 dominante
Dopo R5-05/R5-07 ho promosso `text-gray-300` per le tab inattive (era `text-gray-400` su `bg-gray-700` = 4.05:1, ora ~7:1). Buon contrasto, ma estetica: il `bg-gray-700` è grigio piatto, c'è poca distinzione visiva tra tab attive e inattive oltre al colore di sfondo.
**Proposta:** considerare un border-bottom sui tab inattivi (`border-b-2 border-transparent` → `border-current` su hover) per una più chiara "azione disponibile".

### 🟡 Bottoni export con 4 colori diversi
"PDF Sintetico" (verde), "PDF Roadbook" (verde), "GPX" (blu), "Copia link" (giallo/orange), "📊 Progresso" (purple). Cinque colori distinti per azioni "di consumo del dato" creano rumore visivo.
**Proposta:** unificare le esportazioni (PDF/GPX/Copia link) su una palette neutra (gray) o sull'accent primario (green). Tenere la differenza cromatica per le azioni "didattiche" (Progresso/Quiz).

---

## 3. Microcopy e tono di voce

### 🟢 Tono già coerente: didattico, breve, in italiano
"Clicca sulla mappa per aggiungere waypoint", "Aggiungi almeno 2 waypoint con quota...", "Difficoltà". Buono.

### 🟡 "Verifica" vs "Quiz" — overlap concettuale
Entrambi servono per controllare l'apprendimento, ma con scopi diversi (verifica = sull'itinerario inserito; quiz = su punti random). La differenza non è esplicita per l'utente nuovo.
**Proposta:** aggiungere una micro-descrizione (`title=` o piccolo tooltip) ai bottoni o nel tutorial.

### 🟢 Conferme con `confirm()` native — niente personalizzazione
Es. "Caricare questo itinerario? Le modifiche non salvate andranno perse." in `SavedItinerariesModal`. Funzionale ma rompe la coerenza con l'UI scura dell'app.
**Proposta:** sostituire con un modal interno (R7-03 in bug log).

---

## 4. Mobile/touch UX

### 🟡 Touch target compass/ruler/quiz 36×36
`min-w-[36px] min-h-[36px]` (`ModeSwitch.tsx:40,53,66`). WCAG/Material raccomandano 44×44.
**Proposta:** bump a `min-w-[40px] min-h-[40px]` (compromesso tra densità mobile e accessibilità) o portare a 44.

### 🟢 Drawer mobile con focus trap
Già implementato (`page.tsx:65-86`). Buon lavoro.

### 🟡 Long-press marker su mappa non gestito
Toccare e tenere premuto un marker su mobile non offre azioni alternative (rimuovi, rinomina). L'unica via per editare è aprire il drawer.
**Proposta:** popup leaflet con azioni rapide su tap del marker (in alternativa al solo drag).

---

## 5. Didactic UX (specifico dell'app)

### 🟡 Modalità Learn vs Track — switch distruttivo
Passare da Track a Learn cancella tutti i dati calcolati (richiede confirm). Passare da Learn a Track ricalcola tutto (può perdere i valori inseriti manualmente per "verifica").
**Proposta:** invece di cancellare, "nascondi e ricalcola al ritorno". Lo store potrebbe mantenere `learnValues` separati da `trackValues` e mostrare quelli pertinenti alla modalità corrente. Permette di alternare Learn (esercizio) ↔ Track (verifica visiva) senza perdere dati.

### 🟡 Profilo altimetrico "stimato" in Learn — non collegabile ai punti
In Learn mode il grafico mostra solo i waypoint con quota (no campionamento intermedio, etichetta "stimato"). Visualmente piatto e poco didattico — non aiuta a "vedere" gli errori di stima.
**Proposta:** in Learn permettere all'utente di inserire una stima della D+/D-, e DOPO la verifica mostrare il profilo "vero" sovrapposto al suo grafico-piatto. Forte feedback didattico.

### 🟢 Tip didattici su validation badge — buona idea (v0.4.0)
Già implementato. Suggerimenti contestuali su come migliorare. Continua su questa strada.

---

## 6. Accessibility

### Stato dopo polish
Lighthouse a11y: **97/100** (era 87/100). 2 issues rimaste sono Leaflet markers senza aria-label e "agentic-accessibility-tree" (informativo).

### Issue strutturali risolte
- `<main>` landmark aggiunto
- Tablist non contiene più non-tab elements
- Contrasti `text-gray-500` → `text-gray-400` (WAYPOINT, empty state, Difficoltà)
- Form inputs ora con `name` attribute
- aria-live ridotto a "polite" dove non urgente

### Rimaste / deferred
- Leaflet marker senza accessible name (Drag/Drop button) — limitazione libreria
- Touch target 36px su tool buttons — possibile bump a 40-44

---

## 7. Onboarding & discoverability

### 🟡 Tutorial 8 step — lungo per chi torna
`LearnTutorial.tsx` ha 8 step. Skip prominente è bene, ma per un utente che riapre l'app dopo settimane il tutorial NON ricompare (è gated da localStorage).
**Proposta:** un piccolo "?" sempre visibile per riaprire il tutorial on-demand (oggi non c'è dove riavviarlo).

### 🟢 WhatsNew popup version-aware — pattern corretto
v0.4.0 ha introdotto WhatsNew, mostrato una volta per versione. Buon pattern. Considerare di estendere a "What's New in this session" per cambiamenti minori.

### 🟡 Modalità Track è il default — è giusto?
Default è `'track'` (`itineraryStore.ts:72`). Ma TrekTrak è un'app *didattica per la cartografia manuale*. La modalità Track è "auto-pilot": tutto calcolato, niente da imparare. Forse il default più coerente con la mission è Learn?
**Proposta:** valutare di rendere `learn` il default su first-load (poi memorizzarlo); o aggiungere uno screen di "scegli il tuo profilo" all'onboarding (cartografo principiante / esperto).
