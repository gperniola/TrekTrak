# -*- coding: utf-8 -*-
"""Codice morto, duplicazioni, vocabolario misto, file senza prove."""
import re, pathlib, collections

RADICE = pathlib.Path('C:/Progettiscemi/TrekTrak')
TUTTI = [p for c in ['src', 'e2e', 'e2e-offline'] for p in (RADICE / c).rglob('*')
         if p.suffix in ('.ts', '.tsx') and p.is_file()]
def e_prova(p):
    s = str(p)
    return '__tests__' in s or s.endswith('.test.ts') or s.endswith('.test.tsx') or '\\e2e' in s
PRODOTTO = [p for p in TUTTI if not e_prova(p)]
TESTI = {p: p.read_text(encoding='utf-8') for p in TUTTI}

# --- 1. Esportazioni mai usate da nessun altro file
SPECIALI = {'default', 'dynamic', 'fetchCache', 'revalidate', 'runtime', 'metadata',
            'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'viewport', 'generateMetadata'}
morte = []
for p in PRODOTTO:
    t = TESTI[p]
    nomi = set()
    for m in re.finditer(r'^export\s+(?:async\s+)?(?:const|function|class|type|interface|enum)\s+(\w+)', t, re.M):
        nomi.add(m.group(1))
    for m in re.finditer(r'^export\s*\{([^}]*)\}', t, re.M):
        for pezzo in m.group(1).split(','):
            nome = pezzo.split(' as ')[-1].strip()
            if nome:
                nomi.add(nome)
    for nome in sorted(nomi - SPECIALI):
        usato_fuori = False
        for altro, testo in TESTI.items():
            if altro == p:
                continue
            if re.search(r'\b' + re.escape(nome) + r'\b', testo):
                usato_fuori = True
                break
        if not usato_fuori:
            # Usato almeno due volte nel file stesso? Allora e' interno, non morto.
            interni = len(re.findall(r'\b' + re.escape(nome) + r'\b', t))
            morte.append((nome, str(p.relative_to(RADICE)), interni))

print('== ESPORTAZIONI CHE NESSUN ALTRO FILE USA (%d) ==' % len(morte))
for nome, f, interni in sorted(morte, key=lambda x: x[1]):
    nota = 'mai usata nemmeno qui' if interni <= 1 else 'usata %d volte solo qui' % interni
    print('  %-30s %-52s %s' % (nome, f, nota))

# --- 2. Blocchi duplicati (>= 8 righe di codice identiche)
def normalizza(t):
    fuori = []
    for r in t.split('\n'):
        s = r.strip()
        if not s or s.startswith('//') or s.startswith('*') or s.startswith('/*'):
            fuori.append(None)
        else:
            fuori.append(re.sub(r'\s+', ' ', s))
    return fuori

FINESTRA = 8
impronte = collections.defaultdict(list)
for p in TUTTI:
    righe = normalizza(TESTI[p])
    for i in range(len(righe) - FINESTRA):
        blocco = righe[i:i + FINESTRA]
        if any(x is None for x in blocco):
            continue
        impronte['\n'.join(blocco)].append((str(p.relative_to(RADICE)), i + 1))

dup = {k: v for k, v in impronte.items() if len(v) > 1}
# Si tengono solo i blocchi in file diversi: dentro lo stesso file spesso e' JSX ripetuto.
tra_file = {k: v for k, v in dup.items() if len({f for f, _ in v}) > 1}
print('\n== BLOCCHI DI >=%d RIGHE DUPLICATI FRA FILE DIVERSI: %d ==' % (FINESTRA, len(tra_file)))
visti = set()
for blocco, dove in sorted(tra_file.items(), key=lambda x: -len(x[1]))[:40]:
    chiave = tuple(sorted({f for f, _ in dove}))
    if chiave in visti:
        continue
    visti.add(chiave)
    print('  %s' % ' | '.join('%s:%d' % d for d in dove[:3]))
    print('        prima riga: %s' % blocco.split('\n')[0][:88])

# --- 3. Vocabolario: identificatori inglesi nei file nuovi, italiani nei vecchi
INGLESI = ['handle', 'toggle', 'fetch', 'update', 'compute', 'render', 'point', 'target',
           'user', 'value', 'label', 'active', 'level', 'distance', 'result', 'error',
           'data', 'index', 'count', 'list', 'item', 'name', 'date', 'time']
ITALIANI = ['punto', 'bersaglio', 'utente', 'valore', 'etichetta', 'attivo', 'livello',
            'distanza', 'esito', 'errore', 'dati', 'indice', 'quanti', 'elenco', 'voce',
            'nome', 'data', 'ora', 'anello', 'quota', 'vista', 'giorno', 'raggio']
misti = []
for p in PRODOTTO:
    t = TESTI[p]
    ing = sum(len(re.findall(r'\b' + w + r'\w*\b', t, re.I)) for w in INGLESI)
    ita = sum(len(re.findall(r'\b' + w + r'\w*\b', t, re.I)) for w in ITALIANI)
    if ing + ita > 20:
        misti.append((ing, ita, str(p.relative_to(RADICE))))
print('\n== FILE CON VOCABOLARIO MISTO (piu di 20 occorrenze, entrambe le lingue >25%%) ==')
for ing, ita, f in sorted(misti, key=lambda x: -min(x[0], x[1]))[:14]:
    quota = min(ing, ita) / (ing + ita)
    if quota > 0.25:
        print('  inglese %3d / italiano %3d  (%.0f%% minoranza)  %s' % (ing, ita, quota * 100, f))

# --- 4. File di prodotto che nessun test nomina
senza = []
for p in PRODOTTO:
    nome = p.stem
    if nome in ('layout', 'page', 'globals', 'tema'):
        continue
    citato = any(re.search(r'\b' + re.escape(nome) + r'\b', TESTI[q]) for q in TUTTI if e_prova(q))
    if not citato:
        senza.append(str(p.relative_to(RADICE)))
print('\n== FILE DI PRODOTTO CHE NESSUN TEST NOMINA (%d su %d) ==' % (len(senza), len(PRODOTTO)))
for f in senza:
    print('  %s' % f)
