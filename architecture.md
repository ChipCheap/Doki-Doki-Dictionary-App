# Architecture — Doki-Doki Dictionary

**Created:** 2026-08-16
**Derives from:** `framework.md`, `ui.framework.md` (+ `ui.wireframes.html`,
`ui.theme.css`), `packs.framework.md`, `maintenance.framework.md`
**Complexity target:** **2 (simple)** — scope: project

---

## Overview

A browser-only application. There is no backend: static files are served once,
and everything after that — grading, scheduling, storage, rendering — runs on the
user's machine inside the browser.

Four modules with dependencies pointing inward. The **domain** is pure functions
over plain data and knows nothing about storage or screens; **dictionary** and
**progress** own their halves of the database; **ui** composes them. The split
between dictionary and progress mirrors the design's own most expensive
invariant: decks own no progress, and progress keys on `(word, vector)`.

The complexity ceiling is **2**. The domain is genuinely tiny — two integers per
card, a fixed interval table, no ease factors, no history — and the design was
deliberately closed off rather than left open. Seams exist where the frameworks
named them and nowhere else.

---

## Guidelines

Standing rules. Each is checkable, so the reviewer can flag a violation and the
implementer can tell when a change would offend one.

1. **`domain` imports nothing from `dictionary`, `progress`, or `ui`.**
   Dependencies point inward only.
2. **No screen touches storage directly.** All progress reads and writes go
   through the `progress` module's public surface. That surface is also the
   documented attachment point for any future sync.
3. **Every grade is written the moment it is made.** No batching, no
   end-of-session flush.
4. **No literal colour value appears outside `ui.theme.css`.**
5. **The pack reader tolerates unknown fields.** A newer pack must never break an
   older app.
6. **Pack format changes are additive.** Fields are added, not repurposed or
   removed.
7. **Database migrations run cumulatively from any older version forward** and are
   never destructive. Assume a user skipped a year of updates.
8. **Any operation that changes what the user will study confirms visibly, with a
   count, and never fails silently.** Pack import, profile import, deck creation,
   mass-edit. A silent no-op is worse than a loud failure: the user acts on a
   false belief and discovers it months later.
9. **No swallowed exceptions anywhere near progress.** Data-integrity failures
   surface to the user. Only explicitly optional capabilities degrade quietly.
10. **The complexity ceiling is 2.** Any change that would need more — an event
    bus, a plugin system, formal ports — is surfaced to the user, not absorbed.

---

## Structure

```
        ui
      ↙    ↘
dictionary  progress
      ↘    ↙
       domain
```

**`domain`** — pure functions, no IO, no framework. The mastery ladder as a
constant. Grading (the four outcomes and their level movement). Due-day
arithmetic. Session composition: which cards, in what order, given a deck, its
settings, progress and today. Distractor selection rules. Answer matching,
including the accent-sensitive comparison and the "valid word, wrong target"
determination.

This is where a subtle bug silently corrupts months of a user's progress, which
is exactly why it takes plain data in and returns plain data out — the whole
grading table is testable with no database and no mocks.

**`dictionary`** — the installed pack: reference data, read-only after install,
replaceable wholesale. Owns pack parsing, the install-time merge of core and
meaning layers, and lookups by key, part of speech, meaning and term.

**`progress`** — user data: levels, due days, hidden words, decks, settings,
snapshots. Small, mutable, irreplaceable. Owns export/import and the snapshot
swap. **This module is the transferable part of the app**, and its boundary is
drawn so that moving a user to another machine means moving what this module
owns and nothing else.

**`ui`** — Svelte components, the session store holding in-flight quiz position
and phase, and the theme. Composes the other three; contains no grading logic.

**Data flow for one answer:** `ui` reads the current card, calls `domain` to
grade it, hands the result to `progress` to write, and asks `domain` for the next
card. `domain` never calls anything.

---

## Decisions

### D1: Four modules, dependencies inward
- **Chosen:** `domain` / `dictionary` / `progress` / `ui`
- **Why:** dictionary and progress have opposite natures — ~10 MB read-only and
  replaceable versus ~200 KB mutable and precious. Merged, snapshot code must
  know to skip the dictionary and pack replacement must know not to touch
  progress. Split, each has one job. It also makes the code vocabulary match the
  design's.
- **Drawbacks:** most screens cross two boundaries to assemble what they show.
- **Alternatives:** three modules with a combined `data` layer (one module doing
  two unrelated jobs); vertical slices by feature (grading is shared by study and
  maintenance, so slices need a shared core anyway — this, with extra steps).

### D2: Svelte
- **Chosen:** Svelte, via Vite
- **Why:** compiles away, shipping no framework runtime. A component is HTML with
  a script block, which is the smallest conceptual step from what the user
  already knows. Direct DOM access matters because the keyboard model is
  imperative — autofocus on card appear, blur on submit, then single-key
  shortcuts.
- **Drawbacks:** smaller ecosystem; Svelte 5 was a ground-up rewrite so much
  online material is outdated Svelte 4.
- **Alternatives:** React (heaviest runtime, steepest for a newcomer, declarative
  model fights imperative focus control); vanilla TS (hand-rolled DOM sync,
  untenable for the browse view over thousands of words, and saves no build step
  since a PWA needs one anyway); Lit (web-component overhead buys nothing here).

### D3: Dexie over IndexedDB
- **Chosen:** Dexie
- **Why:** schema versioning and migrations, bulk writes for the ~10,000-row pack
  install, and a readable query API for browse filters. All three are needed.
- **Drawbacks:** ~25 KB and an API to learn.
- **Alternatives:** `idb` (~1 KB, but migrations and bulk logic become hand-rolled
  — exactly the fiddly parts); raw IndexedDB (event-based and easy to get subtly
  wrong); keeping the pack in memory and skipping the database for it (re-parses
  10 MB every launch, and progress needs IndexedDB regardless).

### D4: Indexes built by the database, not shipped in the pack
- **Chosen:** declare indexes in the schema; the pack ships raw data
- **Why:** IndexedDB builds and maintains exactly the indexes the pack was going
  to carry. Shipping them means redundant bytes and a second source of truth that
  can drift.
- **Drawbacks:** index build happens at install rather than being precomputed.
- **Amends `packs.framework.md`**, which specified pre-built indexes.

### D5: Merge core and meaning layers at install
- **Chosen:** one row per word, both sides, written at install
- **Why:** the two-layer split exists to save *download* size — so a second base
  language costs ~4 MB instead of ~10 MB. Once the data is on the device that
  reason is gone. Reads become single lookups.
- **Drawbacks:** changing base language re-runs the merge, an operation that
  happens once if ever.
- **Alternatives:** join at read time (pays a join forever for a split that varies
  approximately never).

### D6: Vite + Svelte, client-side routing
- **Chosen:** Vite with a small client router
- **Why:** the app is genuinely a single-page offline application. Fewer concepts.
- **Drawbacks:** routing is wired by hand, which is modest.
- **Alternatives:** SvelteKit (batteries included and better-documented, but
  brings server concepts — load functions, endpoints, SSR — that would be
  configured off, and that is extra surface for a first Svelte project).

### D7: Durability posture
- **Chosen:** IndexedDB + `navigator.storage.persist()` + an install prompt +
  a periodic backup nudge
- **Why:** default browser storage is evictable under disk pressure, and Safari
  deletes script-writable storage after seven days without site interaction.
  `persist()` exempts the origin from pressure eviction; **installing the app
  exempts it from Safari's seven-day rule.** The install prompt is therefore a
  data-safety mechanism, not decoration.
- **Drawbacks:** none of it survives a user deliberately clearing site data, so
  export remains the only true recovery.
- **Reframes `framework.md`:** export/import is disaster recovery, not only
  portability.
- **Constraint to record:** storage is per-origin. **The hosting URL must be
  chosen once and not changed**, or progress is stranded at the old address.

### D8: Backup destination
- **Chosen:** automatic backup to a user-chosen folder where the File System
  Access API exists; manual export elsewhere
- **Why:** backups that depend on the user remembering are not backups. The
  picker's `id` option reopens the same folder each time.
- **Drawbacks:** a second code path, and it works only in Chrome and Edge.
- **Alternatives:** manual export only (nothing protects a user who never clicks
  it); periodic auto-download (universal but litters the Downloads folder).
- **Not possible, recorded so it is not re-attempted:** a browser cannot be given
  a filesystem path by configuration, and an installed PWA has no folder on disk
  to write beside.

### D9: Service worker via the Vite PWA plugin, `registerType: 'prompt'`
- **Chosen:** generated service worker and manifest; app shell precached; packs
  excluded from the precache; declined versions remembered so the prompt does not
  nag
- **Why:** Vite hashes filenames, so the precache list can only be produced at
  build time. Hand-writing it means either abandoning reliable offline or
  reimplementing the generator. Packs stay out of the precache because they live
  in IndexedDB — caching them twice would double 10 MB.
- **Drawbacks:** a build-tool dependency and generated code not under direct
  control.
- **Exit path is real:** the manifest can be hand-written at any time; only the
  service worker is genuinely worth delegating.
- **Also:** fonts are self-hosted rather than fetched from a CDN, so the app owes
  nothing to a third party at install time.

### D10: Domain as pure functions
- **Chosen:** plain functions taking data and returning data
- **Why:** the entire grading table and ladder become testable with no database
  and no mocks — the right property for the code where a bug is silent and
  cumulative.
- **Drawbacks:** callers assemble the inputs.
- **Alternatives:** a service class with injected storage (grading could no longer
  be tested without standing up storage); methods on rich objects (pulls
  behaviour onto data from the database, blurring the boundary the module split
  exists to draw).

### D11: Explicit phase value for quiz state
- **Chosen:** one explicit phase value; key bindings resolved from it
- **Why:** the same key must mean different things at different moments — `m`
  types a letter while answering and means *mark correct* after a wrong
  submission. An explicit phase makes bindings a lookup instead of a pile of
  conditionals, and `ui.framework.md` made phase-correctness an invariant because
  getting it wrong is a real bug class.
- **Drawbacks:** one more concept than raw flags.
- **Alternatives:** inferring the phase from combinations of booleans (how Enter
  ends up double-submitting); a state machine library (over the ceiling).
- **Placement:** `domain` **composes** the queue as a pure function; a session
  store in `ui` holds position and phase. Composition is domain; progression is
  runtime.

The phases, for reference:

| Phase | Enter | Other keys |
|---|---|---|
| **Typing** | submit; on an empty field, prime — a second Enter is *I don't know* | letters type; `1`–`4` select in multiple choice; Tab suppressed |
| **Result** | continue, accepting the demotion | `m` mark correct, `r` redo, Tab cycles the two buttons |

A correct answer on desktop skips the result phase entirely and advances at once,
with the answered word landing in the pane beside the next question. Wrong answers
always dwell, on every form factor. Nothing auto-advances past a decision the user
still has to make.

### D12: Question types as a lookup map
- **Chosen:** a map from the method enum to its component and a little metadata
- **Why:** adding a vector is one entry plus one component, in one findable place.
- **Drawbacks:** mild indirection.
- **Alternatives:** an interface each type implements (ceremony around two nearly
  identical implementations — both check an answer and grade the same way, and
  differ only in presentation); a switch in the quiz screen (scatters vector
  knowledge into the UI).

### D13: Error posture
- **Chosen:** fail loudly on data integrity; degrade quietly only where a
  framework explicitly says to; console-only logging
- **Why:** the worst failure in this app is a silent one — an import that never
  fired, discovered months later after studying nothing new.
- **Drawbacks:** more visible error surfaces to design.

---

## Infrastructure

**Database:** IndexedDB via Dexie. Stores: `dictionary` (merged entries),
`progress` (keyed by word + vector, indexed on due day), `hiddenWords`, `deck`,
`snapshot`, `settings`. Snapshots live here too, since a PWA has no disk folder.

**Hosting:** static files over HTTPS. No application server exists or is planned.
The origin is load-bearing for data durability — see D7.

**Caching:** service worker precaches the app shell only. Packs are fetched once
and imported into IndexedDB.

**Messaging:** none. There is no server, no queue, and no cross-process
communication to arrange.

---

## Extensibility

Bounded deliberately. Four seams, each named by a framework:

1. **Question-type registry** — a new learning vector is one enum value, one
   component, one registry entry, and a line of language configuration. Nothing
   in scheduling, grading or storage changes.
2. **Pack meaning layer** — swapping the base language re-runs the install merge
   against a different meaning layer. The core pack is untouched.
3. **Audio stub** — a single playback entry point that renders no control and
   does nothing. v1 ships the seam so adding audio later is implementing behind
   it, not retrofitting call sites into finished screens.
4. **Sync attachment point** — the `progress` module's public surface, plus a
   profile revision marker bumped on every change. No interface is invented: at
   ~200 KB, future sync pushes and pulls the whole profile, so nothing needs
   designing in advance.

**Nothing else is held open.** The design was fully explored and closed off; a
seam for an unexplored feature would most likely be the wrong shape.

---

## Open questions

| Question | Recommended default |
|---|---|
| Test framework and depth | Vitest, with `domain` covered thoroughly and the rest by judgment. The grading table and ladder are where tests pay for themselves. |
| Client router choice | Any minimal one, or hand-rolled — under ten screens, this is barely a decision. Left to the implementer. |
| Whether snapshot retention (last 5) is enforced in `progress` or surfaced as a setting | Enforced in `progress`, with manual delete in the UI. Revisit if it chafes. |
| Whether `dictionary` exposes a query API or returns raw rows for `domain` to filter | Query API — filtering thousands of rows in `domain` would pull IO concerns inward and break guideline 1. |
