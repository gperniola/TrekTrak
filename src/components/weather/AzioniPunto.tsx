'use client';

import { linkMeteoblue } from '@/lib/meteoblue';
import { metri, numero } from '@/lib/formato';
import type { RigaPercorso } from '@/lib/route-weather';

/**
 * Le **azioni di un punto** del meteo del percorso.
 *
 * ## Perché una fisarmonica e non una tendina
 *
 * La prima versione era un menu in posizione assoluta sopra la tabella. Misurato il
 * 2026-09-09: la tabella vive dentro un contenitore con `overflow-x: auto`, e **`overflow-x`
 * diverso da `visible` forza anche `overflow-y`** — quindi il menu dell'ultima riga
 * sbordava di 52 px e veniva ritagliato, aggiungendo una barra di scorrimento dentro la
 * tabella. Il difetto non si vedeva sulla prima riga, che è quella che avevo guardato.
 *
 * Aprire il dettaglio **in una riga sotto** toglie il problema alla radice invece di
 * aggirarlo: nessun posizionamento assoluto, niente da ritagliare. Ed è l'idioma che
 * l'app usa già nel pannello dei layer (v0.14.0), dove il dettaglio si apre a fisarmonica
 * una riga per volta.
 *
 * ## Perché non è un `role="menu"`
 *
 * Un menu ARIA promette la gestione del fuoco: freccia giù nella lista, fuoco che torna
 * al pulsante alla chiusura. Non l'avevamo, e dichiararlo sarebbe stato peggio che non
 * dichiararlo. Questo è ciò che è davvero: un pulsante che **rivela** un blocco
 * (`aria-expanded` + `aria-controls`), il modello più semplice e quello che i lettori di
 * schermo gestiscono senza sorprese.
 */

/** Il pulsante ⋮ che rivela le azioni del punto. */
export function BottoneAzioniPunto(
  { nome, aperto, idPannello, onToggle }:
  { nome: string; aperto: boolean; idPannello: string; onToggle: () => void },
) {
  return (
    <button
      type="button"
      aria-expanded={aperto}
      aria-controls={idPannello}
      // Il nome dice DI QUALE punto: al tocco non esiste nessun `title` da leggere, e
      // «altre azioni» ripetuto su ogni riga non distinguerebbe niente.
      aria-label={`Altre azioni per «${nome}»`}
      onClick={onToggle}
      className="text-gray-400 hover:text-gray-200 px-1 rounded max-lg:min-w-[44px] max-lg:min-h-[44px]"
    >
      <span aria-hidden>⋮</span>
    </button>
  );
}

/**
 * Il contenuto rivelato: il link a Meteoblue e i **numeri che la tabella non mostra**.
 *
 * Meteoblue si apre con un **link**, non coi suoi dati: la loro API vuole una chiave da
 * tenere su un server, e la pagina non si può leggere (risponde con una sfida Cloudflare).
 * Il link invece non chiede niente e porta l'utente alla fonte che consulta di suo.
 *
 * Qui sotto stanno i dati che dalla tabella sono stati tolti perché a colpo d'occhio non
 * servono — il CAPE su tutti — ma che chi vuole capire *perché* un punto è arancione deve
 * poter vedere. Toglierli dalla tabella non vuol dire nasconderli.
 */
export function AzioniPunto({ riga }: { riga: RigaPercorso }) {
  const indirizzo = linkMeteoblue(riga.lat, riga.lon);
  const nome = riga.name || 'senza nome';
  return (
    <div className="space-y-1">
      {indirizzo != null ? (
        <a
          href={indirizzo}
          target="_blank"
          // `noopener`: senza, la pagina aperta puo' manipolare quella che l'ha aperta.
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 underline max-lg:min-h-[44px]"
        >
          Leggi previsione Meteoblue per «{nome}» <span aria-hidden>↗</span>
        </a>
      ) : (
        // Senza coordinate valide non c'e' nessuna pagina da aprire: si dichiara invece
        // di offrire un collegamento che non porta da nessuna parte.
        <span className="text-[11px] text-gray-400">Coordinate non disponibili: nessuna pagina da aprire.</span>
      )}
      <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
        <div className="flex gap-1">
          <dt>CAPE</dt>
          <dd className="text-gray-300">
            {Number.isFinite(riga.hour?.cape)
              ? `${numero(riga.hour!.cape, 0)} J/kg`
              : 'n/d'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>quota del modello</dt>
          <dd className="text-gray-300">
            {riga.modelElevation != null ? metri(riga.modelElevation) : 'n/d'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
