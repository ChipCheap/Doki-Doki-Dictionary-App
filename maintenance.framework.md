# Maintenance — Design Framework

**Status:** established 2026-08-13 · amended 2026-08-22 (mass-edit preview is a
count plus a sample, not the full list; a manual level set on an unstudied word
marks it introduced)
**Inherits:** `framework.md`, `ui.framework.md`, `packs.framework.md` — every
boundary in those binds this document.

---

## Intent

Despite the name, this is **not** a set of optional housekeeping tools.

Packs ship no decks, so a fresh install has a full dictionary and **nothing to
study**. Deck quick-create is the only path from install to a usable app, which
makes part of this framework v1-blocking rather than a later nicety.

The rest is genuinely rare corrective work: fixing a mastery the quiz got wrong
about you, retiring words you don't want, and — occasionally — changing a great
many words at once. That last one is the dangerous part, and most of the design
here exists to make it survivable.

---

## Scope

### In

Deck creation and adjustment. Single-word mastery editing. Mass-edit. Hiding.
Browse views over decks and the dictionary. Snapshots and restore.

### Out

Pack production (`packs.framework.md`). The study loop itself. Any operation
that edits *dictionary* content — meanings, examples, part of speech. The
dictionary is source data, not user data; a wrong entry is fixed in the pack
build, never in the app.

---

## Design

### Three different kinds of "gone"

Easily conflated, and they behave differently:

| | Cause | Scope | Reversible |
|---|---|---|---|
| **Removed from a deck** | user | that deck only | yes — still studiable via another deck |
| **Hidden** | user | word-wide, every deck | yes |
| **Absent from the pack** | a pack rebuild | the word does not exist | no — nothing to restore it to |

Hiding and pack-absence present identically to the user: not served, progress
preserved on disk. They differ in that hiding is a flag that can be cleared,
while absence is simply data that isn't there — which is why absence needs no
mechanism at all.

**"Removed" is never used for words in this project.** Say *absent from the
pack*, or *removed from the deck*, and the ambiguity disappears.

### Decks

A deck is a **static list of word keys plus the recipe that produced it**.

Static, so the deck never changes under the user — a deck silently gaining 400
words after a pack update would undermine every number on the deck screen. The
recipe is stored so that when a pack *does* grow, the app can re-run it, diff
against current membership, and offer the new matches in **one button press**.

**Quick-create axes**, drawn from what the pack already tags:

- **Difficulty tier** — Basic, Common, Advanced, Niche
- **Context tag** — `food`, `work`, `finance`, …
- **Everything in the pack**

`sequence`-tagged words are excluded by default. Numbers, weekdays and months
are learned as an ordered series, not as jumbled vocabulary.

Frequency ranges are deliberately **not** an axis. A learner doesn't think in
rank cutoffs, and frequency is already baked into the difficulty tiers.

Deck adjustment covers rename, tags, and adding or removing individual words.

### Hiding

Word-wide, never per vector. Progress is **preserved**, hiding is **fully
reversible**, and hidden words stay visible in browse behind a filter with a
count — the same treatment already given to vectors that get switched off.

**A hidden word remains eligible as a multiple-choice distractor.** It is still a
real word with a real meaning; excluding it would shrink the distractor pool for
no benefit. Hiding means "stop testing me on this", not "pretend it doesn't
exist".

### Editing one word's mastery

A **dropdown over the full 0–9 range**, reachable from the result panel and from
browse. It moves in both directions, though downgrading should be rare.

**Setting a level sets every vector of that word to it.** Recognition at 3 and
Production at 6, set to 5, gives 5 and 5 — including the downward move on
Production. "Set to 5" means what it says; a rule with hidden min/max behaviour
would be harder to predict than the discrepancy it was smoothing over.

The justification is that the discrepancy is rarely meaningful: someone who can
*produce* a word can almost certainly *recognize* it, production being the harder
half. Levels drifting apart is an artifact of which vector happened to come up
more often, not a real difference in knowledge.

Because this also fires from the result panel — where the user is looking at a
single card of a single vector — **the control must state that it sets all
vectors.** Otherwise bumping a Production card silently moves Recognition, which
is a hidden side effect however defensible the semantics.

**The due day is not touched.** A word bumped from level 2 to level 8 still
arrives on the day it was already scheduled for — possibly much earlier than
level 8 warrants — and then rejoins its proper cadence after that one answer.
Self-correcting, and it avoids the whole class of problems that comes from
rewriting due dates.

**One exception:** a word at level 0 has never been studied and has no meaningful
due day. Setting a level has to assign one, and there the assignment is
**staggered** across the coming days. Without that, "I already know all 1,000
Basic words" would make 1,000 reviews fall due simultaneously.

**Setting a level on an unstudied word also marks it introduced.** Whether a
word is served as *new vocabulary* or as a *review* is decided by introduction,
not by level — new words are rationed by the new-words-per-day budget, reviews
are not. So without the mark, claiming to know 1,000 words would leave all 1,000
queued as new vocabulary, trickling out a handful a day, and the level that was
set would never be used. Asserting a level is asserting that the word is already
known: it belongs on the review schedule, not in the introduction queue.

A single word set this way rests for its new level's interval and then comes up:
`today + ladder[level]`, which is what the *already known* rows on the new
vocabulary screen have always done. Quizzing a word the moment the user declared
they know it would be a strange reward for saying so.

A **mass-edit** starts from the same day and then **staggers**, across as many
days as the deck's card cap needs to absorb the batch — otherwise the whole batch
shares one due day, and being the oldest-overdue cards they would out-sort every
genuine review until the batch drained.

### Mass-edit

Three operations. Not more — this is a rare corrective tool, and anything richer
becomes a scripting language:

- **Set to a fixed level** — every vector of every affected word, as above
- **Hide / unhide**
- **Add to / remove from a deck**

**None of the three is vector-scoped.** Hiding is word-wide, deck membership is
word-wide, and setting a level writes all vectors. So a vector is never the
*target* of an operation.

It remains a **filter**: "select words whose Production level is 0–2, set them
all to 5" is the shape these operations take. Filter by one vector, act on the
whole word.

Selection is by **deck, difficulty tier, context tag, level range, and vector**.
Not part of speech, not free text — those serve browsing, and every extra axis is
another combination to get right.

Because context tags are derived from the pack's core layer, they mean the same
thing in every language: a finance term is a finance term whether the sense is
Spanish or Vietnamese. This depends on the tag vocabulary being **controlled and
shared across packs** — see `packs.framework.md`.

**Every mass-edit requires a comment.** Not optional, not defaulted. It is what
makes a snapshot identifiable months later, when "restore the one from Tuesday"
is not a usable description.

**Before committing, the user sees the shape of the change** — not an exhaustive
list. Three things: how many words are affected, how many would **lose mastery**
(already above the chosen level on at least one vector), and a sample of the
affected words with their part of speech and their old and new level.

The loss count is in **words, not vectors**, because the operation is
word-scoped: setting a level writes every vector, so "two vectors move down"
invites the reading that those two could be dealt with separately.

The sample is what makes a mis-aimed selection visible: if the intent was "only
verbs", a sample carrying nouns says so immediately. The full list was
considered and dropped — a mass-edit routinely touches thousands of words, and
a list nobody can read is not a safeguard. The **downward count** is the real
guard, because an unintended demotion is the damage worth catching, and the
snapshot is what makes any of it recoverable.

The surface carries **plain warnings** about the risk. A user should rarely feel
the need to do this, and the UI should say so rather than presenting it as
routine.

### Snapshots

A snapshot is taken **automatically before every mass-edit**. Progress is two
integers per `(word, vector)` pair, so a full snapshot is on the order of
200 KB — insurance this cheap is not worth rationing.

**Restore is a swap, not a rollback.** Loading a snapshot writes the current
state into a snapshot and consumes the one being loaded, in the same breath. The
user can therefore toggle back and forth freely while deciding whether they like
the change, rather than committing to a one-way door.

**But it is a full reload, not a targeted undo, and must be warned about as
such.** Restoring replaces progress, words and decks entirely with the state at
the time the snapshot was taken — so *everything* that happened since is
discarded, study included. Grade fifty cards after a mass-edit and then restore,
and those fifty grades are gone along with the edit. Restore is for use right
after the operation it protects against, while nothing else has accumulated; it
is not a way to reach back into last month. The warning says exactly this, and
the swap is what makes a restore chosen by mistake survivable.

Snapshots live **in the app's own storage alongside the packs**, with a
management view listing date and comment, and a delete action. No size is shown:
the comment is what identifies a snapshot months later, and measuring the payload
means serializing it a second time on every mass-edit for a number nobody acts
on.

They are not files in a folder on disk. A browser PWA has no such folder to
write to — the File System Access API exists but is Chrome and Edge only, so
depending on it would make the feature vanish on Firefox and Safari. The
**export-profile** action remains the way to put a real file on real disk.

### Browse

A word list over a deck or the whole dictionary, filterable on the same axes as
mass-edit, showing per-vector levels and due days. It is the entry point for
single-word edits, and the place hidden words remain visible.

---

## Edge cases

| Case | Decided behavior |
|---|---|
| Quick-create matches zero words | Deck is created empty rather than refused, and says so. |
| Pack update adds no new matches for a deck's recipe | The diff button reports nothing to add; no empty confirmation step. |
| A deck's recipe references a context tag no longer in the pack | Recipe still stored, diff yields nothing, deck unaffected. |
| Word removed from the only deck containing it | Progress preserved. It becomes an unstudied dictionary word again. |
| Word hidden while currently due | Leaves the queue immediately. May drop the deck straight to **Complete**. |
| Hidden word's deck is deleted | Hiding is word-wide, so it stays hidden. |
| Mass-edit selection resolves to zero words | Refused before the comment step; nothing to snapshot. |
| Mass-edit would affect every word in a language | Allowed, with the count shown. The warning is the guard, not a cap. |
| Snapshot restored, then immediately restored again | Returns to the prior state. The swap is symmetric by construction. |
| Storage full when taking a snapshot | Mass-edit is refused rather than performed unprotected. |
| Manual level set on a level-0 word | Word marked introduced. Due day assigned as `today + ladder[level]`; a mass-edit staggers from there. |
| Manual level set on any other word | Due day untouched, in either direction. A demotion moves the ladder position, not the arrival — the next review at the old interval is itself the check. |
| Word has one vector above and one below the chosen level | Both land on it. The higher vector moves **down**; that is the operation working, not a bug. |
| Word has a vector at level 0 and another at level 6, set to 5 | Both become 5. The level-0 vector gains a staggered due day, the other keeps its own. |
| Level set from the result panel mid-quiz | Applies to every vector, and the control says so before it is used. |

---

## Boundaries & invariants

**Always:**

1. A mass-edit is preceded by a snapshot, and refused if one cannot be taken.
2. A mass-edit carries a user-written comment.
3. Before a mass-edit commits, the user sees the number of words affected, the
   number that would **lose mastery**, and a sample of the affected words with
   their part of speech and old→new level. The full list is not required.
4. Hiding preserves progress and is reversible.
5. Restore swaps rather than overwrites, so any restore can be undone.
6. A deck stores the recipe that created it, not only its members.
7. Setting a level writes **every vector** of the word, and any control that does
   so declares it.

**Never:**

1. No maintenance operation edits dictionary content. Wrong entries are fixed in
   the pack build.
2. Changing a level never moves an existing due day.
3. Decks never change their own membership. Growth is always a user action.
4. Hidden words are never excluded from the distractor pool.
5. No bulk operation is reachable without passing through the summary.
6. No operation targets a single vector. A vector is a filter, never a scope.

---

## Relation to the project framework

**Serves:** the path from a fresh install to a usable deck, which nothing else
provides. Gives `Don't study` on the new vocabulary screen somewhere to land, and
gives the result panel's mastery picker its semantics.

**Inherits:** progress keyed on `(word, vector)`; the fixed ladder; day
granularity; the deck-owns-no-progress rule — which is exactly why hiding is
word-wide and deck removal is not.

**Does not contradict the core bet.** `framework.md` holds that recognition and
production are separate skills and must never move each other, and setting a
level writes both. The bet governs **automatic** progression, where letting the
easy half pull up the hard one would let recognition masquerade as mastery. A
manual override is the user asserting knowledge directly — asserting it for both
skills at once is a different act, not the same rule broken.

**Amends `packs.framework.md`:** the context-tag vocabulary must be **controlled
and shared across packs**, normalized from Wiktionary's topics at build time.
Without that, quick-create offers different buttons per language and cross-language
tag queries stop meaning anything.

---

## Standards adopted

**Accepted:** destructive actions preview their effect first; automatic
snapshots before bulk changes; reversible-by-default restore; required
annotation on consequential operations; honest warnings on genuinely risky
surfaces; empty states that explain rather than fail.

**Rejected:** undo/redo as a general mechanism — snapshots cover the one place
that needs it, and the study loop already has its own correction affordances.
A query builder — three operations and five axes cover the real cases, and
anything more becomes a language to learn. Editing dictionary content in-app.
Capping how many words a bulk operation may touch, which would only push users
into doing it in several passes.

---

## Open questions

All four were **adopted as recommended on 2026-08-22** and are carried into
`maintenance.plan.md`. Kept here with their reasoning rather than deleted.

| Question | Recommended default |
|---|---|
| How many snapshots are retained? | Last 5, oldest dropped automatically, with manual delete available. |
| Can a deck be created from another deck's contents? | Not in v1. Add/remove covers it, and deck-algebra is a slope. |
| Does browse expose the pack's difficulty and context tags as columns, or only as filters? | Both — they are the only two axes a learner reasons about. |
| Is quick-create reachable after first run, or only when a language has no decks? | Always reachable, from the deck list. It is how a second deck gets made. |
