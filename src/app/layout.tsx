import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrekTrak — Itinerari di Trekking',
  description: 'App didattica per la creazione di itinerari di trekking con cartografia manuale',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
