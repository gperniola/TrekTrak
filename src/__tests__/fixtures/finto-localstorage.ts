/**
 * **Un `localStorage` finto, in memoria.**
 *
 * jsdom ne ha uno suo, ma è condiviso fra i test dello stesso file e non si ripulisce da
 * sé: questo è isolabile con `.clear()` e si installa in un colpo. Era in doppia copia
 * identica (`map-features.test`, `storage.test`).
 *
 * Ha `length` e `key(i)` perché il codice di prodotto li usa davvero — `isStorageNearLimit`
 * scandisce le chiavi per pesare quanto si sta occupando. Un finto che li omette fa passare
 * i test e rompere l'app.
 */
export function fintoLocalStorage() {
  let deposito: Record<string, string> = {};
  return {
    getItem: (chiave: string) => deposito[chiave] ?? null,
    setItem: (chiave: string, valore: string) => { deposito[chiave] = valore; },
    removeItem: (chiave: string) => { delete deposito[chiave]; },
    clear: () => { deposito = {}; },
    get length() { return Object.keys(deposito).length; },
    key: (i: number) => Object.keys(deposito)[i] ?? null,
  };
}

/**
 * Lo installa su `global` e lo restituisce, così il file di test può ripulirlo fra un caso
 * e l'altro. `defineProperty` e non un'assegnazione: in jsdom `localStorage` è una proprietà
 * di sola lettura sulla finestra, e assegnarla non fa niente **senza dare errore**.
 */
export function installaLocalStorage() {
  const finto = fintoLocalStorage();
  Object.defineProperty(global, 'localStorage', { value: finto, configurable: true });
  return finto;
}
