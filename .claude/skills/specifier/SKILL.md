---
name: specifier
description: Turn a feature's design framework into a single, implementation-ready plan — the merged specify-and-plan step of the pipeline. Use this skill when the user signals they want to specify or start building a feature; triggers include "I want to implement a new feature", "let's add", "I need a feature for", "let's spec out", "spec this". It reads the explorer's framework (plus the architect's architecture and complexity ceiling), works out HOW to achieve the framework's goals, and probes the design technically — what happens when illegal or malformed actions hit a system, ordering and partial-failure cases, and gaps where the explored goal isn't yet achievable. It asks only valid, non-obvious questions, and raises cross-feature concerns only when critical or contradictory. Output is one flat file, name.plan.md, next to CLAUDE.md, consumed directly by the implementer; no separate spec file and no feature folder. Routes Unity vs generic internally, and owns re-planning when reviewer findings return.
---

## Always: read and respect CLAUDE.md

At the **start of every run**, read `CLAUDE.md` fresh from disk. Do not rely
on memory, a session summary, or an earlier read — it may hold coding
guidelines, behavioral rules, or project conventions that changed mid-project.

Treat everything in it as **additive**: its rules apply on top of this skill's
instructions, they don't replace them. If a CLAUDE.md rule appears to
**directly conflict** with a skill instruction, surface the conflict to the
user and let them choose — don't silently pick one.

# Specifier

This skill is the merged specify-and-plan step of the pipeline:

explore → architect → **specify** → implement → review

The explorer already produced the design (`<feature>.framework.md`) and the
architect the standing guidelines and complexity ceiling
(`<feature>.architecture.md`, or the project-wide files). Specification is
therefore **partly done** before this skill runs. Its job is not to re-design
the feature but to work out **how to achieve the framework's goals in code**,
pry into the design for technical problems, close the gaps the framework left,
and emit a single implementation-ready plan.

It produces exactly one artifact: **`<feature>.plan.md`**, written flat next to
`CLAUDE.md` — the same layer and base name as the framework and architecture
files. There is **no separate spec file and no feature folder.** The plan is
what the implementer consumes and the reviewer checks against.

## When this skill runs

Triggers on the user's signal to specify or start building a feature:

- "I want to implement a new feature for the auth flow."
- "Let's add a rate-limiter to the API."
- "I need a feature for offline sync."
- "Let's spec out the inventory bulk-import."

Does **not** trigger on: casual mentions in passing; questions about existing
functionality; requests to plan/implement/review once a plan already exists
(that's the implementer's cue); requests to *explore* or *architect* (those are
the earlier skills).

## Inputs (read first)

Before anything else, read what already exists next to `CLAUDE.md`:

1. **`<feature>.framework.md`** (and the project-wide `framework.md`). The
   design this plan must realize — intent, scope, design, decided edge cases,
   boundaries and invariants, and its own open questions. **Reuse its base
   name** for the plan so the trio shares one prefix.
2. **`<feature>.architecture.md`** (and the project-wide `architecture.md`).
   The standing guidelines, structure, decisions, and the **complexity target
   (1–5)**. The plan must stay inside these and at or under that ceiling.
3. **`CLAUDE.md`** — project conventions and the `## Project Context` language.

**Degrade gracefully.** If no framework exists (exploration was skipped), say
so and recommend running the explorer first; if the user wants to proceed
anyway, elicit the minimum design yourself (happy path + boundaries) before
planning. If no architecture exists, plan without it but don't invent
guidelines. Never guess the language from file extensions — read Project
Context.

## Routing: Unity vs generic (internal)

This is one skill; it routes internally. Detection changes only **which
standard patterns and idioms you probe and propose**, never the procedure.

Read `CLAUDE.md`'s `## Project Context`, and check for an `Assets/` or
`ProjectSettings/` folder or `.unity` files.

- **Unity / game** → probe and plan in Unity idioms: MonoBehaviour vs plain-C#
  boundaries, ScriptableObject data/config, component composition, scene/prefab
  wiring, update-loop and lifecycle order, save/load.
- **App / service / generic** → layering, module boundaries, API surface,
  persistence and data-access, sync/async, error posture.

If there is **no `## Project Context`** yet, this is a first run: ask the user
the language/stack (batched with Phase 1) and record it to `## Project
Context` (confirm before writing — see `references/project-context-section.md`).

## Project-knowledge policy

Reading files costs tokens. Read only what's needed: what's already in context,
then the framework/architecture, then the user's input, then **targeted** reads
of an existing system the feature explicitly touches. Never sweep the whole
project. Default to less reading, more asking.

## Procedure

### Phase 1 — Catch context & fix the name

Identify the domain and whether this is a new feature, an extension, or an
update. Look on the same layer as `CLAUDE.md` for a matching
`<feature>.framework.md`; if found, adopt its base name. If none, propose a
filesystem-friendly base name (kebab-case by default, or the project's
convention) and show the user the exact filenames that will result
(`<name>.plan.md`, and versioned `<name>.plan.vN.md`). Wait for confirmation of
the name. **Create nothing yet.** Apply the `### Specifier` CLAUDE.md rules
(see below) before continuing.

### Phase 2 — Ground in the framework

Read the framework and enumerate the **goals** the plan must achieve — one per
framework design behavior, decided edge case, and invariant. Number them
locally (G1, G2, …) so the coverage map and self-check can reference them.
These replace re-eliciting the design: the framework is the source of truth for
*what*; this skill owns *how*.

### Phase 3 — Technical probing (the heart of this skill)

Pry into the design for what the framework's happy-path view leaves implicit.
Two lenses, probed in batches (see `references/technical-probing-checklist.md`):

1. **Technical failure modes the design implies.** For every system that
   accepts input or actions, ask what happens on the *illegal* ones — an action
   that isn't valid for the current state passed into an action handler,
   malformed or out-of-range input, an operation triggered mid-transaction,
   two conflicting operations at once, ordering and timing, partial failure and
   what state survives it. The framework decided *business* error cases; this
   skill decides the *technical* handling.
2. **Gaps in the explored system.** Where the framework's goal isn't actually
   achievable as written, ask the pointed question that closes it — a missing
   input the design assumes, an undefined transition, a resource whose lifetime
   nobody specified. Make sure the explored goal can be reached *in completion*.

Two firm guardrails:

- **Only valid, non-obvious questions.** Don't manufacture questions to look
  thorough. If the answer is obvious from the framework or the user's words,
  don't ask. A question earns its place only if a wrong default would produce
  wrong code.
- **Cross-feature / cross-framework concerns only when critical or
  contradictory.** Interactions with other features or frameworks were the
  explorer's job. Raise one here only if it's a genuine contradiction or a
  critical blocker; otherwise assume exploration handled it and move on.

If a gap turns out to be a **design** hole rather than a technical one (the
framework's intent itself is under-decided), don't invent design — surface it
and offer to send it back to exploration.

Frame probes as completeness ("I want to make sure we've decided X"), not
gotchas. Capture every "that won't happen" as an explicit **assumption** for the
plan, so the implementer and reviewer don't over-engineer for it.

### Phase 4 — Fit the architecture and the complexity ceiling

Resolve the framework's open questions and your technical decisions **within**
`<feature>.architecture.md`: no forbidden patterns, placement follows its
Structure section, dependencies point the way it says. Hold every decision at or
under the **complexity target** — prefer the simplest approach that meets the
framework; reach past the ceiling only with the user's explicit say-so. If
meeting the framework cleanly seems to require breaking an architecture
guideline or exceeding the ceiling, surface it and let the user choose
(adjust the plan, or amend the architecture) — never resolve it silently.

### Phase 5 — Draft the plan

Write to a **draft location first**: `/tmp/<feature>.plan.draft.md`. Follow
`references/plan-format.md`. Every goal G1, G2, … maps to at least one concrete
step; steps that don't trace to a goal are marked **helpers** with a
justification. No feature folder is created at this stage.

### Phase 6 — Framework-coverage self-check (≤ 3 iterations)

Verify the draft covers the framework. Every goal must appear in at least one
step (or be an explicit assumption); every step must tie to a goal or be a
justified helper; every plan decision must sit inside the architecture and at
or under the complexity ceiling. Fix gaps and re-check, up to **3 iterations**.

- Passes → proceed to review.
- Gap caused by framework/spec ambiguity (you'd be guessing) → return to
  Phase 3 for another batched question round. **This does not consume an
  iteration.**
- Genuine plan inadequacy after 3 iterations → stop and report the specific
  gaps to the user rather than shipping a plan you don't believe in.

### Phase 7 — User review & sign-off

Show the draft. Ask explicitly whether it captures how to build the feature and
whether anything is missing, wrong, or out of scope. Iterate in `/tmp` each
round. Do not finalize until the user signs off unambiguously ("looks good",
"go ahead"); "sure"/"fine" count, vague replies don't.

### Phase 8 — Finalize & hand off

On sign-off:

1. Write the draft to **`<feature>.plan.md`**, flat next to `CLAUDE.md`.
2. Delete the `/tmp` draft. Create no folder.
3. Tell the user it's ready and ask to build next:

Created <feature>.plan.md. Ready to implement — say "implement <feature>" (or
"kick off the build") when you want to start, or "implement normally" to skip
orchestration.

## Re-planning (when reviewer findings come back)

This skill also owns revision, the role the standalone planner used to play. On
a re-plan call with reviewer findings:

1. **Version the current plan on the same layer** — rename `<feature>.plan.md`
   to `<feature>.plan.v<N>.md` (N = the iteration that produced it). No version
   folder; the versioned files sit beside the live one. The implementer reads
   only `<feature>.plan.md`.
2. For each finding, decide **accept** (revise to fix), **dispute** (you have a
   substantive reason it's wrong), or **out of scope** (real, but expands beyond
   the framework — escalate to the user; don't expand scope unilaterally).
3. If any are disputed, don't override the reviewer — write
   `<feature>.disputed-findings.md` (flat; see `references/dispute-format.md`).
   One dispute round, then accept-or-escalate.
4. Write the new full `<feature>.plan.md` (a whole plan, not a patch) with a
   "Changes from previous iteration" section, then re-run the Phase 6
   self-check.

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of
`CLAUDE.md` and find the `### Specifier` subsection (create it, with user
confirmation, if the section exists but the subsection doesn't). Apply its
rules on top of this procedure. Because this skill now covers both
specification and planning, plan-related rules (step granularity, rationale-note
verbosity, self-check strictness) live in the `### Specifier` subsection too.
See `references/claude-md-behavior-section.md`.

If an in-session steer should become a standing rule, don't absorb it silently —
propose the wording, show the diff, and write on confirmation.

## Reference files

- `references/plan-format.md` — the structure of `<feature>.plan.md`.
- `references/technical-probing-checklist.md` — prompts for technical failure-mode and gap probing.
- `references/dispute-format.md` — the structure of `<feature>.disputed-findings.md`.
- `references/project-context-section.md` — the `## Project Context` format and first-run write.
- `references/claude-md-behavior-section.md` — how the Skill Behaviors mechanism works.
