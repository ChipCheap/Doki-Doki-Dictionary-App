# Doki-Doki Dictionary

A vocabulary trainer with spaced repetition, running entirely in the browser.
No backend, no accounts, offline-capable after the first load. Progress lives on
your device and moves between machines by JSON export and import.

Spanish and Vietnamese ship with the app; English is the base language.

## Licensing

Two licences, because two different things are being distributed.

**The application is GPL-3.0-or-later.** See `LICENSE`. You may use, study,
modify and redistribute it, including commercially — provided anything you
distribute that is derived from it stays under the same licence, with source.

**The word packs are CC BY-SA 4.0.** They are derived from openly licensed data
— English Wiktionary via kaikki.org, the Tatoeba Project, and OpenSubtitles-derived
frequency lists — all of which carry share-alike terms, so the packs inherit
them. Every source is credited in each pack's manifest under `public/packs/`
and on the Attributions screen in the app.

The two do not conflict: a pack shipped alongside an application is a
*collection*, not an *adaptation*, so the packs' share-alike terms cover the data
and not the code.

## Development

```
npm install
npm run dev       # dev server
npm run check     # typecheck (svelte-check — plain tsc cannot read .svelte.ts)
npm test          # vitest
```

Pack generation is a build-side tool under `tools/packs`, not part of the app:

```
npm run packs:fetch es      # download and pin sources (~1 GB for Spanish)
npm run packs:build es      # build a pack from the cache
```

Design documents sit next to `CLAUDE.md` and hold the reasoning behind every
decision: `framework.md`, `ui.framework.md`, `packs.framework.md`,
`maintenance.framework.md`, then `architecture.md`.
