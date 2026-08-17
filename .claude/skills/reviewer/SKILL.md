---
name: reviewer
description: Review an implemented plan against the plan, its framework, and its architecture, at a thoroughness level (1 surface, 2 moderate, 3 deep) set by the orchestrator — surfacing real defects, footguns, invariant and guideline violations, and, at deep level with the user, judgment calls about whether the code serves the project's future. Use this skill whenever a plan has just been implemented and needs review before the next iteration, even if the user doesn't say "review" — trigger on "I just implemented the plan", "check what I changed", "look over this diff", "what did I miss", or any plan + code-change pair. Routes Unity vs generic internally. Findings feed the specifier's re-plan; the deep-level bundle goes to the user. Output is structured findings (root cause / effect / suggested fix).
---

# Reviewer

A focused review skill for the implement → review → re-plan loop. Each invocation
is one review pass over one plan and its implementation. One skill, routing Unity
vs generic internally.

The **specifier** produces and revises plans; **this skill reviews
implementations**, then its findings feed the specifier's re-plan. The review loop
is capped at **3 iterations** (the orchestrator also tracks this; honor an explicit
override to go further).

## Routing: Unity vs generic (internal)

Detect Unity (an `Assets/`/`ProjectSettings/` folder, `.unity` files, or
`## Project Context` naming Unity). Unity → also run the `references/unity-checklist.md`
pass and use the `unity` severity tag; otherwise skip both. Everything else is
identical.

## Inputs

The orchestrator sends a shared, cache-identical prefix — `CLAUDE.md`,
`<feature>.architecture.md`, `<feature>.framework.md`, `<feature>.plan.md` — then a
tail: the implementer's report, the **thoroughness level**, and the iteration
number. All files sit flat next to `CLAUDE.md`; there is no feature folder. Read the
changed source files yourself.

## Thoroughness levels (set by the orchestrator)

The tail carries a level. If none is given, default to **1** and say so.

**1 — Surface.** Fast sanity checks only. Confirm each plan goal (Gx) and step (Sx)
is traceable in the code (a `// G2` / `// S3` marker, or a method name matching the
step), that the plan's keywords appear, and that the changed files match the plan's
file list. Surface review **leans on the test suite** for correctness — so if the
changed code has no covering tests, flag that. Do **not** run the full
correctness/performance/architecture sweep; a defect obvious on the surface is still
worth a finding, but you're not hunting for them at this level.

**2 — Moderate.** Surface, plus every automatic pass: correctness, Unity (if Unity),
style/conventions, performance, architecture-quality, and the framework-boundary and
architecture-guideline checks below. Runs to completion and returns findings without
the user.

**3 — Deep.** Everything in moderate, plus a **user-judgment pass, done with the
user**. Read for real understanding: question implementations that look off, and
call out anything that could hurt the project's future — fragile designs, growing
coupling, whether the feature as built is actually valuable to carry forward. Bundle
these as questions and observations and return them **for the user to discuss** —
deep review is collaborative and pauses the loop; its bundle goes to the user, not
straight into the specifier's re-plan.

## Review procedure

0. **Read the level** from the tail.
1. **Read `CLAUDE.md`** (+ `## Project Context`). Treat it as additive: apply the
   generic conventions for the project's language first, then layer CLAUDE.md on top;
   both can produce findings, and when they conflict, name both and recommend
   CLAUDE.md.
2. **Read the plan, framework, and architecture** from the shared prefix.
3. **Read every changed file** — bugs live at the boundary of changed and unchanged
   code.
4. **Plan ↔ implementation correspondence** (all levels, lax on scope creep — extra
   refactors aren't findings by themselves). Flag plan items that are missing,
   present-but-unused, or implemented contrary to what the plan said; confirm each
   framework goal (Gx) is realized.
5. **Level-gated passes.**
   - **Level 1** stops after step 4 plus the surface sanity checks (traceability,
     keyword presence, file-list match, test coverage).
   - **Level 2+** runs the passes in priority order, reading each reference when you
     reach it: correctness (`references/correctness.md`); Unity, if Unity
     (`references/unity-checklist.md`); style (`references/style-and-conventions.md`);
     performance (`references/performance.md`); architecture-quality
     (`references/architecture.md`); then the two project checks (6, 7).
   - **Level 3** also runs the user-judgment pass (8).
6. **Framework-boundary check** (level 2+). Compare the implementation against the
   framework's boundaries and invariants (in the shared prefix). An invariant
   violation is **`bug`** severity; name the framework file in the root cause. If the
   violation actually originates in the **plan** (the code faithfully implements a
   plan that itself breaks an invariant), don't just flag the code — say so and refer
   it back to reconciliation via the specifier.
7. **Architecture-guideline check** (level 2+). Compare against the project's
   `<feature>.architecture.md` guidelines, Structure, and complexity ceiling (in the
   shared prefix). A hard-guideline violation is **`arch`** severity and is a blocker;
   name the guideline and file in the root cause. Deviations the user already approved
   and that are documented (in the implementer's "Architecture conflicts" summary or a
   plan note) are marked as **known**, not re-flagged.
8. **User-judgment pass** (level 3 only). Produce the bundle described under Output.

## Output format

Begin with an iteration header on its own line: `**Iteration:** N of 3`.

Then one block per finding (levels 1–2, and the concrete defects at level 3),
ordered by severity:

```
## Finding N: <short title>
**Severity:** bug | unity | style | perf | arch
**Location:** <RelativePath/File> :: <Symbol> (line ~<N>)
**Root cause:** <what's wrong, mechanically — for framework/architecture findings,
name the framework or architecture file and the specific invariant/guideline>
**Effect:** <what goes wrong at runtime/build time, or for the next developer>
**Suggested fix:** <concrete enough for the specifier's re-plan to act on>
```

Severity: `bug` = correctness defects **and framework-invariant violations**; `unity`
= Unity-specific defects (allocation in `Update`, missing Unity null check); `style`,
`perf` as usual; `arch` = architecture-quality issues **and architecture-guideline
violations**. Spanning categories → pick the most severe, mention the rest.

End with: `**Summary:** N finding(s) — X bug, [Y unity,] Z style, W perf, V arch.`
or the explicit no-findings line.

### Level-3 addition — the user bundle

After the findings, add:

```
## For your call (deep review)
<numbered questions and observations that need the user's judgment, not auto-fixes —
implementation choices worth questioning, future-maintainability concerns, whether the
feature as built is worth carrying forward. Framed for discussion.>
```

The orchestrator surfaces this to the user and waits; it does not feed straight into
re-plan.

### Stop-report (iteration 3 with findings, or beyond)

Append after the summary when the cap is reached with findings unresolved:

```
---
**Iteration cap reached.** The loop caps at 3 iterations; the findings above remain.
Hand off to the user: accept as-is, authorize more iterations, or restructure the plan.
```

## Dispute handling (reviewer as counterparty)

The reviewer answers two one-round disputes: from the **implementer** (about what the
code actually does) and from the **specifier** (about what the plan called for). For
each disputed finding: **Concede** (drop it), **Hold with clarification** (supply the
detail the other party missed), or **Hold without movement** (sparingly). Respond in
the disputes' numbered order; the reviewer's response is final for that round.

**Prefix discipline:** the plan, framework, and architecture are already in your
shared prefix. In dispute responses, reference them by identifier (Sx, Gx, finding
number) — do **not** re-paste them. Keep responses lean so the re-spawn's prefix stays
byte-identical and the cache still hits.

## What not to do

- Don't nitpick what a formatter handles, or flag preferences not in CLAUDE.md or the
  language's/Unity's established convention.
- Don't rewrite the code — suggest fixes; the specifier's re-plan decides.
- Don't invent findings to look thorough; an empty review is valid.
- Don't review the plan's *design* — that's the specifier's job. (Do flag where the
  code breaks a framework invariant or architecture guideline — that's this skill's.)

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of `CLAUDE.md`
and find the `### Reviewer` subsection; apply its rules on top of this procedure.
Create it (with confirmation) if missing. See `references/claude-md-behaviors.md`.
Common rules: severity calibration, project-specific patterns to flag or ignore,
default thoroughness, dispute-disposition tendencies.

## Reference files

- `references/correctness.md` — logic, null handling, edge cases, concurrency, exceptions.
- `references/style-and-conventions.md` — CLAUDE.md adherence, naming, organization, readability.
- `references/performance.md` — allocations, hot paths, caching, batching.
- `references/architecture.md` — architecture-quality: coupling, single responsibility, boundaries, dependency direction.
- `references/unity-checklist.md` — Unity footguns (used only in Unity projects).
- `references/claude-md-behaviors.md` — reviewer-specific Skill Behaviors notes.
