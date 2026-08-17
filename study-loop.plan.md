# Plan: study-loop

**Outer iteration:** 1
**Realizes framework:** `framework.md`, `ui.framework.md` (+ `ui.wireframes.html`, `ui.theme.css`), `packs.framework.md`, and the quick-create portion of `maintenance.framework.md`
**Within architecture:** `architecture.md`, complexity target **2 (simple)**
**Previous version:** none — first iteration

Slice 1 of 2. Delivers a shippable app: install a language, build a deck, study it, keep the progress, get it back out. Slice 2 (`maintenance.plan.md`) adds browse, mastery editing, mass-edit, snapshots, deck adjustment and automatic backup.

---

## Framework coverage map

| Framework goal | Plan steps |
|---|---|
| G1: Ladder — levels 0–9, fixed intervals, whole days, `dueDay` stored | S1 |
| G2: Grading table — four outcomes, graded once at first sight | S2 |
| G3: Level-0 wrong stays at 0 and stays due *(amendment)* | S2 |
| G4: Re-query is ungraded and repeats until correct or cleared | S2, S6, S23 |
| G5: Redo leaves `dueDay` untouched — card returns next session | S2 |
| G6: Two vectors, independent levels, method enum + component registry | S3, S21 |
| G7: One word → one card per session; lower-mastery vector, ties random | S6 |
| G8: Session cap 20/deck; new words first up to new-words-per-day (5) | S6 |
| G9: Reviews ordered most-overdue-first (`today − dueDay`) | S6 |
| G10: New words drawn by weighted random over difficulty tier | S6 |
| G11: `introducedOn` recorded on first quiz, word-level, global | S13, S23 |
| G12: Mastery = level 9, withheld unless deck re-query is on; wrong → 8 | S1, S6 |
| G13: Deck states Due / Caught up / Complete / Empty | S7, S18 |
| G14: Matching — trimmed, case-insensitive, accent- and tone-sensitive | S4 |
| G15: Valid word, wrong target → rejected submission, not a grade | S4, S22 |
| G16: MC construction, exclusions, reshuffle, degradation ladder | S5, S12, S21 |
| G17: Two-phase keyboard model | S20 |
| G18: Desktop two-pane auto-advance; mobile stacked dwells | S19, S24 |
| G19: Result panel — entry, mastery picker over all vectors, conditional buttons | S24 |
| G20: Diacritic mismatch highlighting | S25 |
| G21: New vocabulary screen — flip, already-known row, replacement, abandon-free | S23 |
| G22: Counter — `n of N` words, switching to the re-query round | S19 |
| G23: Session summary | S26 |
| G24: Pack format — two layers, entry per sense, tolerant reader | S9, S10, S12 |
| G25: Pack install — merge, bulk write, ready flag last, visible progress | S11, S17 |
| G26: Deck quick-create — tier / tag / all, excludes `sequence`, stores recipe | S15, S18 |
| G27: First run — language pick → install → quick-create | S17 |
| G28: Colour only from `ui.theme.css`, both modes | H4, S27 |
| G29: Settings with live previews; per-deck settings | S14, S27 |
| G30: Export / import — progress only, full replace, version-checked | S16, S28 |
| G31: PWA — manifest, service worker, `persist()`, install prompt | H2, S29 |
| G32: Module boundaries and the ten architecture guidelines | H1, S8, all |

---

## Plan steps

### S1: Ladder and due-day arithmetic
**Covers:** G1, G12
**Files:** `src/domain/ladder.ts` (new)
**Description:** The interval table `[1,2,4,7,14,21,30,60,100]` as a frozen constant indexed by level 1–9, with level 0 meaning new. Functions to compute a due day from a level and a reference day, to derive last-studied by subtraction, to convert between `Date` and integer days-since-epoch, and to report whether a level counts as mastered (9). All arithmetic is on whole-day integers; nothing here takes or returns a time.
**Rationale:** Days-since-epoch integers are what make `today − dueDay` a single subtraction and let IndexedDB range-query due cards directly. Keeping conversion here means no other module ever handles a `Date`.

### S2: Grading
**Covers:** G2, G3, G4, G5
**Files:** `src/domain/grading.ts` (new)
**Description:** A pure function taking the current level, current due day, today, and an outcome (`correct`, `markCorrect`, `redo`, `none`), returning the new level and due day plus whether the card re-queues. Correct and mark-correct raise the level by one and reschedule; redo changes nothing at all — **including the due day**, so the card remains due today and returns next session — and re-queues; `none` lowers the level by one with a floor of 1 and re-queues. **Level 0 is special: a wrong answer leaves it at 0, due today**, because the floor of 1 would otherwise promote a word the user just failed. A separate function handles the re-query appearance, which returns no level change ever and reports only whether the card leaves the queue.
**Rationale:** The single riskiest function in the app — a bug here corrupts progress silently and cumulatively — so it takes plain numbers and returns plain numbers, testable exhaustively with no database.

### S3: Vector definitions and the method enum
**Covers:** G6
**Files:** `src/domain/vectors.ts` (new)
**Description:** The closed method enum (`FOREIGN_TO_BASE_MC`, `BASE_TO_FOREIGN_TEXT`), the vector definitions for v1 as data (id, method, which side prompts), and the per-language vector configuration. No component references — those live in the UI registry (S21), because `domain` may not import from `ui`.

### S4: Answer matching
**Covers:** G14, G15
**Files:** `src/domain/matching.ts` (new)
**Description:** Normalization (trim, case-fold) that **preserves diacritics**, comparison of a typed answer against an entry's accepted set, and a diacritic-difference detector reporting whether two strings differ *only* by diacritics and at which character positions. Also the rejection check: given a typed answer and the prompted entry, report whether the answer is the target term of a **different entry sharing a meaning and part of speech** — a valid synonym that isn't the one asked for. This returns a distinct third result, neither correct nor wrong.
**Rationale:** The three-way result is what keeps the grading table untouched — rejection is a refused submission, not an outcome, so `grading.ts` never sees it.

### S5: Distractor selection
**Covers:** G16
**Files:** `src/domain/distractors.ts` (new)
**Description:** Given the correct entry and candidate pools (deck members first, wider dictionary second), pick three distractors sharing the correct answer's part of speech and **excluding any entry sharing its target term**. Degradation ladder when the pools are too thin: same part of speech → any part of speech → fewer options, minimum two. Never fails. Options are shuffled and distractors re-drawn on every presentation, so a repeated card never shows the same set.
**Rationale:** The degradation ladder exists for the 20-word seed pack, where three same-part-of-speech nouns may simply not exist. Real packs should never reach past the first rung.

### S6: Session composition
**Covers:** G7, G8, G9, G10, G12, G4
**Files:** `src/domain/session.ts` (new)
**Description:** A pure function taking a deck's members, their progress, the deck settings and today, returning an ordered queue. Reviews are cards due on or before today, ordered by `today − dueDay` descending, ties arbitrary. New words are un-introduced deck members chosen by **weighted random sampling over difficulty tier without replacement** — Basic heaviest through Niche lightest — capped by the deck's new-words-per-day budget minus the count of deck members already introduced today. **New words fill the session first**, reviews take the remainder, up to the deck's card cap. **Each word yields exactly one card.** Vector selection considers **only the vectors actually due**: if one is due it is served; if several are due the one with the lower level wins, ties broken randomly. A vector that is not due is never a candidate, whatever its level. Mastered words (level 9) are excluded unless the deck's re-query setting is on. Also exposes the re-query queue mechanics: a second queue worked after the first empties, with cards that fail again returning to it, so it terminates only on a correct answer or an explicit clear.
**Rationale:** One-word-one-card is what keeps the new-word budget honest — otherwise "5 new words" would mean 10 cards and crowd out every review.

### S7: Deck state determination
**Covers:** G13
**Files:** `src/domain/deck-state.ts` (new)
**Description:** Given a deck's members, progress and today, return exactly one of `Due`, `CaughtUp`, `Complete`, `Empty`, plus the numbers each state needs — due count, next due day, overdue count. `Complete` requires every member mastered with re-query off; `Empty` requires no members at all. The two must be separately representable so the UI can never render one as the other.

### S8: Database schema
**Covers:** G32
**Files:** `src/progress/db.ts` (new), `src/dictionary/db.ts` (new)
**Description:** One Dexie database, with `dictionary` and `progress` each declaring their own stores so ownership is visible in code. Dictionary side: `entries` keyed by word key, indexed on part of speech, target term, and meaning. Progress side: `progress` keyed by `[wordKey, vectorId]` and **indexed on `dueDay`**; `words` holding `introducedOn` and `hidden` per word key; `decks`; `settings`; `packs` holding installed-pack metadata and the ready flag. Migrations are declared as cumulative Dexie versions from the first schema onward and are never destructive.

### S9: Pack format types and validation
**Covers:** G24
**Files:** `src/dictionary/pack-format.ts` (new)
**Description:** Types for the core layer (key, target term, part of speech, difficulty, context tags, optional `sequence` tag with ordinal, example sentences with source ids) and the meaning layer (base terms, example translations), plus the pack manifest with its schema version. Validation rejects entries missing a target term, a part of speech, or any meaning, and **ignores unknown fields rather than failing** so a newer pack still loads in an older app. Rejects the pack outright if its schema version is newer than the app understands, naming the mismatch.

### S10: Pack parsing and layer merge
**Covers:** G24, G25
**Files:** `src/dictionary/pack-loader.ts` (new)
**Description:** Read a core layer and a meaning layer, validate both, and merge them into one row per word key carrying both sides. Report any core entry with no matching meaning row as a skipped entry with a count, since such an entry has no answer and cannot be tested.
**Rationale:** Merging here rather than at read time (architecture D5) means the two-layer split stays a distribution concern; every later lookup is a single fetch.

### S11: Pack install
**Covers:** G25
**Files:** `src/dictionary/install.ts` (new)
**Description:** Bulk-write merged entries in chunks, reporting progress as a fraction so the UI can show a real bar, then **write the pack's ready flag as the final operation**. A pack whose metadata lacks the flag is treated as absent and reinstalled from scratch. Installing over an existing pack replaces dictionary rows but touches nothing in `progress`.
**Rationale:** The ready flag makes a half-written install self-correcting without a verification scan over every row.

### S12: Dictionary queries
**Covers:** G16, G24
**Files:** `src/dictionary/queries.ts` (new)
**Description:** Lookups by word key, by part of speech, by target term, and by meaning — the last two backing the distractor exclusion rule and the valid-synonym rejection check. Filters for deck construction: by difficulty tier, by context tag, all entries, each excluding `sequence`-tagged words by default. Returns plain data; no domain logic here.
**Rationale:** A query API rather than raw rows keeps filtering out of `domain`, which may not know about storage.

### S13: Progress repository
**Covers:** G11, G32
**Files:** `src/progress/progress-repo.ts` (new)
**Description:** The public surface for all progress reads and writes — no screen touches storage directly. Read and write `(wordKey, vectorId)` levels and due days, query cards due on or before a day using the `dueDay` index, read and set `introducedOn` per word, and bump a **profile revision marker** on every mutation. Writing a graded outcome is a single call committed immediately, with no batching.
**Rationale:** This surface is the documented attachment point for any future sync, and the revision marker is what a later sync would use to tell which device is newer.

### S14: Settings repository
**Covers:** G29
**Files:** `src/progress/settings-repo.ts` (new)
**Description:** Global settings (text size, font, theme mode, current language) and per-deck settings (card cap default 20, new words per day default 5, enabled vectors, mastered re-query off by default), with defaults applied when absent.

### S15: Deck repository and quick-create
**Covers:** G26
**Files:** `src/progress/deck-repo.ts` (new)
**Description:** Create, read, rename and tag decks. A deck stores its name, tags, **member word keys, and the recipe that produced it** — the tier, tag, or all-entries query — so a later pack update can be diffed against it in one action. Quick-create runs a recipe through the dictionary queries and stores both the resulting members and the recipe itself. Creating a deck that matches zero entries succeeds and produces an empty deck rather than refusing.
**Rationale:** Storing the recipe is what makes the one-button diff possible in slice 2; omitting it now would mean re-deriving intent from a member list later, which cannot be done.

### S16: Export and import
**Covers:** G30
**Files:** `src/progress/transfer.ts` (new)
**Description:** Export everything the `progress` module owns — levels, due days, `introducedOn`, hidden words, decks with their recipes, settings, the revision marker — as one JSON document with a schema version. **The dictionary is never exported**; it is reproducible from the pack. Import validates the document, rejects a newer schema version by name, and otherwise **replaces local progress entirely** after explicit confirmation. Both directions report counts.

### S17: First run and pack install screen
**Covers:** G25, G27
**Files:** `src/ui/routes/FirstRun.svelte` (new), `src/ui/routes/InstallPack.svelte` (new)
**Description:** On a launch with no installed pack, offer the bundled language packs. Selecting one runs the install with a visible progress bar and a plain statement of what is happening, then hands off to deck quick-create so the user reaches a studiable deck without further navigation. Install failure states the reason and leaves the app in its previous state.
**Rationale:** Neither screen appears in `ui.framework.md`, whose inventory begins at Home and assumes a language already exists. Without them there is no route from a fresh install to a usable app.

### S18: Home and deck screens
**Covers:** G13, G26
**Files:** `src/ui/routes/Home.svelte` (new), `src/ui/components/DeckRow.svelte` (new), `src/ui/components/DeckDetail.svelte` (new)
**Description:** Home shows **every installed language at once, as stacked sections in a stable order**. Each section is a header — the language name at heading scale plus its two-letter code — then that language's deck list **inside its own bordered box**, then a horizontal rule separating it from the next. No flag icons: Windows does not ship flag glyphs, so they would degrade to letter pairs on the primary platform anyway. Each deck row shows name, tags, and one state-appropriate value — `Start session · n`, `next in n days`, or `complete`. Clicking a deck name expands it to the ladder distribution bar bucketed new / learning / mature / mastered, plus the overdue count. `Complete` and `Empty` get visibly different treatments: `Complete` reads as an accomplishment and offers adding more words; `Empty` explains the deck has no words. Quick-create is reachable per language section, not only at first run. Follows `ui.wireframes.html` for structure and placement.
**Rationale:** Grouped sections rather than a language picker mean a user studying two languages sees both days' work without navigating, and the layout reflows on mobile without a second design — which side-by-side columns would not.

### S19: Session store and quiz shell
**Covers:** G18, G22, G17
**Files:** `src/ui/session/session-store.ts` (new), `src/ui/routes/Quiz.svelte` (new)
**Description:** Holds the drawn queue, the re-query queue, the current card, and an **explicit phase value** (`typing`, `primed`, `rejected`, `resultCorrect`, `resultWrong`). Calls `domain` to grade, hands results to `progress` to write immediately, then advances. The counter shows `n of N` over drawn words, advancing on grading only, and **switches to the re-query round** (`n to get right`) once the drawn queue empties. Two-pane on desktop, stacked on mobile.
**Rationale:** The phase is explicit because key bindings resolve from it; inferring it from flags is how Enter ends up double-submitting.

### S20: Keyboard handling
**Covers:** G17
**Files:** `src/ui/session/keyboard.ts` (new)
**Description:** Bindings resolved from the current phase. Typing: the answer field is focused the instant a card appears; Enter submits; Enter on an empty or whitespace-only field primes, and a second Enter is *I don't know*; `1`–`4` select in multiple choice; Tab is suppressed. Result: the field is blurred so single keys are unambiguous — Enter continues, `m` marks correct, `r` redoes, Tab cycles the two buttons. On a re-query appearance `m` clears the card from the queue **without changing the level**.

### S21: Question-type registry and components
**Covers:** G6, G16
**Files:** `src/ui/questions/registry.ts` (new), `src/ui/questions/MultipleChoice.svelte` (new), `src/ui/questions/TypedAnswer.svelte` (new)
**Description:** A map from method enum to its component and a little metadata (whether distractors are needed, which input mode). The multiple-choice component renders the prompt term, its part of speech, and four numbered options. The typed component renders the prompt meaning, its part of speech, and the autofocused field with the keyboard-help affordance — a hover tooltip on desktop, a tap target on mobile — linking to the static keyboard help page.
**Rationale:** A map rather than an interface: both vectors grade identically and differ only in presentation, so a per-type contract would be ceremony around near-identical implementations.

### S22: Rejected-submission handling
**Covers:** G15
**Files:** `src/ui/questions/TypedAnswer.svelte` (edit)
**Description:** When matching returns the rejection result, show a note below the field stating this is a valid word but not the one being asked for, keep the field live and focused, and grade nothing. **No letter hints.** The card does not advance and the counter does not move.

### S23: New vocabulary screen
**Covers:** G21, G11, G4
**Files:** `src/ui/routes/NewVocabulary.svelte` (new)
**Description:** Opens any session containing new words and covers only that session's set. `← n of N →` navigation, and per card the term, part of speech, meanings, and a *Sentences* action. **No audio control** — the seam exists (H6) but renders nothing. The already-known row offers `a bit` / `well` / `very well` mapping to levels 2 / 5 / 8, and `don't study` which hides the word; **any of these pulls in a replacement new word**. Abandoning writes nothing, so the words remain un-introduced. `introducedOn` is stamped when a word is **first quizzed**, not when shown here.

### S24: Result panel
**Covers:** G19, G18
**Files:** `src/ui/components/ResultPanel.svelte` (new)
**Description:** Shows outcome and level movement, the full dictionary entry — term, part of speech, tags, meanings, examples with translations — and a mastery dropdown over 0–9. **The dropdown states that it sets all vectors** before it is used. *Mark correct* and *Redo question* render only when the answer was wrong. On desktop the panel holds the **previous** word, since a correct answer advances at once; on mobile it dwells and the user advances explicitly.

### S25: Diacritic mismatch display
**Covers:** G20
**Files:** `src/ui/components/DiacriticDiff.svelte` (new)
**Description:** Render the typed answer and the expected answer aligned, highlighting differing characters **only when diacritics are the sole difference**; a substantively wrong answer shows both forms plainly. Highlighting uses a background block and weight as well as colour, so it survives being read without colour.

### S26: Session summary
**Covers:** G23
**Files:** `src/ui/routes/SessionSummary.svelte` (new)
**Description:** Counts promoted, held, demoted, and how many words reached mastery. No streaks, no timers, no accuracy percentage. Offers returning to the deck list.

### S27: Settings screen
**Covers:** G28, G29
**Files:** `src/ui/routes/Settings.svelte` (new), `src/ui/components/SettingPreview.svelte` (new)
**Description:** Global settings — text size, font from the curated Vietnamese-capable list, dark mode — each with a **live preview beside the control** using the stacked-mark test text `ế ộ ữ ẳ`, so the effect is judged without visiting a quiz. Per-deck settings: card cap, new words per day, enabled vectors, mastered re-query. Reachable from a single menu off Home together with export/import and keyboard help.

### S28: Export and import screen
**Covers:** G30
**Files:** `src/ui/routes/Transfer.svelte` (new)
**Description:** Export downloads a JSON file. Import takes a file, validates it, and states exactly what will happen — how many words and decks, and that local progress will be **replaced** — requiring confirmation before proceeding. Both report a visible result with counts; neither ever completes silently.
**Rationale:** Architecture guideline 8. A silent no-op here is the failure the user named: believing an import worked and discovering months later that it never fired.

### S29: PWA registration and durability
**Covers:** G31
**Files:** `src/ui/app-init.ts` (new)
**Description:** On startup request `navigator.storage.persist()`, and surface an **install prompt stating the actual reason** — that installing is what keeps progress from being deleted. Service-worker updates use the prompt strategy, and a **declined version is remembered** so the same update is not offered again on the next visit.

---

## Helper steps

### H1: Project scaffold
**Justification:** Nothing can be built without it, and the folder layout is what makes the architecture's dependency rules visible.
**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.ts`, `src/App.svelte`, `src/{domain,dictionary,progress,ui}/`
**Description:** Vite + Svelte 5 + TypeScript. Four top-level source folders matching the architecture's modules, and a lint rule or documented convention forbidding imports from `domain` into anything else.

### H2: PWA manifest, icons and service worker
**Justification:** Required for installability, which is a data-durability mechanism rather than a nicety.
**Files:** `vite.config.ts` (edit), `public/icon-192.png`, `public/icon-512.png`
**Description:** Vite PWA plugin configured with the manifest fields including `id` and `scope`, app shell precached, **packs excluded from the precache** since they live in IndexedDB, `registerType: 'prompt'`. Fonts are self-hosted rather than fetched from a CDN.

### H3: Client router
**Justification:** Scaffolding for every screen step.
**Files:** `src/ui/router.ts` (new)
**Description:** A minimal client-side router over the screen set. Under a dozen routes; no framework needed.

### H4: Theme wiring
**Justification:** Scaffolding for G28 — the theme file exists but nothing consumes it yet.
**Files:** `src/ui/theme.css` (from `ui.theme.css`), `index.html` (edit)
**Description:** Import the theme's custom properties globally and add the paired `<meta name="theme-color">` tags so browser chrome follows light and dark. No component defines a colour.

### H5: Seed pack
**Justification:** Slice 1 cannot be run or tested without a pack, and pack production is a separate project.
**Files:** `public/packs/es-core.seed.json`, `public/packs/es-meaning-en.seed.json`, `public/packs/vi-core.seed.json`, `public/packs/vi-meaning-en.seed.json`
**Description:** **20 words per language** in the real two-layer pack format. Deliberately chosen to exercise the hard paths: at least one homograph pair sharing a target term with different senses, at least one pair of entries sharing a meaning to trigger the rejection check, a `sequence`-tagged number to prove quick-create excludes it, entries across several difficulty tiers and context tags, at least one entry with only one example, and Vietnamese words with stacked diacritics. The pack generator is built later, against whatever this format proves out.

### H6: Audio seam
**Justification:** `framework.md` requires the seam without the feature, so adding audio later is implementing behind a call site rather than retrofitting one.
**Files:** `src/ui/audio.ts` (new)
**Description:** A single playback entry point that does nothing and reports no available voice. No control renders anywhere.

### H7: Domain unit tests
**Justification:** The grading table and ladder are where a bug is silent and cumulative; they are testable with no database, and this is the cheapest insurance in the project.
**Files:** `src/domain/*.test.ts`
**Description:** Vitest coverage of every grading outcome at every level including the level-0 and level-1 boundaries, ladder arithmetic and day conversion, matching including diacritic-only differences and the rejection case, distractor degradation, and session composition budgets and ordering.

---

## Assumptions

- **A single user per browser profile.** No account system, no multi-user separation, no concurrent access to the same database.
- **Packs are bundled with the build.** No user-supplied packs, no download-on-demand, no remote fetch.
- **English is the only base language shipped.** The core treats it as a parameter, but no UI exists for choosing another and no second meaning layer is produced.
- **A word's part of speech does not change between pack builds**, so keys stay stable without an alias mechanism.
- **The device clock is broadly correct.** Stored due days are used as-is; a clock moved backwards is not detected or corrected.
- **Sessions are not concurrent.** The app is not open in two tabs studying the same deck at once, and no locking guards against it.
- **The hosting URL never changes.** IndexedDB is per-origin; moving it strands progress at the old address.

## Out of scope

- Everything in `maintenance.framework.md` except quick-create: browse views, mastery editing outside the result panel, mass-edit, snapshots, hiding outside the *don't study* action, deck adjustment and recipe diffing, automatic backup.
- The pack production pipeline — sourcing, generation, tagging, the key registry, build reports.
- Audio playback, beyond the inert seam.
- Cloud sync, accounts, sharing.
- The attributions screen — belongs with real sourced packs, and the seed pack derives from nothing.
- Statistics beyond the session summary.
- UI string localization; strings may be externalized but only English ships.

## Acceptance criteria

- **G1 satisfied when:** a card at level *n* answered correctly is next due exactly `ladder[n+1]` days later, and no stored value carries a time of day.
- **G2 satisfied when:** each of the four outcomes produces its specified level movement, and each card is graded exactly once per session, at first sight.
- **G3 satisfied when:** a level-0 card answered wrong remains level 0 and remains due today.
- **G4 satisfied when:** a re-queried card never changes level however often it reappears, and leaves the queue only on a correct answer or *Mark correct*.
- **G5 satisfied when:** a redone card is still due today after the session ends and appears in the next session.
- **G6 satisfied when:** answering one vector leaves the other vector's level and due day untouched.
- **G7 satisfied when:** no session contains two cards for the same word, and the vector served is the lower-level one.
- **G8 satisfied when:** a session never exceeds the deck's cap, and new words occupy slots before reviews.
- **G9 satisfied when:** reviews appear in descending order of `today − dueDay`.
- **G10 satisfied when:** repeated sessions on the same deck draw different new words, weighted toward lower difficulty tiers.
- **G11 satisfied when:** a word introduced while studying one deck is never shown on the new vocabulary screen of another.
- **G12 satisfied when:** level-9 words are absent from sessions with re-query off, present with it on, and drop to 8 when answered wrong.
- **G13 satisfied when:** all four deck states are reachable and `Complete` is visibly distinct from `Empty`.
- **G14 satisfied when:** `" SÍ "` matches `sí`, and `si` does not.
- **G15 satisfied when:** typing a synonym belonging to another entry is refused with a note, grades nothing, and leaves the field live.
- **G16 satisfied when:** a repeated card shows different distractors, none share the answer's target term, and the seed pack still produces answerable questions.
- **G17 satisfied when:** `m` types a letter during typing and marks correct in the result phase, and Enter never double-submits.
- **G18 satisfied when:** a correct answer on desktop advances with one keypress and the answered word appears in the side pane.
- **G19 satisfied when:** the mastery dropdown moves every vector of the word and says so before use.
- **G20 satisfied when:** `phan boi` against `phản bội` highlights only the two differing characters, legibly with colour removed.
- **G21 satisfied when:** marking a word already-known sets the stated level and a replacement word appears; abandoning the screen leaves every word un-introduced.
- **G22 satisfied when:** the counter advances only on grading and switches to the re-query round when the drawn queue empties.
- **G23 satisfied when:** the summary reports promoted, held, demoted and newly mastered counts, and shows no streak, timer or accuracy figure.
- **G24 satisfied when:** a pack carrying an unknown extra field still installs cleanly.
- **G25 satisfied when:** an install interrupted before completion is detected as absent and reinstalled, never left half-present.
- **G26 satisfied when:** quick-create by tier produces a deck containing exactly the matching entries, with `sequence`-tagged words absent.
- **G27 satisfied when:** a fresh profile reaches a studiable deck without leaving the guided flow.
- **G28 satisfied when:** no literal colour appears outside the theme stylesheet, and every role renders in both modes.
- **G29 satisfied when:** each visual setting's preview updates as the control moves.
- **G30 satisfied when:** export then wipe then import restores identical levels, due days, decks and settings, and an import from a newer schema version is refused by name.
- **G31 satisfied when:** `persist()` is requested at startup and a declined update is not re-offered on the next visit.
- **G32 satisfied when:** `domain` imports nothing from the other three modules and no screen touches storage directly.
