# Strumenti dell'analisi del codice

Due script, da eseguire dalla radice del repository:

```
python backlog/docs/analisi-inventario.py           # dimensioni, funzioni lunghe, annidamento, marcatori
python backlog/docs/analisi-morto-duplicazioni.py   # esportazioni non usate, blocchi duplicati, vocabolario, file senza test
```

Stanno qui, e non fra le dipendenze, per una ragione: sono venti righe a testa e servono
una volta l'anno. `knip`, `ts-prune` e `jscpd` farebbero lo stesso lavoro meglio, ma una
dipendenza va giustificata dall'uso quotidiano.

## Cosa NON sanno fare

Vanno letti sapendo dove sbagliano, o si finisce per mettere in un piano cose che non
esistono. Verificato sui dati veri il 2026-09-04:

- **Le funzioni lunghe si contano sulle graffe**, quindi una funzione dichiarata dentro un
  componente viene misurata fino alla fine del componente. In `ActionBar` risultavano
  `handleVerify` a 222 righe e `isStale` a 216: sono conteggi gonfiati, la funzione grossa
  e' una sola (il componente).
- **«Esportazione non usata» non vuol dire «codice morto»**: `generateRoadbookPDF` e
  `geometryContainsPoint` sono chiamate dentro il proprio file. Lo script lo segnala con
  «usata N volte solo qui», e va letto.
- **La ricerca del vocabolario conta parole, non identificatori**: «data» in italiano e
  `data` in inglese sono la stessa stringa, quindi i numeri indicano dove guardare, non
  quanto e' grave.
