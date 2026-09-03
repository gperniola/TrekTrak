'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import type L from 'leaflet';
import type { FeatureCollection, Geometry } from 'geojson';
import { useEmergencyStore } from '@/stores/emergencyStore';
import { EMERGENCY_PANE } from '@/lib/emergency-layers';
import {
  SCALA_EAWS, ZOOM_MINIMO_VALANGHE, dettaglioOrario, dettaglioQuote, etichettaPericolo,
  improntaZone, type BBoxGeo, type Pericolo,
} from '@/lib/avalanche';
import { dataBollettino, fetchAvalanche, type BollettinoValanghe, type ZonaValanghe } from '@/lib/avalanche-api';
import { escapeMarkup } from '@/lib/escape-markup';

/** Attesa dopo l'ultimo movimento: la route ritaglia e semplifica, non è gratis. */
const ATTESA_MS = 700;

/**
 * Lo stile di una zona.
 *
 * Il livello 5 sul sito ufficiale è rosso **a tratteggio nero**, non un rosso diverso dal
 * 4: qui si distingue col bordo nero spesso, e la legenda lo dice. Inventargli una tinta
 * propria avrebbe reso la mappa incoerente con ogni altro bollettino che l'utente
 * consulta.
 */
export function stileZona(pericolo: Pericolo): L.PathOptions {
  const colore = SCALA_EAWS[pericolo].colore;
  return {
    color: pericolo === 5 ? '#000000' : colore,
    weight: pericolo === 5 ? 2.5 : 1.5,
    fillColor: colore,
    // Le zone valanghe coprono aree grandi: sotto il 35% si legge ancora la mappa.
    fillOpacity: 0.35,
  };
}

function popupZona(z: ZonaValanghe, giorno: string | null): string {
  const righe: string[] = [];
  righe.push(`<div style="font-weight:700">${escapeMarkup(z.nome ?? z.id)}</div>`);
  righe.push(`<div>Pericolo ${escapeMarkup(etichettaPericolo(z.pericolo))}</div>`);
  const quote = dettaglioQuote({ id: z.id, pericolo: z.pericolo, am: z.am, pm: z.pm, alta: z.alta, bassa: z.bassa });
  if (quote != null) righe.push(`<div>${escapeMarkup(quote)}</div>`);
  const orario = dettaglioOrario({ id: z.id, pericolo: z.pericolo, am: z.am, pm: z.pm, alta: z.alta, bassa: z.bassa });
  if (orario != null) righe.push(`<div>${escapeMarkup(orario)}</div>`);
  if (giorno != null) {
    righe.push(`<div style="color:var(--tenue)">Bollettino del ${escapeMarkup(dataBollettino(giorno))}</div>`);
  }
  /*
    L'ultima riga non è un disclaimer di rito: il bollettino vale per la **zona**, e la
    scelta del pendio — esposizione, pendenza, ora del giorno — resta a chi cammina. Un
    numero per zona letto come "qui si può" è il modo in cui questi dati fanno danno.
  */
  righe.push('<div style="color:var(--tenue)">Vale per la zona, non per il singolo pendio</div>');
  return `<div style="font-size:12px;line-height:1.35">${righe.join('')}</div>`;
}

/**
 * Pericolo valanghe **della zona inquadrata**.
 *
 * Si interroga sulla vista come i ripari, e per lo stesso genere di ragione: le geometrie
 * complete sono 4,85 MB non compressi (misurato), quindi il ritaglio lo fa la nostra
 * route e qui si chiede solo quel che si guarda.
 */
export function EmergencyAvalancheLayer({ bollettino }: { bollettino: BollettinoValanghe | null }) {
  const map = useMap();
  const report = useEmergencyStore((s) => s.reportAvalanche);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  /** Ultima area chiesta: pannare dentro un'area già coperta non richiede niente. */
  const areaChiesta = useRef<(BBoxGeo & { zoom: number }) | null>(null);

  const interroga = useCallback(() => {
    controller.current?.abort();
    const zoom = map.getZoom();
    if (zoom < ZOOM_MINIMO_VALANGHE) {
      // Non è un errore e non è "nessun pericolo": la fonte non è stata interrogata, e
      // dirlo è l'unico modo di non far credere che in zona non ci sia niente.
      areaChiesta.current = null;
      report({ nodata: `avvicinati per vedere le zone valanghe (zoom ${ZOOM_MINIMO_VALANGHE})` });
      return;
    }
    const b = map.getBounds();
    const vista: BBoxGeo = { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };

    const gia = areaChiesta.current;
    if (gia != null && gia.zoom === Math.round(zoom)
      && vista.south >= gia.south && vista.north <= gia.north
      && vista.west >= gia.west && vista.east <= gia.east) return;

    // Un po' più larga della vista, così uno spostamento breve non costringe a chiedere
    // di nuovo. Il margine è meno generoso di quello dei ripari perché qui la risposta
    // cresce con l'area: sono poligoni, non punti.
    const margineLat = (vista.north - vista.south) * 0.2;
    const margineLon = (vista.east - vista.west) * 0.2;
    const richiesta: BBoxGeo = {
      south: vista.south - margineLat, north: vista.north + margineLat,
      west: vista.west - margineLon, east: vista.east + margineLon,
    };

    const ac = new AbortController();
    controller.current = ac;
    fetchAvalanche(richiesta, zoom, ac.signal)
      .then((dati) => {
        if (ac.signal.aborted) return;
        areaChiesta.current = { ...richiesta, zoom: Math.round(zoom) };
        report({ bollettino: dati });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        report({ error: e instanceof Error ? e.message : 'Bollettino valanghe non disponibile' });
      });
  }, [map, report]);

  const programma = useCallback(() => {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(interroga, ATTESA_MS);
  }, [interroga]);

  useMapEvents({ moveend: programma, zoomend: programma });

  useEffect(() => {
    interroga();
    return () => {
      if (timer.current != null) clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, [interroga]);

  /*
    Memorizzata: `bollettino?.zones ?? []` costruisce un array nuovo a ogni render, quindi
    la `useMemo` della collezione ricalcolava sempre e il layer Leaflet veniva distrutto e
    ricreato a ogni render. E' lo stesso difetto contro cui avverte il commento delle zone
    DPC, e qui l'ha trovato il linter prima dello schermo.
  */
  const zone = useMemo(() => bollettino?.zones ?? [], [bollettino]);

  // Una sola FeatureCollection, quindi un solo layer Leaflet: è la lezione delle zone
  // DPC, dove un <GeoJSON> per zona significava decine di layer creati e distrutti a
  // ogni aggiornamento.
  const collezione = useMemo<FeatureCollection<Geometry, { indice: number }>>(() => ({
    type: 'FeatureCollection',
    features: zone.map((z, i) => ({
      type: 'Feature' as const,
      geometry: z.geometria as Geometry,
      properties: { indice: i },
    })),
  }), [zone]);

  if (zone.length === 0) return null;

  return (
    <GeoJSON
      /*
        La chiave e' un'**impronta del contenuto**, non un conteggio.

        `react-leaflet` passa `data` a Leaflet solo quando CREA il layer: se la chiave non
        cambia, restano disegnati i poligoni di prima, e siccome lo `style` invece si
        aggiorna vengono ricolorati coi pericoli delle zone nuove — livello sbagliato su
        area sbagliata. La prima chiave era `data-numeroZone-primoId`, e bastava pannare
        dentro la stessa regione per farla coincidere fra due viste diverse.
      */
      key={`valanghe-${bollettino?.bulletinDate ?? 'nd'}-${improntaZone(zone)}`}
      data={collezione}
      pane={EMERGENCY_PANE}
      // Come le zone DPC: sul renderer SVG il bersaglio del click è il path, ma lo
      // dichiariamo perché il giorno in cui passassero a canvas il waypoint spurio
      // tornerebbe in silenzio.
      bubblingMouseEvents={false}
      style={(f) => {
        const z = zone[(f?.properties as { indice?: number } | undefined)?.indice ?? 0];
        return stileZona((z?.pericolo ?? 0) as Pericolo);
      }}
      onEachFeature={(f, layer) => {
        const z = zone[(f?.properties as { indice?: number } | undefined)?.indice ?? 0];
        if (z != null) layer.bindPopup(popupZona(z, bollettino?.bulletinDate ?? null));
      }}
    />
  );
}
