# `<feature>.plan.md` Format

The plan is the contract between the framework and the implementation. It must
be readable by the implementer (who acts on it) and the reviewer (who checks
code against it).

## Location & naming

Flat, next to `CLAUDE.md` — **no feature folder**:

- Live plan: `<feature>.plan.md`
- Prior versions: `<feature>.plan.v1.md`, `<feature>.plan.v2.md`, … on the same
  layer (see "Re-planning" in SKILL.md).
- Draft while specifying: `/tmp/<feature>.plan.draft.md`.

`<feature>` is the same base name as `<feature>.framework.md` and
`<feature>.architecture.md`, so the trio shares one prefix.

## Structure

Section names are fixed; fill in the content.

```markdown
# Plan: <feature_name>

**Outer iteration:** <N>
**Realizes framework:** <feature>.framework.md (+ project framework.md if used)
**Within architecture:** <feature>.architecture.md (+ project architecture.md), complexity target <1–5 + label>
**Previous version:** <feature>.plan.v(N-1).md if it exists, else "none — first iteration"

## Changes from previous iteration
<only on iteration > 1: bullets of what was added/removed/modified vs the
previous plan and why; reference reviewer findings by ID (F1, F2, …)>

## Framework coverage map
A table mapping every framework goal to plan steps. The self-check verifies
completeness.

| Framework goal | Plan steps |
|---|---|
| G1: <short label> | S1, S3 |
| G2: <short label> | S2 |
| G3: <decided edge case / invariant> | S4 |

(Steps not listed here are helpers — see below.)

## Plan steps
Each step is concrete enough to act on without re-interpreting.

### S1: <short title>
**Covers:** G1
**Files:** <concrete path, e.g. src/services/auth/auth-service.ts (new)>
**Description:** <one paragraph: what to do, mechanically>
**Rationale:** <only if a non-obvious choice was made — e.g. why this pattern,
how it honors the architecture or holds to the complexity ceiling>

## Helper steps
Steps that don't tie to a framework goal. Each needs a justification.

### H1: <short title>
**Justification:** <why it's needed though no goal names it — scaffolding for S3, etc.>
**Files:** <path>
**Description:** <one paragraph>

## Assumptions
The "that won't happen" answers captured during probing, so the implementer and
reviewer don't over-engineer for them.

- <e.g. "Input is always pre-validated upstream; the handler assumes well-formed actions.">

## Out of scope
Deliberate omissions someone might expect, so the reviewer doesn't flag them.

- <short bullet>

## Acceptance criteria
How the reviewer can tell each goal was correctly implemented. One per goal.

- **G1 satisfied when:** <observable criterion>
- **G2 satisfied when:** …
```

## Style notes

- **Concrete file paths, not abstract descriptions.**
- **One paragraph per step.** If it needs more, it's probably two steps.
- **Rationale only for non-obvious decisions** — especially where a choice was
  driven by the architecture or the complexity ceiling.
- **Reference framework goals by their G-number** consistently; the coverage map
  and self-check depend on it.
- **Reference reviewer findings by their ID** (F1, F2, …) when re-planning.
- **No code.** The plan says what to do; the implementer writes it. An occasional
  load-bearing signature is fine; full implementations are not.
