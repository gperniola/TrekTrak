'use client';

import { useEffect, useRef } from 'react';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useEmergencyStore } from '@/stores/emergencyStore';
import {
  CATEGORY_ICONS,
  CATEGORY_NAMES,
  type EmergencyLayerDef,
} from '@/lib/emergency-layers';
import { useOnline } from '@/lib/useOnline';
import { finestraRilevazioni, datoVecchio } from '@/lib/eta-focolai';
import { useAccendiLayer } from '@/lib/useAccendiLayer';
import { AvvisiLayer } from './AvvisiLayer';
import { DettaglioLayer } from './DettaglioLayer';

export { DISCLAIMER } from '@/lib/useAccendiLayer';

/**
 * Il pallino di stato, con la sua parola.
 *
 * Il colore da solo non basta: nella tabella del meteo il pallino era `aria-hidden` e
 * chi usa un lettore di schermo non sapeva nulla della gravità. Qui la parola entra nel
 * nome accessibile della riga.
 */
interface Indicatore { classe: string; parola: string; }

export function indicatoreStato(
  attivo: boolean,
  runtime: { status: string; partial?: boolean },
  online: boolean,
  stantio: boolean,
): Indicatore | null {
  if (!attivo) return null;
  if (!online) return { classe: 'bg-amber-400', parola: 'non disponibile offline' };
  if (runtime.status === 'loading') return { classe: 'bg-gray-400 animate-pulse', parola: 'in caricamento' };
  if (runtime.status === 'error') return { classe: 'bg-red-500', parola: 'errore' };
  if (runtime.status === 'nodata') return { classe: 'bg-amber-400', parola: 'nessun dato' };
  if (runtime.status === 'ready' && runtime.partial) return { classe: 'bg-amber-400', parola: 'dati parziali' };
  if (runtime.status === 'ready' && stantio) return { classe: 'bg-amber-400', parola: 'dati non aggiornati' };
  if (runtime.status === 'ready') return { classe: 'bg-green-500', parola: 'aggiornato' };
  return null;
}

interface Props {
  def: EmergencyLayerDef;
  aperta: boolean;
  onApri: () => void;
  /**
   * Il layer si e' appena acceso o spento. Serve al pannello per aprire il dettaglio
   * all'accensione e chiuderlo allo spegnimento (vedi `lib/riga-aperta`).
   */
  onInterruttore: (acceso: boolean) => void;
}

/**
 * **Una riga per layer: icona della categoria, nome, pallino di stato, interruttore.**
 *
 * Il nome e l'interruttore sono due bersagli **non annidati**: prima l'interruttore stava
 * dentro il pulsante che apre il dettaglio, e ogni tocco per accendere apriva anche la
 * fisarmonica.
 *
 * Gli avvisi e il dettaglio stanno nei loro file, e il gesto di accensione — con le sue
 * due guardie — in `lib/useAccendiLayer`.
 */
export function EmergencyLayerRow({ def, aperta, onApri, onInterruttore }: Props) {
  const settings = useItineraryStore((s) => s.settings);
  const runtime = useEmergencyStore((s) => s.layers[def.id]);
  const isStale = useEmergencyStore((s) => s.isStale);
  /*
   * `isStale` e l'eta' dei focolai leggono `Date.now()` in fase di render: senza qualcosa
   * che provochi un nuovo render, il badge «dati non aggiornati» non compariva mai — e
   * cioe' proprio quando serve. `nowTick` (5 min) e' quel qualcosa.
   */
  const nowTick = useEmergencyStore((s) => s.nowTick);
  const fires = useEmergencyStore((s) => s.fires);
  const dpc = useEmergencyStore((s) => s.dpc);
  const dpcSelectedDate = useEmergencyStore((s) => s.dpcSelectedDate);
  const online = useOnline();
  const accendi = useAccendiLayer(def.id);

  const active = settings.mapDisplay.emergencyLayers.includes(def.id);
  const stantio = active && isStale(def.id);
  const stato = indicatoreStato(active, runtime, online, stantio);

  /*
   * L'eta' VERA dei dati satellitari, che non e' l'ora in cui li abbiamo chiesti.
   */
  const finestraFocolai = def.id === 'fires-hotspots' && fires
    ? finestraRilevazioni(fires.points, nowTick)
    : null;
  const focolaiVecchi = finestraFocolai != null && datoVecchio(finestraFocolai);

  const giornoScelto = dpc?.days.find((d) => d.date === dpcSelectedDate);
  const giornataCalma = giornoScelto != null && giornoScelto.zones.every((z) => z.maxLevel === 0);

  /*
    **Il dettaglio segue l'interruttore**, e si reagisce ad `active` invece che al tocco.

    Il tocco dichiara un'intenzione, `active` dichiara un fatto: fra i due c'e' il
    disclaimer al primo uso, che e' un dialogo e si puo' annullare. Ascoltando il tocco si
    aprirebbe la legenda di un layer che poi non si accende.

    Il confronto col valore precedente serve a non far niente al montaggio: aprendo il
    pannello con tre layer gia' accesi, tre righe proverebbero ad aprirsi e vincerebbe
    l'ultima — che non e' quella che l'utente ha guardato per ultima.
  */
  const precedente = useRef(active);
  const avvisa = useRef(onInterruttore);
  avvisa.current = onInterruttore;
  useEffect(() => {
    if (precedente.current === active) return;
    precedente.current = active;
    avvisa.current(active);
  }, [active]);

  const idDettaglio = `dettaglio-${def.id}`;

  return (
    <div className="border-b border-gray-700 last:border-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onApri}
          aria-expanded={aperta}
          aria-controls={idDettaglio}
          /*
            Nome dichiarato invece che dedotto dal contenuto: aggiunge due cose che a
            schermo sono affidate a un'icona e a un colore (la categoria e lo stato), e
            il contenuto non le direbbe nella forma giusta — fra elementi diversi il
            browser infila uno spazio, e veniva letto "Radar pioggia , aggiornato".
          */
          aria-label={`${CATEGORY_NAMES[def.category]}: ${def.label}${stato ? `, ${stato.parola}` : ''}`}
          className="flex-1 flex items-center gap-2 py-2 text-left max-lg:min-h-[44px]
                     focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
        >
          <span aria-hidden="true" className="text-sm shrink-0">{CATEGORY_ICONS[def.category]}</span>
          <span className="text-sm text-gray-100 flex-1 leading-tight">{def.label}</span>
          {stato && (
            <span aria-hidden="true" className={`w-2 h-2 rounded-full shrink-0 ${stato.classe}`} />
          )}
          <span aria-hidden="true" className="text-gray-400 text-[10px] shrink-0">{aperta ? '▲' : '▼'}</span>
        </button>
        <button
          role="switch"
          aria-checked={active}
          aria-label={def.label}
          onClick={accendi}
          className="relative shrink-0 flex items-center justify-center rounded max-lg:min-h-[44px] max-lg:min-w-[44px] max-lg:px-2
                     focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          <span className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-amber-500' : 'bg-gray-600'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${active ? 'translate-x-5' : ''}`} />
          </span>
        </button>
      </div>

      {active && (
        <AvvisiLayer
          def={def}
          runtime={runtime}
          online={online}
          stantio={stantio}
          finestraFocolai={finestraFocolai}
          focolaiVecchi={focolaiVecchi}
          giornataCalma={giornataCalma}
        />
      )}

      {aperta && (
        <DettaglioLayer
          def={def}
          id={idDettaglio}
          attivo={active}
          runtime={runtime}
          finestraFocolai={finestraFocolai}
        />
      )}
    </div>
  );
}
