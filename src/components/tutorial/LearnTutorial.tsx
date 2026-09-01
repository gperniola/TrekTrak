'use client';

import { useUIStore } from '@/stores/uiStore';
import { mostra, type Area, type Profilo } from '@/lib/profilo';
import { useState, useEffect, useRef } from 'react';
import { KEYS } from '@/lib/storage';
import { markWhatsNewSeen } from './WhatsNew';
import { useItineraryStore } from '@/stores/itineraryStore';
import { useSheetDrag } from '@/lib/useSheetDrag';
import { useSchermoPiccolo } from '@/lib/useSchermoPiccolo';
import { SheetHandle } from '@/components/shared/SheetHandle';

interface TutorialStep {
  title: string;
  text: string;
  icon: string;
  mockup?: React.ReactNode;
  /**
   * Area del profilo d'uso a cui il passo appartiene. Senza campo, il passo vale per
   * tutti. La guida non deve raccontare funzioni che il profilo appena scelto ha
   * nascosto: la scelta del livello sta al passo 0 di questa stessa guida, quindi chi
   * rispondeva «sono esperto» si vedeva subito spiegare l'interruttore Learn/Track e il
   * pulsante «Verifica», che l'app gli aveva appena tolto.
   */
  area?: Area;
  /** Fa parte del primo contatto (vedi `quantiEssenziali`). */
  essenziale?: boolean;
  /**
   * Elemento dell'interfaccia di cui il passo parla, per `[data-guida="..."]`. La guida
   * gli mette un contorno verde intorno: leggere «tocca la mappa» mentre la mappa e'
   * coperta dalla guida stessa era il difetto che questo task esiste per togliere.
   */
  evidenzia?: string;
}

function MenuMockup({ highlight }: { highlight?: 'fields' | 'verify' | 'badges' }) {
  return (
    <div className="mt-3 bg-gray-800 rounded-lg border border-gray-600 p-2 text-xs">
      <div className="flex gap-1 mb-2">
        <span className="flex-1 py-1 text-center bg-purple-600 rounded-l text-su-colore font-bold">Learn</span>
        <span className="flex-1 py-1 text-center bg-gray-700 rounded-r text-gray-400">Track</span>
      </div>
      <div className="bg-gray-900 rounded p-2 mb-1">
        <div className="text-green-400 font-bold mb-1">1. Partenza</div>
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-gray-800 rounded px-1 py-0.5 text-gray-500">Lat</div>
          <div className="bg-gray-800 rounded px-1 py-0.5 text-gray-500">Lon</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'badges' ? 'text-white' : 'text-gray-500'}`}>
            Alt {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-green-600 text-[8px] text-center leading-3 ml-0.5">✓</span>}
          </div>
        </div>
      </div>
      <div className={`bg-gray-900 rounded p-2 mb-1 border-l-2 border-green-400 ${highlight === 'fields' ? 'ring-1 ring-green-400/50' : ''}`}>
        <div className="grid grid-cols-4 gap-1">
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>
            Dist {highlight === 'badges' && <span className="inline-block w-3 h-3 rounded-full bg-yellow-600 text-[8px] text-center leading-3 ml-0.5">~</span>}
          </div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>D+</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>D-</div>
          <div className={`bg-gray-800 rounded px-1 py-0.5 ${highlight === 'fields' ? 'text-yellow-300' : 'text-gray-500'}`}>
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
          <div className="text-[9px] text-gray-500">Distanza e D+/D- lungo i sentieri reali</div>
        </div>
        <div className="w-9 h-5 bg-green-600 rounded-full relative">
          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-gray-300 font-medium">Percorso colorato</div>
          <div className="text-[9px] text-gray-500">Colora la linea per pendenza</div>
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
          <span className="flex-1 py-1 text-center bg-purple-600 text-su-colore rounded font-bold">Learn</span>
          <span className="flex-1 py-1 text-center bg-gray-700 text-gray-400 rounded">Track</span>
        </>
      )}
    </div>
  );
}

const STEPS: TutorialStep[] = [
  {
    title: 'Benvenuto in TrekTrak!',
    /*
     * Il benvenuto nomina entrambi gli usi, perche' la scelta sta subito sotto: dire solo
     * «impara la cartografia manuale» era la prima frase letta anche da chi sta per
     * rispondere «sono esperto», e gli descriveva l'app che non avrebbe visto.
     */
    text: 'Costruisci itinerari escursionistici: puoi inserire tu distanze, dislivelli e azimuth e farli verificare dall\'app per imparare la cartografia manuale, oppure lasciare che li calcoli lei e usarla per preparare la gita. Questa guida ti mostra le funzioni principali.',
    icon: '🗺️',
    essenziale: true,
  },
  {
    title: 'Aggiungi waypoint',
    evidenzia: 'mappa',
    text: 'Clicca o tocca la mappa per posizionare i waypoint del tuo itinerario. Ogni waypoint rappresenta un punto di passaggio. Puoi trascinare i marker per riposizionarli.',
    icon: '📍',
    essenziale: true,
  },
  {
    title: 'Learn e Track',
    evidenzia: 'modi',
    text: 'In modalità Learn inserisci manualmente distanza, dislivello e azimuth, poi usa "Verifica" per confrontare con i dati reali. In modalità Track i valori vengono calcolati automaticamente. Puoi passare da una all\'altra liberamente: i tuoi dati di entrambe le modalità restano salvati separatamente.',
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
    text: 'Con almeno due waypoint l\'app calcola distanza, dislivelli e tempi di percorrenza. Il pulsante Meteo incrocia la previsione con gli orari stimati e ti dice a che ora arrivi e cosa trovi; il pulsante ⚠️ sulla mappa accende radar della pioggia, incendi, allerte e rifugi.',
    icon: '🥾',
    area: 'layerEmergenza',
    essenziale: true,
  },
  {
    title: 'Strumenti mappa',
    evidenzia: 'strumenti',
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
    evidenzia: 'profilo',
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

/** Pseudo-step shown before step 0: user picks their level so the app sets sensible defaults. */
/**
 * Le due carte restano a schermo anche dopo la scelta, con quella scelta marcata.
 *
 * Prima sparivano appena si toccava una delle due e il dialogo tornava al testo di
 * benvenuto: non si sapeva cosa fosse stato scelto, ne' come cambiarlo. Il riscontro
 * e' doppio — `aria-pressed` con la cornice per chi guarda, e una riga di testo che
 * nomina la modalita' — perche' il colore da solo non e' un messaggio.
 */
function LevelChooser({ scelto, onChoose }: {
  scelto: 'beginner' | 'expert' | null;
  onChoose: (level: 'beginner' | 'expert') => void;
}) {
  const carta = (livello: 'beginner' | 'expert', attivo: string, spento: string) =>
    `w-full text-left border rounded-lg p-3 max-lg:min-h-[44px] transition-colors ${
      scelto === livello ? attivo : spento
    }`;
  return (
    <div className="space-y-2 mt-3">
      <button
        onClick={() => onChoose('beginner')}
        aria-pressed={scelto === 'beginner'}
        className={carta('beginner',
          'bg-purple-900/70 border-purple-400 ring-2 ring-purple-400/60',
          'bg-purple-900/40 hover:bg-purple-900/60 border-purple-600')}
      >
        <div className="text-sm font-bold text-purple-300">
          📚 Sto imparando {scelto === 'beginner' && <span aria-hidden>✓</span>}
        </div>
        <div className="text-[11px] text-gray-300 mt-1">
          Default modalità Learn: inserisco io i valori e li confronto con quelli reali.
        </div>
      </button>
      <button
        onClick={() => onChoose('expert')}
        aria-pressed={scelto === 'expert'}
        className={carta('expert',
          'bg-green-900/70 border-green-400 ring-2 ring-green-400/60',
          'bg-green-900/40 hover:bg-green-900/60 border-green-600')}
      >
        <div className="text-sm font-bold text-green-300">
          🥾 Sono esperto {scelto === 'expert' && <span aria-hidden>✓</span>}
        </div>
        <div className="text-[11px] text-gray-300 mt-1">
          Default modalità Track: l&apos;app calcola tutto, io rivedo e perfeziono.
        </div>
      </button>
      {scelto != null && (
        <p className="text-[11px] text-gray-300 bg-gray-800/70 rounded px-2 py-1.5">
          {scelto === 'beginner'
            ? 'Modalità Learn attiva: i valori li scrivi tu, poi «Verifica» li confronta con i reali.'
            : 'Modalità Track attiva: l’app calcola distanza, dislivelli e azimut.'}
          {' '}La cambi quando vuoi con l’interruttore Learn/Track.
        </p>
      )}
    </div>
  );
}

export function LearnTutorial() {
  const [step, setStep] = useState<number | null>(null);
  const [showLevelChooser, setShowLevelChooser] = useState(false);
  const [livelloScelto, setLivelloScelto] = useState<'beginner' | 'expert' | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const setAppMode = useItineraryStore((s) => s.setAppMode);
  const setProfilo = useUIStore((s) => s.setProfilo);
  /*
   * La guida si ridisegna quando il profilo cambia, e il profilo si sceglie al passo 0 di
   * questa stessa guida: appena si tocca «Sto imparando» o «Sono esperto», i passi
   * successivi diventano quelli di quel profilo.
   */
  const profilo = useUIStore((s) => s.profilo);
  // Mutabile: la riempie la callback del gesto, che e' l'unica `ref` sul nodo.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  /*
   * Su telefono la guida e' un foglio come gli altri tre, quindi si manda via col dito
   * verso il basso. `refEsterna` perche' il pannello ha gia' una ref sua, quella che
   * riceve il fuoco all'apertura.
   */
  const piccolo = useSchermoPiccolo();
  const { refFoglio, propsFoglio, propsManiglia } = useSheetDrag<HTMLDivElement>({
    onDismiss: () => { markSeen(); setStep(null); },
    refEsterna: (n) => { dialogRef.current = n; },
    attivo: piccolo,
  });
  /*
   * Niente blocco dello scorrimento e niente trappola del fuoco: dal task-38 la guida NON
   * e' piu' una finestra modale. La mappa dietro deve restare toccabile, altrimenti il
   * passo «tocca la mappa per aggiungere un waypoint» chiede una cosa che la guida stessa
   * impedisce.
   */

  /*
   * Il contorno verde sull'elemento di cui parla il passo. Si cerca il bersaglio quando
   * serve invece di tenerne un riferimento: i pezzi indicati compaiono e spariscono da
   * soli (il FAB e' solo su telefono, l'interruttore dei modi solo in Imparo).
   */
  const chiaveEvidenza = step == null ? undefined : passiVisibili(profilo)[step]?.evidenzia;
  useEffect(() => {
    if (chiaveEvidenza == null) return;
    const bersaglio = document.querySelector(`[data-guida="${chiaveEvidenza}"]`);
    if (bersaglio == null) return;
    bersaglio.classList.add('guida-evidenziata');
    return () => bersaglio.classList.remove('guida-evidenziata');
  }, [chiaveEvidenza]);

  // Check localStorage on mount
  useEffect(() => {
    try {
      if (localStorage.getItem(KEYS.tutorialSeen)) return;
    } catch {
      // localStorage unavailable — show tutorial anyway
    }
    setStep(0);
    setShowLevelChooser(true);
  }, []);

  const handleChooseLevel = (level: 'beginner' | 'expert') => {
    setAppMode(level === 'beginner' ? 'learn' : 'track');
    /*
     * La stessa risposta decide anche QUALI AREE esistono a schermo. Prima impostava
     * solo il modo di compilare i valori, e restava a meta' del suo mestiere: chi
     * dichiarava di stare imparando si trovava comunque davanti radar della pioggia,
     * instabilita' satellitare e libreria condivisa.
     */
    setProfilo(level === 'beginner' ? 'imparo' : 'montagna');
    try {
      localStorage.setItem(KEYS.userLevel, level);
    } catch {
      // localStorage unavailable
    }
    setLivelloScelto(level);
    // Le carte NON si nascondono: restano visibili con quella scelta marcata, cosi'
    // si vede cosa e' stato scelto e si puo' cambiare idea.
  };

  /*
   * Escape chiude, e basta. La trappola del fuoco e' stata tolta insieme al velo nero: un
   * pannello che lascia usare l'app non deve trattenere il Tab, altrimenti si puo' vedere
   * la mappa ma non raggiungerla da tastiera.
   */
  useEffect(() => {
    if (step === null) return;
    const tasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { markSeen(); setStep(null); }
    };
    window.addEventListener('keydown', tasto);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', tasto);
  }, [step]);

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
   * `step` e' un indice nella lista FILTRATA, che si accorcia se il profilo cambia
   * mentre la guida e' aperta (si puo' tornare al passo 0 e cambiare idea sul livello):
   * senza questo taglio si finirebbe fuori dall'array.
   */
  const current = passi[Math.min(step, passi.length - 1)];
  const visibleCount = showAdvanced ? passi.length : essenziali;
  const isLast = step === visibleCount - 1;
  const atEssentialEnd = !showAdvanced && step === essenziali - 1;

  return (
    /*
     * **Pannello, non finestra modale** (task-38). Niente velo nero e niente contenitore a
     * tutto schermo: la mappa resta visibile e si puo' toccare mentre la guida spiega come
     * si tocca. Su schermo grande sta a destra sotto la barra di ricerca; su telefono e' un
     * foglio in basso, sopra la barra di navigazione, alto un terzo dello schermo.
     */
    <div
      // Senza questa `ref` il gesto non ha un nodo su cui lavorare: il trascinamento non
      // parte e il pannello non riceve il fuoco all'apertura. Era il difetto trovato
      // nella review — i test non lo vedevano perche' jsdom non ha i Pointer Events.
      ref={refFoglio}
      role="dialog"
      aria-label="Guida iniziale TrekTrak"
      tabIndex={-1}
      {...propsFoglio}
      className="fixed z-[1400] bg-gray-900 border border-gray-700 shadow-2xl outline-none overflow-y-auto
        max-lg:inset-x-2 max-lg:bottom-[68px] max-lg:max-h-[42vh] max-lg:rounded-xl
        lg:top-20 lg:right-4 lg:w-80 lg:max-h-[calc(100vh-8rem)] lg:rounded-xl"
    >
      <SheetHandle gesto={propsManiglia} />
      <div className="p-5 pt-2 lg:pt-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="text-3xl">{current.icon}</div>
          <button
            onClick={handleClose}
            aria-label="Chiudi la guida"
            className="text-gray-500 hover:text-white min-h-[32px] min-w-[32px] -mr-1 -mt-1"
          >
            ✕
          </button>
        </div>
        <h2 className="text-base font-bold text-green-400 mb-2">{current.title}</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{current.text}</p>

        {step === 0 && showLevelChooser && <LevelChooser scelto={livelloScelto} onChoose={handleChooseLevel} />}
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
