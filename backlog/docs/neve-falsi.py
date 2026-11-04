#!/usr/bin/env python3
"""La neve falsa del layer: da dove viene, e quale regola la toglie senza togliere la vera.

Rifà le misure della sezione «Neve falsa» di `neve-satellite-analisi.md`. Solo libreria
standard (niente numpy): lento, ma gira ovunque e non cambia sotto i piedi.

Perche' esiste
--------------
Il 3/11/2026 il layer mostrava neve sopra Chieti (330 m). Era una nube di ghiaccio che
MODIS Aqua aveva preso per neve il 2/11, e che il composito teneva a schermo per tre
giorni. Ogni filtro che toglie i falsi toglie anche neve vera in qualche stagione: per
scegliere serve una verita' di terreno, e la sola che vede la neve sottile e' Sentinel-2.

Impianto
--------
- Mosaico 2x2 di mattonelle GIBS z8 (~454 m/pixel a 42°N), per non avere bordi a ridosso
  dei punti che interessano (Chieti sta al pixel 19 della sua mattonella).
- Il composito e' quello dell'app (`neve-sorgente.ts` + `neve-composito.ts`): i passaggi di
  oggi sempre; poi la finestra (oggi, ieri, l'altro ieri; senza dati oggi, i tre prima);
  dentro il giorno l'ordine dei sensori; vince la prima vista non-nube (anche «acqua»).
- Le regole candidate cambiano solo QUALI viste di neve contano: una vista scartata vale
  come nube, e il pixel ricade sulla vista successiva.
- Quote: mattonelle Terrarium, stessa griglia z8.
- Verita': Sentinel-2 L2A (Earth Search), classe SCL 11 = neve, letta dalla panoramica a
  40 m del COG (campionata col piu' vicino: verificato, 65536/65536 valori presenti nel
  blocco 2x2 di partenza). Per pixel GIBS, 36 campioni a 80 m di passo: «neve» se almeno
  meta' dei campioni chiari e' neve, «senza» se al massimo uno lo e', «misto» altrimenti;
  non giudicato se meno dell'80% dei campioni e' chiaro (nubi, ombre, buio, nessun dato).

Uso
---
    python3 -I neve-falsi.py sensori [--cache C] MOSAICO GIORNO...
    python3 -I neve-falsi.py regole  [--cache C] MOSAICO OGGI
    python3 -I neve-falsi.py verita  [--cache C] MOSAICO GIORNO

MOSAICO: apennini (Lazio, Abruzzo, Molise) | dolomiti (Dolomiti, Veneto, Friuli).
`sensori`: per sensore, quanto spesso dice neve sotto la quota bassa (falsa a colpo sicuro
in autunno) e sopra quella alta. `regole`: ogni regola, pixel di neve per fascia di quota
(e attorno a Chieti). `verita`: ogni regola e ogni sensore contro Sentinel-2 dello stesso
giorno.

Cache: --cache (predefinita ~/.cache/trektrak-neve). Il «nessun dato» di GIBS si ricorda
solo per i giorni chiusi da piu' di 7 giorni: prima puo' ancora arrivare.
"""

import argparse
import datetime as dt
import json
import math
import os
import struct
import time
import urllib.error
import urllib.request
import zlib
from itertools import accumulate

GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
STAC = 'https://earth-search.aws.element84.com/v1/search'
UA = {'User-Agent': 'trektrak-misura-neve'}

LAYER = {
    'aqua': 'MODIS_Aqua_NDSI_Snow_Cover', 'noaa20': 'VIIRS_NOAA20_NDSI_Snow_Cover',
    'snpp': 'VIIRS_SNPP_NDSI_Snow_Cover', 'noaa21': 'VIIRS_NOAA21_NDSI_Snow_Cover',
    'terra': 'MODIS_Terra_NDSI_Snow_Cover',
}
ORDINE_APP = ('aqua', 'noaa20', 'snpp', 'noaa21', 'terra')  # SENSORI_NEVE in snow-cover.ts
MODIS = {'aqua', 'terra'}

MOSAICI = {
    'apennini': {'origine': (137, 94), 'bassa': 600, 'alta': 2000,
                 'fasce': [(-1e9, 600, '<600'), (600, 1200, '600-1200'), (1200, 1800, '1200-1800'),
                           (1800, 2000, '1800-2000'), (2000, 1e9, '>2000')]},
    'dolomiti': {'origine': (136, 90), 'bassa': 300, 'alta': 2500,
                 'fasce': [(-1e9, 300, '<300'), (300, 1000, '300-1000'), (1000, 1500, '1000-1500'),
                           (1500, 2000, '1500-2000'), (2000, 2500, '2000-2500'), (2500, 1e9, '>2500')]},
}
CHIETI = (42.351, 14.168)
L = 512  # lato del mosaico in pixel

# Codici del composito, come in snow-cover.ts: neve = 1..100 (l'NDSI).
SENZA, ACQUA, NONVISTO = 0, -1, -2
# Codici della verita'.
V_NEVE, V_SENZA, V_MISTO, V_ACQUA, V_IGNOTO = 1, 0, 2, -1, -2

# Regole candidate. Ognuna dice quali viste di neve contano.
REGOLE = {
    'attuale': {},
    'soglia indice 20': {'soglia': 20},
    'soglia indice 40': {'soglia': 40},
    # `conferma`: i sensori la cui neve conta solo se un'altra vista della finestra vede neve.
    'conferma 2 passaggi': {'conferma': set(ORDINE_APP)},
    'conferma solo MODIS': {'conferma': MODIS},
    'VIIRS prima di MODIS': {'ordine': ('noaa20', 'snpp', 'noaa21', 'aqua', 'terra')},
    'VIIRS, Terra, Aqua': {'ordine': ('noaa20', 'snpp', 'noaa21', 'terra', 'aqua')},
    'VIIRS prima + conferma MODIS': {'ordine': ('noaa20', 'snpp', 'noaa21', 'aqua', 'terra'), 'conferma': MODIS},
    'VIIRS, Terra, Aqua + conferma Aqua': {'ordine': ('noaa20', 'snpp', 'noaa21', 'terra', 'aqua'), 'conferma': {'aqua'}},
    # Quello che resta quando Terra e Aqua si spengono (avviso Earthdata: fine 2026 - inizio 2027).
    'solo VIIRS': {'ordine': ('noaa20', 'snpp', 'noaa21')},
    'niente neve fra le nubi': {'nube': (12, 0.5)},
    'quota relativa': {'quota': (44, 200, 0.2)},
}


# ---------------------------------------------------------------- rete e cache

def scarica(url, percorso, gibs=False, giorno=None):
    """Bytes, oppure None per il «nessun dato» di GIBS (200 senza header) e per i 404."""
    vuoto = percorso + '.nessuno'
    if os.path.exists(percorso):
        return open(percorso, 'rb').read()
    if os.path.exists(vuoto):
        return None
    for tentativo in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                if gibs and not r.headers.get('layer-identifier-actual'):
                    _ricorda_vuoto(vuoto, giorno)
                    return None
                dati = r.read()
            tmp = percorso + '.tmp'
            open(tmp, 'wb').write(dati)
            os.replace(tmp, percorso)
            return dati
        except urllib.error.HTTPError as e:
            if e.code == 404:
                _ricorda_vuoto(vuoto, giorno)
                return None
            if e.code < 500 or tentativo == 2:
                raise
        except urllib.error.URLError:
            if tentativo == 2:
                raise
        time.sleep(1 + tentativo)


def _ricorda_vuoto(percorso, giorno):
    # Un giorno recente puo' ancora essere pubblicato: si ricorda l'assenza solo dei giorni chiusi.
    if giorno and (dt.date.today() - dt.date.fromisoformat(giorno)).days > 7:
        open(percorso, 'wb').close()


# ---------------------------------------------------------------- PNG

def png(d):
    """(larghezza, altezza, tipo colore, pixel grezzi, tavolozza, tRNS). Tavolozza, RGB, RGBA."""
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'non e\' un PNG'
    p, idat, plte, trns = 8, b'', None, None
    while p < len(d):
        n = struct.unpack('>I', d[p:p + 4])[0]
        t, c = d[p + 4:p + 8], d[p + 8:p + 8 + n]
        if t == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', c[:10])
            assert bd == 8 and c[12] == 0, 'solo 8 bit non interlacciati'
        elif t == b'PLTE':
            plte = c
        elif t == b'tRNS':
            trns = c
        elif t == b'IDAT':
            idat += c
        p += 12 + n
    bpp = {3: 1, 2: 3, 6: 4}[ct]
    raw, stride = zlib.decompress(idat), w * bpp + 1
    out = bytearray(w * h * bpp)
    for y in range(h):
        f, s, o = raw[y * stride], y * stride + 1, y * w * bpp
        for x in range(w * bpp):
            a = out[o + x - bpp] if x >= bpp else 0
            b = out[o - w * bpp + x] if y else 0
            c = out[o - w * bpp + x - bpp] if (x >= bpp and y) else 0
            v = raw[s + x]
            if f == 1:
                v += a
            elif f == 2:
                v += b
            elif f == 3:
                v += (a + b) >> 1
            elif f == 4:
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                v += a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            out[o + x] = v & 0xff
    return w, h, ct, bytes(out), plte, trns


VERDE = (0, 255, 0)
COLORI_ACQUA = {(0, 0, 255), (35, 35, 117)}
COLORI_NON_VISTO = {(0, 191, 255), (189, 0, 189), (255, 200, 255), (200, 200, 200), (170, 0, 0), (255, 255, 255)}


def classi(plte, trns):
    """Copia di `classificaTavolozza` (snow-cover.ts): un codice per voce di tavolozza."""
    out = []
    for i in range(len(plte) // 3):
        rgb = tuple(plte[i * 3:i * 3 + 3])
        alfa = trns[i] if trns and i < len(trns) else 255
        if rgb == VERDE:
            out.append(SENZA)
        elif rgb in COLORI_ACQUA:
            out.append(ACQUA)
        elif rgb in COLORI_NON_VISTO:
            out.append(NONVISTO)
        elif 1 <= i <= 100 and alfa > 0:
            out.append(i)
        else:
            out.append(NONVISTO)
    return out


# ---------------------------------------------------------------- mosaico GIBS

def giorno_prima(g, n=1):
    return (dt.date.fromisoformat(g) - dt.timedelta(days=n)).isoformat()


class Mosaico:
    def __init__(self, nome, cache):
        self.nome, self.cache, self.conf = nome, cache, MOSAICI[nome]
        self.ox, self.oy = self.conf['origine']
        self._passaggi = {}
        self.quota = [0.0] * (L * L)
        for dx in (0, 1):
            for dy in (0, 1):
                tx, ty = self.ox + dx, self.oy + dy
                d = scarica(f'{TERRARIUM}/8/{tx}/{ty}.png', os.path.join(cache, f'terrarium_{tx}_{ty}.png'))
                _, _, ct, px, _, _ = png(d)
                bpp = 3 if ct == 2 else 4
                for i in range(65536):
                    j = (dy * 256 + i // 256) * L + dx * 256 + i % 256
                    self.quota[j] = px[i * bpp] * 256 + px[i * bpp + 1] + px[i * bpp + 2] / 256 - 32768

    def passaggio(self, sensore, giorno, dx, dy):
        """Codici dei 65536 pixel della mattonella (dx, dy) del mosaico, o None senza dati."""
        k = (sensore, giorno, dx, dy)
        if k not in self._passaggi:
            tx, ty = self.ox + dx, self.oy + dy
            url = f'{GIBS}/{LAYER[sensore]}/default/{giorno}/GoogleMapsCompatible_Level8/8/{ty}/{tx}.png'
            d = scarica(url, os.path.join(self.cache, f'{sensore}_{giorno}_{tx}_{ty}.png'), gibs=True, giorno=giorno)
            if d is None:
                self._passaggi[k] = None
            else:
                _, _, _, idx, plte, trns = png(d)
                cl = classi(plte, trns)
                self._passaggi[k] = [cl[v] if v < len(cl) else NONVISTO for v in idx]
        return self._passaggi[k]

    def viste(self, oggi, dx, dy, ordine=ORDINE_APP):
        """Le viste della mattonella nell'ordine del composito dell'app: [(giorno, sensore, codici)]."""
        candidati = [giorno_prima(oggi, n) for n in range(4)]
        di_oggi = [(oggi, s, self.passaggio(s, oggi, dx, dy)) for s in ordine]
        di_oggi = [v for v in di_oggi if v[2] is not None]
        finestra = candidati[0:3] if di_oggi else candidati[1:4]
        out = list(di_oggi)
        for g in finestra:
            if g == oggi:
                continue
            out += [(g, s, c) for s in ordine if (c := self.passaggio(s, g, dx, dy)) is not None]
        return out

    def indice(self, dx, dy, i):
        return (dy * 256 + i // 256) * L + dx * 256 + i % 256

    def pixel_di(self, lat, lon):
        fx = (lon + 180) / 360 * 256
        r = math.radians(lat)
        fy = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 256
        return int((fx - self.ox) * 256), int((fy - self.oy) * 256)

    def latlon(self, j):
        """Centro del pixel j del mosaico."""
        x = self.ox + (j % L + 0.5) / 256
        y = self.oy + (j // L + 0.5) / 256
        lon = x / 256 * 360 - 180
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 256))))
        return lat, lon


# ---------------------------------------------------------------- composito e regole

def integrale(v, lato=256):
    w = lato + 1
    I = [0] * (w * w)
    for y in range(lato):
        acc = 0
        for x in range(lato):
            acc += v[y * lato + x]
            I[(y + 1) * w + x + 1] = I[y * w + x + 1] + acc
    return I


def somma(I, x0, y0, x1, y1, lato=256):
    """Somma sul rettangolo [x0..x1] x [y0..y1], estremi inclusi."""
    w = lato + 1
    return I[(y1 + 1) * w + x1 + 1] - I[y0 * w + x1 + 1] - I[(y1 + 1) * w + x0] + I[y0 * w + x0]


def componi_mattonella(viste, regola, implausibili=frozenset()):
    """Il composito di una mattonella. Una vista di neve scartata dalla regola vale come nube."""
    n = 65536
    out = [NONVISTO] * n
    soglia = regola.get('soglia')
    conferma = regola.get('conferma')
    nube = regola.get('nube')
    if conferma:
        conta = [0] * n
        for _, _, c in viste:
            for i in range(n):
                if c[i] >= 1:
                    conta[i] += 1
    aperti = range(n)
    for g, s, c in viste:
        if nube:
            In = integrale([1 if v == NONVISTO else 0 for v in c])
            It = integrale([0 if v == ACQUA else 1 for v in c])
            R, C = nube
        restano = []
        for i in aperti:
            v = c[i]
            if v == NONVISTO:
                restano.append(i)
                continue
            if v >= 1:
                if soglia and v < soglia:
                    out[i] = SENZA  # sotto soglia vale «senza neve», come la Collection 5
                    continue
                if conferma and s in conferma and conta[i] < 2 or i in implausibili:
                    restano.append(i)
                    continue
                if nube:
                    x, y = i % 256, i // 256
                    a, b, cc, d = max(0, x - R), max(0, y - R), min(255, x + R), min(255, y + R)
                    terra = somma(It, a, b, cc, d)
                    if terra and somma(In, a, b, cc, d) / terra >= C:
                        restano.append(i)
                        continue
            out[i] = v
        aperti = restano
    return out


def componi(m, oggi, nome_regola):
    """Il composito del mosaico (L*L codici) con una regola."""
    regola = REGOLE[nome_regola]
    ordine = regola.get('ordine', ORDINE_APP)
    if 'quota' in regola:
        base = componi(m, oggi, 'attuale')
        implaus = implausibili_per_quota(m, base, *regola['quota'])
    out = [NONVISTO] * (L * L)
    for dx in (0, 1):
        for dy in (0, 1):
            imp = frozenset()
            if 'quota' in regola:
                imp = frozenset(i for i in range(65536) if m.indice(dx, dy, i) in implaus)
            mat = componi_mattonella(m.viste(oggi, dx, dy, ordine), regola, imp)
            for i in range(65536):
                out[m.indice(dx, dy, i)] = mat[i]
    return out


def implausibili_per_quota(m, comp, R, DELTA, F, NMIN=100):
    """Neve implausibile: entro R pixel, fra i pixel visti (neve o senza neve) piu' alti di
    almeno DELTA metri — soglia arrotondata in su ai 100 m — ce ne sono almeno NMIN, e meno
    di una frazione F e' neve. Se nevica in basso nevica anche sopra: se sopra e' verde, la
    neve in basso e' una nube. Un'immagine integrale per fascia, non una finestra per pixel."""
    visto = [c >= 0 for c in comp]
    neve = [c >= 1 for c in comp]
    per_fascia = {}
    for j in range(L * L):
        if neve[j]:
            per_fascia.setdefault(math.ceil((m.quota[j] + DELTA) / 100), []).append(j)
    out = set()
    for fascia, pixel in per_fascia.items():
        soglia = fascia * 100
        alti = [m.quota[k] >= soglia for k in range(L * L)]
        Iv = integrale([1 if visto[k] and alti[k] else 0 for k in range(L * L)], L)
        In = integrale([1 if neve[k] and alti[k] else 0 for k in range(L * L)], L)
        for j in pixel:
            x, y = j % L, j // L
            a, b, c, d = max(0, x - R), max(0, y - R), min(L - 1, x + R), min(L - 1, y + R)
            n = somma(Iv, a, b, c, d, L)
            if n >= NMIN and somma(In, a, b, c, d, L) / n < F:
                out.add(j)
    return out


# ---------------------------------------------------------------- Sentinel-2

def utm(lat, lon, zona):
    """WGS84 -> UTM nord (Snyder). Errore sotto il metro entro qualche grado dal meridiano."""
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    phi, lam = math.radians(lat), math.radians(lon)
    lam0 = math.radians((zona - 1) * 6 - 180 + 3)
    N = a / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    T, C, A = math.tan(phi) ** 2, ep2 * math.cos(phi) ** 2, math.cos(phi) * (lam - lam0)
    M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
             - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * phi)
             + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * phi)
             - (35 * e2 ** 3 / 3072) * math.sin(6 * phi))
    x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000
    y = k0 * (M + N * math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
                                       + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720))
    return x, y


def scene(m, giorno):
    """Le scene L2A del giorno sul mosaico, dalla meno nuvolosa."""
    lat_n, lon_o = m.latlon(0)
    lat_s, lon_e = m.latlon(L * L - 1)
    corpo = {'collections': ['sentinel-2-l2a'], 'bbox': [lon_o, lat_s, lon_e, lat_n],
             'datetime': f'{giorno}T00:00:00Z/{giorno}T23:59:59Z', 'limit': 200}
    req = urllib.request.Request(STAC, data=json.dumps(corpo).encode(), headers={**UA, 'Content-Type': 'application/json'})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    out = []
    if d.get('numberMatched', 0) > len(d['features']):
        print(f'  attenzione: {d["numberMatched"]} scene, lette {len(d["features"])}')
    for f in d['features']:
        p, a = f['properties'], f['assets'].get('scl')
        if not a:
            continue
        epsg = p.get('proj:epsg') or int(str(p.get('proj:code', '')).split(':')[-1])
        assert 32601 <= epsg <= 32660, f'proiezione inattesa {epsg}'
        out.append({'id': f['id'], 'nubi': p.get('eo:cloud_cover', 100), 'zona': epsg - 32600,
                    'href': a['href'], 'x0': a['proj:transform'][2], 'y0': a['proj:transform'][5]})
    return sorted(out, key=lambda s: s['nubi'])


class Scl:
    """La panoramica a 40 m (IFD 1) di un SCL.tif: deflate + predittore orizzontale."""

    def __init__(self, dati):
        assert dati[:4] == b'II*\x00', 'atteso un TIFF little-endian'
        self.d = dati
        off = struct.unpack('<I', dati[4:8])[0]
        ifd = []
        while off:
            n = struct.unpack('<H', dati[off:off + 2])[0]
            t = {}
            for k in range(n):
                tag, typ, cnt = struct.unpack('<HHI', dati[off + 2 + 12 * k: off + 10 + 12 * k])
                fmt = {3: 'H', 4: 'I', 16: 'Q'}.get(typ)
                if not fmt:
                    continue
                sz = struct.calcsize('<' + fmt) * cnt
                p = off + 10 + 12 * k
                raw = dati[p:p + 4] if sz <= 4 else dati[struct.unpack('<I', dati[p:p + 4])[0]:][:sz]
                t[tag] = struct.unpack('<' + fmt * cnt, raw[:sz])
            ifd.append(t)
            off = struct.unpack('<I', dati[off + 2 + 12 * n: off + 6 + 12 * n])[0]
        t = ifd[1]
        assert t[259][0] == 8 and t[317][0] == 2 and t[258][0] == 8, 'atteso deflate, predittore 2, 8 bit'
        self.lato, self.tw = t[256][0], t[322][0]
        self.per_riga = -(-self.lato // self.tw)
        self.off, self.cnt = t[324], t[325]
        self.passo = 5490 * 20 / self.lato  # metri per pixel della panoramica
        self._tasselli = {}

    def valore(self, r, c):
        k = (r // self.tw) * self.per_riga + c // self.tw
        t = self._tasselli.get(k)
        if t is None:
            raw = zlib.decompress(self.d[self.off[k]:self.off[k] + self.cnt[k]])
            tw = self.tw
            t = bytearray()
            for y in range(tw):
                t += bytes(v & 255 for v in accumulate(raw[y * tw:(y + 1) * tw]))
            self._tasselli[k] = t
        return t[(r % self.tw) * self.tw + c % self.tw]


CHIARI_SENZA = {4, 5}  # vegetazione, suolo nudo
NEVE_S2 = 11
ACQUA_S2 = 6
OFFSET = (-5, -3, -1, 1, 3, 5)  # 36 campioni a 80 m: copre ~440 m, il pixel GIBS


def verita_s2(m, giorno, cache):
    """Per ogni pixel del mosaico: V_NEVE / V_SENZA / V_MISTO / V_ACQUA / V_IGNOTO."""
    out = [V_IGNOTO] * (L * L)
    centri = [m.latlon(j) for j in range(L * L)]
    per_zona = {}
    usate = []
    for sc in scene(m, giorno):
        dati = scarica(sc['href'], os.path.join(cache, sc['id'] + '_SCL.tif'))
        if dati is None:
            continue
        scl = Scl(dati)
        if sc['zona'] not in per_zona:
            per_zona[sc['zona']] = [utm(lat, lon, sc['zona']) for lat, lon in centri]
        xy = per_zona[sc['zona']]
        decisi = 0
        for j in range(L * L):
            if out[j] != V_IGNOTO:
                continue
            x, y = xy[j]
            c, r = int((x - sc['x0']) / scl.passo), int((sc['y0'] - y) / scl.passo)
            if r < 6 or c < 6 or r >= scl.lato - 6 or c >= scl.lato - 6:
                continue
            neve = senza = acqua = 0
            for dr in OFFSET:
                for dc in OFFSET:
                    v = scl.valore(r + dr, c + dc)
                    if v == NEVE_S2:
                        neve += 1
                    elif v in CHIARI_SENZA:
                        senza += 1
                    elif v == ACQUA_S2:
                        acqua += 1
            if acqua >= 8:
                out[j] = V_ACQUA
            elif neve + senza >= 29:  # almeno l'80% dei 36 campioni chiaro
                out[j] = V_NEVE if neve * 2 >= neve + senza else V_SENZA if neve <= 1 else V_MISTO
            else:
                continue
            decisi += 1
        usate.append((sc['id'], sc['nubi'], decisi))
    return out, usate


def controllo_registrazione(ver, comp):
    """F1 della neve fra Sentinel-2 e il composito, spostando il composito di un pixel: se le
    due griglie sono allineate il massimo sta a spostamento zero. (La concordanza mare/terra
    sulla costa non serviva: i pixel costieri sono misti, dava 63% a ogni spostamento.)"""
    out = {}
    for sx, sy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        tp = fp = fn = 0
        for j in range(L * L):
            if ver[j] not in (V_NEVE, V_SENZA):
                continue
            x, y = j % L + sx, j // L + sy
            if not (0 <= x < L and 0 <= y < L):
                continue
            c = comp[y * L + x]
            if c < 0:
                continue
            if ver[j] == V_NEVE:
                tp += c >= 1
                fn += c == SENZA
            else:
                fp += c >= 1
        out[(sx, sy)] = 2 * tp / max(1, 2 * tp + fp + fn)
    return out


# ---------------------------------------------------------------- comandi

def cmd_sensori(m, giorni):
    falsi, bassi, neve_alta, alti = {}, {}, {}, {}
    for s in ORDINE_APP:
        falsi[s] = bassi[s] = neve_alta[s] = alti[s] = 0
        for g in giorni:
            for dx in (0, 1):
                for dy in (0, 1):
                    c = m.passaggio(s, g, dx, dy)
                    if c is None:
                        continue
                    for i in range(65536):
                        v = c[i]
                        if v < 0:
                            continue
                        q = m.quota[m.indice(dx, dy, i)]
                        if 0 < q < m.conf['bassa']:
                            bassi[s] += 1
                            falsi[s] += v >= 1
                        elif q > m.conf['alta']:
                            alti[s] += 1
                            neve_alta[s] += v >= 1
    print(f'{m.nome}, {giorni[0]}..{giorni[-1]}: pixel visti (neve o senza neve) per sensore')
    print(f'{"sensore":8s} {"neve sotto " + str(m.conf["bassa"]) + " m":>28s} {"neve sopra " + str(m.conf["alta"]) + " m":>28s}')
    for s in ORDINE_APP:
        print(f'{s:8s} {falsi[s]:9d} / {bassi[s]:7d} = {100 * falsi[s] / max(1, bassi[s]):5.1f}%'
              f' {neve_alta[s]:9d} / {alti[s]:7d} = {100 * neve_alta[s] / max(1, alti[s]):5.1f}%')


def cmd_regole(m, oggi):
    fasce = m.conf['fasce']
    cx, cy = m.pixel_di(*CHIETI)
    con_chieti = 0 <= cx < L and 0 <= cy < L
    print(f'{m.nome}, composito di {oggi}: pixel di neve per fascia di quota')
    print(f'{"regola":26s} ' + ' '.join(f'{n:>10s}' for _, _, n in fasce) + ('     Chieti' if con_chieti else ''))
    for nome in REGOLE:
        comp = componi(m, oggi, nome)
        riga = [sum(1 for j in range(L * L) if comp[j] >= 1 and lo <= m.quota[j] < hi) for lo, hi, _ in fasce]
        if con_chieti:
            riga.append(sum(1 for j in range(L * L) if comp[j] >= 1 and abs(j % L - cx) <= 15 and abs(j // L - cy) <= 15))
        print(f'{nome:26s} ' + ' '.join(f'{v:10d}' for v in riga))


def cmd_verita(m, giorno, cache):
    ver, usate = verita_s2(m, giorno, cache)
    terra = [j for j in range(L * L) if m.quota[j] > 0]
    nv = sum(1 for j in terra if ver[j] == V_NEVE)
    ns = sum(1 for j in terra if ver[j] == V_SENZA)
    nm = sum(1 for j in terra if ver[j] == V_MISTO)
    print(f'{m.nome}, {giorno}: Sentinel-2 su {len(usate)} scene; pixel di terra giudicati: '
          f'neve {nv}, senza neve {ns}, misti {nm}, non giudicati {len(terra) - nv - ns - nm}')
    reg = controllo_registrazione(ver, componi(m, giorno, 'attuale'))
    print('  registrazione (F1 della neve, composito spostato di un pixel):',
          ', '.join(f'{k}: {v:.3f}' for k, v in reg.items()))

    print(f'\n  Sensori, solo il passaggio di {giorno}, sui pixel giudicati da Sentinel-2:')
    print(f'  {"sensore":8s} {"neve vera: vista neve / nube / senza":>40s} {"senza neve: detta neve (falsi)":>34s}')
    for s in ORDINE_APP:
        vn = vnu = vse = sv = sn = 0
        presente = False
        for dx in (0, 1):
            for dy in (0, 1):
                c = m.passaggio(s, giorno, dx, dy)
                if c is None:
                    continue
                presente = True
                for i in range(65536):
                    j = m.indice(dx, dy, i)
                    if m.quota[j] <= 0:
                        continue
                    v = c[i]
                    if ver[j] == V_NEVE:
                        vn += v >= 1
                        vnu += v == NONVISTO
                        vse += v == SENZA
                    elif ver[j] == V_SENZA and v >= 0:
                        sv += 1
                        sn += v >= 1
        if not presente:
            print(f'  {s:8s} nessun dato')
            continue
        tot = max(1, vn + vnu + vse)
        print(f'  {s:8s} {100 * vn / tot:12.1f}% / {100 * vnu / tot:5.1f}% / {100 * vse / tot:5.1f}%  (su {vn + vnu + vse:6d})'
              f' {sn:9d} / {sv:6d} = {100 * sn / max(1, sv):4.1f}%')

    print(f'\n  Regole, composito di {giorno}, sui pixel giudicati da Sentinel-2:')
    print(f'  {"regola":26s} {"neve vera mostrata":>19s} {"vera detta senza":>17s} {"falsi":>7s} {"falsi <" + str(m.conf["bassa"]) + " m":>12s} {"falsi su mostrati":>18s}')
    for nome in REGOLE:
        comp = componi(m, giorno, nome)
        mostrata = detta_senza = falsi = falsi_bassi = mostrati = 0
        for j in terra:
            c, v = comp[j], ver[j]
            if v == V_NEVE:
                mostrata += c >= 1
                detta_senza += c == SENZA
            if v in (V_NEVE, V_SENZA) and c >= 1:
                mostrati += 1
            if v == V_SENZA and c >= 1:
                falsi += 1
                falsi_bassi += m.quota[j] < m.conf['bassa']
        print(f'  {nome:26s} {mostrata:7d} ({100 * mostrata / max(1, nv):5.1f}%) {detta_senza:9d} ({100 * detta_senza / max(1, nv):4.1f}%)'
              f' {falsi:7d} {falsi_bassi:12d} {100 * falsi / max(1, mostrati):17.1f}%')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('comando', choices=['sensori', 'regole', 'verita'])
    ap.add_argument('mosaico', choices=list(MOSAICI))
    ap.add_argument('giorni', nargs='+')
    ap.add_argument('--cache', default=os.path.expanduser('~/.cache/trektrak-neve'))
    a = ap.parse_args()
    os.makedirs(a.cache, exist_ok=True)
    m = Mosaico(a.mosaico, a.cache)
    if a.comando == 'sensori':
        cmd_sensori(m, a.giorni)
    elif a.comando == 'regole':
        cmd_regole(m, a.giorni[0])
    else:
        for g in a.giorni:
            cmd_verita(m, g, a.cache)
            print()


if __name__ == '__main__':
    main()
