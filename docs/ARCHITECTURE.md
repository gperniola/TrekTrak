# TrekTrak — Architettura

> **Questo file non è più la fonte di verità.** Lo era fino alla v0.4.0 (marzo-aprile 2026)
> e descriveva uno stato ormai superato («Zustand store singolo», `next-pwa`, nessun meteo
> né layer di emergenza). Da allora il progetto è cresciuto di oltre venti versioni.

Per lo stato corrente dell'architettura — stack, i più store Zustand, le aree (verifica,
meteo del percorso, layer di emergenza, libreria condivisa, shell mobile), le convenzioni
e i comandi — vedi **[`/CLAUDE.md`](../CLAUDE.md)** nella radice del repo, che è
auto-caricato a ogni sessione ed è tenuto allineato.

Il resto della documentazione:

- **spec e piani per feature** — `docs/superpowers/specs/` e `docs/superpowers/plans/`
- **task e analisi** (review, pulizia, rilascio pubblico) — `backlog/`
- **sinossi e dettaglio per area** — KB Obsidian `02 - Projects/TrekTrak/`
- **cronologia delle versioni** — `CHANGELOG.md`

La storia delle decisioni prese fino alla v0.4.0 resta consultabile in git
(`git log -- docs/ARCHITECTURE.md`), dove questo file conteneva le note di quel periodo.
