# Design — Libreria condivisa di gruppo (cloud, a invito)

**Data:** 2026-06-03
**Stato:** Approvato (brainstorming) — pronto per il piano
**Versione target:** v0.9.0 "Libreria condivisa" (tentativa)
**Predecessore:** estende la Libreria percorsi locale di v0.8.0 (`backlog/docs/route-library-design.md`)

## Sommario

Trasformare la Libreria percorsi (oggi locale, per-dispositivo) in una **libreria condivisa di
gruppo** su backend cloud, accessibile **solo su invito**. Un gruppo ristretto e fidato
(famiglia/amici) condivide lo stesso catalogo di percorsi e un **diario comunitario** di
completamenti. Gli utenti normali di TrekTrak continuano a usare l'app come prima e **non vedono
affatto** la libreria né l'area condivisa.

Backend: **Supabase** (Postgres + Auth + Row-Level Security + Edge Functions). Login
**passwordless via magic-link**, sbloccato da un **link di invito segreto unico**.

## Contesto

- v0.8.0 ha introdotto la Libreria percorsi locale: `routeLibraryStore`, helper in `lib/storage.ts`
  (localStorage), componenti `RouteLibrary`/`RouteList`/`RouteDetailCard`/`CompletionList`/
  `CompletionForm`, tipi `RouteCompletion`/`RouteMetrics`, `Itinerary` esteso.
- Quell'architettura ha una cucitura pulita: la UI parla col `routeLibraryStore`, che a sua volta
  parla con un livello di persistenza. Questo design **sostituisce il backend di persistenza**
  (localStorage → Supabase) mantenendo l'interfaccia dello store dove possibile.
- TrekTrak è una PWA senza backend proprio: il client parla direttamente con Supabase; le Edge
  Functions vivono su Supabase. Nessun cambiamento all'hosting di TrekTrak.

## Decisioni di design (dal brainstorming)

1. **Un'unica libreria condivisa, solo per membri.** La tab "Libreria" diventa cloud e visibile
   solo a invitati/membri. I non-membri non la vedono. La libreria locale v0.8.0 **non** viene
   importata: si **parte puliti** (localStorage resta solo come cache offline dei dati cloud).
2. **Collaborativa:** ogni membro può creare percorsi e aggiungere completamenti.
3. **Invito = link segreto unico riutilizzabile**, revocabile rigenerando il token. È un
   lasciapassare, non un'identità: più persone possono usarlo con email diverse senza conflitti.
4. **Username univoco e modificabile** in seguito; è l'identità mostrata in tutta l'app.
5. **Difficoltà percepita 1-5 scarponi** per completamento (soggettiva, distinta dalla SAC).
6. **Campo "creato da"** (username) sul percorso.
7. **Username del membro loggato** mostrato in alto; **lista completamenti in colonna** in basso
   alla selezione del percorso.

---

## Sezione A — Accesso e autenticazione

### Tre stati utente
- **Anonimo normale:** usa TrekTrak come oggi. La tab "Libreria" **non esiste** per lui.
- **Invitato:** ha aperto il link segreto; sul suo dispositivo compare l'accesso all'area
  condivisa (form email). Flag locale `trektrak_invited` persiste l'accesso sul dispositivo.
- **Membro:** registrato (riga in `members`); vede/usa la libreria; username in alto.

### Link di invito
- Forma: `…/#invite=TOKEN`. All'apertura, l'app verifica il token (vedi sotto) e, se valido,
  salva `trektrak_invited=true` in localStorage e rivela l'area condivisa (login/registrazione).
- Il token è **un segreto unico riutilizzabile**. Verificato **lato server** (Edge Function)
  contro `invites.token_hash`. Rigenerare il token invalida i vecchi link; i membri già
  registrati restano tali.
- La verifica è server-side perché il solo possesso della anon key non deve bastare a registrarsi.

### Flusso (unificato login + registrazione)
1. Apertura `#invite=TOKEN` → area rivelata, form "Inserisci la tua email".
2. Submit → **Edge Function `request-access(email, token)`**:
   - verifica `token` contro `invites` (deve essere `active`);
   - se l'email è già di un membro → invia **magic-link di login** (`shouldCreateUser:false`);
   - altrimenti → **admin invite** (`auth.admin.inviteUserByEmail`) per creare il nuovo utente.
   - I **signup pubblici sono DISABILITATI** in Supabase Auth: l'unico modo di ottenere un
     account è passare da questa funzione (che ha verificato il token).
3. L'utente clicca il magic-link nell'email → sessione autenticata sul dispositivo (persistente
   a tempo indefinito: `persistSession` + `autoRefreshToken`).
4. **Primo accesso senza username** → schermata "Scegli il tuo username" → **Edge Function
   `claim-username(username)`**: verifica sessione valida e unicità, crea la riga `members`.
   (In alternativa una Postgres function con RLS; si sceglie Edge Function per chiarezza.)
5. **Membership = riga in `members`.** Le RLS richiedono membership per leggere/scrivere la
   libreria: essere solo autenticati non basta.

Un membro su un dispositivo nuovo riapre il link di invito (porta unica all'area), inserisce
l'email → magic-link di login → rientra nel suo account esistente (nessuna ri-registrazione).

---

## Sezione B — Modello dati (Supabase)

### Tabelle
- **`members`** — `id uuid` (= `auth.users.id`), `username text unique not null`,
  `role text default 'member'` (`member`|`admin`), `created_at timestamptz`. L'email **non**
  è qui: resta nello schema `auth`. **Assegnazione admin:** il **primo** membro registrato è
  promosso ad `admin` (dalla Edge Function `claim-username` se la tabella è vuota); gli altri
  sono `member`. Ulteriori admin si impostano manualmente in DB.
- **`invites`** — `id`, `token_hash text not null`, `active boolean default true`,
  `created_at`. Per ora una riga (link unico). Il token in chiaro non è mai persistito.
- **`routes`** — `id uuid`, `data jsonb not null` (l'`Itinerary` v0.8.0 **senza** completamenti
  e senza i campi derivati già esclusi a save-time), `created_by uuid → members.id`,
  `created_at`, `updated_at`, `sort_index int`.
- **`completions`** — `id uuid`, `route_id uuid → routes.id on delete cascade`,
  `created_by uuid → members.id`, `person text` (snapshot username al momento),
  `date date`, `duration_minutes int null`, `difficulty smallint null` (1-5),
  `notes text`, `created_at`.

### Scala difficoltà (`completions.difficulty`)
Soggettiva, per-completamento, 1-5: `1` Passeggiata di salute · `2` Facile · `3` Medio ·
`4` Difficile · `5` Kitemmurt. Distinta dalla difficoltà SAC calcolata del percorso (che resta
nelle metriche). Tipo client: `RouteCompletion.difficulty?: 1|2|3|4|5`.

### RLS (collaborativa)
- `members`: ognuno legge tutti i membri (per risolvere gli username); inserisce/aggiorna **solo
  la propria** riga (claim/cambio username).
- `routes`: i membri leggono tutto e inseriscono; **update/delete** solo del `created_by` o admin.
- `completions`: i membri leggono tutto e inseriscono; **update/delete** solo del `created_by` o
  admin.
- `invites`: nessun accesso client diretto (gestita solo dalle Edge Functions / admin).

---

## Sezione C — Architettura client

- **`lib/supabase.ts`** — istanza del client (`createClient`) con `persistSession:true`,
  `autoRefreshToken:true`. URL/anon key da env.
- **`lib/sync.ts`** — funzioni di accesso ai dati cloud (`fetchRoutes`, `upsertRoute`,
  `deleteRoute`, `fetchCompletions`, `addCompletion`, …) + risoluzione `created_by`→username
  via una mappa membri caricata insieme.
- **`stores/authStore.ts`** — sessione Supabase, `member` (id/username/role),
  stato `invited`/`isMember`/`loading`; azioni `requestAccess`, `claimUsername`,
  `updateUsername`, `signOut`; sottoscrizione a `onAuthStateChange`.
- **`routeLibraryStore`** — resta l'interfaccia UI (refresh/select/add/update/delete + CRUD
  completamenti); il backend dietro le azioni passa da `lib/storage` a `lib/sync`. localStorage
  diventa **cache offline** (read-through): i membri vedono l'ultimo stato anche senza rete; le
  **scritture richiedono connessione** (MVP: offline → toast "sei offline, riprova").
- **Gating tab:** `MainViewSwitch` mostra "Libreria" solo se `invited || isMember`. Anonimo
  normale → tab assente. Membro non ancora con username → schermata scelta username.
- **Conflitti:** *last-write-wins* su `updated_at`.

---

## Sezione D — Aggiunte UI

- **Header username:** barra in alto col nome del membro loggato + menu (cambia username,
  logout). Presente su desktop e nel drawer mobile, solo per i membri.
- **Rating scarponi 1-5** in `CompletionForm`: selettore a 5 scarponi con etichetta corrente;
  mostrato in `CompletionList` accanto a durata/data.
- **"Creato da @username"** in `RouteDetailCard`.
- **Lista completamenti in colonna** in basso alla selezione del percorso (riposizionamento di
  `CompletionList` come colonna sotto la scheda).
- **Schermate auth:** form richiesta email (post-invito), schermata scelta username (primo
  accesso), e form login (membro su dispositivo nuovo). Stile coerente coi modali esistenti
  (`role="dialog"`, `aria-modal`).

---

## Sezione E — Privacy, configurazione, fasi, test, rischi

### Dati salvati e privacy
- **Auth (schema `auth`):** email + token di sessione. L'email è l'**unica PII**; nessuna
  password (magic-link).
- **`members`:** username (pubblico nel gruppo), ruolo, date.
- **`routes`:** titolo, coordinate/quote, dati tratte, note (testo libero), metriche, creatore.
- **`completions`:** username, data, durata, difficoltà, note (testo libero).
- Nessun tracking GPS in tempo reale, nessun identificatore dispositivo oltre la sessione,
  nessun dato di pagamento/salute. Le note sono testo libero (contenuto a discrezione utente).
  Region EU selezionabile su Supabase.

### Migrazione
- **Si parte puliti.** Nessun import dei percorsi locali v0.8.0. La libreria condivisa nasce
  vuota. localStorage non viene più usato come libreria primaria (solo cache della cloud).

### Configurazione
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env` (documentati in
  `.env.example`).
- Secret del token di invito e `SUPABASE_SERVICE_ROLE_KEY` configurati come **secret delle Edge
  Functions** (mai nel bundle client).
- Supabase Auth: **signup pubblici disabilitati**; magic-link abilitato; redirect URL configurati.

### Fasi del piano
1. **Backend:** progetto Supabase, schema (4 tabelle), policy RLS, Edge Functions
   `request-access` e `claim-username`, seed del token invito.
2. **Auth client:** `lib/supabase.ts`, `authStore`, flusso invito→magic-link→username,
   gating della tab Libreria, persistenza sessione.
3. **Sync:** `lib/sync.ts` dietro le azioni del `routeLibraryStore`, cache offline read-through,
   merge last-write-wins, gestione errori/offline con toast.
4. **UI sociale:** header username, rating scarponi, "creato da", colonna completamenti,
   schermate auth.

### Test
- Unit su `lib/sync` e `authStore` con client Supabase **mockato** (fetch/insert/merge,
  gating membership, claim/cambio username, unicità).
- Component test: rating scarponi (1-5 → valore), schermate auth (validazione email/username),
  `CompletionForm`/`CompletionList` con difficoltà.
- Edge Functions testate separatamente (verifica token, signup disabilitato, unicità username).
- Gating: la tab Libreria non compare per anonimo; compare per invitato/membro.

### Rischi / trade-off
- **Token riutilizzabile:** chiunque lo riceva può registrarsi finché non lo rigeneri (natura del
  link unico scelto). Per controllo per-persona servirebbero inviti individuali (fuori scope).
- **Backend minimo necessario:** 2 Edge Functions per il gating sicuro (non è "zero backend").
- **Dipendenza esterna:** Supabase come fornitore; i dati lasciano il dispositivo.
- **Offline:** scritture solo online nell'MVP; lettura da cache.

---

## File previsti

**Nuovi (client):** `lib/supabase.ts`, `lib/sync.ts`, `stores/authStore.ts`, componenti auth
(`InviteGate`/`RequestAccessForm`, `ChooseUsername`, `UserHeader`), rating scarponi
(`DifficultyRating`). Test relativi.

**Nuovi (Supabase):** migration SQL (tabelle + RLS), Edge Functions `request-access`,
`claim-username`. (Versionati nel repo, es. `supabase/`.)

**Modificati:** `routeLibraryStore` (backend → sync), `RouteDetailCard` (creato-da + colonna
completamenti), `CompletionForm`/`CompletionList` (difficoltà), `MainViewSwitch`/`LeftPanel`
(gating + header), `RouteCompletion` type (`difficulty`), `.env.example`.

**Rimosso/deprecato:** uso di `lib/storage.ts` come libreria primaria (resta per cache/settings
locali).

## Fuori scope (future)

- Inviti individuali per-persona e gestione membri da UI.
- Sincronizzazione di `validationHistory`/`quizHistory` cross-device.
- Editing offline con coda di sincronizzazione.
- Ruoli/permessi granulari oltre member/admin.
