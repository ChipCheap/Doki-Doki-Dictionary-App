# Plan: attributions

**Outer iteration:** 1
**Realizes framework:** `ui.framework.md` (screen table + menu placement) and
`framework.md`'s "Licensing position"
**Within architecture:** `architecture.md`, complexity target **2 (simple)**
**Previous version:** none — first iteration

The last blocker before v1 can ship publicly. The packs are CC BY-SA derived
from four attribution-bearing sources and nothing in the app says so. Slice 1
deferred this screen only because the seed pack "derives from nothing"; that
reason expired when the generated packs landed.

---

## Framework coverage map

| Framework goal | Plan steps |
|---|---|
| G1: An attributions screen, behind the one menu off Home, never mid-session | S5, S6 |
| G2: Every source of every installed pack — name, licence, URL — grouped per language | S4, S5 |
| G3: Each pack's own licence and the share-alike consequence stated | S5 |
| G4: Works offline — no network fetch | S1, S4 |
| G5: Sources come from the pack itself, so a new pack is covered without code changes | S1 |
| G6: A pack whose sources were never recorded is never presented as attributed | S2, S3 |
| G7: One source listed once, however many files it supplied | S4 |
| G8: Renders honestly with no pack installed | S5 |
| G9: The application's own licence is stated alongside the data's | S5, S7, H1 |
| G10: No screen touches storage directly | S4 |

---

## Plan steps

### S1: Persist a pack's sources at install
**Covers:** G4, G5
**Files:** `src/dictionary/schema.ts`, `src/dictionary/install.ts`
**Description:** Add `sources: { name, licence, url }[]` to `InstalledPack` and
write `core.sources` into the row `installPack` already puts. `installPack`
receives the whole `CorePack`, so this is the value arriving unused today.
**Rationale:** Attribution has to survive offline, and the manifests in
`public/packs/` are excluded from the service-worker precache
(`globIgnores: ['**/packs/**']`) — a screen that fetched them would be blank
exactly when a PWA still owes the obligation. Taking the list from the pack
rather than hard-coding it also means a pack built later, for a language nobody
has added yet, attributes itself with no code change. Dexie stores whole
objects, so a non-indexed field needs no schema version of its own.

### S2: Version 4 — reinstall packs installed before this
**Covers:** G6
**Files:** `src/database.ts`
**Description:** A version 4 upgrade that clears `ready` on any `packs` row with
no `sources`. `listInstalledPacks` filters on `ready`, so such a pack reads as
absent and the existing install flow rebuilds it — the same self-correcting path
`install.ts` already relies on for a half-written install.
**Rationale:** Cumulative and non-destructive, per guideline 7: it touches only
the ready flag, and progress rows are never involved. Showing a language with no
attribution would be the same failure as having no screen at all, so the pack is
repaired rather than displayed incomplete. The cost is rewriting ~10,000 rows
once.

### S3: Repair notice on Home
**Covers:** G6
**Files:** `src/ui/routes/Home.svelte`
**Description:** Where a language has decks but no ready pack, show a line
naming it and a button into the install flow. Sits above the deck list, not
inside a language section — the section itself will not render, because Home
iterates installed packs.
**Rationale:** Without this, S2 is alarming rather than corrective: Home renders
one section per *installed* pack, so a cleared `ready` flag makes the language
and all its decks vanish with no explanation, and the only route back is the
"Add a language" list, which reads as *add* rather than *repair*. The user's
progress is intact throughout; nothing but the display is affected.

### S4: The attribution query
**Covers:** G2, G7, G10
**Files:** `src/dictionary/queries.ts`
**Description:** `listAttributions()` returning one entry per installed pack —
language, language name, pack version, pack licence, and its sources with
duplicates collapsed on `name` + `licence`.
**Rationale:** Deduplication is not cosmetic: Tatoeba supplies three files
(sentences, links, the English corpus) and so appears three times in every
pack's source list. Listing it three times would suggest three different
obligations. The query lives in `dictionary` because the screen may not touch
storage directly (guideline 2).

### S5: The screen
**Covers:** G1, G2, G3, G8, G9
**Files:** `src/ui/routes/Attributions.svelte` (new)
**Description:** Per installed language: the pack's own licence, then each
source with its name, licence and URL as readable text. Above them, a short
statement that the packs are derived works distributed under CC BY-SA and may be
redistributed under the same terms. Below, the application's own licence —
**GPL-3.0** — which is a different thing from the data's. With no pack installed, the app licence
and an explanatory line still render.
**Rationale:** URLs are written out rather than hidden behind link text so they
still mean something with no network. The app licence sits alongside because
declaring the packs CC BY-SA while saying nothing about the program displaying
them reads as an oversight — and the two genuinely differ: a pack shipped
alongside an app is a Collection, not an Adaptation, so the share-alike does not
reach the code.

### S6: Route and menu entry
**Covers:** G1
**Files:** `src/ui/router.svelte.ts`, `src/ui/App.svelte`,
`src/ui/routes/Home.svelte`
**Description:** Add an `attributions` route and an "Attributions" button in
Home's top menu, beside Settings, Backup, Snapshots and Keyboard.
**Rationale:** `ui.framework.md` fixes this: settings, export/import,
attributions and keyboard help sit behind one menu off Home, and none is
reachable mid-session.

### S7: The repository licence
**Covers:** G9
**Files:** `LICENSE` (new), `package.json`, `README.md`
**Description:** Add the GPL-3.0 text as `LICENSE`, set `"license": "GPL-3.0-or-later"`
in `package.json`, and state the split in the README: the application is
GPL-3.0, the generated packs are CC BY-SA 4.0.
**Rationale:** Without a licence file, code is all-rights-reserved by default —
public on GitHub does not mean reusable, and a screen claiming GPL against a
repo that grants nothing would be worse than saying nothing. GPL was chosen for
what it actually does: derivatives stay open. It does not forbid commercial use,
and forbidding it would in any case be stricter than the CC BY-SA sources this
project is built on, none of which carry a NonCommercial term.

The two licences do not conflict: a pack shipped alongside the app is a
Collection, not an Adaptation, so the data's share-alike never reaches the code.

---

## Helper steps

### H1: Tests
**Justification:** The obligation is legal, so "the screen renders" is not
enough — what must be pinned is that no pack can be displayed without its
sources, and that every source survives a round trip.
**Files:** `src/dictionary/install.test.ts` (new)
**Description:** A pack installs with its sources recorded; `listAttributions`
collapses Tatoeba's three files into one entry; a `packs` row written without
sources is not returned by `listInstalledPacks` after the v4 upgrade; the app
licence string is present.

---

## Assumptions

- **Every shipped pack carries `sources`.** `buildCorePack` always writes them,
  and `verify.ts` would fail a pack that lost the field.
- **A blanket per-source credit satisfies the licences.** Per-sentence Tatoeba
  IDs stay in the data — every example already carries one — rather than being
  listed on screen. Ten thousand IDs is not attribution anyone reads.
- **Linking to licence text is enough**; the full CC legal code is not bundled.
- **The screen is read-only.** Nothing here writes, so there is no partial
  failure to design for.
- **Only the dev has a pre-v4 install.** The v4 reinstall path is written to be
  correct regardless, but nobody outside this machine is affected.

## Out of scope

- **Showing an example's source on the card.** The data supports it; the
  framework does not ask for it and the result panel is already dense.
- **Bundling full licence texts.** A name and a URL is the norm.
- **Per-source attribution in an exported profile.** Exports carry progress, not
  dictionary content.

## Acceptance criteria

- **G1 satisfied when:** Attributions is reachable from Home's menu and from
  nowhere inside a session.
- **G2 satisfied when:** every installed language lists every source that built
  it, each with a licence and a URL.
- **G3 satisfied when:** the screen states the packs are CC BY-SA and may be
  redistributed on the same terms.
- **G4 satisfied when:** the screen is complete with the network disabled.
- **G5 satisfied when:** installing a pack for a language the app has never seen
  attributes it with no code change.
- **G6 satisfied when:** a `packs` row lacking sources is absent from Home,
  named in the repair notice, and restored by reinstalling.
- **G7 satisfied when:** Tatoeba appears once per language, not three times.
- **G8 satisfied when:** the screen renders with no pack installed.
- **G9 satisfied when:** the screen names GPL-3.0 for the application and
  CC BY-SA for the packs, and a `LICENSE` file carrying the GPL text exists.
- **G10 satisfied when:** `Attributions.svelte` imports nothing from `database`.
