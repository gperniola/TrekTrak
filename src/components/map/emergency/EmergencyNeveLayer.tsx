'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import { ATTRIBUZIONE_NEVE } from '@/lib/snow-cover';
import { aggiornaRiassunti, type RiassuntoMattonella, type RiassuntoVista } from '@/lib/neve-composito';
import { pixelDellaMattonella, ritaglioPer } from '@/lib/neve-disegno';
import type { SorgenteNeve } from '@/lib/neve-sorgente';
import { useEmergencyStore } from '@/stores/emergencyStore';

/**
 * GIBS pubblica i passaggi uno alla volta durante il giorno (Terra ~1 h dopo il passaggio,
 * VIIRS 2-8 h): ogni ora si ricompongono le mattonelle, e quelli arrivati nel frattempo
 * entrano. La sorgente tiene in memoria solo i passaggi con dati, quindi si richiedono
 * soltanto quelli che mancavano.
 */
const RIDISEGNO_MS = 60 * 60 * 1000;
const LATO = 256;

const eAnnullo = (e: unknown) => (e as { name?: unknown } | null)?.name === 'AbortError';

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
    const aSchermo = new Map<HTMLElement, { chiave: string; annullo: AbortController }>();
    let progressivo = 0;
    let chiuso = false;
    let ridisegnando = false;

    // `null` = nessuna mattonella a schermo: lo stato resta l'ultimo vero, non si inventa.
    const riferisci = (r: RiassuntoVista | null) => {
      if (r && !chiuso && !ridisegnando) reportNeve(r);
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
        const chiave = `${coords.z}/${coords.x}/${coords.y}#${++progressivo}`;
        const annullo = new AbortController();
        aSchermo.set(tela, { chiave, annullo });

        const r = ritaglioPer(coords.z, coords.x, coords.y);
        sorgente.mattonella(r.z, r.x, r.y, annullo.signal).then(
          (c) => {
            // Composta ma uscita dalla vista (o layer smontato) nello stesso giro: niente.
            if (annullo.signal.aborted || chiuso) return;
            tela.getContext('2d')?.putImageData(new ImageData(pixelDellaMattonella(c, r), LATO, LATO), 0, 0);
            riferisci(aggiornaRiassunti(riassunti, { tipo: 'composta', chiave, riassunto: c.riassunto }));
            done(undefined, tela);
          },
          (e: unknown) => {
            // Mattonella uscita dallo schermo: non e' un esito, non si dice e non si disegna.
            if (eAnnullo(e)) return;
            // Non dovrebbe succedere (la sorgente non rifiuta senza un annullo): la
            // mattonella resta vuota, che e' meglio di un colore inventato.
            done(e instanceof Error ? e : new Error(String(e)), tela);
          },
        );
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
        `redraw` toglie tutte le mattonelle e le ricrea nello stesso giro. Durante lo
        sgombero non si riferisce: si dichiarerebbe il riassunto di mattonelle che stanno
        sparendo. Il pannello tiene quello di prima finche' le nuove non sono composte.
      */
      ridisegnando = true;
      try {
        strato.redraw();
      } finally {
        ridisegnando = false;
      }
    }, RIDISEGNO_MS);

    return () => {
      // Prima di togliere il layer: lo sgombero delle mattonelle non deve arrivare allo
      // store. Al «Riprova» lo stato e' gia' 'loading' e un riassunto vecchio lo
      // dichiarerebbe pronto con le date di prima.
      chiuso = true;
      clearInterval(timer);
      aSchermo.forEach((v) => v.annullo.abort());
      aSchermo.clear();
      map.removeLayer(strato);
    };
  }, [map, sorgente, reportNeve]);

  return null;
}
