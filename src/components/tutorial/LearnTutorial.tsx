'use client';

import { useUIStore } from '@/stores/uiStore';
import { mostra, type Area, type Profilo } from '@/lib/profilo';
import { useState, useEffect, useRef } from 'react';
import { KEYS } from '@/lib/storage';
import { markWhatsNewSeen } from './WhatsNew';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useModaleTastiera } from '@/lib/useModaleTastiera';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { AnimazionePrimiPassi } from './AnimazionePrimiPassi';

interface TutorialStep {
  title: string;
  text: string;
  icon: string;
  mockup?: React.ReactNode;
  /**
   * Area del profilo d'uso a cui il passo appartiene. Senza campo, il passo vale per
   * tutti. La guida non deve raccontare funzioni che il profilo ha nascosto: in Montagna
   * — il default — spiegare l'interruttore Learn/Track o il pulsante «Verifica» sarebbe
   * descrivere un'app che chi guarda non ha davanti.
   */
  area?: Area;
  /** Fa parte del primo contatto (vedi `quantiEssenziali`). */
  essenziale?: boolean;
}

function MenuMockup({ highlight }: { highlight?: 'fields' | 'verify' | 'badges' }) {
  return (
    <div className="mt-3 bg-gray-800 rounded-lg border border-gray-600 p-2 text-xs">
      <div className="flex gap-1 mb-2">
        <span className="flex-1 py-1 text-center bg-purple-600 rounded-l text-su-colore font-bold">Impara</span>
        <span className="flex-1 py-1 text-center bg-gray-700 rounded-r text-gray-400">Pianificazione</span>
      </div>
      <div className="bg-gray-900 rounded p-2 mb-1">
        <div className="text-green-400 font-bold mb-1">1. Partenza</div>
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-gray-800 rounded px-1 py-0.5 text-gray-400">Lat</div>
          <div className="bg-gray-800 rounded px-1 py-0.5 text-gray-400">Lon</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'badges' ? 'text-white' : 'text-gray-400'}`}>
            Alt {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-green-600 text-[8px] text-center leading-3 ml-0.5">✓</span>}
          </div>
        </div>
      </div>
      <div className={`bg-gray-900 rounded p-2 mb-1 border-l-2 border-green-400 ${highlight === 'fields' ? 'ring-1 ring-green-400/50' : ''}`}>
        <div className="grid grid-cols-4 gap-1">
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-400'}`}>
            Dist {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-yellow-600 text-[8px] text-center leading-3 ml-0.5">~</span>}
          </div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-400'}`}>D+</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-400'}`}>D-</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-400'}`}>
            Azim. {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-red-600 text-[8px] text-center leading-3 ml-0.5">✗</span>}
          </div>
        </div>
      </div>
      {highlight === 'verify' && (
        <div className="flex justify-end mt-1">
          <span className="bg-green-700 text-su-colore px-2 py-0.5 rounded font-bold animate-pulse">Verifica</span>
        </div>
      )}
    </div>
  );
}

function SettingsMockup() {
  return (
    <div className="mt-3 bg-gray-800 rounded-lg border border-gray-600 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-gray-300 font-medium">Percorso su sentiero</div>
          <div className="text-[9px] text-gray-400">Distanza e D+/D- lungo i sentieri reali</div>
        </div>
        <div className="w-9 h-5 bg-green-600 rounded-full relative">
          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-gray-300 font-medium">Percorso colorato</div>
          <div className="text-[9px] text-gray-400">Colora la linea per pendenza</div>
        </div>
        <div className="w-9 h-5 bg-green-600 rounded-full relative">
          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Il disegnino deve somigliare alla barra VERA di chi lo guarda: il quiz e
 * l'interruttore Learn/Track esistono solo in Imparo. Legge il profilo da se' invece di
 * farselo passare, perche' l'array dei passi si costruisce una volta al caricamento del
 * modulo mentre questo e' un componente e si ridisegna a ogni cambio.
 */
function ToolbarMockup() {
  const profilo = useUIStore((s) => s.profilo);
  return (
    <div className="mt-3 bg-gray-800 rounded-lg border border-gray-600 p-2 flex items-center gap-1 text-xs">
      <span className="px-2 py-1 bg-amber-700 text-su-colore rounded font-bold">◎</span>
      <span className="px-2 py-1 bg-blue-600 text-su-colore rounded font-bold">↕</span>
      {mostra('quiz', profilo) && (
        <span className="px-2 py-1 bg-purple-600 text-su-colore rounded font-bold">?</span>
      )}
      {mostra('switchLearnTrack', profilo) && (
        <>
          <span className="flex-1 py-1 text-center bg-purple-600 text-su-colore rounded font-bold">Impara</span>
          <span className="flex-1 py-1 text-center bg-gray-700 text-gray-400 rounded">Pianificazione</span>
        </>
      )}
    </div>
  );
}

const STEPS: TutorialStep[] = [
  {
    title: 'Benvenuto in TrekTrak!',
    /*
     * Il benvenuto dice il CICLO dell'app in una frase — tocca la mappa, rifinisci
     * nell'Editor, guarda il meteo — perche' e' la prima cosa letta in assoluto e deve
     * rispondere a «cosa ci faccio, qui?». Solo la promessa: le meccaniche stanno nei
     * passi loro, e ripeterle qui era dire tre volte le stesse cose (rilievo utente,
     * 2026-09-05). La frase sui due usi e' andata via con la scelta del livello: l'app
     * parte da trekking, e la palestra di cartografia sta nelle «Altre funzionalita'».
     */
    text: 'Prepara l’escursione: metti i punti del percorso toccando la mappa, rifiniscili nell’Editor, e prima di partire sai che meteo troverai lungo il cammino. Il giro completo, in sette secondi:',
    icon: '🗺️',
    mockup: <AnimazionePrimiPassi />,
    essenziale: true,
  },
  {
    title: 'I waypoint',
    /*
     * Il «tocca la mappa» sta gia' nel benvenuto: qui solo quello che il benvenuto non
     * dice — spostare, dare nome e quota, togliere, e il ritorno in un tocco.
     */
    text: 'Trascina un marker per spostarlo; il nome arriva da solo dal luogo più vicino, e nell’Editor scrivi quota e note. Sulla mappa, il cestino 🗑️ toglie l’ultimo punto o tutti, e ↩️ aggiunge il ritorno per la stessa strada.',
    icon: '📍',
    essenziale: true,
  },
  {
    title: 'Impara e Pianificazione',
    text: 'In «Impara» scrivi tu distanza, dislivello e azimuth, poi con "Verifica" li confronti con i dati reali. In «Pianificazione» li calcola l\'app. Puoi passare da una all\'altra quando vuoi: i valori delle due modalità restano salvati separatamente, quindi non perdi niente.',
    icon: '✏️',
    mockup: <MenuMockup highlight="fields" />,
    area: 'switchLearnTrack',
    essenziale: true,
  },
  {
    title: 'Verifica e feedback',
    text: 'Premi "Verifica" per confrontare i tuoi valori. Appaiono icone colorate: ✓ preciso (verde), ~ vicino (giallo), ✗ lontano (rosso). Toccale per vedere il valore esatto e lo scostamento.',
    icon: '✅',
    mockup: <MenuMockup highlight="badges" />,
    area: 'validazione',
    essenziale: true,
  },
  {
    /*
     * Il passo essenziale di chi va in montagna, al posto dei due su Learn/Track e
     * Verifica: senza questo il primo contatto in quel profilo sarebbe stato due schermi
     * — cosa fa l'app e come si mettono i waypoint — e nessuna parola sulle funzioni per
     * cui l'app serve davvero in quota.
     */
    title: 'Pronto per la gita',
    /*
     * Niente ripetizioni del benvenuto («l'app calcola», «il meteo c'e'»): qui il
     * DETTAGLIO che il benvenuto promette — cosa dice davvero «Quando partire», e cosa
     * accende ⚠️.
     */
    text: '«Quando partire» ti dice a che ora sei in ogni punto e che tempo trovi lì a quell’ora, col verdetto sulla fascia critica della giornata. Il pulsante ⚠️ sulla mappa accende radar della pioggia, focolai, allerte e rifugi.',
    icon: '🥾',
    area: 'layerEmergenza',
    essenziale: true,
  },
  {
    /*
     * La palestra di cartografia sta QUI, fra le altre funzionalita', e non piu' come
     * domanda d'ingresso (richiesta utente, 2026-09-05): l'app e' prima di tutto da
     * trekking, e chiedere «sto imparando o sono esperto» a chi vuole solo preparare una
     * gita era un bivio prima ancora di aver visto la mappa. Il passo resta visibile
     * anche in Imparo, con la carta che mostra lo stato: e' il riscontro della v0.11.8 —
     * una scelta fatta deve restare leggibile, non sparire.
     */
    title: 'Impara la cartografia',
    text: 'TrekTrak è anche una palestra: in modalità «Impara» distanze, dislivelli e azimut li calcoli tu su carta, e «Verifica» li confronta coi valori veri del terreno — con quiz e registro dei progressi. Si attiva qui sotto, o quando vuoi da «Modalità» in cima all’Editor.',
    icon: '🎓',
    mockup: <AttivaImpara />,
  },
  {
    title: 'Strumenti mappa',
    text: 'Sulla mappa trovi la Bussola (◎) per l\'azimuth in tempo reale col GPS e il Righello (↕) per misurare distanza e quota tra due punti.',
    icon: '🧭',
    mockup: <ToolbarMockup />,
  },
  {
    title: 'Quiz',
    text: 'Il Quiz (?) mette alla prova quello che hai imparato: legge i dati del tuo itinerario e ti chiede distanze, dislivelli e azimuth. Le risposte finiscono nel Progresso insieme alle verifiche.',
    icon: '❓',
    area: 'quiz',
  },
  {
    title: 'Impostazioni mappa',
    text: 'Tocca ⚙️ per scegliere tra 4 mappe diverse, attivare i sentieri escursionistici, la griglia coordinate, il percorso colorato per pendenza e il tracciamento su sentiero.',
    icon: '⚙️',
    mockup: <SettingsMockup />,
  },
  {
    title: 'Profilo interattivo',
    text: 'Il grafico in basso mostra il profilo altimetrico colorato per pendenza. Passa il dito sul grafico per vedere il punto sulla mappa, e viceversa. Clicca sul grafico per centrare la mappa.',
    icon: '📊',
  },
  {
    title: 'Usa l\'app offline',
    text: 'L\'app funziona anche senza rete: naviga la mappa con connessione e i tile resteranno disponibili senza. Installa l\'app dal browser per averla pronta sul campo.',
    icon: '📱',
  },
  {
    /* «Copia link» e' un export: in Imparo non c'e' e non va promesso. */
    title: 'Condividi l\'itinerario',
    text: 'Con "Copia link" ottieni un indirizzo che contiene tutto l\'itinerario: chi lo apre lo vede senza bisogno di un account. Per portarlo su un GPS o in un\'altra app c\'è l\'export in GPX.',
    icon: '🔗',
    area: 'exportDati',
  },
];

/**
 * TASK-43: al primo avvio si mostrano solo i passi essenziali. Le funzionalità avanzate
 * (tool, impostazioni, profilo, condivisione) sono una continuazione opzionale, quindi
 * restano accessibili anche alla riapertura della guida senza appesantire il primo
 * contatto.
 */
function passiVisibili(profilo: Profilo): TutorialStep[] {
  return STEPS.filter((s) => s.area == null || mostra(s.area, profilo));
}

/**
 * I passi del primo contatto sono la sequenza INIZIALE di quelli marcati essenziali, non
 * un numero fisso: filtrando per profilo l'insieme cambia (in Imparo sono benvenuto,
 * waypoint, Learn/Track e Verifica; in Montagna benvenuto, waypoint e «Pronto per la
 * gita»). Si conta la sequenza iniziale e non tutti gli essenziali dell'array, cosi' un
 * passo essenziale dichiarato in fondo non farebbe saltare la guida oltre gli altri.
 */
function quantiEssenziali(passi: TutorialStep[]): number {
  let n = 0;
  while (n < passi.length && passi[n].essenziale) n += 1;
  return n;
}

/**
 * La carta che accende la modalità «Impara».
 *
 * Legge lo stato dallo store, non da uno `useState`: la si può premere dalla guida, ma la
 * modalità si cambia anche da «Modalità» in cima all'Editor, e la carta deve dire il vero
 * in ogni caso. Il riscontro è doppio — `aria-pressed` con la cornice per chi guarda, e
 * una riga di testo che nomina la modalità — perché il colore da solo non è un messaggio.
 */
function AttivaImpara() {
  const profilo = useUIStore((s) => s.profilo);
  const setProfilo = useUIStore((s) => s.setProfilo);
  const setAppMode = useItineraryStore((s) => s.setAppMode);
  const attiva = profilo === 'imparo';

  const accendi = () => {
    setAppMode('learn');
    setProfilo('imparo');
    // La chiave storica del livello: la migrazione e il ripristino la leggono ancora.
    try { localStorage.setItem(KEYS.userLevel, 'beginner'); } catch { /* storage bloccato */ }
  };

  return (
    <div className="space-y-2 mt-3">
      <button
        onClick={accendi}
        aria-pressed={attiva}
        className={`w-full text-left border rounded-lg p-3 max-lg:min-h-[44px] transition-colors ${
          attiva
            ? 'bg-purple-900/70 border-purple-400 ring-2 ring-purple-400/60'
            : 'bg-purple-900/40 hover:bg-purple-900/60 border-purple-600'
        }`}
      >
        <div className="text-sm font-bold text-purple-300">
          📚 Attiva la modalità «Impara» {attiva && <span aria-hidden>✓</span>}
        </div>
        <div className="text-[11px] text-gray-300 mt-1">
          I valori li inserisci tu e li confronti con quelli reali.
        </div>
      </button>
      {attiva && (
        <p className="text-[11px] text-gray-300 bg-gray-800/70 rounded px-2 py-1.5">
          Modalità «Impara» attiva: i valori li scrivi tu, poi «Verifica» li confronta con i
          reali. La cambi quando vuoi da «Modalità», in cima all&rsquo;Editor.
        </p>
      )}
    </div>
  );
}

export function LearnTutorial() {
  const [step, setStep] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  /*
   * La guida si ridisegna quando il profilo cambia: la carta «Attiva la modalità Impara»
   * sta in un passo della guida stessa, e appena la si preme i passi diventano quelli del
   * profilo nuovo.
   */
  const profilo = useUIStore((s) => s.profilo);

  /*
   * **Popup centrale, di nuovo** (richiesta utente, 2026-09-05: «i messaggi allo startup
   * compaiono in un tiretto scorrevole, ed è sbagliatissimo: devono essere un popup
   * centrale»). È il ribaltamento del task-38, che l'aveva resa un pannello ancorato per
   * lasciare la mappa toccabile — ma il pannello, stretto e scorrevole, tagliava il
   * contenuto proprio al primo avvio. Ora la guida si legge e si chiude, poi si tocca:
   * quindi trappola del fuoco e blocco dello scorrimento, come ogni modale dell'app. Con
   * il velo sopra la pagina, anche il contorno verde sugli elementi (`evidenzia`) non
   * aveva più niente da indicare: rimosso.
   */
  const dialogRef = useModaleTastiera<HTMLDivElement>(step !== null, () => {
    markSeen();
    setStep(null);
  });
  useBodyScrollLock(step !== null);

  // Al primo avvio in assoluto la guida si apre da sola; poi mai piu'.
  useEffect(() => {
    try {
      if (localStorage.getItem(KEYS.tutorialSeen)) return;
    } catch {
      // localStorage non disponibile: la guida si mostra comunque
    }
    setStep(0);
  }, []);

  /*
   * Cambiando profilo dalla carta, l'elenco dei passi cambia sotto i piedi: senza questo
   * aggancio l'indice corrente finirebbe su un ALTRO passo (in Imparo entrano «Impara e
   * Pianificazione» e «Verifica» prima della carta). Si resta sul passo con lo stesso
   * titolo, che e' quello che si stava leggendo.
   */
  const titoloCorrente = useRef<string | null>(null);
  /*
    Il titolo si annota in un effetto su [step], NON durante il render: il cambio di
    profilo ridisegna prima che l'effetto qui sotto legga, e un'annotazione fatta nel
    render verrebbe sovrascritta col titolo del passo SBAGLIATO (quello su cui l'indice
    e' scivolato) — visto coi test, non a occhio.
  */
  useEffect(() => {
    if (step == null) return;
    const lista = passiVisibili(profilo);
    titoloCorrente.current = lista[Math.min(step, lista.length - 1)]?.title ?? null;
    // Il profilo qui e' solo il contesto di lettura: la reazione al suo cambio sta sotto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    if (step == null || titoloCorrente.current == null) return;
    const indice = passiVisibili(profilo).findIndex((s) => s.title === titoloCorrente.current);
    if (indice >= 0 && indice !== step) setStep(indice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilo]);

  function markSeen() {
    try {
      localStorage.setItem(KEYS.tutorialSeen, '1');
    } catch {
      // localStorage unavailable
    }
    // Chi ha appena fatto il tutorial non ha "novita'" da leggere: senza questo, al
    // secondo avvio si ritrovava il popup delle note di rilascio a raccontargli
    // funzioni che non ha mai conosciuto diversamente.
    markWhatsNewSeen();
  }

  const passi = passiVisibili(profilo);
  const essenziali = quantiEssenziali(passi);

  function changeStep(newStep: number | null) {
    const visibleCount = showAdvanced ? passi.length : essenziali;
    if (newStep === null || newStep < 0 || newStep >= visibleCount) {
      markSeen();
      setStep(null);
    } else {
      setStep(newStep);
    }
  }

  const handleNext = () => {
    if (step === null) return;
    const visibleCount = showAdvanced ? passi.length : essenziali;
    changeStep(step < visibleCount - 1 ? step + 1 : null);
  };

  const handleClose = () => changeStep(null);

  if (step === null) return null;

  /*
   * `step` e' un indice nella lista FILTRATA, che cambia se il profilo cambia con la
   * guida aperta (la carta «Attiva Impara» sta in un passo della guida): il taglio e'
   * l'ultima rete se l'aggancio per titolo qui sopra non trova niente.
   */
  const current = passi[Math.min(step, passi.length - 1)];
  const visibleCount = showAdvanced ? passi.length : essenziali;
  const isLast = step === visibleCount - 1;
  const atEssentialEnd = !showAdvanced && step === essenziali - 1;

  return (
    /*
     * Popup centrale col velo, come le Novita': si legge, si chiude, si tocca la mappa.
     * Il clic sul velo vale come «Salta»: chiude e non ripresenta.
     */
    <div
      className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/60"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Guida iniziale TrekTrak"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-sm w-full p-5 shadow-2xl outline-none overflow-y-auto max-h-[calc(100vh-2rem)]"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="text-3xl">{current.icon}</div>
          <button
            onClick={handleClose}
            aria-label="Chiudi la guida"
            className="text-gray-400 hover:text-white min-h-[32px] min-w-[32px] -mr-1 -mt-1"
          >
            ✕
          </button>
        </div>
        <h2 className="text-base font-bold text-green-400 mb-2">{current.title}</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{current.text}</p>

        {current.mockup}

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mt-4 mb-4" aria-hidden="true">
          {passi.slice(0, visibleCount).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${i === step ? 'bg-green-400' : 'bg-gray-600'}`}
            />
          ))}
        </div>
        <span className="sr-only">Passo {step + 1} di {visibleCount}</span>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-3 min-h-[44px] text-xs text-gray-400 hover:text-gray-200"
          >
            Salta
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => changeStep(step - 1)}
                className="px-3 min-h-[44px] bg-gray-700 rounded text-xs text-gray-300 hover:bg-gray-600"
              >
                Indietro
              </button>
            )}
            {atEssentialEnd && (
              <button
                onClick={() => { setShowAdvanced(true); setStep(essenziali); }}
                className="px-3 min-h-[44px] bg-gray-700 rounded text-xs text-gray-200 hover:bg-gray-600"
              >
                Altre funzionalità →
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 min-h-[44px] bg-green-600 rounded text-xs text-black font-bold hover:bg-green-500"
            >
              {isLast ? 'Inizia!' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
