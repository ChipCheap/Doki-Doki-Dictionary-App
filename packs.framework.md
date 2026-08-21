# Dictionary packs — Design Framework

**Status:** established 2026-08-12
**Inherits:** `framework.md` — every boundary there binds this document.
**Related:** `ui.framework.md` (how this data is displayed and typed against).

---

## Intent

A **pack** is one language's dictionary: a flat body of tagged word data the app
consumes. Producing one is a separate offline pipeline with its own cadence; this
document fixes the **contract between them**, so packs can be rebuilt, corrected
and extended without the app changing and without a user's progress detaching
from the words it was earned on.

**The constraint everything else answers to:** `framework.md` keys progress on
`(word, vector)`. A word's identity therefore has to survive regeneration from
source. Get this wrong and every rebuild silently orphans mastery.

---

## Scope

### In

The entry shape and its tagging vocabulary. Word identity and key stability.
Sourcing policy. Difficulty and sequence tagging. The reports a build must emit.
Versioning and update semantics. Licence propagation.

### Out

The build tooling itself — script structure, language, scheduling. Deck creation,
which is a UI surface (a pack ships **no decks at all**). Anything about how the
app stores or queries the data at runtime; that's the architect's.

---

## Design

### Shape

A pack contains a **raw dictionary only** — no decks, no user-facing groupings.
Decks are built in the app from what the pack provides.

A pack is **extensible in place**: adding words must never disturb the learning
state of words already present.

### Two layers, because the base language is a parameter

`framework.md` requires the core to work with the base language swapped — a
Vietnamese speaker learning German gets a working app by exchanging packs. A pack
is therefore really a *(target, base)* pair, and it splits along that seam:

| Layer | Holds | Varies with |
|---|---|---|
| **Core pack** | One per target language: senses, terms, part of speech, difficulty, context and sequence tags, target-language example sentences | target only |
| **Meaning layer** | One per base language: meanings, derived synonyms, example translations | target × base |

The core is ~60% of the total and is identical for every base language, so adding
a base language becomes a small file rather than a second full download. It is
also the shape the requirement literally describes: exchange the baseline, keep
everything else.

**v1 ships one base language, so this costs nothing now** — the *format* keeps
the layers separate even though only one meaning layer exists. Building the seam
later would mean re-cutting every pack.

A core pack with no matching meaning layer is not studiable; the target language
simply isn't selectable until one exists.

### An entry is one sense

Not one word. `wiktextract` emits one object per Wiktionary sense, and that
boundary is exactly the distinction we want:

- **Separate senses become separate entries.** Spanish `banco` yields one entry
  for *bank* and another for *bench*.
- **Meanings within a sense stay one entry.** `casa` sense 1 gives *house, home* —
  one entry, both accepted as answers.

This is mechanically derivable rather than a judgment call we make. It is *not*
guaranteed correct — Wiktionary's granularity is editorially inconsistent, some
entries splitting hairs and others lumping. The sense cap and the build reports
below are the safety valves.

**Consequence for the app:** two entries can share a spelling, so multiple-choice
distractor selection must **exclude any entry sharing the correct answer's target
term**. Without that rule a `banco` question could offer both *bank* and *bench*
and mark a user wrong for knowing the word.

### Identity

Keys look like `es:banco:noun:2` — language, normalized term, part of speech, and
a **pinned sense ordinal**.

The ordinal rather than the meaning, because a meaning is base-language-specific: key
a Spanish sense by its English meaning and the same word keys differently for a
Portuguese speaker. Identity has to be a property of the word, not of who is
learning it. The registry records which sense each ordinal is, and the meaning
travels alongside in the meaning layer for readability.

This costs a little self-evidence in an exported profile — `es:banco:noun:2`
needs a lookup to interpret — but term and part of speech are still legible, and
the alternative breaks the base-language requirement outright.

**Keys are pinned in a registry, not derived at build time.** The registry is a
committed file in the pack-source repository, appended to and never regenerated.
The build proposes keys only for genuinely new entries and matches everything
else against the registry.

This is what makes identity survive our own future decisions — renormalizing a
tag set, changing case folding, or reconsidering a meaning can no longer re-key
existing entries. **The registry is build-side and never ships**; the app reads
keys straight from the pack and has no use for the bookkeeping.

Nothing mutable belongs in a key. A semantic field is a judgment call, and
judgment calls get revised.

### Entry contents

| Field | Layer | Notes |
|---|---|---|
| Key | core | As above |
| Target term | core | The word in the target language |
| Part of speech | core | Also the primary distractor filter |
| Difficulty | core | `Basic` · `Common` · `Advanced` · `Niche` |
| Context tags | core | `trade`, `finance`, `hobby`, `work`, … — from a **controlled vocabulary**, see below |
| Sequence tag | core | Optional, with ordinal — see below |
| Gender | core | Optional: `m` / `f` / `n` / `mf`, where the language has grammatical gender |
| Article | core | Optional explicit article, overriding what the gender implies |
| Example sentences | core | Target language, with source ID |
| Base terms | meaning | Meanings of this sense — **all accepted as answers** |
| Target synonyms | meaning | **Derived**, not authored — entries sharing a meaning and part of speech are synonyms of each other |
| Example translations | meaning | Keyed to the core layer's sentences |

Deriving synonyms rather than curating them means the **meaning index does three
jobs**: synonym lookup, the "valid word, but not the one asked for" rejection,
and build-time cross-checking. A separately authored synonym list would be a
second source of truth that drifts from the first.

### Examples

**Two preferred, more allowed, fewer accepted.** Best effort — a common word with
one example is far more useful than a missing word, and an entry with none still
ships rather than being dropped.

This matters because example availability is wildly uneven between languages:
Tatoeba's Spanish corpus is enormous, its Vietnamese corpus a small fraction of
it. Pooling **Wiktionary's own usage examples** with Tatoeba's helps. Generating
the shortfall does not — a fabricated Vietnamese sentence with wrong tones is
exactly the error a learner cannot detect.

**Sentences are duplicated across entries, not normalized into a shared
collection.** Normalizing would require finding which words a sentence contains,
and Vietnamese word segmentation is genuinely hard — compounds mean whitespace
doesn't split words. A wrong sentence-to-word link is a silent quality defect the
user cannot diagnose; duplication costs 2–3 MB. Bytes are the cheaper problem.

### Difficulty tagging

Frequency rank from an OpenSubtitles-derived list splits `Basic` / `Common` /
`Advanced`. A register or domain label on the sense promotes it to `Niche`.

The label data is real: senses carry structured `tags` (`archaic`, `rare`,
`colloquial`, `poetic`) and `topics` (`medicine`, `law`). What does **not** exist
is per-sense frequency — which meaning of a word is most common. Wiktionary's
editorial sense order stands in for it.

`Niche` may be legitimately empty in a frequency-selected pack; rare words are
excluded by the selection itself. It fills as packs extend past the core.

### Sense cap

**At most 3 senses per `(term, POS)`.** Because entries are split, a highly
polysemous word otherwise becomes many cards with the same visible prompt and
different expected answers, and the recognition vector starts feeling like a
trick. Beyond three you are teaching lexicography, not vocabulary.

Pruning order: drop senses labelled rare, archaic, obsolete or dialectal first,
then truncate by source order.

### Context tags are a controlled vocabulary

Context tags derive from Wiktionary's `topics`, which are English topic names
applied to senses in *any* language — so a finance term is tagged `finance`
whether the sense is Spanish or Vietnamese. Tags therefore belong to the **core
layer** and survive a base-language swap untouched.

That only holds if the vocabulary is **fixed and shared across every pack**.
Wiktionary's raw topic list runs to hundreds of inconsistent names, so the build
normalizes them into one small controlled set. Without that step, deck
quick-create would offer different buttons for Spanish than for Vietnamese, and a
cross-language tag query would stop meaning anything.

Unmappable topics are dropped rather than passed through. A tag nobody can query
is worse than no tag.

### Gender and its article

Nouns in gendered languages carry a **gender**; the **article** is derived per
language, because `m` means `el` in Spanish and `der` in German. Keeping the
mapping in the app rather than on every entry means adding a language is one
line, not a pass over the whole pack.

Gender is **sourced, not inferred** — Wiktionary tags nouns `masculine` /
`feminine` / `neuter` in the same array the register labels come from.

Entries split per sense, so the hard cases resolve themselves: Spanish
`el capital` (money) and `la capital` (city) are already two entries, each with
one gender.

**An explicit `article` overrides the gender rule**, for words whose article does
not follow from their gender. Spanish `el agua` is feminine but takes `el` before
a stressed *a*; French elides to `l'`. How often this matters varies sharply by
language — essentially never in German, a small closed set in Spanish, and
frequently in French and Italian where the article's *form* changes for
phonological reasons rather than grammatical ones.

**The article is part of the typed answer.** `el libro` is correct; `la libro`
and a bare `libro` are both wrong, because the gender is one of the things being
learned. *Redo question* already covers "I was close".

Gender is deliberately **not** its own learning vector in v1. The vector model
would support it — one enum value, one component — but getting the data into the
pack is the part that is expensive to retrofit; how it is tested is cheap to
change later.

### Sequence tag

Words belonging to an **ordered paradigm** — numbers, weekdays, months, ordinals,
the alphabet — carry a `sequence` tag **with an ordinal position**
(`sequence:number:7`).

These are learned as a series, not as isolated vocabulary; nobody wants *1, 20,
100000, 7, 14* jumbled into a quiz. Deck quick-create excludes them by default. A
future counting feature needs the order, and capturing it during the build is
free where reconstructing it later means redoing the tagging by hand.

### Sources

| Source | Provides | Licence |
|---|---|---|
| Wiktionary via kaikki / `wiktextract` | Senses, meanings, part of speech, labels, some examples | CC BY-SA |
| Tatoeba | Example sentence pairs, stable citable IDs | CC BY 2.0 FR |
| OpenSubtitles-derived frequency list | Ranking, difficulty banding | CC BY-SA 3.0 |

**Generation may assemble; it may never author.** Reformatting, filtering,
selecting among sourced examples — fine. Writing a meaning or a sentence — not.

### Build reports

Every build **must** emit these. They are how quality is known rather than
assumed, and each answers a question that can't be settled from the literature:

| Report | Answers |
|---|---|
| Homographs | Which terms carry more than one entry, and how many |
| Sense cap | Where senses were dropped, and which |
| Example coverage | How many entries fell short of two, per language |
| Source coverage | Frequency-list headwords with no usable dictionary entry |

### Versioning

A pack carries a **pack version** and a **schema version**. The app rejects a pack
whose schema version it doesn't understand, naming the mismatch.

Adding words never disturbs existing progress. A word removed in a later pack
keeps its progress on disk and is simply no longer served.

### Size

About 870 bytes per entry, dominated by examples:

| Pack | Raw | Gzipped |
|---|---|---|
| 6,000 entries | ~5.2 MB | ~0.9 MB |
| 10,000 entries + indexes | ~10 MB | ~1.5 MB |

Split across layers, roughly **60% core / 40% meaning** — so a second base language
for an existing target costs ~4 MB rather than ~10 MB.

**Examples are ~60% of a pack**; everything else is rounding error. The example
array is therefore the only meaningful size lever — a third example on every word
adds ~2.6 MB at 10,000 entries.

Packs ship **pre-built indexes** by part of speech, by meaning, and by term, since
all three are needed at question time.

---

## Edge cases

| Case | Decided behavior |
|---|---|
| Frequency-list word absent from the dictionary source | Skipped; counted in the source coverage report. |
| Entry has one example, or none | Ships anyway. Counted in the example coverage report. |
| A term has more than 3 senses | Truncated after label-based pruning. Logged. |
| Two senses produce the same discriminator | Build fails loudly rather than minting a colliding key. |
| A meaning is reconsidered in a later build | Key unchanged — the registry holds. |
| A source reorders its senses between builds | Key unchanged — ordinals come from the registry, never from the source's current order. |
| Core pack updated with new words; meaning layer not yet rebuilt | The new entries are not studiable until the meaning layer catches up. Reported. |
| Source relabels a word's part of speech | Key unchanged — the registry holds. |
| Word removed from a later pack | Progress preserved; word not served. |
| Sense carries no usable English meaning | Entry skipped. A word with no answer isn't testable. |
| Sentence appears under several entries | Duplicated. Intended. |
| `Niche` tier ends up empty | Accepted. The scale exists before the words do. |

---

## Boundaries & invariants

**Always:**

1. One entry per sense; meanings within a sense share one entry.
2. Keys come from the registry. New keys are minted only for new entries.
3. Every entry has a target term, at least one English meaning, and a part of speech.
4. Synonyms are derived from the meaning index, never authored.
5. Every example carries a source ID sufficient for attribution.
6. Every build emits all four reports.
7. A derived pack is distributed under CC BY-SA, with its sources listed in the
   manifest.
8. A pack is extensible in place — adding words never disturbs existing progress.
9. Core and meaning layers stay separable, even while only one base language ships.
10. Context tags come from one controlled vocabulary shared by every pack.

**Never:**

1. No mutable value ever enters a key.
1a. **No base-language-specific value ever enters a key.** Identity belongs to
    the word, not to who is learning it.
2. The registry is never regenerated from scratch, and never ships.
3. No generated content authors a meaning or a sentence.
4. A pack never contains decks.
5. No entry exceeds 3 senses per `(term, POS)`.
6. A word is never dropped for having too few examples.

---

## Relation to the project framework

**Serves:** the dictionary/deck split — packs supply the dictionary half, and the
distractor pool the recognition vector depends on. Difficulty and context tags
back deck quick-create.

**Inherits:** progress keyed on `(word, vector)` — the reason identity is the
central concern here; **the base language as a parameter**, which drives both the
sense-ordinal key and the two-layer split; verified sources over generation;
CC BY-SA propagation; cheap indexed distractor lookup, which is why indexes ship
pre-built.

**Amends `framework.md`:**

- **Entries are split per sense**, not collapsed per word — with the distractor
  exclusion rule that makes it safe
- **Examples are best-effort, two preferred**, replacing "1–3 required"; an entry
  is never rejected for having too few
- **Synonyms are derived**, not authored
- Adds the **`sequence` tag** and the rule that quick-create excludes it

---

## Standards adopted

**Accepted:** stable identifiers pinned in a registry rather than derived;
build-time reporting over assumed quality; open licensed sources with attribution
carried through to the artifact; failing loudly on key collisions.

**Rejected:** normalized sentence storage — correctness beats bytes here.
Authored synonym lists — a second source of truth. Generated meanings or
sentences. Sense-frequency weighting, which would require data that doesn't
exist for either language.

---

## Open questions

| Question | Recommended default |
|---|---|
| Manifest contents | Language, pack version, schema version, source list with licences, entry count, build date, report summaries. |
| Can a user supply their own pack file? | Not in v1 — packs stay build-bundled, so the core loop is proven against known-good data first. |
| Are packs stored compressed in IndexedDB and inflated on read? | No. ~10 MB is affordable and inflation costs latency at exactly the wrong moment. Revisit if packs grow past ~20 MB. |
| Does the pack pin a fixed source snapshot date for reproducibility? | Yes — record the kaikki and Tatoeba dump dates in the manifest, so a build is repeatable. |
