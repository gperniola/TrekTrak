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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/*
          Il tema si decide PRIMA del primo disegno.
          Senza questo, l'app si dipinge scura (il suo aspetto di partenza), poi React
          legge le impostazioni e la preferenza di sistema e corregge: chi ha scelto il
          chiaro vedeva un lampo scuro a ogni avvio, e chi ha il sistema scuro un lampo
          bianco — perche' prima che `matchMedia` venga letta il valore di partenza dice
          «chiaro». Qualche riga di script che gira sincrono e' l'unico modo di evitarlo:
          il primo fotogramma non si puo' correggere dopo.

          Tutto dentro un try: se lo storage e' bloccato resta l'aspetto scuro, che e'
          quello con cui l'app e' nata.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{
  var s=JSON.parse(localStorage.getItem('trektrak_settings')||'{}');
  var t=s&&s.tema;
  if(t!=='chiaro'&&t!=='scuro'&&t!=='sistema')t='sistema';
  var scuro=t==='scuro'||(t==='sistema'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(!scuro)document.documentElement.setAttribute('data-tema','chiaro');
}catch(e){}`,
          }}
        />
      </head>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
