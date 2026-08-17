# UI — Design Framework

**Status:** established 2026-08-11
**Inherits:** `framework.md` — every boundary there binds this document.
**Visual reference:** `ui.wireframes.html`, next to this file. It is
**normative for structure and placement** — what appears on each screen and
where — and **not normative** for final spacing, type scale, or icon choice.
**Colour reference:** `ui.theme.css` — the role vocabulary and the default
palette, documented per role.

---

## Intent

Define the surfaces the user actually touches. The scheduling model in
`framework.md` is invisible to them; this is the part they experience.

**The governing bias: the hands never leave the keyboard.** A vocabulary session
is a few dozen rapid type-and-submit cycles, and every interaction that requires
reaching for a pointer costs more than the decision it captures. Desktop is the
primary target because that is where this bias pays off.

---

## Scope

### In

Home, Deck, the new vocabulary screen, both quiz screens, the result panel,
session summary, settings, export/import, attributions, keyboard help. Layout
across form factors. The keyboard model. Theming, typography, the diacritic
mismatch display, and audio playback.

### Out

Deck browse / word list, dictionary browse and add-to-deck, and standalone word
detail — all `maintenance.framework.md`. **One shared surface:** the mastery
control on the result panel. This framework owns where it sits and how it looks;
the maintenance framework owns what the operation means.

---

## Design

### Form factor

**Desktop primary, two-pane** — quiz left, result right. **Mobile stacks** the
same content in the same order, result below quiz, scrolled into view on submit.

That part is one flex axis and is nearly free. What genuinely diverges is
**auto-advance**: on desktop a correct answer advances instantly and the entry
lands in the right-hand pane, still readable while the next question is answered.
Stacked on mobile that pane is below the fold, so an instant advance would show
the user nothing — mobile dwells where desktop does not.

### The keyboard model

Two phases per card, and the phase boundary is what removes every key conflict:

**Typing phase** — the answer field is focused **the moment the card appears**.
Never a click, never a tab. All keys go to the field.

| Key | Effect |
|---|---|
| `Enter` | submit |
| `Enter` on an empty field | primes a confirmation; a second `Enter` is *I don't know* |

Whitespace-only input normalizes to empty and takes the same path.

**Result phase** — submission ends typing, so the field blurs and single keys
become unambiguous.

| Key | Effect |
|---|---|
| `Enter` | continue |
| `m` | mark correct |
| `r` | redo question |
| `1`–`4` | select a multiple-choice option (typing phase, MC only) |

*Mark correct* and *Redo question* render only when the answer was wrong. They
are meaningless otherwise, and showing them greyed out would be four pixels of
noise on every correct card.

### Screens

| Screen | Holds |
|---|---|
| **Home** | **All installed languages at once**, as stacked sections in a stable order: a header at heading scale with the language name and its two-letter code, that language's deck list in its own bordered box, then a horizontal rule. Each deck row carries name, tags, and one state-appropriate value — `Start session · 14`, `next in 3 days`, or `complete`. Menu in the header. No flag icons — Windows ships no flag glyphs, so they degrade to letter pairs on the primary platform. |
| **Deck** (expanded) | Reached by clicking the deck name. Ladder distribution bar bucketed new / learning / mature / mastered, with counts, plus the **overdue count**. Start session, browse words. |
| **New vocabulary** | Opens any session containing new words. Flip through them with `← n of N →` before the quiz begins. Per card: term, part-of-speech, meanings, a *Sentences* action, and the already-known row. |
| **Quiz — recognition** | Progress `n of N`, quiet *I don't know*, prompt word, part-of-speech, four numbered options. |
| **Quiz — production** | Same chrome; autofocused answer field; keyboard-help affordance. |
| **Result panel** | Outcome and level movement, full dictionary entry (term, part-of-speech, tags, meaning, examples), mastery level picker, and the two buttons when wrong. |
| **Session summary** | Counts promoted / held / demoted, and how many words reached mastery. No streaks, timers, or accuracy percentages. |
| **Settings** | Per deck: session cap, **new words per day**, enabled vectors, mastered re-query. Global: text size, font, dark mode — each with a live preview beside it. |
| **Keyboard help** | Static, always available, steps inline. |
| **Attributions** | Source licences. A licensing obligation, not a courtesy. |
| **Export / import** | Profile round-trip, with confirmation before replacement. |

Settings, export/import, attributions and keyboard help all sit behind **one
menu off Home**. None is reachable mid-session; four separate entry points would
outweigh the study loop they exist to serve.

### The new vocabulary screen

New words are **shown before they are quizzed**, never sprung as a question the
user cannot possibly answer. The screen opens any session that contains new
words, covers only that session's set, and is a preview — flip forward and back
freely, then start.

Per card: term, part of speech, meanings, and a **Sentences** action. No images —
the pack carries none. No audio in v1, and therefore no audio control.

**"Know this already?"** offers three levels and an opt-out, mapping onto the
ladder:

| Choice | Level | Rest |
|---|---|---|
| a bit | 2 | 4 days |
| well | 5 | 14 days |
| very well | 8 | 60 days |
| don't study | *hidden* | — |

Taking one of these **pulls in a replacement new word**. The daily budget was for
learning *n* words; dismissing one already known shouldn't spend a slot. Hiding
is the maintenance framework's operation, surfaced here.

**Abandoning the intro costs nothing** and reproduces nothing. Words are only
written when graded, so quitting leaves them unlearned and the next session may
pick a different set. Making that reproducible would add state and branching to
serve a case that barely happens.

### Audio — not in v1

**v1 ships no audio.** The available options were evaluated and rejected on
quality, not effort.

Browser `speechSynthesis` was the obvious candidate — zero bytes, offline, no
licence — but the OS voices were judged unusable for Vietnamese by listening to
them. That is disqualifying rather than disappointing: tones are semantic, so a
voice that flattens or mangles them teaches the wrong word, and the learner has
no way to detect it. The same failure mode as a generated sentence.

Bundled neural synthesis (Piper and similar) is also out — an ONNX runtime plus
a voice model of tens of megabytes would dwarf the dictionary it pronounces, and
Vietnamese has only two Piper voices, one of them explicitly low quality.

**What v1 does build: the seam.** A single playback entry point that the new
vocabulary screen and result panel call, backed by nothing. Adding audio later
is implementing behind that seam — not retrofitting call sites into finished
screens. No control renders while it is unimplemented; a dead button is worse
than an absent one.

Revisit when a Vietnamese voice exists that survives a listening test.

### The result panel holds the previous word

A consequence of auto-advance, and accepted deliberately: on desktop the pane is
always one card behind. You are never stopped when you were right, and the entry
you just earned stays readable while you answer the next question. The cost is
that the pane and the question refer to different words — judged easy enough to
learn and worth the uninterrupted flow.

### Diacritic mismatch

Per-character highlighting applies **only when diacritics are the sole
difference**. A substantively wrong answer shows both forms plainly — highlighting
every mismatched glyph there would be noise dressed as feedback.

The highlight uses **a background block and weight as well as colour**. It carries
the entire explanation of why the answer was wrong, and colour alone fails for
colour-blind users. Tones stay muted; saturated red and green shout far louder
than the information warrants, especially against a dark background.

### Theme and typography

A warm amber-brown signature colour, as a **pair** rather than a single value —
light mode needs it dark enough to carry white button text, dark mode light
enough to read against near-black. Surfaces are warm near-black and cream rather
than neutral grey and white.

The ladder distribution runs light-to-dark through that same brand, so a deck
visibly fills with the app's colour as it is mastered.

**Colour is data, not code.** Every value lives in **one swappable stylesheet**
(`ui.theme.css` is the reference), as named custom properties with a comment on
each explaining what the role is *for* — `--brand`, `--miss-bg`, `--bucket-new`
— never what it looks like. No component may contain a literal colour, so
re-skinning the app is exchanging one file and touching nothing else.

Two rules that make the file safe to swap:

- **Every role is defined twice**, light and dark. A theme filling in one is
  incomplete, not light-only.
- **The ladder buckets invert between modes.** The rule is not "dark means
  mastered" but *furthest from the page background* means mastered — so on a
  dark page mastery is the lightest step. A theme that copies the light values
  into the dark block reads backwards.

**Type size is a correctness concern here, not a comfort one.** The semantic
payload of a Vietnamese word lives in marks a few pixels tall, and the matching
rule treats that difference as the whole answer. Minimum body size and generous
line height protect the invariant.

**The font list is curated, not free** — five sans faces chosen for ordinariness
and, decisively, for genuine Vietnamese coverage: `Noto Sans`, `Inter`,
`Roboto`, `Open Sans`, `Source Sans 3`. Many otherwise-common faces render `ẳ`
or `ộ` by falling back mid-word.

Since the base language is a parameter, a face must cover **both sides** of a
pairing, not just the target. The curation criterion is therefore per-pack, and
widening the language set can narrow the font list.

Every preview in settings uses stacked-mark test text (`ế ộ ữ ẳ`) — the preview
should show where a font fails, not a flattering word.

### Text input

Diacritics are typed with the **operating system's own input method** — Telex or
VNI for Vietnamese, a Spanish layout for Spanish. Nothing is implemented in-app,
and deliberately so: in-app Telex fights a configured OS IME and double-transforms
the input.

A Spanish accent row may exist as a **fallback only**; click-to-insert cannot
conflict with an IME, whereas transform-on-type can.

The cost lands on discoverability, so a keyboard-help affordance sits **on the
typed quiz screen itself** — where someone stuck will actually be looking. It is
**on demand, not ambient**: a hover tooltip on desktop, a tap target on mobile.

### Loading

Installing a language pack is an **explicit, one-time step with real progress** —
several MB into IndexedDB, and pretending otherwise with a spinner is worse than
admitting it. After that, entering a deck or starting a session shows **no
loading state at all**.

---

## Edge cases

| Case | Decided behavior |
|---|---|
| Card appears; user has not touched the keyboard | Field is already focused. Typing works immediately. |
| Answer is a valid word, but not the one asked for | Submission refused with a note below the field. Field stays live, nothing graded, nothing advanced. No letter hints. |
| Fresh install, packs present, no decks | Deck quick-create is the first-run path — packs ship no decks. Belongs to `maintenance.framework.md`. |
| Session has no new words | The new vocabulary screen is skipped entirely. |
| Every new word in the intro marked already-known | Replacements are pulled until the budget is met or the deck runs out of unlearned words. |
| `Enter` on an empty field | Primes a confirmation rather than submitting. Second `Enter` is *I don't know*. |
| Whitespace-only answer | Normalizes to empty; same path. |
| Correct answer, desktop | Advances instantly. Entry appears in the right pane. |
| Correct answer, mobile | Result dwells; user advances explicitly. |
| Wrong answer | Always dwells, both form factors. Nothing auto-advances past a decision. |
| First card of a session | Result pane is empty, not blank-with-error. |
| Deck list, no deck due | Every row still shows its own state; the list is never hidden. |
| Font lacks a glyph | Prevented by curation, not handled at runtime. |
| Touch device, help affordance | Tap target, not hover. |
| Session interrupted | Every grade already written. Re-query queue is not restored. |

---

## Boundaries & invariants

**Always:**

1. The answer field is focused when a typed card appears.
2. Every action in the study loop has a keyboard path.
3. The result phase blurs the field before single-key shortcuts become live.
4. The mismatch highlight encodes difference by more than colour.
5. Settings previews render adjacent to their control and update live — the user
   never visits a quiz to see the effect of a setting.
6. Both themes are fully supported; neither is a filter over the other.
7. Font choices are drawn from the curated Vietnamese-capable list.
8. New words are shown before they are quizzed.
9. Every colour role is defined for both light and dark.

**Never:**

1. No spinner on deck entry or session start. If one is needed, the architecture
   is wrong.
2. No study-loop action is pointer-only.
3. *Mark correct* and *Redo question* never render on a correct answer.
4. Nothing auto-advances past a decision the user still has to make.
5. No ambient help text in the quiz surface.
6. Free-form font entry is never offered.
7. **No literal colour value appears anywhere outside the theme stylesheet.**

---

## Relation to the project framework

**Serves:** the "open it, answer, close it" loop — the keyboard model exists to
make that friction-free. The four deck states get four distinct screens, with
**Complete** rendered as the win condition it is.

**Inherits:** accent- and tone-sensitive matching (which is what makes type size
and font coverage correctness concerns); mastery as a level-9 state with its
per-deck re-query setting; grading decided at first sight; attribution surfaced
in-app.

**Amends `framework.md`,** as a result of this exploration:

- Decks carry a **name and tags** — new; the deck concept previously had neither
- **Redo leaves the card due today**, so it returns in the next session too
- **No loading state on session entry** — promoted from UI preference to a
  standing constraint the architect must satisfy

No conflicts outstanding.

---

## Standards adopted

**Accepted:** keyboard-first everywhere; autofocus on the input that matters;
dark mode; user-controlled type size and font; live preview on every visual
setting; explicit progress on genuinely slow operations; distinct empty, complete
and error states; on-demand help.

**Rejected:** undo/redo — the grading model already carries its own correction
affordances. Streaks, timers and accuracy percentages — the ladder is the
progress metric and a second one competes with it. Onboarding wizards — the
keyboard help page is static and always reachable, so nothing needs remembering
or storing. Greyed-out disabled controls — absent rather than dimmed.

---

## Open questions

| Question | Recommended default |
|---|---|
| **Does a swappable base language imply UI localization?** | Undecided — see below. |
| Does the session summary offer "study more" when other decks are due? | Yes, as a quiet link. Never auto-chain into another session. |
| Does the result pane show anything before the first answer? | A neutral placeholder naming the deck. Not an error state. |
| Is text size global or per language? | Global. Per-language sizing solves a problem nobody has. |
| Can the mastery picker on the result panel go *down*? | Yes — full 0–9. Confirm when the maintenance framework defines the operation. |

### On UI localization

`framework.md` makes the vocabulary's base language a parameter — a Vietnamese
speaker can learn German by exchanging packs. But the **chrome** is a separate
thing: *Start session*, *Mark correct*, *Redo question*, the keyboard help page.
Nothing so far says those follow.

The two are genuinely independent — a Vietnamese speaker could study
German-with-Vietnamese-meanings through an English interface, and it would work.
It would just be odd.

The cost is asymmetric and worth knowing before it's decided. Externalizing
every user-facing string is cheap while there are none; retrofitting it across a
finished UI is the classic expensive refactor. Actually *translating* the strings
is separate again, and can wait indefinitely.

**Recommended default:** treat UI strings as externalized data from the start,
ship only the English set, and leave translation out of scope. That keeps the
door open at roughly zero cost without committing to a localization effort.
Needs the user's decision.
