'use client';

/**
 * Diagnostica del tasto Indietro (temporanea). Attiva con ?debug=back nell'URL
 * (persistita in localStorage per le PWA), si disattiva con ?debug=off.
 * Registra gli eventi del gestore back per capire il comportamento sul dispositivo reale.
 */

const KEY = 'tt_back_debug';
const buf: string[] = [];
const MAX = 14;

export function isBackDebug(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = new URLSearchParams(window.location.search).get('debug');
    if (v === 'back') localStorage.setItem(KEY, '1');
    if (v === 'off') localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function logBack(line: string): void {
  buf.push(line);
  while (buf.length > MAX) buf.shift();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tt-backlog'));
}

export function getBackLog(): string[] {
  return [...buf];
}
