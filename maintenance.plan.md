# Plan: maintenance

**Outer iteration:** 1
**Realizes framework:** `maintenance.framework.md` (amended 2026-08-22) + `framework.md`
**Within architecture:** `architecture.md`, complexity target **2 (simple)**
**Previous version:** none — first iteration

Slice 2. Slice 1 (`study-loop.plan.md`) is implemented and committed; this plan
extends it and does not revisit it. Where slice 1 already satisfies a goal, the
coverage map says so and the only work is a test that pins it.

---

## Framework coverage map

| Framework goal | Plan steps |
|---|---|
| G1: Deck adjustment — add / remove individual words | S6, S11, S14 |
| G2: Recipe diff offers new matches in one press; adds only | S6, S14 |
| G3: Hiding is word-wide, reversible, progress preserved; hidden stay visible in browse behind a filter with a count | S5, S11 |
| G4: Hidden words remain eligible as distractors | H1 (already true by construction) |
| G5: Single-word mastery edit — 0–9, writes every vector, control declares it | S5, S10, S11 |
| G6: Mass-edit offers exactly three operations | S2, S12 |
| G7: Selection axes — deck, tier, tag, level range, vector; vector filters, never scopes | S1, S8, S12 |
| G8: Every mass-edit carries a user-written comment | S12 |
| G9: Pre-commit summary — word count, mastery-loss count, sample | S2, S12 |
| G10: Snapshot + edit are one atomic transaction; refused if the snapshot cannot be written; empty selection refused | S4, S5, S12 |
| G11: Level-0 words are marked introduced; mass-edit staggers their due days | S2, S5 |
| G12: A snapshot is taken automatically before every mass-edit | S3, S4, S12 |
| G13: Restore is a swap, symmetric, net zero against retention | S4, S13 |
| G14: Snapshot management — date, comment, delete; retention 5 | S3, S4, S13 |
| G15: Browse over a deck or the dictionary, same axes, per-vector levels and due days | S8, S9, S11 |
| G16: One language at a time; deck target picker lists that language only, no default | S11, S12 |
| G17: Automatic backup where the File System Access API exists; explicit warning when permission is lost | S7, S15 |
| G18: No maintenance operation edits dictionary content | (invariant — no step writes `db.entries`) |
| G19: Decks never change their own membership | S6 |
| G20: A hidden word leaves the queue immediately; the deck may drop to Complete | H1 (slice 1: `session.ts:58`, `deck-state.ts:61`) |
| G21: Quick-create matching zero words yields an empty deck that says so | delivered by slice 1 |
| G22: A word removed from its only deck keeps its progress | S6, H2 |

---

## Plan steps

### S1: Selection matching
**Covers:** G7
**Files:** `src/domain/maintenance.ts` (new)
**Description:** Pure predicates resolving the progress-side selection axes over
a word: level range and vector. A word matches a level range when **any** of its
vectors falls in range; when a vector is named, only that vector is consulted. A
vector with **no progress row counts as level 0** — without that, "everything at
0–2" selects nothing, which is the framework's headline case. The vector is a
filter and never narrows what gets written.
**Rationale:** The dictionary-side axes (tier, tag, deck membership) are resolved
by the query API in S8, so `domain` never sees raw dictionary rows and guideline
1 holds. What lands here is only the part that reads progress.

### S2: Mass-edit planning
**Covers:** G6, G9, G11
**Files:** `src/domain/maintenance.ts`
**Description:** One pure function taking the selected words, their progress, the
chosen operation, the daily rate and today, returning everything the UI and the
repository both need: the exact write set, the number of words affected, the
number of words **losing mastery**, a sample for the summary (word, part of
speech, old→new level), and the stagger assignment for vectors that have no due
day yet. Only three operations exist — set level, hide/unhide, add/remove deck —
and there is no path that constructs a fourth.

**The stagger rule**, for a vector with no existing due day:

```
dueDay = today + intervalForLevel(newLevel) + floor(i / rate)
```

`i` is the word's index in the selection, `rate` is `max(1, floor(cardCap / 2))`
— half a session, so the batch never crowds out genuine reviews. `cardCap` is the
selected deck's when the selection is deck-scoped, otherwise
`DEFAULT_DECK_SETTINGS.cardCap`. The level's ladder interval decides when the
batch **starts** arriving and the stagger decides how it **spreads**: 1,000 words
set to level 1 at rate 10 begin tomorrow and run to today+100; the same 1,000 set
to level 5 begin at today+14 and run to today+113. Neither collapses onto one
day. Vectors that already have a due day are never rewritten, in either
direction.
**Rationale:** Computing the write set as data, before anything touches storage,
is what lets the summary and the transaction be driven from the same source —
the summary cannot describe one thing while the write does another. It is also
the piece where a silent bug corrupts months of progress, so it is pure and
directly testable. The stagger exists for one reason: an unstaggered batch shares
a single due day and grows overdue *together*, so from the following day every
one of its words outranks each review that comes due on time, for as long as the
batch takes to drain. Staggered, no part of the batch ever accumulates that lead.

### S3: Snapshot store and migration
**Covers:** G12, G14
**Files:** `src/progress/schema.ts`, `src/database.ts`
**Description:** Add `SnapshotRow` — id, taken-on day, comment*, and
a payload of `progress`, `words` and `decks` rows — plus a `snapshots` store
declaration, and a version 3 upgrade that adds the store without touching
existing data. Settings are deliberately **not** in the payload: a mass-edit
never changes them, so its undo must not revert them.
**Rationale:** Migrations run cumulatively from any older version and are never
destructive (guideline 7); adding a store is additive by nature.

### S4: Snapshot repository
**Covers:** G10, G12, G13, G14
**Files:** `src/progress/snapshot-repo.ts` (new)
**Description:** `takeSnapshot(comment)` capturing the three stores*;
`listSnapshots`; `deleteSnapshot`;
retention pruning to the newest 5 on write; and `restoreSnapshot(id)` — the
**swap**, all four moves inside one transaction:

1. capture the current state `C`
2. delete the snapshot `S` being loaded
3. insert `C` as a new snapshot, auto-named *"State before restoring '<S's
   comment>'"*
4. replace `progress`, `words` and `decks` from `S`'s payload

The list goes 5 → 4 → 5, which is what **net zero** against the retention limit
means. And because step 3 commits before the user can act again, restore-twice is
always available: the entry consumed in step 2 is replaced by one holding exactly
what was just left, so restoring `C` reverses the reversal. The list never loses
a slot — its contents trade places with live data. Every path bumps the profile
revision. `takeSnapshot` must also be callable inside a caller's open
transaction, which S5 needs.
**Rationale:** The generated comment on the swap-back entry is why the
mandatory-comment invariant applies to mass-edits only — the user did not author
this snapshot and cannot be asked to describe it.

### S5: Progress repository extensions
**Covers:** G3, G5, G10, G11
**Files:** `src/progress/progress-repo.ts`
**Description:** Three additions. `applyMassEdit(plan, comment)` runs the
snapshot and the entire write set in **one Dexie transaction** — all-or-nothing,
so a failure leaves neither a partial edit nor an orphan snapshot, and a snapshot
that cannot be written refuses the edit rather than performing it unprotected.
`setHiddenMany` for the bulk hide/unhide path. And `setLevelForAllVectors` gains
the two rules that make a manual level real: it stamps `introducedOn` when the
word has none, and it honours the `staggerOffset` parameter that exists today but
no caller has ever passed. Existing due days stay untouched in both directions.
**Rationale:** Without the `introducedOn` stamp the whole feature is inert —
`session.ts` classifies a word as new vocabulary or review by introduction, not
by level, so bulk-setting a thousand unstudied words would leave all thousand
rationed by the new-words budget at a handful a day, with the level never used.

### S6: Deck membership editing and the recipe diff
**Covers:** G1, G2, G19, G22
**Files:** `src/progress/deck-repo.ts`
**Description:** `addWordsToDeck` and `removeWordsFromDeck` (both idempotent,
both copying into plain arrays before storing), `applyPendingAdditions` turning
the existing `pendingAdditions` into the one-press action, and `absentMembers`
reporting how many stored member keys no longer resolve to a pack entry. The
diff **adds only**: absent keys stay in `memberKeys`, so a later pack restoring
the word brings it back with its progress intact, and every count already derives
from `deckMembers`, which skips unresolvable rows. Removing a word from a deck
touches deck membership and nothing else — progress survives, and the word
becomes an unstudied dictionary word again.
**Rationale:** Membership only ever changes by a user action, which is why the
diff offers and never applies itself.

### S7: Automatic backup
**Covers:** G17
**Files:** `src/progress/backup.ts` (new)
**Description:** Persist a `FileSystemDirectoryHandle` (structured-cloneable, so
the settings store holds it) plus the last-backup day. `backupNow` writes
`exportProfile`'s JSON under a date-stamped name, overwriting the same day's file
rather than accumulating. `backupState()` reports ready / paused / unsupported by
querying the handle's permission without prompting. Cadence: after every
mass-edit, and at startup when the last backup is over seven days old. Every
call is a no-op where the API does not exist.
**Rationale:** The permission does not survive a browser restart and re-granting
needs a user gesture, so the module can only ever report that it is paused — the
prompt itself belongs to the UI (S15). This is the one place the architecture
allows quiet degradation, because D8 scoped it to Chrome and Edge from the start.

### S8: Browse and selection queries
**Covers:** G7, G15
**Files:** `src/dictionary/queries.ts`
**Description:** A `BrowseFilter` (language, optional deck member keys,
difficulty tiers, context tags, hidden-included flag) with `browseEntries(filter,
offset, limit)` and `countBrowse(filter)`, sorted lexicographically by term.
Resolves only the dictionary-side axes; the level and vector axes are applied by
S1 against progress.
**Rationale:** A query API rather than raw rows keeps thousands of entries out of
`domain` (architecture open question 4). Offset paging is enough at 6–10k rows
and stays well under the ceiling.

### S9: Incremental list
**Covers:** G15
**Files:** `src/ui/components/IncrementalList.svelte` (new)
**Description:** Renders the first 200 rows and appends 200 more when the user
scrolls to the bottom, showing "showing N of M" throughout. No virtualization, no
row recycling, no measurement.
**Rationale:** Virtualization is the obvious answer to 10k rows and is squarely
over the ceiling. Appending on scroll costs a scroll handler and a slice index,
keeps every row reachable, and degrades to a plain list if the handler never
fires.

### S10: Shared mastery picker
**Covers:** G5
**Files:** `src/ui/components/MasteryPicker.svelte` (new),
`src/ui/components/ResultPanel.svelte`
**Description:** Extract the existing 0–9 dropdown and its "applies to every
vector of this word" hint from `ResultPanel.svelte` into one component, and use
it in both the result panel and browse. The declaration travels with the control
rather than being re-written per screen.
**Rationale:** The invariant is that any control setting a level says it writes
every vector; making that a property of the component is what stops a second
surface from quietly omitting it.

### S11: Browse screen
**Covers:** G1, G3, G5, G15, G16
**Files:** `src/ui/routes/Browse.svelte` (new)
**Description:** A word list over a deck or the whole dictionary for one
language, filterable on tier, tag, level range and vector, showing per-vector
levels and due days with tier and tag as **both** columns and filters. Each row
carries the mastery picker, a hide toggle, and add/remove for the deck in
context. Hidden words are excluded by default and revealed by a filter that
carries their count. Rows come from S8 through S9, and the row itself is a
separate component rather than inline markup — a second word-list surface is
already anticipated (see Out of scope) and should reuse it rather than grow its
own.
**Rationale:** Reached from the expanded deck ("browse words") and from the deck
list for the whole-dictionary view, which is where `ui.framework.md` already
placed the entry point.

### S12: Mass-edit screen
**Covers:** G6, G7, G8, G9, G10, G16
**Files:** `src/ui/routes/MassEdit.svelte` (new)
**Description:** Four stages in one screen: selection on the five axes with a
live affected-count; the operation, with the deck target as a **separate picker
with no default** listing only the current language's decks; the summary — word
count, **mastery-loss count called out as the warning**, and the sample from
S2 — carrying plain text about the risk; and the mandatory comment, with the
apply button disabled until it is non-empty. A selection resolving to zero words
is refused before the comment stage. Applying calls `applyMassEdit`, then
triggers a backup, then reports the result with its counts.
**Rationale:** The summary and the write are rendered from the same planned write
set (S2), so the preview cannot disagree with what commits. The whole screen is
scoped to one language, which removes cross-language selection as a case rather
than ruling on it.

### S13: Snapshot management screen
**Covers:** G13, G14
**Files:** `src/ui/routes/Snapshots.svelte` (new)
**Description:** Snapshots newest first with date and comment*, and a delete
action. Restore sits behind an explicit confirmation carrying two statements, not
one: that it **replaces all current data** with the state from that moment —
discarding everything since, *study included*, so fifty cards graded after the
edit are fifty grades lost — and that it is therefore meant for use shortly after
the operation it protects against, not for reaching back into last month. The
same dialog says the current state is kept and can be swapped straight back.
Restoring reports what changed by count afterwards.
**Rationale:** The two halves guard opposite mistakes. Without the first, a user
treats restore as a targeted undo and quietly loses a week of study. Without the
second, a user who believes restore is one-way never uses it when they most need
to. The swap is the whole safety story for mass-edit, so the screen has to say
both in words.

### S14: Deck detail additions
**Covers:** G1, G2
**Files:** `src/ui/components/DeckDetail.svelte`
**Description:** Add "Browse words", and an update-from-pack control that appears
only when `pendingAdditions` is non-empty, naming the count and adding on one
press. Where members no longer resolve, a plain informational line reports how
many are absent from the pack, with no action attached.
**Rationale:** Absence needs no mechanism — the word does not exist and there is
nothing to restore it to — but a silently shrinking deck count needs an
explanation, which is what the line provides.

### S15: Backup settings and the paused warning
**Covers:** G17
**Files:** `src/ui/routes/Settings.svelte`,
`src/ui/components/BackupWarning.svelte` (new)
**Description:** A settings block to choose the backup folder, showing the last
backup time and the current state. When the handle exists but permission has
lapsed, an explicit warning the user must acknowledge — stating that automatic
backups are **not running** and offering the re-grant button, which supplies the
user gesture the API requires. Where the API is absent, the block says so and
points at manual export instead.
**Rationale:** A passive banner was considered and rejected: silently stopped
backups are exactly the failure that is discovered months too late, and
guideline 8 requires that anything affecting the user's data never fail quietly.

### S16: Routes and navigation
**Covers:** G15, G16
**Files:** `src/ui/router.svelte.ts`, `src/ui/App.svelte`
**Description:** Add `browse`, `massEdit` and `snapshots` route names with their
params (language, optional deck id) and wire the three screens. Mass-edit and
snapshots are reached from the deck list rather than from anywhere inside a
session.
**Rationale:** Keeping them off every quiz path is what makes "no restore happens
mid-session" an assumption rather than a case to handle.

---

## Helper steps

### H1: Domain tests
**Justification:** The framework's invariants are only real if something fails
when they break, and this is the module where a bug is silent and cumulative.
**Files:** `src/domain/maintenance.test.ts` (new),
`src/domain/distractors.test.ts`
**Description:** Selection matching including the absent-row-is-level-0 case and
the vector-as-filter case; the planned write set for each of the three
operations, including a word with one vector above and one below the target level
landing both on it; the mastery-loss count, in words rather than vectors;
stagger assignment and its arithmetic;
and a case pinning that a hidden word is still offered as a distractor.

### H2: Repository tests
**Justification:** Atomicity and the swap are the two safety properties the whole
feature rests on, and neither is visible by reading the code.
**Files:** `src/progress/snapshot-repo.test.ts` (new),
`src/progress/progress-repo.test.ts` (new)
**Description:** Snapshot round-trip; restore-twice returning to the original
state; retention holding at 5 across takes and staying net zero across a restore;
a failed mass-edit leaving neither a partial write nor an orphan snapshot; the
`introducedOn` stamp firing only when absent; and a word removed from its only
deck keeping every progress row.

---

## Technical notes

Added during implementation, with the user's agreement.

- **T1 (S3, S4, S13) — snapshots carry no size.** Dropped from the row, the list
  and the framework. It is display-only, the comment is what identifies a
  snapshot months later, and measuring the payload means serializing it a second
  time on every mass-edit for a number nobody acts on.
- **T2 (S7) — the backup handle lives under its own settings key**, not inside
  `GlobalSettings`. `exportProfile` serializes global settings into every profile
  file, and a `FileSystemDirectoryHandle` is not JSON-serializable; inside
  `GlobalSettings` it would land in every exported profile as `{}`. The handle
  survives a browser restart; only the permission on it lapses.
- **T3 (S8, S11) — progress is read at three different widths**, deliberately.
  The `words` table (hidden flags) is always read, because hiding changes which
  words land on which page and it holds one row per word the user has touched.
  The `progress` table is read entire **only** when a level or vector filter is
  active, because such a filter must run before paging or the page and the count
  are computed from data that was never read. Otherwise progress is fetched for
  the rendered rows only, refetched as the list grows.
- **T4 (S5) — `revision.ts` is a new file.** `progress-repo` opens the mass-edit
  transaction and so imports the snapshot repository, while the snapshot
  repository needs to bump the profile revision. Extracting the counter breaks
  the cycle; `progress-repo` re-exports it so no existing caller changed.
- **T5 (S11, S12) — `ui/browse-query.ts` is a new file.** A selection has two
  halves living in modules that may not see each other (`dictionary` resolves
  tier, tag and text; `domain` resolves level and vector against progress), so
  composing them belongs to `ui`. It calls each module's public surface and
  touches no storage directly.
- **T6 (S11, S12) — `FilterPanel.svelte` and `WordRow.svelte` are shared
  components.** The framework has browse and mass-edit filtering on the same
  axes; two copies would be two places for them to drift.

## Assumptions

- **Maintenance is never entered mid-session.** The screens hang off the deck
  list, so a restore cannot land under a running quiz. The result panel's mastery
  picker is the one in-session write and it touches a single word.
- **A single user per browser profile**, as in slice 1. No concurrent tabs, no
  locking.
- **Snapshots are small.** Two integers per `(word, vector)` puts a full profile
  near 200 KB, so five of them are not worth rationing or compressing.
- **Single-word edits take no snapshot.** The framework asks for one before every
  *mass-edit*; one word at a time is recoverable by hand.
- **Packs are bundled with the build.** Re-adding a word absent from a pack is a
  build-side edit to the pack JSON, not an in-app action. It works because keys
  are registry-pinned and install never touches `progress`, so a restored word
  recovers its history automatically.
- **The device clock is broadly correct**, as in slice 1.

## Out of scope

- **O6, ungraded revision sessions** — a second session mode, and design work
  that belongs to the explorer rather than here.
- **Creating a deck from another deck's contents** — add/remove covers it and
  deck algebra is a slope.
- **Editing dictionary content.** A wrong entry is fixed in the pack build.
- **Part of speech and free text as selection axes.** They serve browsing; every
  extra axis is another combination to get right.
- **Undo/redo as a general mechanism.** Snapshots cover the one place that needs
  it.
- **Capping how many words a bulk operation may touch.** The warning is the
  guard; a cap only pushes the user into several passes.
- **Pruning absent members from decks**, and any automatic membership change.
- **The dictionary slide-in panel** — a right-hand panel opened from a dictionary
  icon beside settings, searching the pack by term or translation with regex
  accepted by default, and adding single words to decks. Its own framework, to be
  explored separately. Two things for that exploration to settle: it overlaps
  S11's whole-dictionary browse, so it should decide whether it replaces that
  route or complements it; and regex-by-default has two teeth — an invalid
  pattern throws while the user is still typing, and a pathological one can hang
  on 10k entries.

## Acceptance criteria

- **G1 satisfied when:** a word added to a deck from browse appears in its next
  session, and one removed leaves every progress row intact.
- **G2 satisfied when:** after a pack gains matching words, one press adds
  exactly the new matches, and a deck whose recipe matches nothing new offers no
  control at all.
- **G3 satisfied when:** hiding a word removes it from sessions immediately,
  preserves its levels, is reversible, and the word remains findable in browse
  behind a filter carrying a count.
- **G4 satisfied when:** a hidden word still appears among multiple-choice
  distractors.
- **G5 satisfied when:** the picker moves every vector of the word, including
  downward, and states that it does so before it is used.
- **G6 satisfied when:** the screen offers exactly three operations and no
  combination of inputs produces a fourth.
- **G7 satisfied when:** selecting "Production 0–2" selects words whose
  Production is 0, 1 or 2 **including those with no progress row**, and the write
  still lands on every vector.
- **G8 satisfied when:** the apply button cannot be reached with an empty comment.
- **G9 satisfied when:** the summary states the affected word count and how many
  words lose mastery, and the sample shows part of speech and old→new level.
- **G10 satisfied when:** a mass-edit interrupted by a storage failure leaves the
  profile byte-identical and no snapshot behind, and a selection of zero words is
  refused before the comment stage.
- **G11 satisfied when:** setting 1,000 unstudied words to level 5 marks them
  introduced and gives them due days running from `today + 14` at about `cardCap
  / 2` per day, none sharing a single day, and they are served as reviews rather
  than as new vocabulary. The same selection set to level 1 starts at `today + 1`
  and spreads over the same span.
- **G12 satisfied when:** every committed mass-edit leaves exactly one new
  snapshot carrying its comment.
- **G13 satisfied when:** restoring a snapshot and immediately restoring again
  returns the profile to its starting state, the snapshot count is unchanged by
  either restore, and neither is reachable without a confirmation stating that
  all current data — study since the snapshot included — is replaced.
- **G14 satisfied when:** a sixth snapshot drops the oldest, and the list shows
  date and comment with a working delete.
- **G15 satisfied when:** browsing the full dictionary reaches every word by
  scrolling, shows the total count, and renders per-vector levels and due days
  with tier and tag as both columns and filters.
- **G16 satisfied when:** the deck target picker offers only the current
  language's decks, starts unset, and no selection can span two languages.
- **G17 satisfied when:** a mass-edit writes a backup where the folder permission
  holds; a lapsed permission produces an explicit warning with a working re-grant;
  and a browser without the API says so instead of failing.
- **G18 satisfied when:** no code path in this slice writes to `db.entries`.
- **G19 satisfied when:** no deck's membership changes without a user action.
- **G20 satisfied when:** hiding the last outstanding word of a deck moves it to
  `Complete`.
- **G21 satisfied when:** unchanged from slice 1 — a recipe matching nothing
  still creates an empty deck that says so.
- **G22 satisfied when:** a word removed from its only deck keeps its levels and
  due days and reappears as an unstudied dictionary word.
