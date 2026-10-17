import type { PngTavolozza } from './png-tavolozza';

/**
 * Copertura nevosa da **NASA GIBS** (indice NDSI), composta da cinque sensori — MODIS
 * Aqua e Terra, VIIRS S-NPP, NOAA-20 e NOAA-21 — su una finestra di tre giorni: un solo
 * passaggio al giorno lascia scoperta quasi ogni mattonella dietro le nubi.
 *
 * Mattonelle WMTS statiche, senza chiave, chieste con `fetch` e non come `<img>`: il
 * «nessun dato» di GIBS si riconosce solo da un header, e da un `<img>` gli header non si
 * leggono. Un layer da inverno — a settembre sulle Alpi il tile misurato conteneva **0,5%
 * di pixel dipinti** — ma è quello che dice se la neve è già arrivata, e a che quota.
 *
 * ## Quello che NON dipinge, e perché conta
 *
 * MISURATO il 2026-09-03 decodificando un tile vero (zoom 6, Alpi): 59,8% dei pixel è la
 * classe "nube", 38,3% "niente neve", 0,9% "acqua" — e **tutte e tre sono trasparenti**
 * (`alpha = 0` nella tavolozza del PNG; le 8 classi speciali della color map ufficiale
 * sono dichiarate `transparent="true"`). Quindi il layer non dipinge nuvole: bene, ma la
 * conseguenza va detta a schermo, perché è controintuitiva — **dove non c'è colore, può
 * non esserci neve oppure può esserci una nuvola sopra**. Il satellite non vede sotto le
 * nubi, e un versante nevoso sotto un fronte risulta identico a un versante spoglio.
 * Per questo la composizione non lascia trasparente la nube: dove nessun passaggio ha
 * visto il suolo stende un velo grigio (`VELO_NON_VISTO`).
 *
 * ## La scala è gialla-rossa, non bianca
 *
 * Dalla color map ufficiale (`colormaps/v1.3/MODIS_NDSI_Snow_Cover.xml`, letta il
 * 2026-09-03): NDSI 0 trasparente, 1 giallo pallido `240,240,128`, e via crescendo fino a
 * 100 rosso pieno `255,0,0`. Chi si aspetta il bianco legge la mappa al rovescio, quindi
 * la legenda dice i valori. È la stessa lezione dell'instabilità satellitare, dove la
 * scala andava in senso opposto al CAPE.
 */

const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

/** Tutti i sensori della composizione, non solo Terra: l'attribuzione nomina le due famiglie. */
export const ATTRIBUZIONE_NEVE = 'Neve: <a href="https://worldview.earthdata.nasa.gov/">NASA GIBS</a> / MODIS, VIIRS';

export type SensoreNeve = 'aqua' | 'noaa20' | 'snpp' | 'noaa21' | 'terra';

export interface DefSensore {
  id: SensoreNeve;
  layer: string;
  famiglia: 'MODIS' | 'VIIRS';
  nome: string;
}

/**
 * Nell'ordine dei passaggi dentro un giorno, **dal piu tardo**: il primo che ha visto il
 * terreno e' il piu fresco, e in composizione vince. Nessuna data di spegnimento qui: un
 * sensore che smette di pubblicare lo dice il servizio (404), non il codice.
 */
export const SENSORI_NEVE: readonly DefSensore[] = [
  { id: 'aqua', layer: 'MODIS_Aqua_NDSI_Snow_Cover', famiglia: 'MODIS', nome: 'Aqua' },
  { id: 'noaa20', layer: 'VIIRS_NOAA20_NDSI_Snow_Cover', famiglia: 'VIIRS', nome: 'NOAA-20' },
  { id: 'snpp', layer: 'VIIRS_SNPP_NDSI_Snow_Cover', famiglia: 'VIIRS', nome: 'S-NPP' },
  { id: 'noaa21', layer: 'VIIRS_NOAA21_NDSI_Snow_Cover', famiglia: 'VIIRS', nome: 'NOAA-21' },
  { id: 'terra', layer: 'MODIS_Terra_NDSI_Snow_Cover', famiglia: 'MODIS', nome: 'Terra' },
];

/** Quanti giorni la composizione usa davvero: oggi, ieri e l'altro ieri (o i tre prima di oggi). */
export const GIORNI_FINESTRA = 3;

/**
 * Oggi piu i `GIORNI_FINESTRA` precedenti, in UTC. Quattro candidati e non tre: oggi puo'
 * non essere ancora pubblicato per una mattonella, e allora serve un giorno in piu.
 */
export function giorniCandidati(adesso: Date): string[] {
  return Array.from({ length: GIORNI_FINESTRA + 1 }, (_, i) =>
    giornoUTC(new Date(adesso.getTime() - i * 86_400_000)));
}

/**
 * L'URL di **una** mattonella. Attenzione all'ordine: riga (`y`) prima della colonna
 * (`x`), la convenzione REST del WMTS, l'opposto di XYZ. Scambiati, le mattonelle
 * arrivano tutte (200, PNG validi) ma di un altro posto: si vede solo guardando la mappa.
 */
export function urlMattonellaNeve(layer: string, giorno: string, z: number, x: number, y: number): string {
  return `${BASE}/${layer}/default/${giorno}/GoogleMapsCompatible_Level8/${z}/${y}/${x}.png`;
}

/** Codici di pixel della composizione: neve e' 1..100 (l'NDSI stesso). */
export const SENZA_NEVE = 0;
export const ACQUA = -1;
export const NON_VISTO = -2;

const chiave = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;
const COLORI_ACQUA = new Set([chiave(0, 0, 255), chiave(35, 35, 117)]);
const COLORI_NON_VISTO = new Set([
  chiave(0, 191, 255), chiave(189, 0, 189), chiave(255, 200, 255),
  chiave(200, 200, 200), chiave(170, 0, 0), chiave(255, 255, 255),
]);

/**
 * Un codice per ogni voce della tavolozza (una tavolozza puo' avere meno di 256 voci:
 * gli indici oltre la fine sono affare di chi legge i pixel, non di questa funzione).
 *
 * Il verde puro e' l'unico «senza neve». Una voce trasparente che non riconosciamo e'
 * `NON_VISTO`, **mai** `SENZA_NEVE`: un colore nuovo del servizio non deve diventare, in
 * silenzio, la dichiarazione che li' la neve non c'e'.
 */
export function classificaTavolozza(t: PngTavolozza): Int8Array {
  const n = t.tavolozza.length / 3;
  const out = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const k = chiave(t.tavolozza[i * 3], t.tavolozza[i * 3 + 1], t.tavolozza[i * 3 + 2]);
    const alfa = t.alfa[i] ?? 255;
    if (k === chiave(0, 255, 0)) out[i] = SENZA_NEVE;
    else if (COLORI_ACQUA.has(k)) out[i] = ACQUA;
    else if (COLORI_NON_VISTO.has(k)) out[i] = NON_VISTO;
    else if (i >= 1 && i <= 100 && alfa > 0) out[i] = i;
    else out[i] = NON_VISTO;
  }
  return out;
}

/** La mattonella z8 che contiene il punto e il pixel (0-255) dentro di essa. */
export function pixelZ8(lat: number, lon: number): { x: number; y: number; px: number; py: number } {
  const n = 256; // mattonelle per lato a z8
  const fx = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  return { x, y, px: Math.floor((fx - x) * 256), py: Math.floor((fy - y) * 256) };
}

/** Opacita' della neve (su 255) e velo «non visto»: un'unica costante per disegno e legenda. */
export const OPACITA_NEVE = 235;
export const VELO_NON_VISTO = [71, 85, 105, 115] as const;
export const COLORE_VELO_CSS =
  `rgba(${VELO_NON_VISTO[0]},${VELO_NON_VISTO[1]},${VELO_NON_VISTO[2]},${(VELO_NON_VISTO[3] / 255).toFixed(2)})`;

/** Giorno in forma `YYYY-MM-DD`, in UTC: è il fuso in cui GIBS indicizza i suoi giorni. */
export function giornoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * La legenda: cinque classi **campionate dalla color map ufficiale**, non inventate.
 *
 * I colori sono i valori esatti pubblicati per NDSI 1, 25, 50, 75 e 100. Dichiarare
 * colori che sulla mappa non esistono è peggio che non avere legenda — costato due volte
 * in questo progetto, con le legende EFFIS della v0.11.6.
 */
export const LEGENDA_NEVE = [
  { color: '#f0f080', label: '~1-20: poca neve o incerta' },
  { color: '#f0d283', label: '~21-40' },
  { color: '#f0b488', label: '~41-60' },
  { color: '#f0968d', label: '~61-80' },
  { color: '#ff0000', label: '~81-100 (copertura piena)' },
] as const;
