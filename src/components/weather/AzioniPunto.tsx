'use client';

import { linkMeteoblue } from '@/lib/meteoblue';

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
 * Il contenuto rivelato: per ora una voce sola.
 *
 * Meteoblue si apre con un **link**, non coi suoi dati: la loro API vuole una chiave da
 * tenere su un server, e la pagina non si può leggere (risponde con una sfida Cloudflare).
 * Il link invece non chiede niente e porta l'utente alla fonte che consulta di suo.
 */
export function AzioniPunto({ lat, lon, nome }: { lat: number; lon: number; nome: string }) {
  const indirizzo = linkMeteoblue(lat, lon);
  // Senza coordinate valide non c'e' nessuna pagina da aprire: si dichiara invece di
  // offrire un collegamento che non porta da nessuna parte.
  if (indirizzo == null) {
    return <span className="text-[11px] text-gray-400">Nessuna azione: coordinate non disponibili.</span>;
  }
  return (
    <a
      href={indirizzo}
      target="_blank"
      // `noopener`: senza, la pagina aperta puo' manipolare quella che l'ha aperta.
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 underline max-lg:min-h-[44px]"
    >
      Apri «{nome}» su Meteoblue <span aria-hidden>↗</span>
    </a>
  );
}
