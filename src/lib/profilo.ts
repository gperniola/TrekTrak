/**
 * Quali aree dell'app esistono, per profilo d'uso.
 *
 * Il problema che risolve, misurato sulla v0.14.2: 21 comandi visibili nella vista
 * Mappa, 112 nell'Editor con quattro waypoint, e circa quindici aree funzionali tutte
 * presenti insieme. Chi apre l'app per imparare a leggere una carta incontra
 * l'instabilita' satellitare di Meteosat prima di aver capito cos'e' un azimut.
 *
 * Con quindici aree sparse in una dozzina di componenti, la domanda «questo pulsante in
 * quale profilo si vede?» deve avere **una sola risposta in un solo posto**. Altrimenti
 * il difetto tipico e' nascondere un ingresso e lasciarne un altro allo stesso posto.
 *
 * Da non confondere con `appMode` ('learn' | 'track'), che e' dell'ITINERARIO e decide
 * come si compilano i valori. Il profilo e' dell'UTENTE e decide cosa si vede.
 */
export type Profilo = 'imparo' | 'montagna';

export const PROFILI: readonly Profilo[] = ['imparo', 'montagna'];

export const ETICHETTE_PROFILO: Record<Profilo, string> = {
  imparo: 'Imparo',
  montagna: 'Vado in montagna',
};

export const AREE = {
  validazione: ['imparo'],
  quiz: ['imparo'],
  progresso: ['imparo'],
  tipsDidattici: ['imparo'],
  switchLearnTrack: ['imparo'],
  layerEmergenza: ['montagna'],
  meteo: ['montagna'],
  allertaPosizione: ['montagna'],
  libreria: ['montagna'],
  exportDati: ['montagna'],
  /*
   * Bussola e righello sono strumenti DIDATTICI prima che da campo: misurare un azimut
   * sulla mappa e' un esercizio. Il PDF resta in Imparo perche' serve a portarsi
   * l'esercizio su carta.
   */
  bussola: ['imparo', 'montagna'],
  righello: ['imparo', 'montagna'],
  pdf: ['imparo', 'montagna'],
} as const satisfies Record<string, readonly Profilo[]>;

export type Area = keyof typeof AREE;

export function mostra(area: Area, profilo: Profilo): boolean {
  return (AREE[area] as readonly Profilo[]).includes(profilo);
}
