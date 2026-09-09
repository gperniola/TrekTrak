#!/usr/bin/env python3
"""Verifica quale modello meteo avvisa meglio dei temporali, contro OSSERVAZIONI vere.

Rifà le misure di `meteo-verifica-modelli-analisi.md`. Serve a non decidere le soglie a
occhio: la domanda «quale modello e' migliore» ha una risposta misurabile, e questo
script la misura.

Impianto
--------
- Verita': temporale osservato al METAR (`TS`/`TSRA`/`VCTS`) su 8 stazioni italiane,
  dall'archivio Iowa State. Non un altro modello: un'osservazione.
- Previsione: archivio delle previsioni di Open-Meteo, stesse coordinate e stesse ore.
- Giudizio: `classifyHour` di `src/lib/route-weather.ts`, tradotta qui riga per riga.
  Se la si cambia nel prodotto, va cambiata anche qui — o il confronto mente.
- Tolleranza +/- 1 ora: la convezione non si giudica al minuto.

Uso
---
    python meteo-verifica-modelli.py [--cache CARTELLA] [--da 2026-07-01] [--a 2026-08-31]

Le risposte si salvano nella cartella cache (fuori dal repository) e non si riscaricano:
i servizi sono gratuiti e senza chiave, ma hanno un limite di richieste.
"""

import argparse
import bisect
import csv
import datetime as dt
import json
import os
import urllib.parse
import urllib.request

# Aeroporti con METAR, sparsi sulla penisola. Stanno fra 3 e 350 m: sono fondovalle, non
# creste — il limite principale di questa verifica, dichiarato nell'analisi.
STAZIONI = [
    ('LIBV', 'Gioia del Colle', 40.7661, 16.9353),
    ('LIRZ', 'Perugia',         43.0972, 12.5103),
    ('LIPB', 'Bolzano',         46.4603, 11.3264),
    ('LIME', 'Bergamo',         45.6689,  9.7003),
    ('LIRQ', 'Firenze',         43.8086, 11.2028),
    ('LIPX', 'Villafranca',     45.3875, 10.8723),
    ('LIMJ', 'Genova',          44.4133,  8.8375),
    ('LIPY', 'Ancona',          43.6167, 13.3603),
]

MODELLI = [('ecmwf_ifs', 'ECMWF'), ('icon_seamless', 'ICON')]

# Codici WMO di temporale: gli unici che `classifyHour` leggeva prima della correzione.
CODICI_TEMPORALE = {95, 96, 99}


def scarica(url: str, dove: str) -> str:
    if os.path.exists(dove) and os.path.getsize(dove) > 0:
        return dove
    req = urllib.request.Request(url, headers={'User-Agent': 'TrekTrak-verifica/1.0'})
    with urllib.request.urlopen(req, timeout=180) as r, open(dove, 'wb') as f:
        f.write(r.read())
    return dove


def osservazioni(cache: str, da: str, a: str) -> set:
    """Le ore in cui un temporale e' stato OSSERVATO, come (stazione, ora UTC)."""
    y1, m1, d1 = da.split('-')
    y2, m2, d2 = a.split('-')
    q = [('data', 'wxcodes'), ('tz', 'UTC'), ('format', 'onlycomma'),
         ('missing', 'empty'), ('trace', '0.0001'), ('report_type', '3'),
         ('year1', y1), ('month1', str(int(m1))), ('day1', str(int(d1))),
         ('year2', y2), ('month2', str(int(m2))), ('day2', str(int(d2)))]
    q += [('station', s[0]) for s in STAZIONI]
    url = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?' + urllib.parse.urlencode(q)
    percorso = scarica(url, os.path.join(cache, 'osservazioni.csv'))

    visti = set()
    with open(percorso, newline='') as f:
        for r in csv.DictReader(f):
            if 'TS' not in (r.get('wxcodes') or ''):
                continue
            t = dt.datetime.strptime(r['valid'], '%Y-%m-%d %H:%M')
            # Un METAR delle 14:55 descrive l'intervallo (14,15]: in Open-Meteo e' l'ora 15.
            ora = t.replace(minute=0) + dt.timedelta(hours=1) if t.minute >= 30 else t.replace(minute=0)
            visti.add((r['station'], ora))
    return visti


def previsioni(cache: str, da: str, a: str) -> dict:
    """{(stazione, ora): {modello: {cod, prob, cape, raff}}} dall'archivio previsioni."""
    fuori = {}
    for modello, _ in MODELLI:
        url = ('https://historical-forecast-api.open-meteo.com/v1/forecast'
               '?latitude=' + ','.join('%.4f' % s[2] for s in STAZIONI) +
               '&longitude=' + ','.join('%.4f' % s[3] for s in STAZIONI) +
               '&start_date=%s&end_date=%s' % (da, a) +
               '&hourly=precipitation_probability,weather_code,cape,wind_gusts_10m,precipitation'
               '&timezone=UTC&models=' + modello)
        with open(scarica(url, os.path.join(cache, 'previsioni-%s.json' % modello))) as f:
            risposta = json.load(f)
        for k, (sigla, *_r) in enumerate(STAZIONI):
            h = risposta[k]['hourly']
            for i, iso in enumerate(h['time']):
                t = dt.datetime.strptime(iso, '%Y-%m-%dT%H:%M')
                fuori.setdefault((sigla, t), {})[modello] = {
                    'cod': h['weather_code'][i], 'prob': h['precipitation_probability'][i],
                    'cape': h['cape'][i], 'raff': h['wind_gusts_10m'][i],
                }
    return fuori


def classify_hour(v: dict) -> int:
    """Porting fedele di classifyHour (src/lib/route-weather.ts).

    ATTENZIONE: se cambiano le soglie nel prodotto, vanno cambiate anche qui.
    """
    livello = 0

    def alza(x):
        nonlocal livello
        if x > livello:
            livello = x

    if v['cod'] in CODICI_TEMPORALE:
        alza(3)
    if v['prob'] is not None:
        if v['prob'] >= 70:
            alza(2)
        elif v['prob'] >= 40:
            alza(1)
    if v['cape'] is not None:
        innesco = v['prob'] is not None and v['prob'] >= 30
        if innesco and v['cape'] >= 800:
            alza(3)
        elif not innesco and v['cape'] >= 2000:
            alza(1)
    if v['raff'] is not None:
        if v['raff'] >= 70:
            alza(3)
        elif v['raff'] >= 50:
            alza(2)
        elif v['raff'] >= 30:
            alza(1)
    return livello


def punteggio(prev, oss, scatta):
    """(presi, POD, falsi allarmi, quota di ore in allarme) per una regola."""
    def vicino(s, t):
        return any((s, t + dt.timedelta(hours=k)) in oss for k in (-1, 0, 1))

    positivi = len(oss & set(prev.keys()))
    presi = sum(1 for k, d in prev.items() if k in oss and scatta(d))
    scatti = sum(1 for _, d in prev.items() if scatta(d))
    falsi = sum(1 for (s, t), d in prev.items() if scatta(d) and not vicino(s, t))
    return presi, 100.0 * presi / max(1, positivi), falsi, 100.0 * scatti / max(1, len(prev))


def auc(prev, oss, modello):
    """Probabilita' che un'ora con temporale abbia previsione piu' alta di una senza."""
    def vicino(s, t):
        return any((s, t + dt.timedelta(hours=k)) in oss for k in (-1, 0, 1))

    si = sorted(d[modello]['prob'] for k, d in prev.items()
                if modello in d and d[modello]['prob'] is not None and k in oss)
    no = sorted(d[modello]['prob'] for (s, t), d in prev.items()
                if modello in d and d[modello]['prob'] is not None and not vicino(s, t))
    if not si or not no:
        return float('nan')
    tot = 0.0
    for p in si:
        lo, hi = bisect.bisect_left(no, p), bisect.bisect_right(no, p)
        tot += lo + (hi - lo) * 0.5
    return tot / (len(si) * len(no))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cache', default=os.path.join(os.path.expanduser('~'), '.cache', 'trektrak-meteo'))
    ap.add_argument('--da', default='2026-07-01')
    ap.add_argument('--a', default='2026-08-31')
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    oss = osservazioni(args.cache, args.da, args.a)
    prev = previsioni(args.cache, args.da, args.a)
    positivi = len(oss & set(prev.keys()))

    print('CAMPIONE  %s -> %s  ·  %d ore-stazione  ·  %d con temporale osservato'
          % (args.da, args.a, len(prev), positivi))
    print('Verita\': METAR TS/TSRA/VCTS. Tolleranza +/- 1 ora.')

    print('\nREGOLA ATTUALE DELL\'APP, per modello')
    print('%-10s %8s %8s %10s %14s' % ('modello', 'presi', 'POD', 'falsi', '% ore allarme'))
    for m, nome in MODELLI:
        r = punteggio(prev, oss, lambda d, m=m: m in d and classify_hour(d[m]) >= 2)
        print('%-10s %8d %7.0f%% %10d %13.0f%%' % (nome, r[0], r[1], r[2], r[3]))

    print('\nPOTERE DISCRIMINANTE (AUC; 0,5 = a caso)')
    for m, nome in MODELLI:
        print('  %-10s %.3f' % (nome, auc(prev, oss, m)))

    print('\nCOSTO DI OGNI SOGLIA DI PROBABILITA\'')
    for m, nome in MODELLI:
        print('\n  === %s ===' % nome)
        print('  %8s %8s %8s %10s %14s' % ('soglia', 'presi', 'POD', 'falsi', '% ore allarme'))
        for soglia in (5, 8, 10, 15, 20, 25, 32, 40, 45, 55, 70):
            def scatta(d, m=m, s=soglia):
                return m in d and d[m]['prob'] is not None and d[m]['prob'] >= s
            r = punteggio(prev, oss, scatta)
            print('  %7d%% %8d %7.0f%% %10d %13.0f%%' % (soglia, r[0], r[1], r[2], r[3]))


if __name__ == '__main__':
    main()
