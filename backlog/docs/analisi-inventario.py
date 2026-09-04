# -*- coding: utf-8 -*-
"""Inventario del codice: dimensioni, funzioni lunghe, annidamento, marcatori."""
import os, re, pathlib, collections, json, sys

RADICE = pathlib.Path('C:/Progettiscemi/TrekTrak')
SORGENTI = []
for cartella in ['src', 'e2e', 'e2e-offline']:
    for p in (RADICE / cartella).rglob('*'):
        if p.suffix in ('.ts', '.tsx') and p.is_file():
            SORGENTI.append(p)

def righe_di_codice(testo):
    """Righe che non sono vuote, commento di riga o riga di commento a blocco."""
    n = 0
    in_blocco = False
    for r in testo.split('\n'):
        s = r.strip()
        if in_blocco:
            if '*/' in s:
                in_blocco = False
            continue
        if s.startswith('/*'):
            if '*/' not in s:
                in_blocco = True
            continue
        if not s or s.startswith('//') or s.startswith('*'):
            continue
        n += 1
    return n

def profondita_massima(testo):
    massimo = livello = 0
    for c in testo:
        if c == '{':
            livello += 1
            massimo = max(massimo, livello)
        elif c == '}':
            livello = max(0, livello - 1)
    return massimo

def funzioni_lunghe(testo, soglia=60):
    """Blocchi function/=> con piu' di `soglia` righe di codice, contati sulle graffe."""
    righe = testo.split('\n')
    fuori = []
    for i, r in enumerate(righe):
        if not re.search(r'(function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(|export\s+(default\s+)?function)', r):
            continue
        livello = 0
        iniziato = False
        for j in range(i, min(len(righe), i + 600)):
            livello += righe[j].count('{') - righe[j].count('}')
            if righe[j].count('{'):
                iniziato = True
            if iniziato and livello <= 0:
                lunghezza = righe_di_codice('\n'.join(righe[i:j + 1]))
                if lunghezza > soglia:
                    nome = re.search(r'(?:function\s+(\w+)|const\s+(\w+))', r)
                    fuori.append((nome.group(1) or nome.group(2) if nome else '?', i + 1, lunghezza))
                break
    return fuori

prodotto = [p for p in SORGENTI if '__tests__' not in str(p) and not str(p).endswith('.test.ts') and not str(p).endswith('.test.tsx') and '\\e2e' not in str(p)]
prove = [p for p in SORGENTI if p not in prodotto]

tot_prod = sum(righe_di_codice(p.read_text(encoding='utf-8')) for p in prodotto)
tot_prove = sum(righe_di_codice(p.read_text(encoding='utf-8')) for p in prove)

print('== INVENTARIO ==')
print('file di prodotto: %d, righe di codice: %d' % (len(prodotto), tot_prod))
print('file di prova:    %d, righe di codice: %d  (rapporto %.2f)' % (len(prove), tot_prove, tot_prove / max(1, tot_prod)))

print('\n== I DIECI FILE DI PRODOTTO PIU GROSSI (righe di codice) ==')
grossi = sorted(((righe_di_codice(p.read_text(encoding='utf-8')), p) for p in prodotto), reverse=True)[:10]
for n, p in grossi:
    print('  %5d  %s' % (n, p.relative_to(RADICE)))

print('\n== FUNZIONI OLTRE 60 RIGHE DI CODICE ==')
tutte = []
for p in prodotto:
    for nome, riga, lung in funzioni_lunghe(p.read_text(encoding='utf-8')):
        tutte.append((lung, nome, p.relative_to(RADICE), riga))
for lung, nome, rel, riga in sorted(tutte, reverse=True)[:12]:
    print('  %4d righe  %-28s %s:%d' % (lung, nome, rel, riga))
print('  totale funzioni oltre soglia: %d' % len(tutte))

print('\n== ANNIDAMENTO (graffe) OLTRE 8 ==')
for p in prodotto:
    d = profondita_massima(p.read_text(encoding='utf-8'))
    if d > 8:
        print('  %2d  %s' % (d, p.relative_to(RADICE)))

print('\n== MARCATORI ==')
marcatori = collections.Counter()
dettaglio = collections.defaultdict(list)
for p in SORGENTI:
    t = p.read_text(encoding='utf-8')
    for etichetta, patt in [
        ('TODO/FIXME/XXX', r'\b(TODO|FIXME|XXX|HACK)\b'),
        ('any', r':\s*any\b|<any>|as any\b'),
        ('as unknown as', r'as unknown as'),
        ('eslint-disable', r'eslint-disable'),
        ('ts-ignore/expect-error', r'@ts-(ignore|expect-error)'),
        ('non-null !', r'\w!\.'),
    ]:
        trovati = re.findall(patt, t)
        if trovati:
            marcatori[etichetta] += len(trovati)
            dettaglio[etichetta].append((len(trovati), str(p.relative_to(RADICE))))
for etichetta, n in marcatori.most_common():
    print('  %-24s %4d' % (etichetta, n))
    for quanti, f in sorted(dettaglio[etichetta], reverse=True)[:4]:
        print('        %3d  %s' % (quanti, f))
