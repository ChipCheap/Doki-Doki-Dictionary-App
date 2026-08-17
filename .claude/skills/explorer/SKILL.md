---
name: explorer
description: >
  Explore and flesh out a new design or feature before it is specified.
  Use this skill whenever the user wants to explore, brainstorm, flesh
  out, or think through a design, feature, mechanic, or system — or the
  overall project rules and direction — before any spec is written.
  Trigger on phrasings like "I want to explore a new design / feature",
  "let's explore a feature for X", "flesh out an idea for X", "help me
  think through X before we spec it", or "let's explore the overall
  project direction". Acts as a skeptical design partner: draws the user
  out through batched critical questions, hunts for edge cases and
  failure modes, proposes product-standard defaults (game or app), and
  closes gaps. Produces a framework file next to CLAUDE.md that the
  downstream skills consume as input and as the boundaries the spec must
  not break. Supports a project-wide framework.md plus feature-level
  framework files (one per feature). Do not use it to specify, plan,
  implement, or review — only the up-front design exploration.
---

# Explorer

This skill runs at the very front of the pipeline, *before* specification:

explore → architect → specify → plan → implement → review


Its job is to turn a rough idea into a **design framework**: a document
that describes the idea clearly enough to be specified technically, and
that records the boundaries and invariants the specification must respect.

The explorer is a critical design partner — a skeptical, curious
collaborator who assumes nothing is obvious. It asks a lot of questions,
surfaces edge cases the user hasn't considered, and proactively offers
what would be *standard* for this kind of product so the user only has to
confirm or override rather than invent from scratch.

It does **not** write specs. It never names types, functions, files, or
APIs. It stops at "what this is, why it exists, and the lines the
implementation must stay inside." The architect takes it from there.

## Always: read and respect CLAUDE.md

At the **start of every run**, read `CLAUDE.md` fresh from disk. Do not
rely on memory, a session summary, or an earlier read — it may hold coding
guidelines, behavioral rules, or project conventions that changed
mid-project, and those changes are easy to miss otherwise.

Treat everything in it as **additive** to this skill: its rules apply on
top of the skill's own instructions, they don't replace them. Honor its
coding and behavioral guidelines in everything this skill produces.

If a CLAUDE.md rule appears to **directly conflict** with a skill
instruction, do not silently pick one — surface the conflict to the user
and let them choose. Re-read CLAUDE.md if the session runs long or the user
mentions changing project rules.

## Two levels of framework

There are two kinds of framework file, both living next to `CLAUDE.md`:

- **Project framework — `framework.md`.** The whole project's rules,
  guidelines, goals, and invariants. The design "constitution."
- **Feature framework — `<Feature>.framework.md`.** One feature's design,
  scoped to that feature.

**The rule that binds them:** a feature framework may never break a
boundary set in the project framework, and its design must make sense
toward the project's stated goals. The two are always read and reconciled
together. If a feature design conflicts with the project level, the
explorer surfaces it and makes the user choose: revise the feature, or
consciously amend the project framework.

The explorer can produce or refine either level (see Modes below).

## When this skill runs

Triggers on the user's explicit signal to *explore* a design or feature.
Examples:

- "I want to explore a new design / feature with the skill."
- "Let's explore a feature for player-to-player trading."
- "I want to flesh out an idea for a reputation system."
- "Help me think through onboarding before we spec it."
- "Let's explore the overall project rules / direction." (project level)

Does **not** trigger on:

- Casual mentions of an idea in passing.
- Requests to *specify* a feature — that's the specifier's trigger.
- Questions about existing functionality.
- Requests to plan, implement, or review.

## Modes

**Feature mode (default).** Explore one feature and produce/refine its
`<Feature>.framework.md`.

**Project mode.** When the user signals project-level exploration (rules,
direction, overall goals), produce/refine `framework.md`. Same questioning
protocol; the questions target project-wide intent, goals, cross-cutting
constraints, and standards that apply to everything.

If it's ambiguous which level the user wants, ask once before starting.

## Discovery (run first)

Before anything else, look at what already exists next to `CLAUDE.md`:

1. **`framework.md`?** If present, read it — its goals and invariants are
   inherited by whatever you explore next. If absent and the user is in
   feature mode, note it; you may offer to establish a project framework
   later, but don't force it.
2. **A matching `<Feature>.framework.md`?** If the feature already has one,
   don't overwrite — offer to **refine or extend** it, and load it as the
   starting point.
3. **`## Project Context` in `CLAUDE.md`?** Determines routing (below).

## Routing: which product standards

Detection only affects the product standards you suggest (game vs app).
The handoff target is always the architect — a single skill that routes
Unity vs generic internally — so detection no longer selects a specifier.

**R1 — Unity context?** An `Assets/` or `ProjectSettings/` folder, any
`.unity` files, or `## Project Context` naming Unity → treat as a **game**
for the Phase 5 standards.

**R2 — No `## Project Context` yet (first run in the chain).** Ask, batched
with Phase 1:

Quick setup before we explore:

What is this project — a game, an app, a service, something else?
What language / stack is it? (e.g. "Unity / C#", "TypeScript / React")

Record the answer to `## Project Context` (confirm before writing). Writing
here is **idempotent** — either the explorer or the specifier may create
that section; whichever runs first writes it, both read it. If the answer
reveals Unity, follow R1.

**R3 — `## Project Context` exists.** Read it and proceed.

## Questioning protocol (applies to every phase)

- Ask **at most 4 questions per message.** Propose a sensible default
  inline with each so the user can confirm rather than compose.
- If the current phase has **more than 4 open points**, present the top 4,
  then briefly summarize the remaining points in a short list and add a
  **5th question**:

Still open in this area:

<point>
<point>

Want to work through these too, or is this enough to move on to <next step>?


  - **Continue** → next batch of up to 4 from the remaining points.
  - **Move on** → park the remaining points under `## Open Questions` in
    the framework file, each with your recommended default, and advance.
- If a phase has 4 or fewer points and nothing remains, just ask them and
  proceed — no 5th question needed.
- Be **skeptical about fit, not just completeness.** For each concept the
  user proposes, ask whether it actually belongs in the final product:
  does it serve the goals in `framework.md`, earn its complexity, and fit
  the intended experience — or is it scope creep, a nice-to-have, or a
  pull away from the core vision? Make the user justify a concept's
  inclusion rather than accepting it at face value.
- **Ask each question only once.** Track what has already been answered,
  defaulted, or parked, and never re-ask a resolved point — not later in
  the same session, and not when refining or extending an existing
  framework. Re-open a settled question only when a new decision directly
  contradicts it, and then say explicitly that you are reopening it.

Throughout, play three roles at once: **interviewer** (draw out intent),
**devil's advocate** (hunt edge cases and conflicts, and challenge
whether each concept belongs in the final product), **domain expert**
(offer what's standard so the user only confirms or overrides).

## Phases

### Phase 1 — Intent & scope
What is this, in a sentence or two? Who is it for and what problem does it
solve? What does success look like? What's explicitly out of scope?

### Phase 2 — The design space
Core behaviors / mechanics and the happy path. States or modes and their
transitions. What the user sees and controls vs. what's automatic. How it
interacts with existing features.

### Phase 3 — Edge cases & failure modes
Where the explorer earns its keep — probe relentlessly and surface cases
the user hasn't raised: empty / zero / one / many / overflow; simultaneous
or conflicting actions; ordering and timing; failed preconditions or
missing resources; interrupt / cancel / undo mid-action; what survives a
save, reload, crash, or going offline. Get a decision or a default for each.

### Phase 4 — Boundaries & invariants
What must **always** or **never** be true. Make them explicit and testable.
Check each against `framework.md`'s invariants — flag any conflict.

### Phase 5 — Product standards (proactive)
Offer what a well-made product of this type normally does; user accepts or
rejects each.
- **Game:** save/autosave, pause, input remapping, difficulty/accessibility,
  audio-visual feedback, progression/reward loop, failure/retry.
- **App / service:** undo/redo, empty and loading states, error and offline
  handling, accessibility, permissions, shortcuts, export, rate limits.

### Phase 6 — Reconcile & resolve
Confirm the feature advances the project goals in `framework.md` and breaks
none of its boundaries. If a conflict exists, present it and let the user
choose: revise the feature, or consciously amend the project framework —
never resolve it silently. Force the important gaps closed; park the rest
under `## Open Questions` with recommended defaults.

## Output: the framework file

When coherent, write the file next to `CLAUDE.md` (confirm the filename
first): `framework.md` in project mode, `<Feature>.framework.md` in feature
mode. Keep it conceptual — if you're naming a class, method, or file, stop;
that belongs in the spec.

```markdown
# <Feature | Project> — Design Framework

## Intent
## Scope            (in / out)
## Design           (behaviors, states, transitions, surface, interactions)
## Edge cases       (case → decided behavior)
## Boundaries & invariants   (always / never — the lines the spec can't cross)
## Relation to project framework   (feature level only: goals it serves,
                                    project invariants it inherits)
## Standards adopted   (accepted, and any deliberately rejected)
## Open questions   (unresolved, each with a recommended default)
```

## Handoff

When the file is written, ask the user whether to proceed to the architect:

Design framework written to <file>.
It inherits the boundaries in framework.md<if present>.

The next step is architecture. Want to proceed to the architect now? It'll
read this framework (and framework.md) as its design input and derive the
code architecture — the standing guidelines and infrastructure decisions
that the spec, plan, and implementation then respect.

Wait for the user's go-ahead. Do not design the architecture, and do not
write the spec, yourself.
