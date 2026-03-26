# PWA Offline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TrekTrak a Progressive Web App with offline support — installable, with cached app shell and map tiles.

**Architecture:** Use `next-pwa` to generate a Workbox service worker from Next.js config. Cache tile URLs with cache-first strategy (max 2000, TTL 30 days). App shell uses stale-while-revalidate. OfflineBanner component shows connectivity status. PWA manifest enables install-to-homescreen.

**Tech Stack:** next-pwa, Workbox (via next-pwa), Next.js 14

**Spec:** `docs/superpowers/specs/2026-03-26-pwa-offline.md`

---

## File Structure

### New files
- `public/manifest.json` — PWA manifest
- `public/icons/icon-192.png` — PWA icon 192x192
- `public/icons/icon-512.png` — PWA icon 512x512
- `src/components/shared/OfflineBanner.tsx` — offline status banner

### Modified files
- `next.config.mjs` — wrap with next-pwa, add runtimeCaching for tiles
- `src/app/layout.tsx` — add manifest link + theme-color meta
- `src/app/page.tsx` — render OfflineBanner
- `package.json` — add next-pwa dependency

---

## Task 1: Install next-pwa + configure service worker

**Files:**
- Modify: `package.json`
- Modify: `next.config.mjs`

- [ ] **Step 1: Install next-pwa**

Run: `npm install next-pwa`

- [ ] **Step 2: Configure next.config.mjs**

Replace `next.config.mjs` with:

```javascript
import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.tile\.opentopomap\.org\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/tile\.thunderforest\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.tile-cyclosm\.openstreetmap\.fr\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/tile\.waymarkedtrails\.org\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default pwaConfig(nextConfig);
```

- [ ] **Step 3: Add generated SW files to .gitignore**

Append to `.gitignore`:
```
# next-pwa generated files
public/sw.js
public/workbox-*.js
public/sw.js.map
public/workbox-*.js.map
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

## Task 2: PWA manifest + icons

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create public directory and manifest**

Run: `mkdir -p public/icons`

Create `public/manifest.json`:
```json
{
  "name": "TrekTrak",
  "short_name": "TrekTrak",
  "description": "App didattica per cartografia manuale e trekking",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#4ade80",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Generate PWA icons**

Create minimal SVG-based PNG icons using a canvas script or manually. The icons should be a green triangle (▲) on a black background. Generate them with this Node script:

Create a temporary file `generate-icons.mjs`:
```javascript
import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';

function generateIcon(size, path) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  // Green triangle
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  const margin = size * 0.2;
  ctx.moveTo(size / 2, margin);
  ctx.lineTo(size - margin, size - margin);
  ctx.lineTo(margin, size - margin);
  ctx.closePath();
  ctx.fill();

  writeFileSync(path, canvas.toBuffer('image/png'));
}

mkdirSync('public/icons', { recursive: true });
generateIcon(192, 'public/icons/icon-192.png');
generateIcon(512, 'public/icons/icon-512.png');
console.log('Icons generated');
```

Run: `npm install canvas --save-dev` then `node generate-icons.mjs` then `rm generate-icons.mjs` then `npm uninstall canvas`

Alternative if canvas is hard to install on Windows: create simple solid-color PNG placeholders manually, or use any online PWA icon generator.

- [ ] **Step 3: Update layout.tsx with manifest and theme-color**

Replace `src/app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrekTrak — Itinerari di Trekking',
  description: 'App didattica per la creazione di itinerari di trekking con cartografia manuale',
  manifest: '/manifest.json',
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
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

---

## Task 3: OfflineBanner component

**Files:**
- Create: `src/components/shared/OfflineBanner.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create OfflineBanner component**

```typescript
// src/components/shared/OfflineBanner.tsx
'use client';

import { useState, useEffect } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1050] bg-amber-600 text-black text-xs text-center py-1 font-medium"
      role="status"
      aria-live="polite"
    >
      Modalità offline — alcune funzioni non disponibili
    </div>
  );
}
```

- [ ] **Step 2: Add OfflineBanner to page.tsx**

In `src/app/page.tsx`, add import:
```typescript
import { OfflineBanner } from '@/components/shared/OfflineBanner';
```

Add `<OfflineBanner />` as the first child inside the root `<div>`:
```tsx
<div className="h-dvh flex flex-col lg:flex-row overflow-hidden">
  <OfflineBanner />
  {/* ... rest unchanged */}
```

- [ ] **Step 3: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit`
Run: `npx jest --no-cache`

---

## Task 4: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest --no-cache`
Expected: all tests pass

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run production build**

Run: `npx next build`
Expected: build succeeds, `public/sw.js` generated

- [ ] **Step 4: Verify SW was generated**

Run: `ls public/sw.js`
Expected: file exists

- [ ] **Step 5: Verify manifest**

Run: `cat public/manifest.json`
Expected: valid JSON with name, icons, display standalone
