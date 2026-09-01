import {
  MASSIMO_PASSI,
  avanti,
  azioneDaAnnullare,
  azioneDaRifare,
  indietro,
  passoCorrente,
  puoAnnullare,
  puoRifare,
  registra,
  storiaIniziale,
} from '@/stores/itinerary/storia';
import type { Leg, Waypoint } from '@/lib/types';

/** TASK-19: la logica dell'annullamento, come funzioni pure. */

const wp = (id: string): Waypoint => ({ id, name: id, lat: 45, lon: 7, altitude: 1000, order: 0 });
const stato = (nomi: string[], nome = 'Giro') => ({
  waypoints: nomi.map(wp),
  legs: [] as Leg[],
  itineraryName: nome,
});

describe('la storia', () => {
  test('appena nata non ha niente da annullare ne da rifare', () => {
    const s = storiaIniziale(stato([]));
    expect(puoAnnullare(s)).toBe(false);
    expect(puoRifare(s)).toBe(false);
    expect(azioneDaAnnullare(s)).toBeNull();
  });

  test('dopo un gesto si puo annullare, e si sa quale', () => {
    const s = registra(storiaIniziale(stato([])), stato(['a']), 'aggiunta del waypoint');
    expect(puoAnnullare(s)).toBe(true);
    expect(azioneDaAnnullare(s)).toBe('aggiunta del waypoint');
    expect(puoRifare(s)).toBe(false);
  });

  test('annullando si torna allo stato di prima', () => {
    let s = storiaIniziale(stato([]));
    s = registra(s, stato(['a']), 'aggiunta del waypoint');
    s = indietro(s);
    expect(passoCorrente(s).waypoints).toHaveLength(0);
    expect(puoRifare(s)).toBe(true);
    expect(azioneDaRifare(s)).toBe('aggiunta del waypoint');
  });

  test('rifacendo si torna avanti', () => {
    let s = storiaIniziale(stato([]));
    s = registra(s, stato(['a']), 'aggiunta del waypoint');
    s = avanti(indietro(s));
    expect(passoCorrente(s).waypoints).toHaveLength(1);
  });

  test('al fondo e in cima non succede niente', () => {
    const s = storiaIniziale(stato([]));
    expect(indietro(s)).toBe(s);
    expect(avanti(s)).toBe(s);
  });

  /**
   * La regola che rende la storia una linea e non un albero: se si e' annullato e poi si
   * fa qualcosa di nuovo, i passi annullati spariscono. Tenerli farebbe di «rifai» un
   * salto in una realta' che non e' piu' successa.
   */
  test('un gesto nuovo dopo un annullamento tronca il futuro', () => {
    let s = storiaIniziale(stato([]));
    s = registra(s, stato(['a']), 'aggiunta del waypoint');
    s = registra(s, stato(['a', 'b']), 'aggiunta del waypoint');
    s = indietro(s);                       // torno a ['a']
    expect(puoRifare(s)).toBe(true);
    s = registra(s, stato(['a', 'c']), 'aggiunta del waypoint');
    expect(puoRifare(s)).toBe(false);      // 'b' non e' piu' raggiungibile
    expect(passoCorrente(s).waypoints.map((w) => w.id)).toEqual(['a', 'c']);
  });

  /**
   * Il tetto morde in CODA: si perde la possibilita' di tornare all'inizio, non quella di
   * tornare indietro di un passo — che e' quella che serve davvero.
   */
  test('oltre il tetto si butta il passo piu vecchio', () => {
    let s = storiaIniziale(stato([]));
    for (let i = 0; i < MASSIMO_PASSI + 20; i++) {
      s = registra(s, stato([`w${i}`]), 'aggiunta del waypoint');
    }
    expect(s.passi).toHaveLength(MASSIMO_PASSI);
    expect(s.cursore).toBe(MASSIMO_PASSI - 1);
    // l'ultimo gesto e' ancora annullabile
    expect(puoAnnullare(s)).toBe(true);
    expect(passoCorrente(s).waypoints[0].id).toBe(`w${MASSIMO_PASSI + 19}`);
  });

  test('la storia conserva anche il nome dell itinerario', () => {
    let s = storiaIniziale(stato([], 'Primo'));
    s = registra(s, stato([], 'Secondo'), 'modifica del nome');
    expect(passoCorrente(indietro(s)).itineraryName).toBe('Primo');
  });

  test('annullare piu volte di fila risale la catena', () => {
    let s = storiaIniziale(stato([]));
    s = registra(s, stato(['a']), 'aggiunta del waypoint');
    s = registra(s, stato(['a', 'b']), 'aggiunta del waypoint');
    s = registra(s, stato(['a', 'b', 'c']), 'aggiunta del waypoint');
    s = indietro(indietro(indietro(s)));
    expect(passoCorrente(s).waypoints).toHaveLength(0);
    expect(puoAnnullare(s)).toBe(false);
  });
});
