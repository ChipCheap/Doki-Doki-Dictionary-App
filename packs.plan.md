# Plan: packs

**Outer iteration:** 1
**Realizes framework:** `packs.framework.md` (amended 2026-08-23) + `framework.md`
**Within architecture:** **none — deliberately.** `architecture.md` governs the
browser app: no backend, complexity ceiling 2, four modules over Dexie. This is a
**build-side program** that never ships to a user, streams ~1 GB inputs and
writes files. Inheriting that ceiling would be a category error. Its own
constraints are stated below, and they are what the reviewer should check.
**Previous version:** none — first iteration

## Constraints adopted in place of an architecture

1. **Output conformance is enforced by the compiler, not by convention.** The
   generator imports `CorePack` / `MeaningPack` from
   `src/dictionary/pack-format.ts`, and its final gate runs the app's own
   `validateCoreEntries` / `validateMeaningEntries`. If the app would drop an
   entry, the build fails before writing.
2. **Assemble, never author.** No step may write a meaning or a sentence.
3. **Silent identity loss is a build failure, never a warning.**
4. **Every input is pinned.** A build reads only from a cache matching
   `sources.lock.json`; nothing reaches the network mid-build.
5. **The registry is append-only, committed, and never shipped.**
6. **Stream, never load.** A ~1 GB JSONL is read line by line.

---

## Framework coverage map

| Framework goal | Plan steps |
|---|---|
| G1: Two layers, core per target and meaning per target×base, separable | S12, S13 |
| G2: One entry per sense; meanings within a sense share an entry | S2, S6 |
| G3: Keys `lang:term:pos:ordinal`, minted only for new entries | S9 |
| G4: Registry never regenerated, never ships | S9, H1 |
| G5: No mutable or base-language value in a key | S9 |
| G6: Entry needs term, at least one meaning, part of speech — else skipped | S2, S16 |
| G7: Sense cap of 3 per (term, POS); labelled senses pruned first | S6 |
| G8: Difficulty from frequency rank; register or domain label promotes to Niche | S3, S4 |
| G9: Context tags normalized to one controlled vocabulary | S5 |
| G10: Gender sourced not inferred; explicit article overrides | S7 |
| G11: Sequence tag with ordinal | S8 |
| G12: Examples best-effort, pooled, duplicated, each with a source ID | S10, S11 |
| G13: Synonyms derived, never authored | satisfied by the app (`queries.ts`) |
| G14: Generation assembles, never authors | S11, S16 |
| G15: Build reports — the four, plus key churn | S15 |
| G16: Manifest, including pinned dump dates | S14 |
| G17: Pack distributed CC BY-SA with sources listed | S14 |
| G18: Extensible in place — adding words never disturbs progress | S9 |
| G19: Build fails loudly on a key or discriminator collision | S9 |
| G20: Packs ship no indexes | S12 |

---

## Plan steps

### S1: Source acquisition and pinning
**Covers:** constraint 4
**Files:** `tools/packs/sources.ts` (new), `sources.lock.json` (new)
**Description:** Declare three sources per language — the kaikki per-language
JSONL extract, the Tatoeba per-language sentence export, and the
OpenSubtitles-derived frequency list — each with URL, licence and dump date. A
`fetch` command downloads into a gitignored `dumps/` cache and records real byte
size and a content hash in `sources.lock.json`. Builds read only from cache and
abort when it does not match the lock, unless `--refresh` is passed.
**Rationale:** Measured, not estimated: the Spanish extract is **978 MB**,
Vietnamese **75 MB**, and kaikki regenerates on Wiktionary's dump cadence —
roughly twice a month. Pinning is what stops an upstream edit from changing a
pack we did not intend to rebuild.

### S2: kaikki reader
**Covers:** G2, G6
**Files:** `tools/packs/kaikki.ts` (new)
**Description:** Stream the JSONL, yielding one candidate per
`(word, pos, sense)`. **Drop `form-of` senses** — those carrying `form_of` or a
`form-of` tag — and set them aside for S3. Drop senses with no usable gloss.
Carry through `glosses`, `tags`, `topics`, `examples`, and the entry's `forms`.
**Rationale:** 21% of senses in the sample are `form-of`. Admitting them would
fill a fifth of the pack with conjugation trivia — "first-person singular present
indicative of bancar" is not vocabulary.

### S3: Form-to-lemma map and frequency folding
**Covers:** G8
**Files:** `tools/packs/frequency.ts` (new)
**Description:** Build a form→lemma map from the `form_of` senses and the lemma
`forms` arrays, then fold each inflected form's frequency count into its lemma.
Emit a lemma-ranked list.
**Rationale:** The frequency lists are raw subtitle tokens, so `casa` and `casas`
rank separately. Ranking unfolded counts systematically under-ranks exactly the
common nouns and verbs that belong in `Basic`, and that error would propagate
into every quick-created deck.

### S4: Difficulty banding
**Covers:** G8
**Files:** `tools/packs/difficulty.ts` (new)
**Description:** Band by folded lemma rank into `basic` / `common` / `advanced`,
with a register or domain label — `archaic`, `rare`, `colloquial`, `poetic` —
promoting a sense to `niche`. Rank cutoffs live as constants in one place.
**Rationale:** The framework calls the tiers deliberately approximate and expects
tuning against real data. `niche` may come out legitimately empty in a
frequency-selected pack.

### S5: Context-tag normalization
**Covers:** G9
**Files:** `tools/packs/topics.ts` (new)
**Description:** Map kaikki `topics` onto a small controlled vocabulary shared by
every language, defined as one table here. Unmappable topics are dropped rather
than passed through. The build reports how many selected entries received a tag.
**Rationale:** Only **10.2%** of studiable senses carry a topic, across **256**
distinct names of which **42** cover 80% of uses — so the mapping is over names,
not words, and is bounded. The coverage report exists because the decision to
keep this axis should be made on the real number for the selected words, not the
corpus average. Tags are not part of the key, so the whole axis stays reversible:
a later build may add or drop them without disturbing progress.

### S6: Sense selection and the cap
**Covers:** G2, G7
**Files:** `tools/packs/senses.ts` (new)
**Description:** Group candidates by `(term, POS)` and keep **at most 3**.
Pruning order: senses labelled rare, archaic, obsolete or dialectal go first,
then truncate by source order. Record every drop for the sense-cap report.
**Rationale:** Real shape from the sample — `banco` (noun) has four senses: bank,
bench, pew, school of fish. The cap drops "school of fish". About 8.5% of nouns
exceed three senses, so this bites on a real minority rather than routinely.

### S7: Gender and article
**Covers:** G10
**Files:** `tools/packs/gender.ts` (new)
**Description:** Read gender from the sense's `tags` array — `masculine`,
`feminine`, `neuter` — mapping onto the app's `m` / `f` / `n` / `mf`. Never infer
from word endings. Carry an explicit `article` only for the small set where it
does not follow from gender, from a table here.
**Rationale:** Confirmed in the sample: every `banco` noun sense carries
`tags: ["masculine"]`. Inferring from endings gets `el agua` wrong, and the
article is part of the typed answer.

### S8: Sequence tagging
**Covers:** G11
**Files:** `tools/packs/sequence.ts` (new)
**Description:** Tag ordered paradigms — numbers, weekdays, months, ordinals —
with a group and an ordinal position, from an explicit per-language list.
**Rationale:** Small, closed and knowable per language. Detecting them from the
source would be less reliable than naming them, and capturing the order now is
free where reconstructing it later means redoing the tagging by hand.

### S9: The registry
**Covers:** G3, G4, G5, G18, G19
**Files:** `tools/packs/registry.ts` (new), `packs/registry.json` (new, committed)
**Description:** The heart of the pipeline. Each record holds the key, its
`(language, term, POS, ordinal)` parts, and the **normalized gloss set** that
identified the sense when the key was minted. For each incoming sense, match
against registered records for the same `(language, term, POS)` by **gloss-set
overlap above a threshold**: the best match reuses its key, anything else mints
the next unused ordinal. Never renumber, never regenerate, never reuse a retired
ordinal.

Two hard failures, not warnings: **two incoming senses matching one registered
record**, and **a previously-registered key that would be orphaned**. Both abort
the build unless `--allow-churn` is passed explicitly.
**Rationale:** The key is the join between the replaceable dictionary and the
irreplaceable progress — `db.progress` is keyed `[wordKey+vectorId]`, deck
membership is an array of word keys, and `install.ts` deliberately never touches
progress. Three parts of the key are inherent to the word; only the ordinal is
assigned, so only the ordinal can drift. Matching on exact gloss text would mint
a fresh key the moment an editor reworded a gloss, silently detaching months of
study onto a different meaning; set overlap survives rewording. Failing loudly is
what converts an undetectable runtime corruption into an obvious build-time stop
on a developer machine.

### S10: Tatoeba ingest
**Covers:** G12
**Files:** `tools/packs/tatoeba.ts` (new)
**Description:** Read the per-language sentence export and its English links,
producing target sentences with English translations, each keyed by Tatoeba's
stable sentence id. Index by contained term for S11.
**Rationale:** The sentence id is what makes per-example attribution possible,
which Always-5 requires.

### S11: Example assembly
**Covers:** G12, G14
**Files:** `tools/packs/examples.ts` (new)
**Description:** Pool Wiktionary's own usage examples with Tatoeba matches:
prefer two, allow more, accept fewer, and **never drop an entry for having none**.
Every example carries its source id. Sentences are duplicated across entries
rather than normalized into a shared collection. Nothing is generated.
**Rationale:** Only 13% of senses carry a Wiktionary example, so Tatoeba does
most of the work and the pooling is load-bearing rather than a refinement.
Normalizing would require knowing which words a sentence contains, and Vietnamese
compounds make whitespace segmentation unreliable — a wrong sentence-to-word link
is a silent defect the user cannot diagnose, while duplication costs a few MB.

### S12: Core pack emit
**Covers:** G1, G20
**Files:** `tools/packs/emit-core.ts` (new)
**Description:** Write the core layer as `CorePack`: schema version, pack
version, language, and entries carrying key, term, part of speech, difficulty,
context tags, sequence, gender, article and target-language examples. **No
indexes**, no meanings.
**Rationale:** `architecture.md` D4 has the app build indexes at install and
`pack-format.ts` has no field to carry one. The framework's contrary line was
reconciled on 2026-08-23.

### S13: Meaning layer emit
**Covers:** G1
**Files:** `tools/packs/emit-meaning.ts` (new)
**Description:** Write the meaning layer as `MeaningPack`: English meanings per
key, and example translations keyed by the core layer's example ids. No synonyms.
**Rationale:** The app derives synonyms from the meanings index at query time
(`queries.ts`), so shipping them would be a second source of truth. Keeping the
layers separate costs nothing now and is what a second base language needs;
building the seam later means re-cutting every pack.

### S14: Manifest and licensing
**Covers:** G16, G17
**Files:** `tools/packs/manifest.ts` (new)
**Description:** Emit language, pack version, schema version, entry count, build
date, the **pinned source dump dates**, every source with its licence, and the
report summaries. Declare the pack **CC BY-SA**.
**Rationale:** The sources are share-alike, so the derived pack must be too.
`framework.md`'s licensing section makes this an obligation, not a courtesy, and
it is not relaxed by the app being free.

### S15: Build reports
**Covers:** G15
**Files:** `tools/packs/reports.ts` (new)
**Description:** Emit five reports per build — homographs, sense cap, example
coverage, source coverage, and **key churn** (minted, matched, orphaned) —
written beside the pack and summarized to stdout.
**Rationale:** Key churn is an addition to the framework's four. Every other
report describes pack quality; this one describes whether anyone's progress just
moved, which is the only failure here a user can neither see nor recover from.

### S16: Conformance gate
**Covers:** G6, G14
**Files:** `tools/packs/verify.ts` (new)
**Description:** Before writing, run the app's own `validateCoreEntries` and
`validateMeaningEntries` over the generated entries and fail on any rejection,
naming them. Assert every key parses to `lang:term:pos:ordinal`, and that every
meaning-layer key exists in the core layer.
**Rationale:** Makes the app the arbiter of its own input. A pack that would lose
entries at install never gets written.

### S17: Swap the seed fixtures
**Covers:** G1
**Files:** `public/packs/` (replaced), `src/dictionary/catalog.ts`
**Description:** Write the generated packs into `public/packs/`, update the
catalogue to point at them and drop `provisional: true`. Delete the four
`*.seed.json` fixtures.
**Rationale:** Closes open point O3 in `study-loop.plan.md`, which named exactly
this swap-in point. The fixtures are labelled "TEST FIXTURE — not sourced data"
and their Vietnamese tones were authored, so they must not survive into a build
anyone studies from.

---

## Helper steps

### H1: Toolchain scaffold
**Justification:** Nothing runs without it, and it is where the compile-time
conformance guarantee is actually established.
**Files:** `tools/packs/main.ts` (new), `tsconfig.json`, `package.json`,
`.gitignore`
**Description:** A CLI with `fetch`, `build <language>` and `report`
subcommands, run through `tsx`. Add `tools/**/*.ts` to the tsconfig `include` —
without it `npm run check` never sees the generator and the shared-types
guarantee is hollow. Add `dumps/` to `.gitignore`, and npm scripts for each
subcommand.

### H2: Pipeline tests
**Justification:** The registry decides whether a user keeps their progress, and
that is not observable by reading the code. Every case below is a way a rebuild
could silently move a key; each one gets a test that names it.
**Files:** `tools/packs/registry.test.ts` (new),
`tools/packs/frequency.test.ts` (new), `tools/packs/senses.test.ts` (new)

**Description:** The registry suite works against a fixed build-1 registry for
`banco` — `:1` bank, `:2` bench, `:3` pew — and feeds it a mutated build-2 source
for each case:

| Case | Build-2 source | Required outcome |
|---|---|---|
| **Gloss reworded** | `"bank (financial institution)"` → `"a financial institution"` | `:1` reused. The single most likely real change. |
| **Sense inserted first** | `"sandbank"` added at position 0 | `:1`–`:3` unchanged, sandbank mints `:4`. The case a naive index scheme gets wrong. |
| **Senses reordered** | bench, pew, bank | all three keys unchanged |
| **Sense removed** | pew deleted | build **fails** — `:3` would be orphaned |
| **Two senses merged** | bank and bench collapse to one gloss set matching both | build **fails** — two records matched by one sense |
| **One sense split** | bench becomes "bench" and "bench (sports)" | one reuses `:2`, the other mints `:4`; never both on `:2` |
| **Term recased or re-accented** | `Banco` | matches `banco` — the key's term is normalized |
| **Part of speech changes** | noun → verb | mints a new key; the noun key orphans and the build fails |
| **Retired ordinal** | after `:2` orphans and is allowed through | `:2` is never handed to a different sense |
| **Empty registry** | first build | every key minted, reported as first-build rather than churn |

Each failing case must also assert **nothing was written** — no pack file, no
registry mutation — since a half-written registry is itself the corruption.

Frequency — inflected counts fold into the lemma, and a form with no lemma is
counted once rather than dropped. Senses — the cap keeps three and prunes
labelled senses before truncating by order.

---

## Technical notes

Added during implementation, each forced by real data rather than chosen.

- **T1 (H1) — no `tsx`.** Node is v24 and `vite-node` was already present via
  vitest, so it is declared explicitly instead. Vite-identical resolution means
  the extensionless imports in `src/` work unchanged. `tools/**` was added to
  both the tsconfig `include` and the vitest `include`.
- **T2 (S9) — two similarity metrics, not one.** Jaccard answers "are these the
  same sense?"; containment answers "does this one swallow that one?". A merged
  gloss absorbing a short one scores 0.2 by Jaccard purely on size mismatch and
  1.0 by containment, so merge detection needs the second metric.
- **T3 (S9) — stopwords are dropped only when something survives.** Spanish `a`
  has senses glossed exactly "to", "by", "at". Filtering those to nothing made
  every such sense look identical, so they were flagged ambiguous on a first
  build and orphaned on every rebuild after it.
- **T4 (S9) — merges are diagnosed after assignment, not before.** Checking "did
  a sense match two records" up front reported 857 false merges on a 42 MB
  sample, because two senses of one word are often merely similar and greedy
  assignment had already paired them correctly. Only a record left unassigned is
  in danger.
- **T5 (S9) — orphan detection is scoped to the languages being built.** The
  registry is shared; builds are per language. Without scoping, the first
  Spanish build declared all 3,000 Vietnamese keys orphaned and refused to run.
- **T6 (S6) — identical senses are collapsed before the registry sees them.**
  Wiktionary really does gloss one sense twice (`absolutismo` → "absolutism"
  twice; 73 words in the sample). For genuinely identical senses this is
  assembly, not the framework's "fails loudly" case.
- **T7 (S11) — corpus examples attach only to the FIRST sense of a (term, POS).**
  Tatoeba matches by term but entries are per sense, so every sense of a
  polysemous word was getting the same sentences. Observed: `vi:bàn:noun:2`
  ("game; match") illustrated with "Place the deck of cards on the oaken table".
  Restricting to the primary sense leans on the framework's existing rule that
  Wiktionary's editorial sense order stands in for sense frequency. Cost:
  Vietnamese two-example coverage fell 98% → 67%, which is the honest figure.
- **T8 (S10) — the corpus is indexed by lemma as well as surface form**, using
  S3's form map. Spanish sentences contain `hablo`, never `hablar`, so surface
  indexing alone found examples for 51% of Spanish entries against 67% of
  Vietnamese ones — not for want of sentences but because Vietnamese is analytic.
- **T9 (S10) — a fourth Tatoeba source.** The per-language links export carries
  translation IDs, not text, so `eng_sentences.tsv.bz2` is fetched once and
  shared across languages.
- **T10 (S17) — `pack-loader.test.ts` was rewritten against the generated
  packs.** It asserted fixture specifics (exactly 20 entries, `banco` meaning
  bank and bench). It now asserts the properties the study loop depends on —
  homographs exist, the sense cap holds, gender is sourced, `área` overrides to
  `el`, entries with no examples still ship — which survive a source refresh.

## Assumptions

- **kaikki, Tatoeba and the frequency list stay available at stable URLs.** If
  one moves, `fetch` fails loudly and the lock records what was expected.
- **English is the only base language built.** The two-layer split is honoured in
  the format, but only one meaning layer is produced.
- **Spanish and Vietnamese only**, at roughly 5,000 and 3,000 entries. Adding a
  language is a lockfile entry plus a sequence list, not new code.
- **The build runs on a developer machine, not in CI.** It needs ~1 GB of cached
  input and takes minutes; nothing about it is interactive or scheduled.
- **The registry starts empty.** The first build mints every key, which is
  correct and reported as such rather than treated as churn.
- **Wiktionary's sense order is editorial and may change between dumps** — new
  senses are filed where they fit semantically, not appended. This is the
  assumption the registry exists to absorb.

## Out of scope

- **The attributions screen** — app-side, required before a real pack ships, but
  a different codebase area. Its own follow-up plan.
- **User-supplied packs.** Packs stay build-bundled in v1.
- **A second base language**, and any UI for choosing one.
- **Pack compression in IndexedDB.** ~10 MB is affordable, and inflation costs
  latency at exactly the wrong moment.
- **Sense-frequency weighting** — which meaning of a word is most common. The
  data does not exist for either language; Wiktionary's editorial sense order
  stands in for it.
- **Regenerating the registry**, under any circumstance.

## Acceptance criteria

- **G1 satisfied when:** core and meaning layers are written separately, and the
  core installs identically whichever meaning layer accompanies it.
- **G2 satisfied when:** `banco` yields separate entries for *bank* and *bench*,
  while `casa` yields one entry accepting both *house* and *home*.
- **G3 satisfied when:** every emitted key is `lang:term:pos:ordinal` and appears
  in the registry.
- **G4 satisfied when:** the registry is committed, never rewritten wholesale,
  and absent from every build output.
- **G5 satisfied when:** no key contains a gender, tag, meaning or difficulty.
- **G6 satisfied when:** an entry lacking a term, a meaning or a part of speech is
  absent from the pack and counted in a report.
- **G7 satisfied when:** no `(term, POS)` has more than three entries, and `banco`
  keeps bank, bench and pew.
- **G8 satisfied when:** `casa` ranks by the summed frequency of its inflected
  forms, not by the count of the bare form.
- **G9 satisfied when:** every emitted context tag is in the controlled
  vocabulary and means the same thing in both languages.
- **G10 satisfied when:** `agua` carries feminine gender **and** an explicit `el`
  article.
- **G11 satisfied when:** numbers carry a sequence group and ordinal and are
  absent from a quick-created deck.
- **G12 satisfied when:** entries with no example still ship, every example
  carries a source id, and coverage is reported per language.
- **G14 satisfied when:** no meaning or sentence in a pack is absent from its
  source.
- **G15 satisfied when:** all five reports are emitted, and a build that would
  orphan a key stops without writing.
- **G16 satisfied when:** the manifest names both dump dates and every source
  licence.
- **G17 satisfied when:** the manifest declares the pack CC BY-SA.
- **G18 satisfied when:** rebuilding after adding words leaves every previously
  emitted key unchanged.
- **G19 satisfied when:** a deliberately duplicated sense fails the build by name.
- **G20 satisfied when:** no emitted pack contains an index structure.
