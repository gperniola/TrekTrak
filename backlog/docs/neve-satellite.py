#!/usr/bin/env python3
"""Misura cosa vedono davvero i satelliti della neve sull'Appennino centrale.

Rifà le misure di `neve-satellite-analisi.md`. Serve a non giudicare il layer neve
guardando la mappa: «non vedo colore» puo' voler dire niente neve, nube, dato non ancora
pubblicato o mattonella rotta, e solo i pixel lo dicono.

Impianto
--------
- Fonte: NASA GIBS, WMTS EPSG:3857, livello 8 (~454 m/pixel a 42°N). MODIS e VIIRS
  usano la stessa color map (`colormaps/v1.3/MODIS_NDSI_Snow_Cover.xml`).
- Classi: le mattonelle sono PNG a tavolozza. Nube, niente neve, acqua... sono
  **trasparenti ma con un RGB proprio** nella tavolozza: decodificando a mano si
  distinguono. Un canvas del browser no (perde l'RGB dei pixel trasparenti).
- Finestra: 9x9 pixel (~4x4 km) attorno alla cima.
- «Nessun dato» NON e' un errore HTTP: GIBS risponde 200 con `etag: 1000000000000` e
  senza `layer-identifier-actual`, e un corpo che cambia a ogni richiesta (vuoto, oppure
  rumore). Qui si riconosce dall'header e non si salva.
- I 404 non si salvano: una mattonella che manca adesso puo' esserci fra qualche ora (la
  pubblicazione arriva a pezzi). Una cache di 404 ha falsato la prima misura.

Uso
---
    python3 neve-satellite.py misura    [--cache C] [--sensori terra,aqua] GIORNO...
    python3 neve-satellite.py composito [--cache C] [--sensori ...] OGGI GIORNI
    python3 neve-satellite.py vuote     URL VOLTE

`misura`: per ogni sensore e giorno, classi della mattonella e della finestra su ogni cima.
`composito`: per ogni pixel della finestra, l'ultima osservazione senza nube negli ultimi
GIORNI giorni (e da quale passaggio viene).
`vuote`: ripete la stessa richiesta e dice cosa arriva ogni volta.

Le mattonelle valide si salvano nella cartella cache (fuori dal repository).
"""

import argparse
import datetime as dt
import math
import os
import struct
import urllib.error
import urllib.request
import zlib

BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
Z = 8
ETAG_NESSUN_DATO = '1000000000000'

SENSORI = {
    'terra': 'MODIS_Terra_NDSI_Snow_Cover',
    'aqua': 'MODIS_Aqua_NDSI_Snow_Cover',
    'noaa20': 'VIIRS_NOAA20_NDSI_Snow_Cover',
    'noaa21': 'VIIRS_NOAA21_NDSI_Snow_Cover',
    'snpp': 'VIIRS_SNPP_NDSI_Snow_Cover',
}
# Ordine dei passaggi dentro un giorno, dal piu' tardo (ottobre 2026, UTC sull'Appennino):
# Aqua 13:20-15:00, VIIRS 10:36-13:12, Terra 07:25-09:05. Il composito prende il primo.
ORDINE_NEL_GIORNO = ['aqua', 'noaa20', 'snpp', 'noaa21', 'terra']

PUNTI = {
    'Monte Amaro (Maiella) 2793': (42.0858, 14.0858),
    'Corno Grande (Gran Sasso) 2912': (42.4692, 13.5658),
    'Monte Velino 2486': (42.1531, 13.3864),
    'Monte Vettore 2476': (42.8200, 13.2681),
}

# RGB delle classi speciali nella tavolozza (tutte trasparenti sulla mappa).
CLASSI = {
    (0, 255, 0): 'senza-neve', (255, 200, 255): 'mancante', (200, 200, 200): 'indeciso',
    (189, 0, 189): 'notte', (0, 0, 255): 'acqua', (35, 35, 117): 'oceano',
    (0, 191, 255): 'nube', (170, 0, 0): 'saturo', (255, 255, 255): 'fill',
}
# Cio' che non dice niente sulla neve: il composito ci passa attraverso.
NON_VISTO = {'nube', 'mancante', 'notte', 'indeciso', 'fill', 'saturo'}


def tile_xy(lat, lon):
    n = 2 ** Z
    r = math.radians(lat)
    return (lon + 180) / 360 * n, (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n


def _paeth(a, b, c):
    pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
    return a if pa <= pb and pa <= pc else (b if pb <= pc else c)


def decodifica(png):
    """PNG -> (larghezza, altezza, tipo colore, righe, tavolozza, trasparenze)."""
    assert png[:8] == b'\x89PNG\r\n\x1a\n', 'non e\' un PNG'
    pos, idat, pal, trns = 8, b'', None, None
    while pos < len(png):
        ln, = struct.unpack('>I', png[pos:pos + 4])
        typ, body = png[pos + 4:pos + 8], png[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', body[:10])
        elif typ == b'PLTE':
            pal = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif typ == b'tRNS':
            trns = body
        elif typ == b'IDAT':
            idat += body  # possono essere piu' d'uno: vanno concatenati
    assert depth == 8, f'profondita\' {depth} non gestita'
    bpp = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    stride = w * bpp
    raw = zlib.decompress(idat)
    righe, prev, p = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[p]
        line = bytearray(raw[p + 1:p + 1 + stride])
        p += 1 + stride
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4: line[i] = (line[i] + _paeth(a, b, c)) & 255
        righe.append(bytes(line))
        prev = line
    return w, h, ctype, righe, pal, trns


def classe(indice, pal, trns):
    rgb = pal[indice]
    alpha = trns[indice] if trns is not None and indice < len(trns) else 255
    if rgb in CLASSI:
        return CLASSI[rgb]
    return 'NEVE' if alpha else 'trasparente-ignoto'


def scarica(cache, layer, giorno, x, y):
    """La mattonella decodificata, oppure None e il motivo."""
    path = os.path.join(cache, f'{layer}_{giorno}_{Z}_{x}_{y}.png')
    if os.path.exists(path):
        return decodifica(open(path, 'rb').read()), 'ok (cache)'
    url = f'{BASE}/{layer}/default/{giorno}/GoogleMapsCompatible_Level8/{Z}/{y}/{x}.png'
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            body, etag, actual = r.read(), r.headers.get('etag'), r.headers.get('layer-identifier-actual')
    except urllib.error.HTTPError as e:
        return None, f'HTTP {e.code}'  # non si salva: puo' arrivare piu' tardi
    except OSError as e:
        # GIBS chiude le connessioni ogni tanto: la misura va avanti, e lo dice.
        return None, f'errore di rete ({e})'
    if etag == ETAG_NESSUN_DATO or actual is None:
        return None, f'nessun dato (200 con etag {etag}, {len(body)} B)'
    with open(path, 'wb') as fh:
        fh.write(body)
    return decodifica(body), f'ok ({actual})'


def posizione(lat, lon):
    fx, fy = tile_xy(lat, lon)
    tx, ty = int(fx), int(fy)
    return tx, ty, int((fx - tx) * 256), int((fy - ty) * 256)


def conta(dec, px, py, r=4):
    w, h, _, righe, pal, trns = dec
    cont, indici = {}, set()
    for yy in range(max(0, py - r), min(h, py + r + 1)):
        for xx in range(max(0, px - r), min(w, px + r + 1)):
            k = classe(righe[yy][xx], pal, trns)
            cont[k] = cont.get(k, 0) + 1
            if k == 'NEVE':
                indici.add(righe[yy][xx])
    return cont, indici


def riassunto(cont):
    return ', '.join(f'{k} {n}' for k, n in sorted(cont.items(), key=lambda t: -t[1]))


def cmd_misura(args):
    for nome_s in args.sensori:
        layer = SENSORI[nome_s]
        for giorno in args.giorni:
            print(f'--- {nome_s} {giorno}')
            for nome, (lat, lon) in PUNTI.items():
                tx, ty, px, py = posizione(lat, lon)
                dec, esito = scarica(args.cache, layer, giorno, tx, ty)
                if dec is None:
                    print(f'    {nome}: {esito}')
                    continue
                cont, indici = conta(dec, px, py)
                extra = f'  (NDSI {min(indici)}-{max(indici)})' if indici else ''
                print(f'    {nome}: {riassunto(cont)}{extra}')


def cmd_composito(args):
    oggi = dt.date.fromisoformat(args.oggi)
    giorni = [(oggi - dt.timedelta(days=i)).isoformat() for i in range(args.quanti)]
    passaggi = [(g, s) for g in giorni for s in ORDINE_NEL_GIORNO if s in args.sensori]
    for nome, (lat, lon) in PUNTI.items():
        tx, ty, px, py = posizione(lat, lon)
        scaricati = {(g, s): scarica(args.cache, SENSORI[s], g, tx, ty) for g, s in passaggi}
        tiles = {k: dec for k, (dec, _) in scaricati.items()}
        # Un composito con dei buchi va detto: la prima misura di questa analisi era
        # sbagliata proprio perche' i passaggi del 15/10 non erano ancora pubblicati.
        assenti = [f'{g[5:]} {s}: {motivo}' for (g, s), (dec, motivo) in scaricati.items() if dec is None]
        esito, origine = {}, {}
        for yy in range(py - 4, py + 5):
            for xx in range(px - 4, px + 5):
                scelto = None
                for g, s in passaggi:
                    dec = tiles[(g, s)]
                    if dec is None:
                        continue
                    _, _, _, righe, pal, trns = dec
                    k = classe(righe[yy][xx], pal, trns)
                    if k not in NON_VISTO:
                        scelto = (k, f'{g[5:]} {s}')
                        break
                k = scelto[0] if scelto else 'non visto (nube in tutti i passaggi)'
                esito[k] = esito.get(k, 0) + 1
                if scelto:
                    origine[scelto[1]] = origine.get(scelto[1], 0) + 1
        print(f'{nome}: {riassunto(esito)}')
        print('    da: ' + ', '.join(f'{k} ({v})' for k, v in sorted(origine.items(), reverse=True)))
        if assenti:
            print('    passaggi assenti: ' + '; '.join(assenti))


def cmd_vuote(args):
    for n in range(args.volte):
        try:
            with urllib.request.urlopen(args.url, timeout=30) as r:
                body, h = r.read(), r.headers
        except urllib.error.HTTPError as e:
            print(n, 'HTTP', e.code)
            continue
        except OSError as e:
            print(n, 'errore di rete', e)
            continue
        w, hh, ctype, righe, _, _ = decodifica(body)
        if ctype == 6:
            visibili = sum(1 for riga in righe for i in range(3, len(riga), 4) if riga[i] > 0)
            forma = f'RGBA, pixel visibili {visibili}/{w * hh}'
        else:
            forma = f'tipo colore {ctype}'
        print(n, 200, 'etag', h.get('etag'), '| actual', h.get('layer-identifier-actual'),
              '|', len(body), 'B |', forma)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    cache_default = os.path.join(os.path.expanduser('~'), '.cache', 'trektrak-neve')
    for nome in ('misura', 'composito'):
        s = sub.add_parser(nome)
        s.add_argument('--cache', default=cache_default)
        s.add_argument('--sensori', default='terra,aqua', type=lambda v: v.split(','))
    sub.choices['misura'].add_argument('giorni', nargs='+')
    sub.choices['composito'].add_argument('oggi')
    sub.choices['composito'].add_argument('quanti', type=int)
    v = sub.add_parser('vuote')
    v.add_argument('url')
    v.add_argument('volte', type=int)
    args = ap.parse_args()
    if args.cmd in ('misura', 'composito'):
        os.makedirs(args.cache, exist_ok=True)
    {'misura': cmd_misura, 'composito': cmd_composito, 'vuote': cmd_vuote}[args.cmd](args)


if __name__ == '__main__':
    main()
