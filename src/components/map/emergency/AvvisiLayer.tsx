'use client';

import { useEmergencyStore } from '@/stores/emergencyStore';
import { dataBollettino } from '@/lib/avalanche-api';
import { descriviEta, type FinestraRilevazioni } from '@/lib/eta-focolai';
import type { EmergencyLayerDef } from '@/lib/emergency-layers';
import type { LayerRuntime } from '@/stores/emergencyStore';

interface Props {
  def: EmergencyLayerDef;
  runtime: LayerRuntime;
  online: boolean;
  stantio: boolean;
  finestraFocolai: FinestraRilevazioni | null;
  focolaiVecchi: boolean;
  /** Bollettino valido e nessuna zona sopra il livello 0: è il caso più frequente. */
  giornataCalma: boolean;
}

/**
 * **Cosa resta visibile a riga chiusa: tutto quello che qualifica l'ATTENDIBILITÀ del
 * dato.**
 *
 * Il dettaglio del layer si comprime quando va tutto bene, non quando c'è qualcosa da
 * sapere: un pallino colorato che non spiega niente sarebbe un passo indietro. Queste
 * righe sono la ragione per cui il pannello riordinato della v0.14.0 non ha perso
 * informazione.
 *
 * Sono ottanta righe di casi, e stavano dentro `EmergencyLayerRow` come una variabile in
 * mezzo al componente.
 */
export function AvvisiLayer(
  { def, runtime, online, stantio, finestraFocolai, focolaiVecchi, giornataCalma }: Props,
) {
  const retryLayer = useEmergencyStore((s) => s.retryLayer);
  const avalanche = useEmergencyStore((s) => s.avalanche);
  const xyzGiorno = useEmergencyStore((s) => s.xyzGiorno);

  return (
    <div className="space-y-0.5 pb-1.5">
      {/* Spec §6: da offline la riga dice "non disponibile offline", non un errore di
          rete. I dati di emergenza sono esclusi dalla cache di proposito. */}
      {!online && <div className="text-[10px] text-amber-400">⚠ non disponibile offline</div>}
      {online && runtime.status === 'error' && (
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-red-400 flex-1">⚠ {runtime.error}</div>
          <button
            onClick={() => retryLayer(def.id)}
            className="shrink-0 px-2 py-0.5 text-[10px] rounded bg-gray-700 hover:bg-gray-600 text-gray-100 max-lg:min-h-[32px]"
          >
            Riprova
          </button>
        </div>
      )}
      {/* "nessun dato" non è un guasto: la fonte ha risposto e per quel giorno non c'è
          nulla. Va detto, non lasciato indovinare da una mappa vuota. */}
      {runtime.status === 'nodata' && (
        <div className="text-[10px] text-gray-300">
          Nessun dato disponibile{runtime.error ? ` — ${runtime.error}` : ''}
        </div>
      )}
      {runtime.partial && runtime.status === 'ready' && (
        <div className="text-[10px] text-amber-400">
          {/*
            "Parziale" vuol dire cose diverse a seconda del layer, e un messaggio riusato
            dice il falso: per i ripari e i terremoti l'elenco e' stato TAGLIATO da un
            tetto nostro, per le valanghe una regione su nove non ha risposto, per i
            focolai qualche sensore. Tre cause, tre frasi.
          */}
          {def.id === 'shelters'
            ? '⚠ troppi ripari in quest’area: ne vedi solo una parte, avvicinati per l’elenco completo'
            : def.id === 'earthquakes'
              ? '⚠ molti eventi in corso: ne vedi solo i primi 300'
              : def.id === 'avalanche-danger'
                ? '⚠ bollettino incompleto: qualche servizio regionale non ha risposto'
                : '⚠ dati parziali: alcune fonti non hanno risposto'}
        </div>
      )}
      {/* Prima questo avviso stava attaccato all'orario; ora che l'orario è materiale di
          consultazione e sta nel dettaglio, l'avviso deve reggersi da solo. */}
      {stantio && runtime.status === 'ready' && (
        <div className="text-[10px] text-amber-400">⚠ dati non aggiornati</div>
      )}
      {/*
        Focolai vecchi: oltre le sei ore l'eta' del dato non e' piu' materiale di
        consultazione ma una cosa da sapere prima di fidarsi della mappa — il satellite
        passa due volte al giorno, e fra un passaggio e l'altro non si vede niente.
      */}
      {focolaiVecchi && finestraFocolai && (
        <div className="text-[10px] text-amber-400">
          ⚠ ultimo passaggio del satellite {descriviEta(finestraFocolai.etaMinuti)}
        </div>
      )}
      {/*
        DI CHE GIORNO e' il dato.

        Vale per i due layer che mostrano una giornata precisa e non "adesso": il
        bollettino valanghe (uno al giorno, e in stagione quello del pomeriggio vale per
        il giorno dopo) e l'immagine satellitare della neve (un passaggio al giorno, e col
        ripiego puo' essere di ieri). L'orario in cui li abbiamo CHIESTI non dice niente
        su quale giornata stiano descrivendo: e' la distinzione che in questo progetto e'
        gia' costata due rilasci.
      */}
      {def.id === 'avalanche-danger' && avalanche?.bulletinDate != null && runtime.status === 'ready' && (
        <div className="text-[10px] text-gray-300">
          Bollettino del {dataBollettino(avalanche.bulletinDate)} · {avalanche.zones.length}
          {avalanche.zones.length === 1 ? ' zona' : ' zone'} in questa vista
        </div>
      )}
      {def.id === 'snow-cover' && xyzGiorno['snow-cover'] != null && runtime.status === 'ready' && (
        <div className="text-[10px] text-gray-300">
          Immagine del {dataBollettino(xyzGiorno['snow-cover'] as string)}
        </div>
      )}
      {/* Giornata calma: senza questa riga un layer acceso su una mappa vuota è
          indistinguibile da un layer rotto, e sono la maggioranza dei giorni. */}
      {def.id === 'dpc-alerts' && giornataCalma && (
        <div className="text-[10px] text-green-400">Nessuna zona in allerta per questo giorno</div>
      )}
    </div>
  );
}
