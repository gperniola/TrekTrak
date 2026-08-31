import { render, screen } from '@testing-library/react';

// La libreria condivisa parla con Supabase: mock per non toccare la rete ne' le env.
jest.mock('@/lib/sync', () => ({
  fetchRoutes: jest.fn(() => Promise.resolve([])),
  saveRouteToCloud: jest.fn(() => Promise.resolve('id')),
}));

import { MainViewSwitch } from '@/components/panel/MainViewSwitch';
import { ModeSwitch } from '@/components/panel/ModeSwitch';
import { ActionBar } from '@/components/panel/ActionBar';
import { ItineraryHeader } from '@/components/panel/ItineraryHeader';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useItineraryStore } from '@/stores/itineraryStore';
import type { Waypoint } from '@/lib/types';

const due: Waypoint[] = [
  { id: 'a', name: 'A', lat: 45, lon: 7, altitude: 1200, order: 0 },
  { id: 'b', name: 'B', lat: 45.01, lon: 7.01, altitude: 1400, order: 1 },
];

/**
 * TERZO giro di review. I primi due cercavano ingressi rimasti aperti; questo cerca la
 * classe opposta: **cosa resta a schermo quando un'area sparisce**. Contenitori vuoti che
 * occupano spazio, comandi che si accendono senza fare niente, e un caso in cui e' stata
 * portata via la porta d'ingresso invece di quella d'uscita.
 */
describe('review 3: quello che resta quando un area sparisce', () => {
  beforeEach(() => {
    useItineraryStore.setState({ waypoints: due, legs: [], appMode: 'track' });
    useAuthStore.setState({ member: null, session: null, invited: false });
  });

  /**
   * La scheda "Libreria" su schermo grande guardava solo l'accesso (invito, sessione,
   * iscrizione) e non il profilo, mentre `LeftPanel` ha una guardia che in Imparo mostra
   * l'editor al posto della libreria. Risultato: la scheda si accendeva — `aria-selected`
   * vero, sottolineatura verde — e a schermo non cambiava niente. Peggio di entrambi gli
   * estremi: un comando che dice di aver funzionato e non ha funzionato.
   */
  test('in Imparo la scheda Libreria non c e, nemmeno da iscritto', () => {
    useAuthStore.setState({ member: { id: 'm1', username: 'tizio' } as never, session: {} as never });
    useUIStore.setState({ profilo: 'imparo' });
    render(<MainViewSwitch />);
    expect(screen.queryByRole('tab', { name: 'Libreria' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Editor' })).toBeInTheDocument();
  });

  test('in Montagna da iscritto la scheda Libreria c e', () => {
    useAuthStore.setState({ member: { id: 'm1', username: 'tizio' } as never, session: {} as never });
    useUIStore.setState({ profilo: 'montagna' });
    render(<MainViewSwitch />);
    expect(screen.getByRole('tab', { name: 'Libreria' })).toBeInTheDocument();
  });

  /**
   * In Montagna la barra dei modi non ha piu' niente da mostrare su telefono: la toolbar
   * degli strumenti e' `hidden lg:flex` e l'interruttore Learn/Track e' di Imparo. Restava
   * un rettangolo vuoto con `border-b` e padding: una riga di separazione in mezzo al
   * nulla, in cima al pannello Editor.
   *
   * jsdom non calcola il layout, quindi il test guarda il meccanismo: la classe che
   * nasconde il contenitore sotto `lg`.
   */
  test('in Montagna la barra dei modi e nascosta sotto lg', () => {
    useUIStore.setState({ profilo: 'montagna' });
    const { container } = render(<ModeSwitch />);
    expect(container.firstElementChild?.className).toMatch(/max-lg:hidden/);
  });

  test('in Imparo la barra dei modi resta visibile', () => {
    useUIStore.setState({ profilo: 'imparo' });
    const { container } = render(<ModeSwitch />);
    expect(container.firstElementChild?.className).not.toMatch(/max-lg:hidden/);
    expect(screen.getByRole('tablist', { name: 'Modalità app' })).toBeInTheDocument();
  });

  /**
   * Il gruppo "Attivita'" contiene Verifica e Progresso, due aree di Imparo: in Montagna
   * era SEMPRE vuoto. Un `div` vuoto dentro `space-y-2` si porta comunque il suo margine,
   * e per chi usa uno screen reader era un gruppo annunciato col suo nome e senza niente
   * dentro.
   */
  test('in Montagna il gruppo Attivita non viene renderizzato', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ActionBar />);
    expect(screen.queryByRole('group', { name: 'Attività' })).not.toBeInTheDocument();
  });

  test('in Imparo il gruppo Attivita c e', () => {
    useUIStore.setState({ profilo: 'imparo' });
    useItineraryStore.setState({ appMode: 'learn' });
    render(<ActionBar />);
    expect(screen.getByRole('group', { name: 'Attività' })).toBeInTheDocument();
  });

  /**
   * `exportDati` aveva portato via anche l'IMPORTAZIONE, che non e' un export: e' il modo
   * in cui il lavoro entra. In Imparo la libreria condivisa non c'e', il GPX non c'e', il
   * link non c'e' — e senza il pulsante di importazione non restava nessun modo di aprire
   * un itinerario ricevuto come file. E' la stessa regola trovata al secondo giro col link
   * di invito: un modo che semplifica non deve rendere l'app incapace di RICEVERE.
   */
  test('in Imparo si puo importare un itinerario, non esportarlo', () => {
    useUIStore.setState({ profilo: 'imparo' });
    render(<ItineraryHeader />);
    expect(screen.getByRole('button', { name: 'Importa JSON' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Esporta JSON' })).not.toBeInTheDocument();
  });

  test('in Montagna ci sono entrambi', () => {
    useUIStore.setState({ profilo: 'montagna' });
    render(<ItineraryHeader />);
    expect(screen.getByRole('button', { name: 'Importa JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Esporta JSON' })).toBeInTheDocument();
  });
});
