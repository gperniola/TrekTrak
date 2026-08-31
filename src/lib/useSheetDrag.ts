'use client';

import { useCallback, useRef } from 'react';
import {
  intenzione,
  puoPrendereIlComando,
  chiudeAlRilascio,
  opacitaBackdrop,
} from './sheet-drag';

/** Durata del ritorno al proprio posto e dell'uscita. */
const DURATA_MS = 170;

function menoMovimento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface Opzioni<T extends HTMLElement> {
  /** Chiude il foglio. Chiamata a fine animazione di uscita. */
  onDismiss: () => void;
  /**
   * Ref da chiamare anche sul nodo del foglio. Serve perche' questi fogli hanno gia'
   * una ref: la guardia che impedisce ai tocchi di diventare waypoint sulla mappa.
   *
   * Generico sul tipo di elemento: le ref esistenti sono tipate sul nodo concreto
   * (`HTMLDivElement`), e una firma su `HTMLElement` non le accetterebbe.
   */
  refEsterna?: (n: T | null) => void;
  /** A false il gesto non si arma (desktop, o foglio non trascinabile). */
  attivo?: boolean;
}

/**
 * "Trascina in basso per chiudere" per gli sheet dal basso.
 *
 * Pointer Events e non touch: coprono dito e mouse con lo stesso codice, e
 * `setPointerCapture` fa arrivare i movimenti anche quando il dito esce dal foglio.
 *
 * Il DOM si muove per via diretta (`style.transform`), non passando dallo stato di
 * React: un `setState` per ogni `pointermove` sono decine di render al secondo su un
 * pannello che contiene sette righe e le loro legende.
 *
 * Il gesto NON e' l'unico modo di chiudere questi fogli — restano la ✕, il tocco sul
 * backdrop e il tasto Indietro. Un trascinamento non e' utilizzabile da tastiera ne'
 * da chi usa un lettore di schermo, quindi non puo' essere la sola via d'uscita.
 */
export function useSheetDrag<T extends HTMLElement = HTMLElement>(
  { onDismiss, refEsterna, attivo = true }: Opzioni<T>,
) {
  const foglio = useRef<HTMLElement | null>(null);
  const backdrop = useRef<HTMLElement | null>(null);
  const gesto = useRef<{
    id: number;
    x0: number;
    y0: number;
    t0: number;
    daManiglia: boolean;
    preso: boolean;
    dy: number;
  } | null>(null);

  const refFoglio = useCallback((n: T | null) => {
    foglio.current = n;
    refEsterna?.(n);
  }, [refEsterna]);

  const refBackdrop = useCallback((n: HTMLElement | null) => {
    backdrop.current = n;
  }, []);

  const disegna = (dy: number) => {
    const f = foglio.current;
    if (!f) return;
    f.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
    if (backdrop.current) {
      backdrop.current.style.opacity = String(opacitaBackdrop(dy, f.offsetHeight));
    }
  };

  const ripristina = (conAnimazione: boolean) => {
    const f = foglio.current;
    gesto.current = null;
    if (!f) return;
    f.style.transition = conAnimazione && !menoMovimento() ? `transform ${DURATA_MS}ms ease-out` : '';
    f.style.transform = '';
    if (backdrop.current) backdrop.current.style.opacity = '';
    if (conAnimazione) {
      window.setTimeout(() => { if (foglio.current) foglio.current.style.transition = ''; }, DURATA_MS);
    }
  };

  const esci = () => {
    const f = foglio.current;
    gesto.current = null;
    if (!f || menoMovimento()) { onDismiss(); return; }
    f.style.transition = `transform ${DURATA_MS}ms ease-out`;
    f.style.transform = `translateY(${f.offsetHeight}px)`;
    if (backdrop.current) {
      backdrop.current.style.transition = `opacity ${DURATA_MS}ms ease-out`;
      backdrop.current.style.opacity = '0';
    }
    // Il timeout e non `transitionend`: se la transizione non parte (elemento nascosto,
    // motion ridotto sopraggiunto) il foglio resterebbe aperto per sempre.
    window.setTimeout(onDismiss, DURATA_MS);
  };

  const onPointerDown = (e: React.PointerEvent, daManiglia: boolean) => {
    if (!attivo || gesto.current) return;
    // Solo il pulsante primario: un tasto destro non trascina.
    if (e.button !== 0) return;
    gesto.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(),
      daManiglia, preso: false, dy: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;

    if (!g.preso) {
      const cosa = intenzione(dx, dy);
      if (cosa === 'attesa') return;
      if (cosa === 'altro') { gesto.current = null; return; }
      const scrollTop = foglio.current?.scrollTop ?? 0;
      if (!puoPrendereIlComando({ daManiglia: g.daManiglia, scrollTop })) {
        gesto.current = null;
        return;
      }
      g.preso = true;
      try { (e.currentTarget as HTMLElement).setPointerCapture(g.id); } catch { /* non essenziale */ }
      if (foglio.current) foglio.current.style.transition = '';
    }

    g.dy = Math.max(dy, 0);
    disegna(g.dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    if (!g.preso) { gesto.current = null; return; }
    const altezza = foglio.current?.offsetHeight ?? 0;
    if (chiudeAlRilascio(g.dy, altezza, performance.now() - g.t0)) esci();
    else ripristina(true);
  };

  /**
   * `pointercancel` arriva quando il browser si prende il gesto per se' — tipicamente
   * perche' ha deciso che stai scorrendo. Il foglio deve tornare al suo posto senza
   * discutere: la priorita' e' di chi stava leggendo.
   */
  const onPointerCancel = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    if (g.preso) ripristina(true);
    else gesto.current = null;
  };

  return {
    refFoglio,
    refBackdrop,
    /** Da mettere sul foglio: il gesto parte dal corpo solo se il contenuto e' in cima. */
    propsFoglio: attivo ? {
      onPointerDown: (e: React.PointerEvent) => onPointerDown(e, false),
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    } : {},
    /** Da mettere sulla maniglia: da qui il gesto parte sempre. */
    propsManiglia: attivo ? {
      onPointerDown: (e: React.PointerEvent) => onPointerDown(e, true),
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    } : {},
  };
}
