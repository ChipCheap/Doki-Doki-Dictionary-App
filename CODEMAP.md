# Code map — slice 1 (`study-loop`)

A file-by-file account of what exists and what each piece is for, so it can be
read against the source. Exports listed are the public surface other files may
use; anything not listed is private to its module.

**Dependency direction** (`architecture.md` D1) — arrows point at what a module
is allowed to import:

```
        ui
      ↙    ↘
dictionary  progress
      ↘    ↙
       domain
```

`domain` imports nothing from the other three. `dictionary` and `progress` never
import each other. `src/database.ts` sits above both because Dexie needs one
connection declaring every store, and putting it inside either module would
create exactly the dependency the split prevents.

---

## `src/domain` — pure logic, no IO

Plain functions over plain data. No database, no framework, no `Date` beyond one
conversion. This is where a bug corrupts progress silently, which is why it is
testable without any setup — 78 of the 97 tests live here.

### `types.ts`
Shared value types. Data shapes only, no behaviour.

`WordKey` · `DifficultyTier` · `DIFFICULTY_TIERS` · `TIER_WEIGHT` ·
`VectorProgress` · `WordProgress` · `DeckMember` · `Card` · `Rng` · `defaultRng`

`TIER_WEIGHT` is the sampling bias for new-word selection — Basic 4 through
Niche 1.

### `ladder.ts`
The interval table and all day arithmetic. Days are integers (days since epoch)
computed from the **local** calendar, so a session at 23:30 belongs to that day.

`LADDER` · `NEW_LEVEL` · `MIN_STUDIED_LEVEL` · `MASTERED_LEVEL` · `Level` ·
`DayNumber` · `toDayNumber` · `fromDayNumber` · `isValidLevel` · `clampLevel` ·
`isMastered` · `intervalForLevel` · `dueDayFor` · `lastStudiedFrom` ·
`overdueBy` · `isDue`

`lastStudiedFrom` is the derivation that lets us store `dueDay` instead of a
last-studied date — the reverse of what you might expect, chosen so due cards
are an indexed range query and so editing the ladder never reschedules cards
already in flight.

### `grading.ts`
The four outcomes and their level movement. The single riskiest function set in
the app.

`Outcome` · `CardState` · `GradeResult` · `grade` · `RequeueOutcome` ·
`RequeueResult` · `resolveRequeue` · `isPromotion` · `isDemotion`

`grade` handles first sight only. `redo` changes **nothing at all**, including
the due day, which is what makes a redone card return next session too. A
level-0 word answered wrong stays at 0 rather than hitting the floor of 1, which
would otherwise *promote* a word just failed.

`resolveRequeue` handles later appearances and reports only whether the card
leaves the queue — it can never move a level.

### `matching.ts`
Answer comparison. Case-folding and trimming, but diacritics are **preserved**;
they are the answer, not noise.

`normalize` · `isBlank` · `stripDiacritics` · `AnswerVerdict` · `ClassifyInput` ·
`classifyAnswer` · `DiacriticDiff` · `diacriticDiff`

`classifyAnswer` returns three values, not two: `correct`, `wrong`, and
`rejected` — a real word that isn't the one asked for. The third keeps the
grading table untouched, because a rejection is a refused submission rather than
an outcome.

`stripDiacritics` maps `đ` explicitly, since it has no Unicode decomposition and
would otherwise break accent-only detection for Vietnamese.

### `distractors.ts`
Multiple-choice option construction.

`DistractorCandidate` · `DistractorRequest` · `DistractorResult` ·
`pickDistractors` · `isAnswerable`

Excludes any entry sharing the correct answer's **target term**, so the two
senses of `banco` can never both appear. Degrades same-part-of-speech → any
part-of-speech → fewer options, minimum two; it never fails.

### `session.ts`
Queue composition.

`SessionSettings` · `ComposeInput` · `ComposedSession` · `composeSession`

New words claim slots before reviews. One word yields exactly one card, on the
lowest-level **due** vector, ties random. Reviews are ranked most-overdue-first
because that decides which survive the cap — then the whole queue is **shuffled**
for presentation, so new words land throughout rather than bunched at the front.

### `deck-state.ts`
Which of the four states a deck is in, and the numbers each needs.

`DeckStatus` · `DeckStateInput` · `DeckState` · `LadderDistribution` ·
`computeDeckState`

`dueCount` is what a session would **actually serve** — cap and new-word budget
applied — not raw availability. It also distinguishes "caught up for today,
budget spent" from "complete".

### `vectors.ts`
The closed enum of question types and the v1 vector definitions.

`QuestionMethod` · `VectorId` · `Side` · `VectorDefinition` · `RECOGNITION` ·
`PRODUCTION` · `ALL_VECTORS` · `vectorById` · `LanguageVectorConfig` ·
`DEFAULT_VECTOR_IDS`

No component references — `domain` may not import from `ui`, so the registry
that maps a method to its component lives on the UI side.

### `random.ts`
`shuffle` · `randomOf`

Extracted so `session` can shuffle without importing `distractors`.

---

## `src/dictionary` — reference data

Read-only after install, replaceable wholesale, never part of an export.

### `schema.ts`
Store declarations and the installed-pack record.

`DictionaryEntry` (re-export) · `InstalledPack` · `DICTIONARY_STORES`

`InstalledPack.ready` is written **last**; a pack without it counts as absent, so
a half-written install self-corrects with no verification scan.

### `pack-format.ts`
Types and validation for both pack layers.

`SUPPORTED_SCHEMA_VERSION` · `CoreExample` · `SequenceTag` · `CorePackEntry` ·
`CorePack` · `MeaningPackEntry` · `MeaningPack` · `DictionaryEntry` ·
`PackSchemaError` · `PackShapeError` · `assertSupportedSchema` ·
`ValidationOutcome` · `validateCoreEntries` · `validateMeaningEntries`

Validation **ignores unknown fields** so a newer pack still loads in an older
app, and rejects a newer schema version by name rather than failing obscurely.

### `pack-loader.ts`
Parsing and the core/meaning merge.

`MergeReport` · `mergePack` · `fetchJson`

`MergeReport` carries the quality signals: entries skipped, entries with no
meaning, and how many fell short of two examples.

### `install.ts`
Writing a pack into the database.

`InstallProgress` · `InstallResult` · `installPack` · `isPackInstalled` ·
`listInstalledPacks` · `removePack`

Chunked writes with progress reporting; clears the ready flag first and sets it
last. Never touches `progress` — a word that disappears keeps its history.

### `queries.ts`
All dictionary reads.

`getEntry` · `getEntries` · `countEntries` · `entriesByPartOfSpeech` ·
`entriesForLanguage` · `synonymEntries` · `synonymTerms` · `entriesForRecipe` ·
`countForRecipe` · `availableTiers` · `availableTags`

`synonymTerms` backs the "valid word, wrong target" rejection.
`entriesForRecipe` applies the deck filter: difficulties OR'd, tags OR'd, the two
groups AND'd, `sequence` excluded by default.

### `catalog.ts`
The packs bundled with this build.

`CatalogEntry` · `CATALOG` · `catalogEntry`

`provisional: true` marks the seed fixtures as not-real-data.

---

## `src/progress` — user data

Small, mutable, irreplaceable. **This module is the transferable part of the
app**; its boundary is drawn so moving machines means moving what it owns and
nothing else.

### `schema.ts`
Store declarations and row shapes.

`ProgressRow` · `WordRow` · `DeckRecipe` · `LegacyDeckRecipe` · `DeckRow` ·
`SettingRow` · `PROGRESS_STORES` · re-exported types

`ProgressRow` is the whole scheduling state: `level` and `dueDay` per
`(wordKey, vectorId)`. `LegacyDeckRecipe` exists only for the v2 migration.

### `progress-repo.ts`
Every progress read and write. No screen touches storage directly.

`bumpRevision` · `getRevision` · `getWordProgress` · `GradeWrite` ·
`recordGrade` · `setLevelForAllVectors` · `setHidden` · `markIntroduced` ·
`exportRows`

`recordGrade` commits immediately and stamps `introducedOn` on first quiz.
`setLevelForAllVectors` writes **every** vector, preserving existing due days and
staggering only those with none.

### `settings-repo.ts`
Global settings with defaults applied on read.

`ThemeMode` · `GlobalSettings` · `FONT_CHOICES` · `DEFAULT_GLOBAL_SETTINGS` ·
`DEFAULT_DECK_SETTINGS` · `getGlobalSettings` · `updateGlobalSettings`

Per-deck settings live on the deck row, not here.

### `deck-repo.ts`
Decks and quick-create.

`DeckRecipe` · `DeckRow` (re-exports) · `listDecks` · `listDecksByLanguage` ·
`getDeck` · `QuickCreateInput` · `describeRecipe` · `quickCreateDeck` ·
`countForRecipe` (re-export) · `pendingAdditions` · `renameDeck` ·
`updateDeckSettings` · `deleteDeck` · `sessionSettingsFor` · `deckMembers`

A deck stores its members **and** the recipe, so a pack update can be diffed.
`quickCreateDeck` and `updateDeckSettings` copy arrays into plain ones before
storing — reactive state is a Proxy and structured clone rejects it.

### `transfer.ts`
Export and import — disaster recovery, not just portability.

`PROFILE_SCHEMA_VERSION` · `ProfileExport` · `TransferCounts` ·
`ProfileSchemaError` · `ProfileShapeError` · `exportProfile` · `countsOf` ·
`parseProfile` · `importProfile` · `toFileContents` · `suggestedFileName`

`parseProfile` validates **without** applying, so the UI can state what will
happen first. Missing settings default; missing progress/words/decks is fatal.

---

## `src/database.ts`

`AppDatabase` · `db`

Composes both modules' store declarations into one Dexie connection. Declares
version 1, and version 2 with a non-destructive upgrade converting single-value
deck recipes to the multi-select shape.

---

## `src/ui` — screens and interaction

### Shell and infrastructure

| File | Purpose | Exports |
|---|---|---|
| `main.ts` | Mounts the app, imports both stylesheets | default mount |
| `App.svelte` | Route outlet, startup, first-run redirect | — |
| `router.svelte.ts` | Hash router | `RouteName` · `Route` · `router` |
| `app-init.ts` | `persist()`, theme application, install detection | `StartupReport` · `requestPersistentStorage` · `isInstalled` · `applySettings` · `startup` |
| `audio.ts` | The inert seam. `isAvailable` is hard-coded false | `SpeechRequest` · `isAvailable` · `speak` |
| `theme.css` | Every colour, once, as `light-dark()` pairs | — |
| `base.css` | Element styling; defines no colour of its own | — |

### Session machinery

**`session/session-store.svelte.ts`** — the in-flight quiz.
`Phase` · `PresentedCard` · `ResolvedResult` · `SessionTally` · `SessionStore` ·
`session`

Holds the drawn queue, the re-query queue, the current card and the phase.
`ResolvedResult` records what happened **at resolution time** — outcome, what was
submitted, and which side was being asked for — because a correct answer
auto-advances and the phase has already moved on by the time the panel renders.

**`session/keyboard.ts`** — bindings resolved from the phase.
`KeyAction` · `KeyContext` · `resolveKey` · `fieldShouldBeFocused`

The phase split is what makes `m` and `r` safe: they are live only after a wrong
answer, so a run of correct answers never has them active.

### Questions

**`questions/registry.ts`** — `QuestionType` · `QUESTION_TYPES` ·
`questionTypeFor`. A map from method enum to component plus metadata; adding a
vector is one entry and one component.

**`questions/MultipleChoice.svelte`** — prompt term, part of speech, four
numbered options.
**`questions/TypedAnswer.svelte`** — prompt meaning, autofocused field, the
rejection note, and the keyboard-help affordance.

### Components

| File | Purpose |
|---|---|
| `components/DeckRow.svelte` | One deck: name, tags, one state-appropriate value, rotating chevron |
| `components/DeckDetail.svelte` | Ladder distribution bar, overdue count, start button |
| `components/ResultPanel.svelte` | Outcome, entry, examples, the two buttons, mastery picker |
| `components/DiacriticDiff.svelte` | Per-character highlight, only when diacritics are the sole difference |
| `components/SettingPreview.svelte` | Live preview using stacked-mark test text |

### Routes

| File | Purpose |
|---|---|
| `routes/FirstRun.svelte` | Language picker on a fresh profile |
| `routes/InstallPack.svelte` | Explicit install with a real progress bar |
| `routes/Home.svelte` | All languages as stacked sections; deck list; quick-create with live count; add-a-language |
| `routes/NewVocabulary.svelte` | Preview of new words, already-known row, replacement pull-in |
| `routes/Quiz.svelte` | Two-pane shell, keyboard wiring, auto-advance on correct, summary below when finished |
| `routes/SessionSummary.svelte` | Promoted / held / demoted / mastered counts |
| `routes/Settings.svelte` | Global visual settings with previews, per-deck cadence |
| `routes/Transfer.svelte` | Export, and import with an explicit confirmation |
| `routes/KeyboardHelp.svelte` | Static per-OS instructions, offline, stores nothing |

---

## Fixtures and config

| File | Purpose |
|---|---|
| `public/packs/*.seed.json` | 20 words per language, both layers. **Authored, not sourced** — labelled `TEST FIXTURE`. Chosen to exercise the homograph pair, shared meanings, an accent pair, a `sequence` number, a one-example entry, and stacked diacritics |
| `vite.config.ts` | Base path, PWA plugin, precache excluding packs |
| `svelte.config.js` · `tsconfig.json` | Toolchain. **Note:** plain `tsc` cannot check `.svelte.ts` runes — `npm run check` is the real gate |

## Tests — 97 across 7 files

`domain/{ladder,grading,matching,distractors,session,deck-state}.test.ts` and
`dictionary/pack-loader.test.ts`.

**Nothing tests the UI or the session store.** The three bugs found by using the
app — the counter denominator, the result panel reading a stale phase, and the
panel staying empty on a wrong answer — all lived in that gap.
