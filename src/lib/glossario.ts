/**
 * Glossario dei termini di cartografia (TASK-16 B).
 *
 * Nasce da un rilievo dei test con le persone: la guida e i campi **usavano** i termini
 * senza mai definirli. I sette pulsanti ⓘ dei campi mostravano frasi come «Dislivello
 * positivo cumulativo (metri di salita)» o «Latitudine WGS84 in gradi decimali», che
 * spiegano il campo a chi già sa cos'è un dislivello cumulativo e cos'è WGS84 — cioè a
 * chi non ha bisogno della spiegazione. Per un'app che esiste per **insegnare** la
 * cartografia manuale era il posto sbagliato dove dare per scontato.
 *
 * Il catalogo sta in un file solo perché la stessa definizione serve in più punti: il ⓘ
 * di un campo, i suggerimenti dopo una verifica, la scala di difficoltà. Definirla due
 * volte significa, prima o poi, definirla in due modi diversi.
 *
 * Le definizioni descrivono **quello che l'app fa davvero**: il tempo di percorrenza è
 * la formula implementata in `calculateMunterTime`, non quella dei manuali, e la
 * distanza è quella che si ottiene con l'impostazione attiva.
 */

/**
 * Le sei classi della scala SAC in forma breve, quelle che il riquadro della difficolta'
 * elenca a colpo d'occhio. Stanno qui e non nel componente perche' il glossario ha una
 * voce sulla stessa scala: due elenchi in due file sono due elenchi che prima o poi
 * dicono cose diverse. Un test verifica che coprano gli stessi sei gradi.
 */
export const LIVELLI_SAC = {
  T1: 'Camminata — sentiero ben segnato',
  T2: 'Sentiero di montagna — tratti meno definiti',
  T3: 'Sentiero alpino impegnativo — passaggi esposti possibili',
  T4: 'Alpino — capacità di orientamento richiesta',
  T5: 'Alpinismo facile — passaggi tecnici',
  T6: 'Alpinismo difficile',
} as const;

export type Termine =
  | 'azimut'
  | 'declinazione-magnetica'
  | 'dislivello-positivo'
  | 'dislivello-negativo'
  | 'linea-daria'
  | 'percorso-su-sentiero'
  | 'quota'
  | 'curve-di-livello'
  | 'pendenza'
  | 'wgs84'
  | 'gradi-decimali'
  | 'scala-sac'
  | 'munter';

export interface VoceGlossario {
  /** Il termine come si legge, non lo slug. */
  titolo: string;
  /** Che cos'è, in una frase sola. */
  definizione: string;
  /** La parte pratica: come si misura, dove si sbaglia. Facoltativa. */
  comeSiUsa?: string;
  /** Termini imparentati, per chi vuole tirare il filo. */
  vediAnche?: readonly Termine[];
}

export const GLOSSARIO: Record<Termine, VoceGlossario> = {
  azimut: {
    titolo: 'Azimut',
    definizione:
      'L’angolo fra il Nord e la direzione in cui vuoi andare, misurato in senso orario: '
      + 'Nord 0°, Est 90°, Sud 180°, Ovest 270°.',
    comeSiUsa:
      'Si misura sulla carta dal punto di partenza verso quello di arrivo, mai al contrario. '
      + 'L’ago della bussola però punta al Nord magnetico, che non è quello della carta: '
      + 'prima di seguirlo sul terreno va corretto della declinazione.',
    vediAnche: ['declinazione-magnetica'],
  },
  'declinazione-magnetica': {
    titolo: 'Declinazione magnetica',
    definizione:
      'La differenza fra il Nord geografico, che è quello della carta, e il Nord magnetico, '
      + 'che è quello verso cui punta l’ago della bussola.',
    comeSiUsa:
      'In Italia oggi vale circa 3–5° verso Est, a seconda della zona, e cambia lentamente '
      + 'negli anni: la carta riporta il valore e l’anno a cui si riferisce. Su una tratta di '
      + 'un chilometro, 4° di errore spostano il punto d’arrivo di una settantina di metri.',
    vediAnche: ['azimut'],
  },
  'dislivello-positivo': {
    titolo: 'Dislivello positivo (D+)',
    definizione:
      'La somma di TUTTE le salite del percorso, non la differenza fra la quota di partenza '
      + 'e quella di arrivo.',
    comeSiUsa:
      'Un anello che parte e torna a 1.000 m passando per una sella a 1.300 m ha 300 m di D+, '
      + 'non zero. Contano anche i saliscendi brevi, ed è per questo che il D+ letto sulla '
      + 'carta è quasi sempre più alto di quello che si stima a occhio.',
    vediAnche: ['dislivello-negativo', 'quota'],
  },
  'dislivello-negativo': {
    titolo: 'Dislivello negativo (D−)',
    definizione: 'La somma di tutte le discese del percorso, con lo stesso criterio del D+.',
    comeSiUsa:
      'Su un anello che finisce dov’è cominciato D+ e D− coincidono. Se non coincidono e '
      + 'l’anello è chiuso, da qualche parte manca un tratto.',
    vediAnche: ['dislivello-positivo'],
  },
  'linea-daria': {
    titolo: 'Distanza in linea d’aria',
    definizione:
      'La distanza in linea retta fra due punti. Il sentiero è quasi sempre più lungo, perché gira.',
    comeSiUsa:
      'Sulla carta si misura col righello e si converte con la scala: a 1:25.000 un centimetro '
      + 'vale 250 metri. Con l’impostazione «Percorso su sentiero» attiva l’app misura invece '
      + 'lungo il tracciato reale.',
    vediAnche: ['percorso-su-sentiero'],
  },
  'percorso-su-sentiero': {
    titolo: 'Percorso su sentiero',
    definizione:
      'L’impostazione che fa calcolare distanza e dislivelli seguendo i sentieri veri invece '
      + 'della linea retta fra un waypoint e l’altro.',
    comeSiUsa:
      'Serve la rete per scaricare il tracciato: senza, i valori tornano a essere quelli in '
      + 'linea d’aria, che sono più corti.',
    vediAnche: ['linea-daria'],
  },
  quota: {
    titolo: 'Quota',
    definizione: 'L’altezza di un punto sul livello del mare, in metri.',
    comeSiUsa:
      'Sulla carta si legge dalle curve di livello: si parte dalla curva direttrice più vicina, '
      + 'che porta scritto il valore, e si contano le curve intermedie moltiplicandole per '
      + 'l’equidistanza.',
    vediAnche: ['curve-di-livello'],
  },
  'curve-di-livello': {
    titolo: 'Curve di livello',
    definizione:
      'Le linee che uniscono i punti di uguale quota: dove sono fitte il terreno è ripido, '
      + 'dove sono larghe è dolce.',
    comeSiUsa:
      'L’equidistanza — quanti metri di dislivello separano due curve vicine — è dichiarata '
      + 'nella legenda, e sulle carte 1:25.000 è tipicamente di 25 metri. Le curve direttrici, '
      + 'più spesse, tornano ogni quarta o quinta curva e portano scritta la quota.',
    vediAnche: ['quota', 'pendenza'],
  },
  pendenza: {
    titolo: 'Pendenza',
    definizione:
      'Quanto il terreno sale rispetto a quanto avanza, in percentuale: 100 metri di salita '
      + 'in 1.000 metri di percorso fanno il 10%.',
    comeSiUsa:
      'Non è l’angolo in gradi: il 100% corrisponde a 45°, non alla verticale. Oltre il 40% '
      + 'un sentiero smette di salire dritto e comincia a fare tornanti.',
    vediAnche: ['curve-di-livello'],
  },
  wgs84: {
    titolo: 'WGS84',
    definizione:
      'Il sistema di riferimento con cui si esprimono latitudine e longitudine sui GPS e sulle '
      + 'carte moderne (in sigla, EPSG:4326). È quello che usa questa app.',
    comeSiUsa:
      'Le carte italiane più vecchie usano sistemi diversi (Gauss-Boaga, ED50): coordinate '
      + 'copiate da lì non cadono nello stesso punto, e lo scarto può essere di centinaia di metri.',
    vediAnche: ['gradi-decimali'],
  },
  'gradi-decimali': {
    titolo: 'Gradi decimali',
    definizione:
      'I gradi scritti con la virgola — 45,4736° — invece che in gradi, primi e secondi — '
      + '45° 28′ 25″.',
    comeSiUsa:
      'Per convertire si dividono i primi per 60 e i secondi per 3.600, e si somma: '
      + '45 + 28/60 + 25/3.600 = 45,4736°. La latitudine è positiva a Nord, la longitudine '
      + 'positiva a Est.',
    vediAnche: ['wgs84'],
  },
  'scala-sac': {
    titolo: 'Scala SAC (T1–T6)',
    definizione:
      'La scala del Club Alpino Svizzero per la difficoltà dei percorsi escursionistici, '
      + 'da T1 (camminata) a T6 (alpinismo).',
    comeSiUsa:
      'T1 sentiero ben tracciato e senza rischio di caduta; T2 sentiero continuo, a tratti '
      + 'ripido; T3 traccia non sempre visibile, passaggi esposti a volte attrezzati, mani per '
      + 'l’equilibrio; T4 traccia spesso assente, erba ripida e detriti, semplici passaggi in '
      + 'roccia; T5 arrampicata facile ed esposizione; T6 senza traccia, arrampicata fino al '
      + 'secondo grado.',
  },
  munter: {
    titolo: 'Metodo Munter',
    definizione:
      'Il modo di stimare il tempo di percorrenza combinando la distanza e il dislivello '
      + 'invece di guardarli separatamente.',
    comeSiUsa:
      'Questa app conta 4 km/h in piano, 400 m/h in salita e 800 m/h in discesa; poi prende la '
      + 'più lunga fra le due componenti e le somma metà dell’altra. È una stima di cammino: '
      + 'non comprende le soste, e la si può tarare su di sé col passo personale nelle '
      + 'impostazioni.',
  },
};

/** L'elenco in un ordine stabile, per le pagine che mostrano tutto il glossario. */
export const TERMINI: readonly Termine[] = Object.keys(GLOSSARIO) as Termine[];

export function voce(termine: Termine): VoceGlossario {
  return GLOSSARIO[termine];
}
