'use client';

import { useEffect, useState } from 'react';

/**
 * Stato di connessione, estratto dalla logica già presente in `OfflineBanner`.
 *
 * Parte da `true` e si corregge nel primo effetto: leggere `navigator.onLine` durante
 * il render romperebbe l'idratazione (sul server non esiste).
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
