'use client';

/**
 * Diagnostica del tasto Indietro (temporanea). Attiva con ?debug=back nell'URL
 * (persistita in localStorage per le PWA), si disattiva con ?debug=off.
 * Registra gli eventi del gestore back per capire il comportamento sul dispositivo reale.
 *
 * IMPORTANTE: il log è persistito in localStorage, così SOPRAVVIVE a un'eventuale
 * uscita/ricarica dell'app (il bug fa proprio uscire l'app: senza persistenza il log
 * andrebbe perso proprio nell'istante che ci interessa). ?debug=clear svuota il log.
 */

const KEY = 'tt_back_debug';
const LOG_KEY = 'tt_back_log';
const MAX = 40;

function load(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

let buf: string[] = load();

export function isBackDebug(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = new URLSearchParams(window.location.search).get('debug');
    if (v === 'back') localStorage.setItem(KEY, '1');
    if (v === 'off') {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LOG_KEY);
      buf = [];
    }
    if (v === 'clear') {
      localStorage.removeItem(LOG_KEY);
      buf = [];
    }
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function logBack(line: string): void {
  buf.push(line);
  while (buf.length > MAX) buf.shift();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(buf));
    } catch {
      // localStorage pieno o non disponibile: il log resta comunque in memoria
    }
    window.dispatchEvent(new Event('tt-backlog'));
  }
}

export function getBackLog(): string[] {
  return [...buf];
}
