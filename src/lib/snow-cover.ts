/**
 * Copertura nevosa da **NASA GIBS** (MODIS Terra, indice NDSI).
 *
 * Mattonelle WMTS statiche, senza chiave: viaggiano come `<img>`, quindi il CORS non
 * conta. Un layer da inverno — a settembre sulle Alpi il tile misurato conteneva **0,5%
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
const LAYER = 'MODIS_Terra_NDSI_Snow_Cover';

/**
 * Il set di mattonelle si chiama `GoogleMapsCompatible_Level8`: **otto livelli**, cioè
 * zoom 8 e non oltre. Non è una stima nostra, lo dichiara il `WMTSCapabilities` — e oltre
 * quel livello Leaflet stira l'ultimo disponibile invece di chiedere mattonelle che non
 * esistono.
 */
export const ZOOM_NATIVO_MASSIMO_NEVE = 8;

export const ATTRIBUZIONE_NEVE = 'Neve: <a href="https://worldview.earthdata.nasa.gov/">NASA GIBS</a> / MODIS Terra';

/** Quanti giorni indietro si può arrivare cercando un giorno con dati. */
export const GIORNI_INDIETRO_MAX = 4;

/** Giorno in forma `YYYY-MM-DD`, in UTC: è il fuso in cui GIBS indicizza i suoi giorni. */
export function giornoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * I giorni da provare, dal più recente.
 *
 * Il capabilities dichiara **oggi** come default, quindi oggi si prova per primo: ma il
 * passaggio del satellite copre una fascia alla volta, e nelle prime ore il mosaico
 * globale è incompleto. Un elenco di ripieghi costa niente e evita di mostrare un layer
 * vuoto quando i dati di ieri ci sono.
 */
export function giorniDaProvare(adesso: Date): string[] {
  return Array.from({ length: GIORNI_INDIETRO_MAX + 1 }, (_, i) =>
    giornoUTC(new Date(adesso.getTime() - i * 86_400_000)));
}

/**
 * Il template per Leaflet. **Attenzione all'ordine: `{y}` prima di `{x}`** — è la
 * convenzione REST del WMTS, l'opposto di quella XYZ a cui somiglia. Con l'ordine
 * scambiato le mattonelle arrivano tutte (200, PNG validi) ma di un altro posto: un
 * errore che non si vede negli errori di rete, solo guardando la mappa.
 */
export function templateNeve(giorno: string): string {
  return `${BASE}/${LAYER}/default/${giorno}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
}

/**
 * La legenda: cinque classi **campionate dalla color map ufficiale**, non inventate.
 *
 * I colori sono i valori esatti pubblicati per NDSI 1, 25, 50, 75 e 100. Dichiarare
 * colori che sulla mappa non esistono è peggio che non avere legenda — costato due volte
 * in questo progetto, con le legende EFFIS della v0.11.6.
 */
export const LEGENDA_NEVE = [
  { color: '#f0f080', label: 'Indice neve ~1-20 (poca)' },
  { color: '#f0d283', label: '~21-40' },
  { color: '#f0b488', label: '~41-60' },
  { color: '#f0968d', label: '~61-80' },
  { color: '#ff0000', label: '~81-100 (copertura piena)' },
] as const;
