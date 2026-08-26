/**
 * Escaping di testo destinato a markup (HTML dei popup Leaflet, XML del GPX).
 *
 * Unica implementazione: nel progetto ne esistevano tre copie divergenti — `esc` in
 * `dpc.ts` copriva solo `& < >`, `escapeXml` in `export-gpx.ts` anche `" '`, e una
 * terza nei popup dei focolai. Con più copie, quella che verrà dimenticata è sempre
 * la più debole, proprio nel punto in cui il testo arriva da una fonte esterna.
 */
export function escapeMarkup(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
