# Elevation Profile Gradient + Mobile Drawer

**Date:** 2026-03-17
**Status:** Draft

## Overview

Two improvements to TrekTrak:
1. Color the elevation profile chart by slope gradient (green → yellow → orange → red)
2. Replace the mobile sidebar with a full-screen drawer triggered by a hamburger button

---

## Feature 1: Elevation Profile Slope Gradient

### Problem

The elevation profile currently displays a uniform green area. It provides no visual indication of where the terrain is steep vs flat.

### Data Flow

**Store changes:**
- Add `elevationProfile?: { distance: number; altitude: number }[]` to the `Leg` type
- Each entry is a sampled point with cumulative distance (km) from leg start and altitude (m)
- Populated by `autoFillLegClassic` after fetching the batch elevation profile
- **Sampling interval**: 20m for legs ≤ 500m, 100m for legs > 500m (reduces API calls on long legs while keeping detail on short ones). This also applies to the existing D+/D- calculation in `autoFillLegClassic` (update `SAMPLE_INTERVAL_M` to be dynamic based on leg distance)
- **Excluded from localStorage persistence and JSON export** — the profile is recomputed on auto-fill (avoids bloating storage)
- **Cleared** on the same lifecycle as `routeGeometry`: waypoint reorder, mode switch to 'learn', routing switch change, waypoint position change

**Chart rendering:**
- `ElevationProfile` builds a combined dataset from all legs' `elevationProfile` arrays, computing global cumulative distance
- For each consecutive pair of points, calculate local slope: `|altitude[i+1] - altitude[i]| / (distance[i+1] - distance[i]) × 100` (absolute value — steepness regardless of uphill/downhill direction; directional distinction is out of scope)
- Direction-agnostic coloring is intentional: steep downhill is as challenging as steep uphill in trekking

**Recharts technique: `<linearGradient>` with horizontal offset stops.**
- Define an SVG `<linearGradient>` with `x1="0" x2="1" y1="0" y2="0"` (horizontal)
- For each data point, compute `offset = point.cumulativeDistance / totalDistance`
- At each offset, insert two gradient stops: one closing the previous color, one opening the new color (based on the slope to the next point)
- This colors the area fill by x-position. The fill appears as vertical color bands — acceptable for this use case
- **Stroke**: same `<linearGradient>` applied to the stroke, so the top line also reflects slope colors

**Fallback:** If a leg has no `elevationProfile` data (guided mode legs, or pre-existing legs), fall back to uniform green using waypoint altitudes only.

### Slope Thresholds (half-open intervals)

| Slope           | Color   | Hex       | Meaning    |
|-----------------|---------|-----------|------------|
| `slope < 10`    | Green   | `#4ade80` | Flat       |
| `10 ≤ slope < 20` | Yellow  | `#facc15` | Moderate   |
| `20 ≤ slope < 30` | Orange  | `#fb923c` | Steep      |
| `slope ≥ 30`    | Red     | `#ef4444` | Very steep |

---

## Feature 2: Mobile Full-Screen Drawer

### Problem

On mobile (< 1024px), the left panel takes 50vh stacked above the map. This splits the small screen in half, making both the panel and map cramped.

### Design

**Desktop (≥ 1024px):** No change. Sidebar remains at 380px fixed width.

**Mobile (< 1024px):**
- The left panel is hidden by default via Tailwind: `hidden lg:flex` on the sidebar container
- A **hamburger button** (☰) is shown only on mobile (`lg:hidden`), fixed over the top-left of the map
- The existing "Impostazioni" button moves inside the drawer on mobile (alongside the other panel controls) to avoid overlap; on desktop it stays on the map as-is
- Tapping the hamburger opens the `LeftPanel` inside a **full-screen drawer overlay** covering the entire viewport (100vw × 100vh) including the elevation profile bar, with solid `bg-gray-950` background
- A **close button** (✕) in the top-right corner of the drawer dismisses it
- No animation required (simple show/hide)

**Responsive approach — Tailwind classes, not JS conditional rendering:**
- The sidebar in page.tsx gets `hidden lg:flex` (hidden on mobile, visible on desktop)
- The hamburger button gets `lg:hidden` (visible on mobile, hidden on desktop)
- The drawer overlay gets `lg:hidden` and is toggled via `useState` (`drawerOpen`)
- This way CSS breakpoints handle the responsive layout naturally, no `useMediaQuery` hook needed, no SSR hydration issues
- `LeftPanel` itself needs a minor change: accept an optional `className` prop so the drawer can render it with `h-full` instead of the default `h-[50vh]`

**State:** `useState<boolean>` in page.tsx for `drawerOpen`. Purely UI state, no Zustand needed.

**Z-index values:**
- Hamburger button: `z-[1000]`
- Drawer overlay: `z-[1100]`
- Modals (ToleranceSettings, SavedItinerariesModal): `z-[1200]` (bumped from current `z-[1001]` so they render above the drawer)

---

## Out of Scope

- Legend/key for the slope colors
- Swipe gestures for the drawer
- Animated transitions for drawer open/close
- Directional slope coloring (different palette for uphill vs downhill)
- Changes to guided mode elevation handling
- Changes to desktop layout
