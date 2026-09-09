import { render, screen, fireEvent } from '@testing-library/react';
import { MenuRigaMeteo } from '@/components/weather/MenuRigaMeteo';

/**
 * **Le azioni di una riga del meteo.**
 *
 * Una sola voce per ora — aprire quel punto su Meteoblue — ma il menu esiste perché la
 * riga è stretta e le azioni cresceranno. Al tocco non c'è nessun `title` da leggere:
 * ogni cosa qui deve avere un nome accessibile scritto.
 */
describe('MenuRigaMeteo', () => {
  test('chiuso di partenza: nessuna voce a occupare la riga', () => {
    render(<MenuRigaMeteo lat={42.2} lon={14.28} nome="Blockhaus" />);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  test('il pulsante dice di che punto è: «Blockhaus», non «altre azioni» e basta', () => {
    render(<MenuRigaMeteo lat={42.2} lon={14.28} nome="Blockhaus" />);
    expect(screen.getByRole('button', { name: /Blockhaus/ })).toBeInTheDocument();
  });

  test('aperto, offre Meteoblue per QUEL punto', () => {
    render(<MenuRigaMeteo lat={42.2} lon={14.28} nome="Blockhaus" />);
    fireEvent.click(screen.getByRole('button'));
    const voce = screen.getByRole('menuitem', { name: /Apri su Meteoblue/i });
    expect(voce).toHaveAttribute('href', 'https://www.meteoblue.com/it/tempo/settimana/42.200N14.280E');
    expect(voce).toHaveAttribute('target', '_blank');
    // `noopener`: senza, la pagina aperta può manipolare quella che l'ha aperta.
    expect(voce.getAttribute('rel')).toContain('noopener');
  });

  test('Escape lo chiude', () => {
    render(<MenuRigaMeteo lat={42.2} lon={14.28} nome="Blockhaus" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  test('un tocco fuori lo chiude', () => {
    render(<MenuRigaMeteo lat={42.2} lon={14.28} nome="Blockhaus" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  /** Senza coordinate valide non esiste una pagina da aprire: il menu non compare. */
  test('coordinate non valide: nessun pulsante', () => {
    const { container } = render(<MenuRigaMeteo lat={Number.NaN} lon={14.28} nome="Ignoto" />);
    expect(container).toBeEmptyDOMElement();
  });
});
