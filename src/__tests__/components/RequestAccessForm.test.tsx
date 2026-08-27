import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequestAccessForm } from '@/components/auth/RequestAccessForm';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => {
  // Il modulo con l'email esiste solo per chi ha aperto un link di invito: senza
  // token il form non puo' andare a buon fine e al suo posto si spiega come stanno
  // le cose (vedi il describe in fondo).
  useAuthStore.setState({
    requestAccess: (jest.fn(async () => ({ ok: true }))) as never,
    inviteToken: 'tok-di-prova',
  });
});

describe('RequestAccessForm', () => {
  test('email vuota → non chiama requestAccess', () => {
    const spy = jest.fn(async (_email: string) => ({ ok: true }));
    useAuthStore.setState({ requestAccess: spy as never });
    render(<RequestAccessForm />);
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    expect(spy).not.toHaveBeenCalled();
  });

  test('email valida → chiama requestAccess e mostra conferma', async () => {
    const spy = jest.fn(async (_email: string) => ({ ok: true }));
    useAuthStore.setState({ requestAccess: spy as never });
    render(<RequestAccessForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.it' } });
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('a@b.it'));
    expect(await screen.findByText(/controlla la (tua )?mail/i)).toBeInTheDocument();
  });

  test('errore invito non valido mostrato', async () => {
    useAuthStore.setState({ requestAccess: (jest.fn(async () => ({ ok: false, error: 'invalid_invite' }))) as never });
    render(<RequestAccessForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.it' } });
    fireEvent.click(screen.getByRole('button', { name: /invia/i }));
    // Il messaggio dice cosa fare, non solo che è andata male: chi ha un invito
    // scaduto deve capire che serve un link nuovo, non che ha sbagliato lui.
    expect(await screen.findByText(/invito non.*valido/i)).toBeInTheDocument();
    expect(screen.getByText(/link nuovo/i)).toBeInTheDocument();
  });
});

/**
 * Senza link di invito la richiesta e' condannata: il server risponde 403 perche' i
 * signup pubblici sono chiusi. Prima l'utente lo scopriva solo dopo aver inviato
 * l'email, con un "Invito non valido" che non significa niente per chi non ha mai
 * avuto un invito — e nel frattempo pensava che la libreria fosse rotta.
 */
describe('senza invito', () => {
  beforeEach(() => { useAuthStore.setState({ inviteToken: null }); });

  test('non chiede l’email: spiega che si entra su invito', () => {
    render(<RequestAccessForm />);
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.getByText(/ad accesso su invito/i)).toBeInTheDocument();
  });

  test('dice che l’app resta usabile e come portare via il lavoro', () => {
    render(<RequestAccessForm />);
    expect(screen.getByText(/resta\s+su questo dispositivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Esporta JSON/)).toBeInTheDocument();
  });
});
