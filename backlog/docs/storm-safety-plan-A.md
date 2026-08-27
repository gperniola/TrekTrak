# Fase A — piano di implementazione (task-56, con i suggerimenti 2 e 3)

Riferimento: [[storm-safety-design]] per l'analisi delle fonti, verificate il 2026-08-27.

Le tre cose stanno nello stesso pannello perché rispondono alla stessa domanda —
**cosa incontro, e a che ora** — e usano gli stessi due ingredienti: i waypoint e la
stima Munter dei tempi.

| | Contenuto | Fonte |
|---|---|---|
| A | temporali: CAPE, codice meteo, probabilità di precipitazione | Open-Meteo |
| 2 | raffiche di vento | Open-Meteo, stessa chiamata |
| 3 | tramonto e crepuscolo civile | calcolo locale, nessuna rete |

## Ora di partenza

L'app non ha un concetto di "ora di partenza": senza, "al waypoint 5 arrivi alle 14:40"
non è calcolabile. Si aggiunge **solo nel pannello meteo**, non nel modello
dell'itinerario: data (oggi / domani / dopodomani) e ora.

Default calcolato da `defaultDeparture(now)`: prima delle 10:00 si assume che si stia
pianificando **oggi** (ora = la prossima ora piena, non prima delle 6:00), dopo le 10:00
**domani alle 7:00**. È la differenza fra guardare il meteo la sera prima e guardarlo
mentre si allacciano gli scarponi.

## Punti interrogati

Una sola chiamata multi-punto. I modelli meteo hanno maglie di chilometri, quindi
interrogare 30 waypoint darebbe 30 volte lo stesso numero: si **campionano al massimo
12 punti** distribuiti sul percorso, primo e ultimo sempre inclusi. Il pannello lo dice,
invece di far credere che il dato sia per waypoint.

## Classificazione

Per ogni punto e ora si prende il **peggio** fra tre letture, ognuna con la sua scala:

- **temporale dichiarato**: `weather_code` 95, 96, 99 → è la lettura più forte
- **CAPE** (energia disponibile per la convezione): < 300 basso · 300-800 moderato ·
  800-1500 alto · > 1500 molto alto
- **raffiche**: < 30 km/h nulla · 30-50 attenzione · 50-70 forte · > 70 pericolosa in
  cresta

La **finestra critica** è l'intervallo di ore in cui almeno un punto del percorso sta a
livello "alto" o oltre. Il verdetto incrocia finestra e orari di arrivo: serve a dire
"parti prima" o "questo giro oggi no", che è la decisione vera.

## Onestà del dato

- è una **previsione**, e si dice: non sostituisce i canali ufficiali;
- la stima Munter **non conta le pause**, quindi gli orari di arrivo sono ottimistici, e
  va scritto accanto agli orari, non in una nota a fondo pagina;
- il CAPE dice quanta energia c'è, non che il temporale ci sarà: la parte didattica
  spiega questa differenza, il ciclo diurno della convezione in montagna e la regola
  30/30 (se fra lampo e tuono passano meno di 30 secondi, il temporale è entro ~10 km:
  ci si mette al riparo e si aspettano 30 minuti dall'ultimo tuono).

## Struttura

- `lib/weather-api.ts` — client Open-Meteo: costruzione URL multi-punto, validazione
  della risposta, `AbortSignal`, nessuna chiave.
- `lib/route-weather.ts` — puro: campionamento, orari di arrivo dai tempi Munter,
  classificazione, finestra critica, verdetto.
- `lib/sun.ts` — puro: alba, tramonto, crepuscolo civile (algoritmo NOAA), validato su
  valori noti.
- `components/weather/RouteWeatherPanel.tsx` — il pannello.

## Dove si apre

Il pulsante **Meteo** oggi apre Meteoblue in una scheda esterna. Diventa il pannello del
percorso, e il collegamento a Meteoblue resta **dentro** il pannello come "previsione
completa": due voci meteo separate avrebbero solo confuso. Vale per la ActionBar
(desktop) e per la voce del menu "Altro" (mobile).
