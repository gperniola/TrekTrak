/**
 * Tema chiaro e scuro (task-35).
 *
 * **Come è fatto, e perché così.** L'app è scritta scura da sempre: 690 usi di
 * `bg-gray-800`, `text-gray-400`, `border-gray-600` e compagnia, sparsi su 58 file.
 * Aggiungere a ognuno una variante `light:` avrebbe voluto dire toccare tutti quei punti
 * — e sbagliarne qualcuno in silenzio, perché nessun test guarda un colore.
 *
 * La strada scelta è un'altra: **si ridefinisce cosa significa `gray-400`**. La scala
 * grigia e i pochi accenti usati come testo diventano variabili CSS, e nel tema chiaro la
 * scala si **rovescia** — `gray-950`, che nel buio è il fondo della pagina, diventa quasi
 * bianco; `gray-100`, che nel buio è il testo più acceso, diventa quasi nero. Siccome
 * l'app usa quella scala con una convenzione coerente (numeri bassi = chiaro, numeri alti
 * = scuro), rovesciarla ribalta l'intera interfaccia **senza modificare un solo
 * componente**.
 *
 * Gli accenti sono il punto delicato: `text-green-400` su fondo scuro è perfetto, sul
 * bianco è illeggibile. Quelli che nell'app fanno da *testo* vengono quindi rimappati su
 * tonalità più cupe; quelli che fanno da *sfondo di un pulsante* restano, perché un
 * pulsante si dipinge il suo fondo e ci scrive sopra in nero.
 *
 * Che tutto questo sia leggibile non è affidato all'occhio: `contrasto()` qui sotto e il
 * test che lo usa misurano ogni accoppiata nei due temi.
 */

export type Tema = 'chiaro' | 'scuro' | 'sistema';

export const TEMI: readonly Tema[] = ['sistema', 'chiaro', 'scuro'];

export const ETICHETTE_TEMA: Record<Tema, string> = {
  sistema: 'Come il sistema',
  chiaro: 'Chiaro',
  scuro: 'Scuro',
};

export const ICONE_TEMA: Record<Tema, string> = {
  sistema: '🖥️',
  chiaro: '☀️',
  scuro: '🌙',
};

/**
 * Il tema che si vede davvero: `sistema` non è un aspetto, è una delega.
 *
 * `sistemaScuro` arriva da `prefers-color-scheme`, che in un contesto senza browser non
 * si sa: in quel caso si sceglie **scuro**, che è il tema con cui l'app è nata e quello
 * che serve in montagna la sera.
 */
export function temaEffettivo(tema: Tema, sistemaScuro: boolean): 'chiaro' | 'scuro' {
  if (tema === 'chiaro') return 'chiaro';
  if (tema === 'scuro') return 'scuro';
  return sistemaScuro ? 'scuro' : 'chiaro';
}

/** Scrive il tema sull'elemento radice: da lì lo leggono le variabili CSS. */
export function applicaTema(effettivo: 'chiaro' | 'scuro'): void {
  if (typeof document === 'undefined') return;
  const radice = document.documentElement;
  if (effettivo === 'chiaro') radice.setAttribute('data-tema', 'chiaro');
  else radice.removeAttribute('data-tema');
}

/** Un tema salvato che non riconosciamo vale «come il sistema», non un errore. */
export function temaValido(salvato: string | null | undefined): Tema {
  return TEMI.includes(salvato as Tema) ? (salvato as Tema) : 'sistema';
}

// --- Contrasto, per non affidare la leggibilità all'occhio -----------------------------

/** Canali `"74 222 128"` → `[74, 222, 128]`. È il formato delle variabili CSS. */
export function canali(valore: string): [number, number, number] {
  const p = valore.trim().split(/\s+/).map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    throw new Error(`Canali non validi: "${valore}"`);
  }
  return [p[0], p[1], p[2]];
}

function luminanzaCanale(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminanza relativa secondo WCAG 2.1. */
export function luminanza(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(luminanzaCanale);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Rapporto di contrasto fra due colori, da 1 (identici) a 21 (bianco su nero).
 *
 * WCAG chiede 4,5 per il testo normale e 3 per quello grande o in grassetto.
 */
export function contrasto(a: [number, number, number], b: [number, number, number]): number {
  const la = luminanza(a);
  const lb = luminanza(b);
  const chiaro = Math.max(la, lb);
  const scuro = Math.min(la, lb);
  return (chiaro + 0.05) / (scuro + 0.05);
}
