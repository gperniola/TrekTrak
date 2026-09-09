# Meteo del percorso: modelli scelti dall'utente, soglie misurate — Design

Data: 2026-09-09 · Analisi di riferimento:
`backlog/docs/meteo-verifica-modelli-analisi.md` (tutti i numeri citati qui vengono da lì,
e si rifanno con `backlog/docs/meteo-verifica-modelli.py`).

## Scopo

Il pannello «Quando partire» dichiarava **«nuvoloso, nessuna criticità»** in ore in cui un
temporale era in corso a venti chilometri. Due segnalazioni dell'utente, due difetti
distinti, una correzione sola non basta.

- **Difetto B** — `classifyHour` legge **solo** i codici WMO 95/96/99. Pioggia, pioviggine,
  rovesci e neve dichiarati dal modello non entrano nel giudizio: 7 ore su 288 misurate a
  livello 0 con la pioggia scritta nel codice.
- **Difetto A** — un solo modello (`best_match` → ICON) e soglie tarate a occhio. Con ICON
  la probabilità media **nelle ore in cui il temporale c'è davvero** è **38,7%**: la soglia
  dell'arancione, fissata a 70%, è strutturalmente irraggiungibile.

## Decisioni

**Un modello alla volta possiede tutto.** Scelta dell'utente: «se ho selezionato ICON,
prendo le righe di ICON e mostro le allerte di ICON; non mescoliamo i dati». Niente valori
di fonti diverse nella stessa riga, niente note di disaccordo.

**Le soglie sono per modello**, ricavate dalla verifica su 171 temporali osservati, e
scelte in modo che i due modelli avvisino **con la stessa sensibilità**: cambiare tendina
non deve cambiare di nascosto quanto l'app allarma.

| modello | giallo | arancione | temporali presi | ore in allarme |
|---|---|---|---|---|
| ECMWF (`ecmwf_ifs`) | ≥ 15% | **≥ 32%** | 93% / **81%** | 21% / **13%** |
| ICON (`icon_seamless`) | ≥ 5% | **≥ 10%** | 83% / **78%** | 13% / **10%** |

Le due righe dell'**arancione** si equivalgono (81% contro 78%): è lì che la taratura
conta. Le due del **giallo** no, e non possono: la probabilità di ICON satura, e oltre
l'83% quel modello non arriva a nessuna soglia. Va detto invece che nascosto.

Predefinito **ECMWF**: AUC 0,927 contro 0,891, ed è l'unico dei due che riesce a coprire il
90% dei temporali. Chi ha già delle impostazioni salvate non ha il campo: il predefinito
vale anche per loro, senza migrazione.

## Architettura

### Rete — una chiamata, due modelli, nessun riscaricamento al cambio

`buildForecastUrl` aggiunge `models=ecmwf_ifs,icon_seamless` e la variabile `precipitation`.
Misurato: 5 punti × 3 modelli × 2 giorni = 25 KB; con due modelli ~17 KB.

Con più modelli il servizio **suffissa ogni chiave** con il nome del modello
(`weather_code_ecmwf_ifs`), mentre `elevation` resta **un solo campo** di primo livello —
quindi `scartoQuota` non cambia. `serieValida` va riscritta per leggere le chiavi
suffissate.

```ts
export type ModelloMeteo = 'ecmwf' | 'icon';
const MODELLI_API: Record<ModelloMeteo, string> = {
  ecmwf: 'ecmwf_ifs', icon: 'icon_seamless',
};
export interface RouteForecast {
  serie: Record<ModelloMeteo, SerieOraria[]>;  // una serie per punto, per modello
  elevations: number[];
}
```

**Cambiare modello non richiama la rete**: il rapporto è un `useMemo`, come già per passo e
soste. È la regola scritta nel CLAUDE.md — «la rete è separata dalla ricostruzione».

### Il giudizio — `route-weather.ts`, che resta puro

`PuntoOrario` guadagna `mm: number` (da `precipitation`), ma **`OraDaClassificare` lo
esclude** — diventa `Omit<PuntoOrario, 'temp' | 'mm'>`. Il commento già in quel punto dice
perché: chiedere al giudice un campo che non guarda significa doverne inventare un valore
in ogni chiamata, ed è lì che nascono i dati finti.

`classifyHour` prende le soglie come **parametro**: la funzione non deve sapere quale
modello sia attivo.

```ts
export interface SoglieModello { giallo: number; arancione: number }
export const SOGLIE: Record<ModelloMeteo, SoglieModello> = {
  ecmwf: { giallo: 15, arancione: 32 },
  icon:  { giallo:  5, arancione: 10 },
};
export function classifyHour(o: OraDaClassificare, soglie: SoglieModello): Classificazione
```

I codici di precipitazione entrano nel giudizio, con la scala della tabella WMO:

| codici | livello | esempio di motivo |
|---|---|---|
| 51·53·55 pioviggine · 80 rovesci deboli · 71 neve debole | 1 | «rovesci deboli» |
| 61·63 pioggia · 81 rovesci · 73 neve · 85 rovesci di neve | 2 | «pioggia» |
| 65 pioggia forte · 82 rovesci violenti · 75 neve forte · 86 | 3 | «rovesci violenti» |
| 56·57·66·67 che gela | 3 | «pioggia che gela» |
| 95·96·99 temporale | 3 | invariato |

**Il CAPE resta nel giudizio** — la regola «probabilità ≥ 30% e CAPE ≥ 800 → possibili
temporali forti» è quella che ad Altamura, con ECMWF, produce il rosso alle 16:00 — ma
**sparisce dalla tabella**: il numero se ne va, il significato resta scritto in parole.

**I millimetri NON entrano nel giudizio.** La verifica ha misurato soglie di *probabilità*;
aggiungere una soglia in mm senza misurarla sarebbe tornare al difetto di partenza, le
soglie a occhio. I mm si mostrano e si colorano, non decidono.

`buildRouteWeather` riceve `modello: ModelloMeteo` e usa `serie[modello]`: righe, motivi,
verdetto e fasce critiche vengono tutti da lì.

`RigaPercorso` guadagna **`lat` e `lon`** — oggi non le porta, e senza quelle il menu ⋮ non
sa dove mandare l'utente.

### La tabella

Colonne: `Punto · Arrivo · Cielo · mm · Piogg. · Raffiche · ⋮` (via il CAPE).

Millimetri sulla scala convenzionale dell'intensità oraria, coi colori già in uso per la
gravità: `< 1` grigio · `1-4` giallo · `4-10` arancione · `≥ 10` rosso. Zero si scrive `—`,
un dato assente resta `n/d` (mai zero: regola del progetto).

### La tendina del modello

Un `<select>` accanto a «Il tuo passo», stessa meccanica del precedente già in casa
(`updateSettings` + `saveSettings`): la scelta vale anche fuori dal pannello e sopravvive
alla ricarica. Sotto la tabella, una riga dichiara **quale modello ha parlato**.

### Il menu ⋮ per riga

Un pulsante per riga (`aria-haspopup="menu"`, `aria-expanded`), che apre un menu con **una**
voce: «Apri su Meteoblue». Chiude con `Escape` e col tocco fuori; bersaglio ≥ 44 px su
mobile.

```
https://www.meteoblue.com/it/tempo/settimana/{lat}N{lon}E
```

Verificato con un browser vero: titolo «Meteo 42.2°N 14.28°E - meteoblue». I segni si
costruiscono dal valore (`N`/`S`, `E`/`W`), non si danno per scontati. `target="_blank"`,
`rel="noopener"`.

## Verifica

- **Unità**: ogni nuovo codice WMO al suo livello; entrambe le tabelle di soglie; `mm` che
  non altera il livello; `classifyHour` che resta pura.
- **Per mutazione**: rompere di proposito la riga corretta e vedere un test rosso — sui
  codici di precipitazione e sulle due soglie.
- **Caso reale**: il pomeriggio del 2026-09-09 ad Altamura (dati salvati). Con ICON la
  riga delle 17:00 deve dire «rovesci deboli» come motivo — oggi dice solo «raffiche 32»;
  con ECMWF le 16:00 devono essere **arancioni o peggio**.
- **e2e**: la tendina cambia il verdetto **senza una nuova richiesta di rete**; il menu ⋮
  apre la voce col link giusto.

## Fuori perimetro

Ensemble grezzo a 51 membri; ICON-2I come indicatore «localmente forti»; Meteoblue via API
(chiave server-only + route proxy). Rimandati, con le misure già in `backlog/docs/`.
