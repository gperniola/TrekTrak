import jsPDF from 'jspdf';
import type { Waypoint, Leg, DifficultyGrade } from './types';
import { azimuthToCardinal } from './calculations';
import { formatTime, sanitizeFilename } from './format';

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 1) + '.' : str;
}

interface PdfData {
  name: string;
  waypoints: Waypoint[];
  legs: Leg[];
  totalDistance: number;
  totalElevGain: number;
  totalElevLoss: number;
  totalTime: number;
  difficulty: DifficultyGrade;
}

export function generateSummaryPDF(data: PdfData): jsPDF {
  const doc = new jsPDF();
  const { name, waypoints, legs, totalDistance, totalElevGain, totalElevLoss, totalTime, difficulty } = data;

  // Title
  doc.setFontSize(20);
  doc.text(name || 'Itinerario TrekTrak', 14, 20);

  // Summary line
  doc.setFontSize(10);
  doc.text(
    `Distanza: ${totalDistance.toFixed(1)} km | Dislivello: +${totalElevGain}m / -${totalElevLoss}m | Tempo: ${formatTime(totalTime)} | Difficolta': ${difficulty}`,
    14, 30
  );

  // Table header
  let y = 45;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const headers = ['#', 'Da', 'A', 'Dist (km)', 'D+ (m)', 'D- (m)', 'Azimuth', 'Tempo', 'Pend %'];
  const colX = [14, 22, 55, 88, 108, 128, 148, 168, 188];
  headers.forEach((h, i) => doc.text(h, colX[i], y));

  doc.setFont('helvetica', 'normal');
  y += 8;

  legs.forEach((leg, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);
    const row = [
      String(i + 1),
      truncate(from?.name || `WP${i + 1}`, 16),
      truncate(to?.name || `WP${i + 2}`, 16),
      leg.distance != null ? leg.distance.toFixed(1) : '-',
      leg.elevationGain != null ? String(leg.elevationGain) : '-',
      leg.elevationLoss != null ? String(leg.elevationLoss) : '-',
      leg.azimuth != null ? `${leg.azimuth}° ${azimuthToCardinal(leg.azimuth)}` : '-',
      leg.estimatedTime != null ? formatTime(leg.estimatedTime) : '-',
      leg.slope != null ? leg.slope.toFixed(1) : '-',
    ];
    row.forEach((cell, j) => doc.text(cell, colX[j], y));
    y += 6;
  });

  // Waypoint details
  y += 10;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Waypoint', 14, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  waypoints.forEach((wp) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(
      `${wp.order + 1}. ${wp.name || 'Senza nome'} — Lat: ${wp.lat ?? '-'}, Lon: ${wp.lon ?? '-'}, Alt: ${wp.altitude ?? '-'}m`,
      14, y
    );
    y += 6;
  });

  return doc;
}

export function generateRoadbookPDF(data: PdfData): jsPDF {
  const doc = generateSummaryPDF(data);
  const { waypoints, legs } = data;

  // Add detailed leg pages
  legs.forEach((leg, i) => {
    doc.addPage();
    const from = waypoints.find((w) => w.id === leg.fromWaypointId);
    const to = waypoints.find((w) => w.id === leg.toWaypointId);

    doc.setFontSize(14);
    doc.text(`Tratta ${i + 1}: ${from?.name || `WP${i + 1}`} -> ${to?.name || `WP${i + 2}`}`, 14, 20);

    let y = 35;
    doc.setFontSize(11);
    const details = [
      `Distanza: ${leg.distance != null ? `${leg.distance.toFixed(1)} km` : '-'}`,
      `Dislivello: +${leg.elevationGain ?? '-'}m / -${leg.elevationLoss ?? '-'}m`,
      `Azimuth: ${leg.azimuth != null ? `${leg.azimuth}° ${azimuthToCardinal(leg.azimuth)}` : '-'}`,
      `Pendenza: ${leg.slope != null ? `${leg.slope.toFixed(1)}%` : '-'}`,
      `Tempo stimato: ${leg.estimatedTime != null ? formatTime(leg.estimatedTime) : '-'}`,
    ];

    // Azimuth change from previous leg
    if (i > 0 && legs[i - 1].azimuth != null && leg.azimuth != null) {
      let delta = leg.azimuth - legs[i - 1].azimuth!;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const direction = delta > 0 ? 'destra' : 'sinistra';
      details.push(`Variazione azimuth: ${Math.abs(delta).toFixed(0)}° a ${direction}`);
    }

    details.forEach((d) => {
      doc.text(d, 14, y);
      y += 8;
    });

    // From/To coordinates
    y += 5;
    doc.setFontSize(9);
    doc.text(`Partenza: ${from?.name || 'N/A'} (${from?.lat ?? '-'}, ${from?.lon ?? '-'}) alt. ${from?.altitude ?? '-'}m`, 14, y);
    y += 6;
    doc.text(`Arrivo: ${to?.name || 'N/A'} (${to?.lat ?? '-'}, ${to?.lon ?? '-'}) alt. ${to?.altitude ?? '-'}m`, 14, y);
  });

  return doc;
}

export function downloadPDF(data: PdfData, format: 'summary' | 'roadbook'): void {
  const doc = format === 'summary'
    ? generateSummaryPDF(data)
    : generateRoadbookPDF(data);
  doc.save(`${sanitizeFilename(data.name || 'trektrak-itinerario')}-${format}.pdf`);
}
