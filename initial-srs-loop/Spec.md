# Spec: initial-srs-loop

**Created:** 2026-05-21
**Status:** initial

## Overview

A personal vocabulary-learning Progressive Web App that drills the user on a custom word list using spaced repetition. The user selects a target language (initially Spanish or Vietnamese), the app shows a prompt word in either the base language (English) or the target language, and the user types the translation. Correct answers advance the word in a spaced-repetition schedule; incorrect answers let the user choose whether to retry later in the session or accept the answer as correct. All user progress lives on-device but can be exported and re-imported as a single JSON file so the user can move between machines.

## Assumptions

- **Platform**: TypeScript browser PWA. No native shell, no server. Runs offline once installed.
- **On-device storage**: IndexedDB, accessed through Dexie.js.
- **Portability mechanism**: in-app "Export profile" and "Import profile" buttons that produce/consume a single JSON file. No automatic cloud sync.
- **Single user per browser profile**: no account system, no multi-user separation within one install. (Multiple devices = export/import.)
- **Base language is English** for v1. Changing the base language is out of scope; the data shape should not preclude it later.
- **SR algorithm is SM-2**, with two deliberate deviations from canonical SM-2:
  1. A plain wrong answer where the user chooses "retry later in this session" does NOT update the SM-2 state — the word simply re-enters the session queue. SM-2 state only changes on a graded outcome (correct, or wrong-but-accepted-as-correct).
  2. "Accept as correct" is graded identically to a correct answer.
- **Date storage**: dates are stored as a compact, machine-readable form (e.g. integer days-since-epoch or ISO date string) that survives JSON export/import round-trips and is easy to edit by hand in the exported file if needed.
- **Seed data**: v1 ships with a hardcoded seed JSON bundled into the app. There is no in-app word-entry UI yet; richer import flows are designed in a future iteration.
- **Diacritics matter**: matching is accent-sensitive because Spanish (`sí` vs `si`) and Vietnamese (`má` vs `mà` vs `mả`) tones/accents carry meaning.

## Requirements

### R1: Per-language deck selection

**Description:** The user can choose which target language they are currently studying. Each language has its own independent word list and its own independent SR progress. Switching languages does not mix words or progress between them.

**Happy path:**
1. User opens the app.
2. App shows the current target language and a way to switch (initially: Spanish, Vietnamese).
3. User picks a language; the app loads that language's deck and SR state.

**Negative paths:**
- A language with no seed words loaded: the language is still selectable, but enters the "no words yet" empty state on selection.

**Edge cases:**
- First-ever launch: the app picks a default language deterministically (first in the configured list) so the user lands on a usable screen.
- A language is removed from the seed in a later release while user progress for it still exists: progress is preserved on disk; the language is hidden from selection until re-added.

**Acceptance:** With at least two seed languages loaded, the user can switch between them and the visible deck + progress changes accordingly with no cross-contamination.

### R2: Bidirectional testing with independent per-direction progress

**Description:** Every word can be tested in two directions: prompt in base language → user types target, and prompt in target language → user types base. Each direction has its own independent SR state (level, ease factor, due date), because recognizing a word and producing it are different skills.

**Happy path:**
1. The session queue serves a card.
2. The card identifies which direction it is testing (e.g. shows the English word, expects Spanish; or vice versa).
3. The user's outcome updates only that direction's SR state for that word.

**Negative paths:**
- A word has SR state for one direction but not the other: the missing direction starts at the initial SR state when first served.

**Edge cases:**
- The user has set one direction to a high manual level and the other to the lowest: both states coexist; the session serves whichever direction is currently due.

**Acceptance:** Performing well in one direction does not change the other direction's due date or level for the same word.

### R3: Word data model

**Description:** A word entry holds enough to support today's testing flow and tomorrow's dictionary/filter view. Each entry has: a base-language term; zero or more base-language synonyms (alternate acceptable answers when tested in the base→target direction's reverse, i.e. when the prompt is the target word and the user types base); a target-language term; zero or more target-language synonyms; a part-of-speech tag (noun/verb/adjective/...); a list of free-form context tags (e.g. "food", "irregular", "formal"); and at least two example sentences in the target language.

**Happy path:**
- A word entry conforming to this shape is loaded from the seed, served as a card, and round-trips through export/import unchanged.

**Negative paths:**
- An entry missing a required field (base term, target term, part-of-speech, or fewer than two example sentences) is rejected at load time with a logged warning; it is not served as a card.

**Edge cases:**
- Synonym lists may be empty (no synonyms is valid).
- Context tags may be empty (untagged words are valid).
- Example sentences beyond two are allowed.

**Acceptance:** A seed JSON containing entries with all listed fields loads cleanly, serves cards, and exports back to a JSON that re-imports identically.

### R4: Answer matching rules

**Description:** The user's typed answer is compared against the set of acceptable answers for the prompted direction. The acceptable set is the target term plus its target synonyms (for base→target prompts) or the base term plus its base synonyms (for target→base prompts). Matching trims surrounding whitespace, is case-insensitive, and is accent-sensitive. A match against any acceptable answer is treated as correct.

**Happy path:**
1. User types an answer and submits.
2. Normalized user input is compared to each normalized acceptable answer; first match wins.
3. Outcome reported to the SR layer (correct).

**Negative paths:**
- Typed answer matches none of the acceptable answers: app shows the prompted word, the user's typed answer, and the full list of acceptable answers, then offers the choice between "retry later in this session" and "accept as correct".

**Edge cases:**
- Empty input on submit: treated as no-match (negative path).
- Input that matches except for a diacritic (`si` vs `sí`): treated as no-match. The mismatch view should make the missing diacritic visually obvious.
- Trailing or leading whitespace in either the seed entry or the user input: ignored after normalization.

**Acceptance:** Given a word with `target = "sí"` and synonyms `["claro"]`, typing `" sí "` is correct, typing `"SÍ"` is correct, typing `"claro"` is correct, typing `"si"` is incorrect.

### R5: Spaced-repetition scheduling (SM-2 with custom lapse policy)

**Description:** When the user grades a card as correct (either by typing it right or by choosing "accept as correct" after a miss), the SR state for that (word, direction) advances per the SM-2 algorithm: level increases, ease factor updates, due date is recomputed. When the user instead chooses "retry later in this session" after a miss, the SR state is unchanged and the word is re-inserted into the current session's queue to appear again before the session ends. Words that are not due (next due date > now) are not served.

**Happy path:**
1. User answers a due card correctly → SR state advances; the next due date is in the future per SM-2.
2. The next session pulls cards whose due date is ≤ now.

**Negative paths:**
- User answers wrong and picks "retry later in this session": no SR state change; word goes back into the session queue.
- User answers wrong and picks "accept as correct": graded as correct; SR state advances normally.

**Edge cases:**
- A card scheduled far in the future (e.g. level 7, 90+ days out): does not appear until its due date.
- The device clock moves backward (DST, manual change): scheduling uses the stored due date as-is; no auto-correction. (Acknowledged as a known limitation.)
- The same card appears more than once in a session via the lapse path: each appearance is treated independently; only the final graded outcome (correct or accept-as-correct) updates SR state.

**Acceptance:** A correct answer on a level-1 card moves it to level 2 (or whatever SM-2 dictates) with a future due date; a wrong answer + "retry later" leaves level and due date unchanged; a wrong answer + "accept as correct" advances the card identically to a plain correct answer.

### R6: Manual per-direction level override

**Description:** The user can manually set a word's SR level (or equivalent SM-2 state) for either direction independently. This supports the "I already know this" case (set high, effectively retire it) and the "skip this for now" case (set very high so it rarely surfaces).

**Happy path:**
1. From a word's detail view, user picks a direction and a target level.
2. App writes the new SM-2 state for that (word, direction) — level, ease factor, and a coherent due date derived from the new level.
3. The session queue respects the new due date on its next refresh.

**Negative paths:**
- User sets a level outside the supported range: input is rejected with a message naming the valid range.

**Edge cases:**
- Setting the lowest level on a far-future card: card becomes due immediately and surfaces in the next session.
- Setting the highest level on a currently-due card: card disappears from the current session's queue.

**Acceptance:** After a manual override, the affected direction's due date and level match the user's intent, and the other direction is unchanged.

### R7: Seed data source (v1 only)

**Description:** v1 has no in-app word-entry UI. Initial words come from a JSON file bundled in the app build. The file is parsed at app start (or on first language switch); valid entries become part of that language's deck, invalid entries are skipped with a logged warning. The seed is the starting state for a fresh profile; the user's SR state is layered on top of the seed and persists independently across reloads.

**Happy path:**
- On first launch, the seed JSON loads and populates each configured language's deck. User can immediately start a session.

**Negative paths:**
- Seed JSON is malformed: app surfaces an error state on the affected language(s); other languages still work if their seed parsed.
- Seed JSON references a language not in the configured language list: that block is ignored with a warning.

**Edge cases:**
- A word in the seed is later removed in a future release while the user has progress on it: the user's progress is preserved on disk but the word is no longer served (the deck is the intersection of seed × user state).
- A word in the seed has a synonym list that overlaps with another word's term: both are valid; matching follows R4 per-word.

**Acceptance:** Building the app with a valid seed JSON produces a usable app with that vocabulary; building with no seed produces an app where every language enters the "no words yet" empty state.

### R8: User data portability via export and import

**Description:** The user can export their entire profile (all per-language SR state, all manual overrides, any user-specific settings) as a single JSON file via an in-app action. They can import a previously exported file on another device or browser profile, replacing the local profile.

**Happy path:**
1. User clicks "Export profile"; app produces a JSON file and triggers a browser download.
2. On another device, user clicks "Import profile" and selects that file; app validates it and replaces the local profile state.
3. Sessions on the new device behave identically to where the export was taken.

**Negative paths:**
- Imported file is malformed or missing required top-level fields: import is rejected with a clear error; local state is unchanged.
- Imported file is from a newer schema version than the app understands: import is rejected with a message naming the version mismatch.

**Edge cases:**
- Importing into a profile that already has progress: the import fully replaces local state (with a confirmation step before destruction). No merging in v1.
- Exported file is hand-edited to change a due date: re-importing applies the edit. (This is the "easily modifiable" property the user requested.)

**Acceptance:** A round trip (export → wipe local → import) restores the exact same SR state, manual overrides, and settings the user had before the wipe.

### R9: Review session UX and empty states

**Description:** When the user enters review mode, the app shows exactly one of three states for the current language: "X cards due now" (the actual session UI), "all caught up — next card due in <time-from-now>", or "no words yet — this deck is empty". The chosen state is determined by the current language's deck and SR state at session entry.

**Happy path:**
1. User selects a language with due cards → session UI runs through the queue, one card at a time, until the queue is empty.
2. Session ends → state transitions to "all caught up" with the next due time.

**Negative paths:**
- All cards become not-due partway through a session (e.g. user runs through them): the session ends gracefully and transitions to "all caught up".

**Edge cases:**
- Deck exists but no card is currently due AND there is no future due date (e.g. all cards manually retired to max level): "all caught up" shows but with no time estimate (or "no cards scheduled").
- Deck is genuinely empty: "no words yet" message; explains seed data is the v1 source.

**Acceptance:** Each of the three states is reachable through normal use, and the displayed message accurately reflects the deck's actual due-state.

## Boundaries

The following are explicitly **not part of this initial spec** and must not be implemented as part of v1, though the data model and architecture should leave room for them:

- **In-app word entry / edit UI.** v1 reads only from the bundled seed JSON. Add/Edit/Delete word UIs are a separate future feature.
- **Bulk import flows** (CSV, paste-list, multi-list management). User wants to design these separately once they know what shapes their lists take.
- **Synonym search and in-app definition view.** Data model supports synonyms (R3) and the dictionary entry is rich enough to back a future definition view, but neither view is built in v1.
- **Dictionary view with sort/filter by meaning groups or word function** (verbs, irregular verbs, etc.). The `partOfSpeech` and `contextTags` fields exist to back this later view.
- **Changing the base language** away from English. Data model should not preclude it; UI for it is not built.
- **Account system, cloud sync, sharing decks with other users.** Portability is solely via manual export/import.
- **Audio (pronunciation playback, speech recognition).** Not in v1.
- **Statistics / progress dashboards beyond the empty-state "X due now" counter.** Not in v1.
- **Mobile-native packaging.** PWA install on mobile is acceptable; native iOS/Android apps are not built.

## External dependencies

None. The app is fully offline-capable after first load and depends on no external services at runtime.

## Open questions

- **Date storage format**: exact form (integer days-since-epoch vs ISO date string vs Unix ms) is left to the planner, constrained by the "compact + easy to hand-edit in the exported JSON" goal.
- **SM-2 level range and manual-override granularity**: SM-2 doesn't have discrete "levels" in the canonical sense; the v1 implementation will need to define a level vocabulary (e.g. levels 0–7 mapped to typical SM-2 intervals) that the user-facing override and the empty-state "next due in Xh" message can both speak in. The planner should propose this mapping.
- **What constitutes a "session"**: implied to be a single visit to review mode that drains the currently-due queue. No explicit session size cap or timer was specified.
- **Seed JSON schema version**: R8 mentions rejecting imports from newer schema versions; the planner should define the initial version number and where it lives.
