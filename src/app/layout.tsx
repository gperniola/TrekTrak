import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrekTrak — Itinerari di Trekking',
  description: 'App didattica per la creazione di itinerari di trekking con cartografia manuale',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#4ade80',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
