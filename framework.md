# Doki-Doki Dictionary — Project Design Framework

**Status:** established 2026-08-08
**Supersedes:** `initial-srs-loop/Spec.md` in several load-bearing places (see
*Relation to the existing spec* at the end). That spec must be regenerated
against this framework before implementation.

---

## Intent

A personal vocabulary-learning Progressive Web App. The user studies words in a
target language against English, and the app decides what to show and when using
spaced repetition. It runs offline, keeps everything on-device, requires no
account, and is given away freely.

Initial target languages: **Spanish** and **Vietnamese**. Base language: English.

**Success looks like:** the user opens the app, is handed a bounded set of words
the system believes they are about to forget, answers them, and closes it. No
configuration ritual, no deciding what to study, no backlog anxiety.

**The core bet:** knowing a word is not one skill. Recognising it and producing
it are tracked separately and progress independently, because conflating them
lets recognition — the easy half — masquerade as mastery.

---

## Scope

### In

- Consuming **dictionary packs** and the study **decks** selected from them
- The **learning vector** model and the per-vector mastery ladder
- **Quiz sessions**: question presentation, grading, re-query, session bounds
- Multiple-choice construction, including distractor selection
- Profile **export / import** as a single JSON file
- Full **offline** operation after install

### Out — deferred to sibling frameworks

- **Pack production.** Sourcing, generating, tagging and versioning dictionary
  packs is its own pipeline with its own cadence. This framework fixes only the
  *pack contract*; production gets `packs.framework.md`.
- **Maintenance operations.** Editing a word's mastery after a quiz or from deck
  browsing, mass-editing across vectors, adjusting decks, hiding words from
  quizzes. Gets `maintenance.framework.md`.
- **The UI layer.** Screen inventory, navigation, interaction detail. Gets
  `ui.framework.md`, and is expected to be the largest of the three — it is the
  part the user actually touches.

### Out — not planned

Accounts, cloud sync, deck sharing. **Speech recognition.** Statistics
dashboards. Native mobile packaging — PWA install only.

**Audio playback is out of v1.** Browser speech synthesis was evaluated by
listening and rejected — the available Vietnamese voices do not render tones
reliably, and a voice that flattens a tone teaches the wrong word. v1 builds only
the seam where playback would attach, and renders no control. Revisit if a voice
appears that survives a listening test. See `ui.framework.md`.

**A UI for choosing the base language** is out of scope, but the core systems
must already be base-language-agnostic (see below). v1 ships English as the only
base; that is a packaging decision, not an architectural one.

---

## Design

### Core concepts

| Concept | What it is |
|---|---|
| **Dictionary** | The full body of known words for one language. Universally accessible; not owned by any deck. |
| **Word** | One dictionary entry — **one sense**, not one spelling. Terms, synonyms, part-of-speech, examples, difficulty, context tags. |
| **Deck** | A named, tagged *selection* of words from one language's dictionary. Carries settings. Owns no progress. |
| **Learning vector** | A way of being tested on a word: prompt side + answer side + input method. |
| **Level** | The mastery position of one `(word, vector)` pair on the ladder. |

### The dictionary

Per-language, roughly **6,000 words** (up to ~10,000), selected by frequency
from verified open sources rather than authored by generation. Generation may
*assemble* — reformat, filter, select among sourced examples — but must not
author meanings. This matters most for Vietnamese, where tone diacritics are
semantic (`má` / `mà` / `mả`) and plausible-looking errors are invisible to a
learner.

Each entry carries: base term, target term, synonyms on both sides,
part-of-speech, **usage examples — two preferred, best effort**, a difficulty
tier, and context tags (`trade`, `finance`, `hobby`, `work`, …). A word is never
dropped for having too few examples; a common word with one is worth far more
than a missing word.

**An entry is one sense, not one spelling.** Spanish `banco` becomes two entries
— *bank* and *bench* — while `casa` meaning *house, home* stays one entry with
both meanings accepted. Synonyms are **derived** from entries sharing a meaning and
part-of-speech, never authored.

Words in an ordered paradigm — numbers, weekdays, months — carry a `sequence`
tag with their position. They are learned as a series, not as isolated
vocabulary, so deck quick-create excludes them by default.

See `packs.framework.md` for the full contract.

Packs are **bundled with the build** for v1, and are **updatable** — a newer
pack may add words without disturbing any existing progress.

**Difficulty tiers** — four, deliberately approximate:

| Tier | Meaning |
|---|---|
| 1 **Basic** | The base you need in order to describe anything harder |
| 2 **Common** | Turns up regularly in day-to-day conversation |
| 3 **Advanced** | Complex topics; a layman won't take these in immediately |
| 4 **Niche** | Confined to a context — poetic, archaic, or field-specific |

Assigned by heuristic at pack-build time: frequency rank splits 1–3, and a
register or domain label on the word's primary sense promotes it to Niche.
Exactness is not required — misclassification costs the user nothing, since
nobody regrets having learned a word that was too hard.

**Niche may legitimately be empty in the first pack.** A frequency-selected core
excludes rare words by construction, so the tier fills only as the dictionary
grows past that core. This is accepted, not a defect: the tier exists so the
scale is already there when the words arrive. Both the classification heuristic
and the pack contents are expected to be revised later — neither is a decision
the rest of the system depends on.

### Learning vectors

A vector is **(prompt side, answer side, input method)** — not merely a
direction. Two vectors may share a direction and differ only in method.
Vectors are configured **per language**, and each may be enabled or disabled.

Each vector names a **method** from a closed enum of question types the app
actually implements. v1 ships two:

| Vector | Method | Prompt | Answer |
|---|---|---|---|
| **Recognition** | `FOREIGN_TO_BASE_MC` | target language | base language, multiple choice |
| **Production** | `BASE_TO_FOREIGN_TEXT` | base language | target language, typed, orthographically exact |

The app holds a registry mapping each enum value to the component that asks that
kind of question. Adding a vector is therefore one new enum value, one new
component, and a line of language configuration — **no change to scheduling,
grading, or storage**. A **reading** vector for Chinese or Japanese is the known
future case.

Every vector holds its **own independent level** for every word. Performing well
in one never moves another.

### The base language is a parameter, not a constant

The core must work with the base language swapped: a Vietnamese speaker learning
German should get a working app by exchanging packs, with nothing in scheduling,
grading, matching, or storage caring which language sits on the base side.

This is why nothing base-language-specific may enter a word's identity, and why
packs separate target-side data from the base-language meaning layer (see
`packs.framework.md`).

Out of scope: writing systems that need per-script rendering or input — Chinese
hanzi and the like. Those need a new question component, not a different core.

### The mastery ladder

Level 0 is new — due immediately. Levels 1–9 carry a fixed rest interval:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| **Days** | 1 | 2 | 4 | 7 | 14 | 21 | 30 | 60 | 100 |

Intervals are **whole days**. Due dates are calendar days with no time-of-day
component: nothing records *when* a word was answered, only on which day it
comes back.

There is no ease factor and no difficulty prompt. Asking the user to rate how
hard a word felt is overhead that vocabulary drilling does not repay — and with
a single graded outcome an ease factor is provably inert anyway, degenerating
into a deterministic function of the level. The ladder *is* the algorithm.

### Mastery

**Level 9 is mastery.** By default a mastered word is **removed from querying** —
the deck treats it as finished and does not serve it again.

Each deck carries a setting that re-enables mastered words for periodic
check-ups. With it on, a mastered word keeps its 100-day schedule and comes back
when due; answered wrong, it **demotes to level 8 like any other card**. Mastery
is a claim that is re-verified, not a permanent grant — getting a word wrong is
the definition of not having mastered it.

This is distinct from **hiding**, which is manual, immediate, and unconditional,
and belongs to the maintenance framework. Mastery is earned by the ladder and
reversible by a wrong answer; hiding is declared by the user.

### Grading

The grade is decided at **first sight** of the card. The buttons on the result
panel choose it:

| First attempt | Level | Re-queried this session? |
|---|---|---|
| Correct | **+1** | no |
| Wrong → **Mark correct** | **+1** | no — explicitly skips the re-query |
| Wrong → **Redo question** | **0** | yes, ungraded |
| Wrong → *neither; continue* | **−1** (floor 1; level 0 stays 0) | yes, ungraded |

On the re-query appearance the level **never moves** — further errors don't
count, and getting it right does not promote. Otherwise a demotion could always
be undone and no demotion would ever stick.

Two properties this is built to have:

- **The default is the punishing path.** Pressing nothing demotes. *Redo
  question* is an active mercy the user extends to themselves, which is exactly
  why it can be trusted: it costs a deliberate press. It exists for typos, and
  for holding a different word of the same meaning that the dictionary's
  synonyms didn't capture.
- **Every card is graded exactly once, at first sight.** A card that re-queues
  may reappear any number of times, but those appearances are **ungraded** — the
  level never moves again. A re-queued card leaves the queue only by being
  answered correctly, or by *Mark correct*, which on a re-query appearance
  **clears the card without changing the level**. That is the exit for a word
  the user genuinely cannot produce; without it the session could not be
  finished.

**A level-0 word answered wrong stays at level 0 and stays due.** The floor of 1
was written for demotions from higher levels; applied to a new word it would
*promote* one the user has just failed. Nothing is earned until something is
answered right.

**Redo leaves the due day untouched, so the card stays due today** — and
therefore returns in the *next* session too, not just later in this one. This is
intended: *Redo* means "I didn't have it," so the word keeps coming back until
it is answered correctly or *Mark correct* is pressed. The consequence is that a
deck cannot reach **Caught up** while any Redo'd word is outstanding.

Decks carry a **name and tags** (`verbs`, `core`, `leisure`) so several decks per
language stay tellable apart.

### The result panel

After every submission the result is shown alongside the **full dictionary
entry** for the word: definition, synonyms, part-of-speech, and its usage
examples — plus the two grading buttons.

This deliberately moves a boundary the earlier spec drew. That spec excluded any
definition view from v1 in the name of keeping the first pass small, but the
dictionary now carries every one of those fields already, so displaying them
costs presentation and nothing else. The moment immediately after answering is
also when the user is most receptive to them — withholding the entry to protect
a scope line would be saving effort in the wrong place.

### Sessions

A session draws from one deck up to a **card cap set per deck, defaulting to
20**. An unbounded pile after a break offscreen is the classic reason people
abandon an SRS.

**New words are slotted first**, up to a per-deck **new-words-per-day** setting.
Reviews fill whatever remains.

This is deliberate and it is a trade. Reviews-first would keep the backlog under
control, but once the pile is large the user never sees new vocabulary again and
the app becomes pure chore. New-words-first keeps learning moving — at the cost
of **no automatic brake on the backlog**: if more reviews come due each day than
the leftover slots can absorb, the overdue pile grows, and every new word learned
makes it grow slightly faster.

The brake is manual: **new-words-per-day is the lever**. For it to be usable the
user must be able to see the pile, so the deck screen shows an overdue count.

**Review order is most-overdue-first.** Overdueness is `today − due day` — a
single subtraction on data already stored, needing no last-review timestamp.
Ties break arbitrarily; a stable or reproducible ordering buys nothing here and
fast matters more.

**One word yields exactly one card per session.** Selection considers **only the
vectors actually due**: if one is due, it is served. If several are due, the one
with the **lower level** wins, ties broken randomly — so no fixed ordering of
vector types is needed and a third vector requires no new rule. A vector that is
not due is never a candidate, whatever its level.

This is what keeps the new-word budget honest: a new word has every vector at 0,
so without it "5 new words" would mean 10 cards and crowd out every review. It
also removes the cueing problem outright — a word cannot be recognised and then
produced in the same sitting, because it only appears once.

The cost is real and accepted: **each word advances at roughly half the rate
across both vectors**, since only one moves per session.

New words are drawn by **weighted random sampling over difficulty tier** — Basic
heaviest through Niche lightest, without replacement. Common words dominate
without the deck feeling like reading a dictionary front to back, and it needs no
frequency rank stored, only the tier the pack already carries.

**Introduction is a word-level fact and global.** A word introduced while
studying one deck is never re-introduced in another. It is recorded when the word
is **first quizzed**, not when it appears on the new vocabulary screen — so
abandoning that screen leaves it un-introduced, as intended.

### Deck conditions

A deck is always in exactly one of four states, and each needs its own screen:

| State | Meaning |
|---|---|
| **Due** | Reviews are due, or unlearned words remain within today's new-word budget. The session runs. |
| **Caught up** | No reviews due and today's new-word budget is spent or exhausted, but a future due day exists. Show it, alongside the overdue count if any. |
| **Complete** | Every word is mastered and mastered words are not being re-queried. Nothing due, nothing scheduled. |
| **Empty** | The deck holds no words at all. |

**Complete and Empty must not share a screen.** Complete is the win condition —
the user finished what they set out to learn — and its natural next action is
*add more words from the dictionary*. Empty is a deck that was never populated.
Rendering the first as the second turns an accomplishment into an error message.

Complete exists only because mastered words leave the rotation. Under a plain
level-9 cap every word would always carry a next due day, and a deck could never
fall off the schedule entirely.

### Multiple choice

Three distractors sharing the correct answer's **part-of-speech**, drawn from
**the user's own deck first**, falling back to the wider dictionary when the
deck cannot supply three.

**Any entry sharing the correct answer's target term is excluded.** Because
entries are split per sense, `banco` exists twice; offering both *bank* and
*bench* would mark a user wrong for knowing the word. With the sibling sense
removed the question is well-formed — "which of these is a meaning of `banco`" —
and someone who knows only the other sense genuinely does not know this entry.

Deck-first is not about deck size — it closes a leak. If the answer always comes
from the deck and the distractors always come from outside it, the user stops
translating and starts picking *the word they recognise*, and the vector then
measures familiarity while reporting mastery.

Selection must stay a **cheap indexed lookup**. No phonetic or edit-distance
similarity scoring at question time; battery and CPU on a mobile PWA are a
standing constraint.

### Answer matching (typed vectors)

Trimmed of surrounding whitespace, case-insensitive, and **accent- and
tone-sensitive**. `si` does not match `sí`. When it fails, the mismatch is shown
in a way that makes the missing diacritic obvious — and *Mark correct* is there
for when the user judges it a typo.

**A valid word that isn't the one asked for is rejected, not graded.** Prompted
with *to leave*, a user who types `dejar` when `salir` was the target has
produced a real translation, so marking it wrong would be unfair — but accepting
it means never learning the other word. Instead the submission is refused with a
note that this isn't the word being asked for, the field stays live, and nothing
is graded or advanced. Structurally the same as `Enter` on an empty field
priming rather than submitting, so the grading table is untouched and *I don't
know* remains the way out.

No letter hints. Coming up with a different word for the same meaning is the
skill being exercised.

---

## Edge cases

| Case | Decided behavior |
|---|---|
| Word appears in two decks, due the same day | Quizzed **once**. Progress is global, so answering it anywhere satisfies it everywhere. |
| Word already mastered in deck 1 appears in a new deck 2 | Keeps its level. Deck 2 simply starts partly complete. |
| Deck has fewer due cards than the session cap | Session is short. The cap is a ceiling, not a quota. |
| New-word budget exceeds the session cap | The cap wins. New words take the whole session and no reviews are served that day. |
| Both vectors of a word are at the same level | Vector chosen at random. New words always hit this, since every vector starts at 0. |
| A re-queried card is answered wrong again | Re-queues again. Ungraded, so nothing moves; it leaves only on a correct answer or *Mark correct*. |
| A word is marked already-known on the intro screen | It leaves at the chosen level and **another new word replaces it** — the budget was for learning N words, not for dismissing them. |
| Session abandoned before the new words were quizzed | Nothing was written, so they are still unlearned. The next session may pick a different set; no reproducibility is attempted. |
| Deck cannot supply 3 same-part-of-speech distractors | Falls back to the dictionary for the shortfall. |
| A vector is enabled for a language that already has progress | Its words enter at level 0 but **staggered** across coming days, so it drips in at about one session per day rather than flooding. |
| A vector is removed from a language's configuration | Progress on it is **preserved but not served** — the same rule as a word removed from a pack. |
| A base language meaning layer is missing for an installed target pack | That target is not selectable until a matching meaning layer exists. The core pack alone is not studiable. |
| Updated pack adds words | New words enter at level 0. Existing progress untouched. |
| Updated pack removes a word the user has progress on | Progress preserved on disk; the word is no longer served. |
| Word demoted while already at level 1 | Stays at level 1. The floor holds. |
| Device clock moves backward | Stored due dates are used as-is; no correction attempted. |
| Deck is empty / language has no pack | Explicit **Empty** state; never a blank session. |
| Nothing is due, future due day exists | **Caught up**, showing the next due **day**. |
| Every word mastered, re-query setting off | **Complete** — the win state, not an empty one. Offers adding words. |
| Every word mastered, re-query setting on | **Caught up**, next due day up to 100 days out. |
| Mastered word resurfaces and is answered wrong | Demotes to level 8 and rejoins normal rotation. |
| Re-query setting switched off while mastered words are due | They leave the queue immediately; the deck may fall straight to **Complete**. |
| Import from a newer schema version | Rejected, naming the mismatch. Local state untouched. |
| Import into a profile with existing progress | Full replacement after explicit confirmation. No merging. |

---

## Boundaries & invariants

**Always:**

1. Progress keys on `(word, vector)` — **never** on deck. Decks are selections
   over a shared word set. This is the single most expensive invariant to
   retrofit and the cheapest to hold now.
2. A card is graded **exactly once per session**, at first sight.
3. Every vector's level is independent of every other vector's.
3a. Each vector names a method from the implemented enum, and progress hangs off
    the vector's identity rather than its position in a list.
3b. Nothing base-language-specific enters a word's identity. Swapping the base
    language must require no change to scheduling, grading, matching or storage.
4. Intervals come from the fixed ladder. Level fully determines the next due day.
5. Rest is measured in whole days. No time-of-day is stored anywhere.
6. Typed matching is accent- and tone-sensitive.
7. Distractor selection is an indexed lookup.
8. A derived dictionary pack is distributed under **CC BY-SA**, with attribution
   surfaced in-app.
9. Mastery is re-verifiable: a mastered word answered wrong demotes like any
   other card.
10. Everyday operations are fast because the data is local and small relative to
    the machine — entering a deck, starting a session, assembling a question.
    A brief pause to build a question is acceptable; a routine loading state is
    a signal something is wrong. Pack installation is the one place a genuine
    wait is expected, and there it is explicit and one-time.

**Never:**

1. No word yields more than one card in a session.
2. A re-query appearance never changes a level, however often it recurs.
3. No difficulty self-rating is ever requested from the user.
4. No network access is required for study once packs are installed.
5. No generated content authors a *meaning* — only assembles sourced ones.
6. Demotion never falls below level 1.
7. A mastered word is never served unless its deck's re-query setting is on.
8. **Complete** is never rendered as **Empty**.

---

## Standards adopted

**Accepted:** offline operation as the default rather than a fallback; explicit
empty, loading and error states everywhere a deck or pack can be absent; profile
export/import as the portability mechanism; keyboard-first quiz flow (Enter
submits) since typing is half the product; accessible contrast and text sizing;
in-app attributions screen (a licensing obligation, not a courtesy).

**Rejected for v1:** undo/redo — the grading model already contains its own
correction affordances in *Redo question* and *Mark correct*. Rate limiting and
permissions models — no server, no shared resource. Progress dashboards beyond
the due-count.

---

## Licensing position

The app is free and non-commercial. **This does not relax any obligation** — CC
licenses are conditioned on distribution, not on profit, and none of the chosen
sources carry a `NonCommercial` term.

| Source | License | Obligation |
|---|---|---|
| Wiktionary / kaikki extracts | CC BY-SA (+ GFDL) | attribution **and** share-alike |
| FrequencyWords (OpenSubtitles-derived) | data CC BY-SA 3.0 | attribution **and** share-alike |
| Tatoeba | CC BY 2.0 FR (some CC0) | attribution only |

Consequence: a generated pack is a derivative of share-alike data and must be
**CC BY-SA** itself. The application code is unaffected — a pack shipped
alongside an app is a *Collection*, not an *Adaptation*.

---

## Related frameworks

| File | Covers | Status |
|---|---|---|
| `ui.framework.md` + `ui.wireframes.html` + `ui.theme.css` | Screens, keyboard model, theming, typography | **written** |
| `packs.framework.md` | Pack contract, word identity, sourcing, tagging, versioning | **written** |
| `maintenance.framework.md` | Deck creation and adjustment, mastery editing, mass-edit, hiding, snapshots | **written** |

## Open questions

| Question | Recommended default |
|---|---|
| Does a manual level override reset the due day, or preserve the existing one? | Reset: `due = today + ladder[new level]`. Belongs to the maintenance framework. |
| Exact frequency-rank cutoffs between Basic / Common / Advanced | Start at top 1000 / 1000–3000 / 3000–6000 of a 6k pack; tune against real data. |
| Does a deck bundle its own enabled-vector set, or inherit the language's? | Deck-level, defaulting to the language's set. Keeps later splitting additive. |

---

## Relation to the existing spec

`initial-srs-loop/Spec.md` predates this framework and conflicts with it in
ways that cannot be patched in place:

- **R5** mandates SM-2 with ease factors. Replaced by the fixed ladder.
- **R2** hardcodes two directions. Replaced by the extensible vector model.
- **R7** makes a bundled seed JSON the only word data. Replaced by the
  dictionary/deck split; the seed JSON survives only as the bootstrap that
  proves the pack contract before real data exists.
- **R6**'s manual override and the "retire it" case move to the maintenance
  framework.
- **R9** names three deck states and conflates "deck is empty" with "nothing is
  scheduled". Replaced by four states that separate **Complete** from **Empty**.
- The **Boundaries** section excludes a definition view; the result panel
  reinstates it.
- Its four **Open questions** are all resolved here: date format (integer
  days), level vocabulary (the ladder), session definition (per-deck cap), and
  lapse policy (the grading table).

The spec should be regenerated from this framework rather than edited.
