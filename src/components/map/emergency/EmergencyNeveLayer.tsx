'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { ATTRIBUZIONE_NEVE } from '@/lib/snow-cover';
import { aggiornaRiassunti, type RiassuntoMattonella, type RiassuntoVista } from '@/lib/neve-composito';
import { pixelDellaMattonella, ritaglioPer, type Ritaglio } from '@/lib/neve-disegno';
import type { SorgenteNeve } from '@/lib/neve-sorgente';
import { useEmergencyStore } from '@/stores/emergencyStore';

/**
 * GIBS pubblica i passaggi uno alla volta durante il giorno (Terra ~1 h dopo il passaggio,
 * VIIRS 2-8 h): ogni ora la sorgente dimentica gli assenti e i passaggi di oggi
 * (`rinnova`) e le mattonelle a schermo si ricompongono. Tornano in rete solo quelli: i
 * passaggi con dati dei giorni prima vengono dalla memoria.
 */
const AGGIORNAMENTO_MS = 60 * 60 * 1000;
const LATO = 256;

const eAnnullo = (e: unknown) => (e as { name?: unknown } | null)?.name === 'AbortError';
const comeErrore = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/** Una mattonella a schermo: tutto cio' che serve per ricomporla e ridipingerla sul posto. */
interface VoceSchermo {
  chiave: string;
  tela: HTMLCanvasElement;
  ritaglio: Ritaglio;
  annullo: AbortController;
}

/**
 * La copertura nevosa composta da cinque sensori su tre giorni, disegnata su canvas.
 *
 * Non e' un `TileLayer`: le mattonelle si chiedono con `fetch` (il «nessun dato» di GIBS
 * e' un 200 che si riconosce solo da un header) e ogni mattonella a schermo e' il
 * composito di piu' passaggi, cioe' pixel calcolati e non un'immagine da scaricare.
 *
 * Lo stato del pannello lo dice il riassunto delle mattonelle **a schermo**, non di tutte
 * quelle mai composte: una mattonella che esce dalla vista esce anche dal riassunto.
 */
export function EmergencyNeveLayer({ sorgente }: { sorgente: SorgenteNeve }): null {
  const map = useMap();
  const reportNeve = useEmergencyStore((s) => s.reportNeve);

  useEffect(() => {
    const riassunti = new Map<string, RiassuntoMattonella>();
    // Per elemento e non per coordinate: `createTile` riceve le coordinate gia' riportate
    // dentro il mondo, `tileunload` quelle originali. Con le copie del mondo affiancate
    // (zoom bassi) due mattonelle a schermo avrebbero la stessa chiave.
    const aSchermo = new Map<HTMLElement, VoceSchermo>();
    let progressivo = 0;
    let chiuso = false;

    // `null` = nessuna mattonella a schermo: lo stato resta l'ultimo vero, non si inventa.
    const riferisci = (r: RiassuntoVista | null) => {
      if (r && !chiuso) reportNeve(r);
    };

    /*
      Compone la mattonella e la dipinge sulla SUA tela. `fatto` e' il `done` di Leaflet e
      c'e' solo alla creazione: va chiamato una volta sola. L'aggiornamento orario ridipinge
      la stessa tela senza dire niente a Leaflet.
    */
    const componi = (voce: VoceSchermo, fatto?: L.DoneCallback) => {
      const { chiave, tela, ritaglio, annullo } = voce;
      sorgente.mattonella(ritaglio.z, ritaglio.x, ritaglio.y, annullo.signal).then(
        (c) => {
          // Composta ma uscita dalla vista (o layer smontato) nello stesso giro: niente.
          if (annullo.signal.aborted || chiuso) return;
          try {
            tela.getContext('2d')?.putImageData(new ImageData(pixelDellaMattonella(c, ritaglio), LATO, LATO), 0, 0);
          } catch (e) {
            // Senza `done` Leaflet aspetterebbe questa mattonella per sempre. Il riassunto non
            // si riferisce: descriverebbe un disegno che non c'e' (all'aggiornamento la tela
            // tiene quello di prima, e il riassunto di prima resta giusto).
            fatto?.(comeErrore(e), tela);
            return;
          }
          riferisci(aggiornaRiassunti(riassunti, { tipo: 'composta', chiave, riassunto: c.riassunto }));
          fatto?.(undefined, tela);
        },
        (e: unknown) => {
          // Mattonella uscita dallo schermo: non e' un esito, non si dice e non si disegna.
          if (eAnnullo(e)) return;
          // Non dovrebbe succedere (la sorgente non rifiuta senza un annullo): la
          // mattonella resta vuota, o col disegno di prima, che e' meglio di un colore inventato.
          fatto?.(comeErrore(e), tela);
        },
      );
    };

    /*
      `extend` qui dentro e non al caricamento del modulo: il finto Leaflet dei test non ha
      `GridLayer`, e chi importa `EmergencyLayers` (che monta questo componente) non deve
      rompersi solo per averlo importato.
    */
    const StratoNeve: new (o: L.GridLayerOptions) => L.GridLayer = L.GridLayer.extend({
      createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
        const tela = document.createElement('canvas');
        tela.width = LATO;
        tela.height = LATO;
        const voce: VoceSchermo = {
          chiave: `${coords.z}/${coords.x}/${coords.y}#${++progressivo}`,
          tela,
          ritaglio: ritaglioPer(coords.z, coords.x, coords.y),
          annullo: new AbortController(),
        };
        aSchermo.set(tela, voce);
        componi(voce, done);
        return tela;
      },
    });

    const strato = new StratoNeve({
      pane: EMERGENCY_PANE,
      // `.strato-neve canvas` in globals.css: pixel nitidi a ogni zoom, mai interpolati.
      className: 'strato-neve',
      attribution: ATTRIBUZIONE_NEVE,
    });

    strato.on('tileunload', (e: L.TileEvent) => {
      const voce = aSchermo.get(e.tile);
      if (!voce) return;
      aSchermo.delete(e.tile);
      voce.annullo.abort();
      riferisci(aggiornaRiassunti(riassunti, { tipo: 'uscita', chiave: voce.chiave }));
    });

    strato.addTo(map);

    const timer = setInterval(() => {
      /*
        Sul posto, non `redraw()`: Leaflet toglierebbe tutte le tele insieme e le nuove
        resterebbero nascoste fino al loro `done`, quindi ogni ora la neve spariva dalla
        mappa per secondi (decine, su una rete di montagna) col pannello che diceva
        «pronto». Qui ogni tela tiene il suo disegno finche' il nuovo non e' pronto, e il
        riassunto si aggiorna con la stessa chiave. Una mattonella che esce nel frattempo
        ha la guardia di sempre: `tileunload` annulla, e il suo esito non si disegna.
      */
      sorgente.rinnova();
      aSchermo.forEach((voce) => componi(voce));
    }, AGGIORNAMENTO_MS);

    return () => {
      // Prima di togliere il layer: lo sgombero delle mattonelle non deve arrivare allo
      // store. Al «Riprova» lo stato e' gia' 'loading' e un riassunto vecchio lo
      // dichiarerebbe pronto con le date di prima. Due guardie, ciascuna basta da sola
      // (provato per mutazione): `chiuso`, e `aSchermo` svuotato prima di `remove()`, cosi'
      // il `tileunload` dello sgombero non trova piu' niente da togliere.
      chiuso = true;
      clearInterval(timer);
      aSchermo.forEach((v) => v.annullo.abort());
      aSchermo.clear();
      strato.remove();
    };
  }, [map, sorgente, reportNeve]);

  return null;
}
