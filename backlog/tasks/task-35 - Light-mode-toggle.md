---
id: TASK-35
title: Light mode toggle (oltre al dark attuale)
status: To Do
assignee: []
created_date: '2026-05-15 19:00'
labels:
  - feature
  - theming
  - polish-v0.6.2-deferred
dependencies: []
priority: low
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Feature** (suggestion **D4**) — oggi solo dark theme. Un light mode è utile per:
- Stampa (cattura schermo, screenshot didattici)
- Uso esterno con sole diretto (dark può essere illeggibile su LCD esposto)

## Task

### Tailwind dark mode
- [ ] Configurare Tailwind `darkMode: 'class'` in `tailwind.config.ts`
- [ ] Convertire le classi: aggiungere varianti `light:` (es. `bg-gray-900 light:bg-gray-100`, `text-white light:text-gray-900`)

### Store
- [ ] Nuovo `themeMode: 'light' | 'dark' | 'system'` in `settings`
- [ ] Detect `prefers-color-scheme` per `'system'`
- [ ] Apply `class="light"` o `class="dark"` su `<html>` reattivamente

### UI
- [ ] Toggle in `ToleranceSettings` (o nuovo pannello "Aspetto")
- [ ] Icone sole/luna/auto

### Mappa
- [ ] Considerare se OpenTopoMap/Thunderforest hanno variante dark. Altrimenti la mappa rimane sempre nei colori naturali

## Acceptance criteria

- [ ] Toggle funziona, applica immediatamente
- [ ] Tutte le sezioni UI (panel, modal, tutorial) leggibili in entrambe le mode
- [ ] Setting persistito

## Riferimenti

- `backlog/docs/feature-suggestions.md` D4
- Tailwind docs: https://tailwindcss.com/docs/dark-mode
<!-- SECTION:DESCRIPTION:END -->
