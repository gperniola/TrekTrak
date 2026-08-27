/**
 * Il manifest giornaliero del bollettino DPC: `files/<bulletinId>.json`, **~2,4 KB**
 * contro i ~400 KB compressi delle geometrie.
 *
 * Non contiene i livelli per zona, ma il riepilogo nazionale della giornata, e tanto
 * basta per la domanda più frequente. Confronto misurato sui dati reali:
 *
 *   giorno con allerte:  "ORDINARIA CRITICITA' PER RISCHIO TEMPORALI / ALLERTA GIALLA:
 *                         Emilia Romagna : Montagna piacentino-parmense, ..."
 *   giorno tranquillo:   "ASSENZA DI FENOMENI SIGNIFICATIVI PREVEDIBILI / NESSUNA ALLERTA"
 *
 * Se in tutta Italia non ci sono allerte, nessuna posizione può cadere in una zona in
 * allerta: si conclude senza scaricare le geometrie.
 */

export interface DpcManifestDay {
  /** Sì, la chiave del servizio è scritta così. */
  html_descrition?: string;
  topo_json?: string;
}

export interface DpcManifest {
  name?: string;
  today?: DpcManifestDay;
  tomorrow?: DpcManifestDay;
}

export function isDpcManifest(v: unknown): v is DpcManifest {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  // Basta che almeno uno dei due giorni ci sia e sia un oggetto.
  return ['today', 'tomorrow'].some((k) => typeof o[k] === 'object' && o[k] !== null);
}

const NO_ALERT = /nessuna\s+allerta/i;
const ANY_ALERT = /allerta\s+(gialla|arancione|rossa)/i;

/**
 * `true` **solo** quando il riepilogo dice, senza ambiguità, che per quel giorno non
 * ci sono allerte da nessuna parte.
 *
 * La polarità è deliberata e non è simmetrica: si salta il controllo completo solo su
 * una corrispondenza **positiva** di "nessuna allerta" in assenza di qualunque livello
 * nominato. Qualsiasi altro testo — una formulazione nuova, una traduzione, un campo
 * vuoto — ricade su `false`, cioè "scarica le geometrie e verifica".
 *
 * Al contrario (cercare le allerte e concludere "tranquillo" se non le trovo) un
 * cambio di frase produrrebbe un falso "nessuna allerta": la direzione di errore
 * pericolosa, e la stessa su cui è ruotata la campagna di review della v0.11.0.
 */
export function describesNoAlerts(description: string | undefined | null): boolean {
  if (typeof description !== 'string') return false;
  const testo = description.replace(/<[^>]+>/g, ' ');
  if (ANY_ALERT.test(testo)) return false;
  return NO_ALERT.test(testo);
}
