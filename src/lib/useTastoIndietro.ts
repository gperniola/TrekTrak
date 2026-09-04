'use client';

import { useEffect, useRef } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { nextBackAction } from '@/lib/back-nav';
import { confirm as appConfirm } from '@/stores/notificationStore';

/** Sotto questa larghezza il tasto Indietro è quello del telefono, e va gestito. */
const SOLO_SCHERMO_PICCOLO = '(max-width: 1023px)';

export interface ModaliLocali {
  /** «Impostazioni mappa», che vive come stato locale della pagina. */
  mapSettingsOpen: boolean;
  /** «Impostazioni» (tolleranze), anch'esso stato locale della pagina. */
  settingsOpen: boolean;
  chiudiMapSettings: () => void;
  chiudiSettings: () => void;
}

/**
 * **Il tasto Indietro del telefono, su un'app che non ha pagine.**
 *
 * Questa è la macchina che è costata sei rilasci (v0.10.3 → v0.10.10), e viveva dentro
 * `app/page.tsx` insieme alla disposizione dell'interfaccia: centoventi righe di History
 * API in mezzo al JSX, senza un test, in un file che non si può montare in isolamento.
 *
 * ## L'idea
 *
 * L'app è una pagina sola con molti livelli sovrapposti (menu, fogli, modali, schede). Il
 * tasto Indietro deve chiuderne **uno per volta** e non uscire dall'app finché ne resta
 * aperto qualcuno. Perché il browser lo permetta ci vogliono entry di cronologia vere: una
 * **guardia base** per la conferma d'uscita, più una entry per ogni livello aperto.
 *
 * ## Le tre cose che hanno rotto, e come sono risolte
 *
 * 1. **Non si spinge mai una entry dentro `popstate`.** Sul telefono `pushState` chiamato
 *    dentro `popstate` è inaffidabile, ed era la causa del difetto originale. Le entry di
 *    livello si spingono **al momento della navigazione**, dall'effetto di sincronia, dove
 *    `pushState` funziona; `popstate` si limita a chiudere un livello leggendo lo stato.
 * 2. **La guardia è idempotente.** Senza il controllo su `ttGuard`, più chiamate
 *    (`StrictMode` in sviluppo, o un rimontaggio) impilano più guardie, e un solo
 *    `history.back()` non basta più a superarle: l'uscita smette di funzionare.
 * 3. **Lo stato del router di Next si preserva.** L'App Router tiene il suo stato in
 *    `history.state`: sovrascriverlo con un oggetto nostro fa sì che al `popstate` il
 *    router non riesca a riconciliare la rotta e forzi un **hard reload** — la mappa si
 *    ricaricava e la posizione GPS saltava. Da qui lo spread di `window.history.state` in
 *    ogni `pushState`.
 */
export function useTastoIndietro(modali: ModaliLocali) {
  const mobileTab = useUIStore((s) => s.mobileTab);
  const searchOpen = useUIStore((s) => s.searchOpen);
  const quizActive = useUIStore((s) => s.quizActive);
  const progressOpen = useUIStore((s) => s.progressOpen);
  const moreMenuOpen = useUIStore((s) => s.moreMenuOpen);
  const emergencyPanelOpen = useUIStore((s) => s.emergencyPanelOpen);
  const toolsFabOpen = useUIStore((s) => s.toolsFabOpen);
  const weatherOpen = useUIStore((s) => s.weatherOpen);
  const { mapSettingsOpen, settingsOpen, chiudiMapSettings, chiudiSettings } = modali;

  /*
    `chiudiUnLivello` chiude UN livello secondo la priorità di `nextBackAction`
    (`lib/back-nav`, logica pura e provata a parte). È riassegnata a ogni render perché
    deve leggere lo stato fresco: un riferimento catturato una volta chiuderebbe il
    livello che era aperto al montaggio.
  */
  const chiudiUnLivello = useRef<() => boolean>(() => false);
  chiudiUnLivello.current = () => {
    const ui = useUIStore.getState();
    const action = nextBackAction({
      moreMenuOpen,
      mapSettingsOpen,
      settingsOpen,
      progressOpen,
      quizActive,
      searchOpen,
      mobileTab,
      emergencyPanelOpen,
      toolsFabOpen,
      weatherOpen,
    });
    switch (action) {
      case 'closeMore': ui.setMoreMenuOpen(false); return true;
      case 'closeToolsFab': ui.setToolsFabOpen(false); return true;
      case 'closeWeather': ui.setWeatherOpen(false); return true;
      case 'closeEmergencyPanel': ui.setEmergencyPanelOpen(false); return true;
      case 'closeMapSettings': chiudiMapSettings(); return true;
      case 'closeSettings': chiudiSettings(); return true;
      case 'closeProgress': ui.closeProgress(); return true;
      case 'closeQuiz': ui.deactivateQuiz(); return true;
      case 'closeSearch': ui.setSearchOpen(false); return true;
      case 'toMap': ui.setMobileTab('map'); return true;
      default: return false; // 'exit'
    }
  };

  /*
    Profondità "annullabile col tasto Indietro": quanti livelli sono aperti sopra la
    Mappa. Deve combaciare col numero di passi che `nextBackAction` impiega a tornare alla
    base: ogni overlay o menu vale 1, e trovarsi su una scheda diversa dalla Mappa vale 1.
  */
  const profondita =
    (moreMenuOpen ? 1 : 0) +
    (toolsFabOpen ? 1 : 0) +
    (weatherOpen ? 1 : 0) +
    (emergencyPanelOpen ? 1 : 0) +
    (mapSettingsOpen ? 1 : 0) +
    (settingsOpen ? 1 : 0) +
    (progressOpen ? 1 : 0) +
    (quizActive ? 1 : 0) +
    (searchOpen ? 1 : 0) +
    (mobileTab !== 'map' ? 1 : 0);

  const inUscita = useRef(false);
  /** Quante entry "di livello" sono state spinte sopra la guardia base. */
  const spinte = useRef(0);
  /** Quanti `popstate` auto-inflitti (da `history.go`) vanno ignorati. */
  const daIgnorare = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia(SOLO_SCHERMO_PICCOLO).matches) return;

    const spingiGuardia = () => {
      if (window.history.state && (window.history.state as { ttGuard?: boolean }).ttGuard) return;
      window.history.pushState({ ...window.history.state, ttGuard: true }, '');
    };
    spingiGuardia();

    const alPop = () => {
      if (daIgnorare.current > 0) { daIgnorare.current--; return; }
      if (inUscita.current) return;
      if (spinte.current > 0) {
        /*
          Una entry di livello è stata consumata dal tasto Indietro: si chiude un livello.
          Si decrementa PRIMA, così l'effetto di sincronia — reagendo al calo della
          profondità — vede cronologia e interfaccia già allineate e non tocca la
          cronologia una seconda volta.
        */
        spinte.current--;
        chiudiUnLivello.current();
        return;
      }
      // Guardia base consumata: si chiede se uscire.
      void appConfirm({
        title: 'Uscire da TrekTrak?',
        message: 'Vuoi lasciare la pagina? Le modifiche non salvate andranno perse.',
        confirmText: 'Esci',
        variant: 'error',
      }).then((ok) => {
        if (!ok) { spingiGuardia(); return; } // resta nell'app: si ripristina la guardia
        inUscita.current = true;
        window.removeEventListener('popstate', alPop);
        window.history.back();
      });
    };
    window.addEventListener('popstate', alPop);
    return () => window.removeEventListener('popstate', alPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
    Sincronia cronologia ↔ profondità dell'interfaccia. Gira FUORI da `popstate` — a ogni
    cambio di profondità — dove `pushState` è affidabile: spinge una entry per ogni livello
    aperto in più, e rimuove le entry in eccesso (`history.go`) quando un livello viene
    chiuso da un gesto dell'utente (il ✕, la scelta di un percorso). I `popstate` generati
    da `history.go` sono marcati come auto-inflitti e ignorati.
  */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia(SOLO_SCHERMO_PICCOLO).matches) return;
    if (profondita > spinte.current) {
      const n = profondita - spinte.current;
      for (let i = 0; i < n; i++) {
        window.history.pushState({ ...window.history.state, ttDepth: spinte.current + i + 1 }, '');
      }
      spinte.current = profondita;
    } else if (profondita < spinte.current) {
      const differenza = spinte.current - profondita;
      spinte.current = profondita;
      daIgnorare.current += differenza;
      window.history.go(-differenza);
    }
  }, [profondita]);
}
