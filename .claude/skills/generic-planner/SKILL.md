---
name: generic-planner
description: Produce an implementation plan for a software feature based on a Spec.md, with batched user clarification before planning, a spec-coverage self-check after, and revision support when reviewer findings come back. Use this skill whenever a planner sub-agent is asked to produce or revise a plan for a feature — typically spawned by the generic-orchestrator skill. Trigger on prompts like "produce a plan for feature X", "revise the plan based on these findings", "you are the planner for…", or any context where a Spec.md exists and the next step is to turn it into actionable implementation steps. The output is a Plan.md file in the feature folder, plus a self-check verdict the orchestrator can act on.
---

# Generic Planner

A planner sub-agent for the implementation cycle. Produces a `Plan.md` that the implementer can execute and the reviewer can check against. Owns three responsibilities:

1. Make sure the spec is understood before planning (batched clarification with the user).
2. Produce a plan and verify it covers the spec (up to 3 internal self-check iterations).
3. On re-plan calls, fold reviewer findings into a new full plan, with one round of reviewer dispute allowed.

This skill is invoked as a sub-agent by the `generic-orchestrator` skill. It can also be run standalone — the procedure is the same.

## Inputs

When spawned, the planner receives:

- The feature folder path (containing `Spec.md`, optionally `Plan.md` and prior versioned plans, optionally `Handoff.md`).
- The project's `CLAUDE.md`.
- The current outer iteration number.
- On iteration > 1: the previous plan, the implementer's summary, and the reviewer's findings.

The planner reads `Spec.md` itself from the feature folder rather than expecting it inline.

## Procedure

Follow these phases in order.

### Phase 1: Read and understand the spec

1. Read `Spec.md` fully.
2. Read `CLAUDE.md` for project conventions that will constrain the plan. In particular, read the `## Project Context` section to learn the project's language and stack — the plan must be expressed in idioms appropriate to that language.
3. If a prior `Plan.md` exists, note its version and read it for context (do not start from it on iteration 1; on iteration > 1, see Phase 4).
4. Identify each discrete **requirement** in the spec. A requirement is anything the implementation must do or satisfy. Number them locally as you read (R1, R2, …) so the self-check can reference them.

If `CLAUDE.md` has no `## Project Context` section, stop and tell the user/orchestrator that the language hasn't been recorded — the planner cannot produce a language-appropriate plan without that fact. Do not guess from file extensions.

### Phase 2: Pre-planning clarification (batched)

After reading, list every point in the spec that is unclear, incomplete, ambiguous, or in tension with `CLAUDE.md`. Examples of things that count:

- A requirement that names a behavior but not the trigger ("the data refreshes" — when?).
- A requirement that uses a term not defined elsewhere ("the active slot" — what makes a slot active?).
- A requirement whose intended scope is ambiguous ("optimize loading" — what counts as "optimized"?).
- An apparent conflict with CLAUDE.md (e.g. spec implies a singleton, CLAUDE.md forbids them).
- A gap that the planner would otherwise fill by guessing.

**If the list is non-empty, ask the user all questions in a single batched message before writing any plan.** Use this structure:

```
The spec needs clarification on the following points before I can produce a plan. I'll wait for your answers, then amend Spec.md accordingly.

1. <question 1>
   Context: <which spec line or section this concerns>
   <if applicable: 2–3 candidate interpretations the user can pick from>

2. <question 2>
   ...
```

When the user answers:

1. **Amend `Spec.md` directly** with the clarifications. Use a consistent style — either inline edits to the original requirement text, or a "Clarifications" subsection appended at the end. Match the spec's existing tone.
2. Show the user the diff of what you changed and ask them to confirm. Do not proceed until they confirm.
3. If the answers raised new questions, run another batched round. Phase 2 can repeat. **User-clarification rounds do not count against the 3-iteration self-check cap** — that cap is only for the planner's internal self-check loop in Phase 4.

If the list is empty, skip directly to Phase 3.

### Phase 3: Write the plan

Produce `Plan.md` in the feature folder. See `references/plan-format.md` for the full structure. The plan must:

- State which spec version it targets (read the latest line from Spec.md or the file's modification context).
- Cover every requirement R1, R2, … with at least one concrete implementation step. (A requirement may map to multiple steps; one step may cover multiple requirements.)
- Mark steps that don't trace back to a specific requirement as **helpers** with a brief justification (e.g. "scaffolding for R3", "refactor needed to make R5 possible").
- Respect `CLAUDE.md` conventions throughout — don't propose patterns the project forbids.
- Include short rationale notes pointing back to the spec where a non-obvious decision was made. Format: `// R3: chose event-based dispatch over direct call because spec requires loose coupling between modules`.

Write the plan to `<feature_folder>/Plan.md`. If a prior plan exists, version the old one first (see Phase 4 for the rule about iteration > 1; on iteration 1 there should be no prior plan).

### Phase 4: Self-check against the spec

After writing the plan, verify it covers the spec.

**Rule:** every requirement R from Spec.md must appear in at least one plan step. Plan steps without a matching requirement are allowed but must be marked as helpers with a justification. (The reverse mapping — every step ties back to a requirement — is **not** required.)

Procedure for one self-check pass:

1. For each requirement R1, R2, …, find the plan step(s) covering it. If any requirement has zero coverage, record it as a gap.
2. For each plan step, verify it is either tied to a requirement or marked as a helper with a justification. If a step is neither, record it as a stray step.
3. If gaps or stray steps were found, amend the plan to fix them. This is one self-check iteration.

**The self-check loop runs up to 3 iterations.** Count each iteration that resulted in an amendment.

- If after iteration N (where N ≤ 3) the plan passes the self-check (no gaps, no stray steps), report **passed**.
- If the gap exists because the spec itself is unclear — the planner doesn't know how to close it without guessing — exit the self-check loop early and return to Phase 2 for another batched clarification round. **This does not consume a self-check iteration.**
- If after 3 iterations there are still gaps that the planner cannot close, and the gaps are *not* due to spec ambiguity (i.e. you understand what's needed but can't fit it into a workable plan), report **failed-after-3-attempts** with the specific gaps listed. The orchestrator will escalate.

The distinction matters: spec ambiguity → ask the user (Phase 2). Plan inadequacy → 3-iteration cap → escalate.

### Phase 5 (re-plan only): Fold in reviewer findings

This phase only applies on outer iteration > 1, when the orchestrator has passed in reviewer findings.

1. **Version the previous plan** before writing a new one. Rename `Plan.md` to `Plan.v<N>.md` where N is the outer iteration that produced it (so the plan from iteration 1 becomes `Plan.v1.md`). The new plan being written now becomes `Plan.md`.
2. **Read each finding.** For each one, decide:
   - **Accept** — the finding identifies something the plan should have addressed and didn't, or addressed wrongly. Revise the plan to fix it.
   - **Dispute** — the planner believes the finding is wrong, misapplies the spec, or is based on a misunderstanding of what the plan actually called for.
   - **Out of scope** — the finding is real but addressing it would expand the feature beyond Spec.md. (Escalate to user; see below.)
3. **If any findings are disputed**, the planner does not silently override the reviewer. Instead, write a `DisputedFindings.md` file in the feature folder listing each disputed finding with the planner's reasoning. The orchestrator will spawn the reviewer for one round of dispute resolution. After that single round, any remaining disagreement is escalated to the user — the planner does not get to dispute the reviewer's response. (See `references/dispute-format.md` for the file structure.)
4. **If any findings are out of scope**, stop and escalate to the user before writing the new plan. Output a short escalation message naming the out-of-scope findings and asking whether to expand the spec, drop the finding, or treat it as a known limitation. Do not amend Spec.md unilaterally for scope changes.
5. Once disputed findings are resolved (reviewer conceded, planner conceded, or user decided) and out-of-scope findings are handled, **write the new full plan**. It supersedes the previous plan entirely. Include at the top a short "Changes from previous iteration" section listing what was added, removed, or modified and why.
6. Run the Phase 4 self-check on the new plan.

The new plan is a full plan, not a patch. The implementer reads only `Plan.md`, not the version history.

## Output to the orchestrator

When done, return to the orchestrator:

1. The path to the new `Plan.md`.
2. The self-check verdict: `passed` or `failed-after-3-attempts` (with specific gaps if failed).
3. Notes on any user clarifications made to Spec.md this session (so the orchestrator can update Handoff.md if needed).
4. The path to `DisputedFindings.md` if one was created.
5. The escalation summary if any out-of-scope findings were raised.

Keep this return message short. The plan itself lives on disk and doesn't need to be repeated in the response.

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of `CLAUDE.md` and find the `### Planner` subsection. Apply any rules listed there as additional instructions on top of this skill's normal procedure.

If the section or subsection does not exist, create it with user confirmation before continuing. See `references/claude-md-behaviors.md` for planner-specific notes; the shared mechanism is documented in the specifier skill's `references/claude-md-behavior-section.md`.

Common rule types for the planner: rationale-note verbosity, preferred patterns or forbidden patterns specific to this project, self-check strictness, plan-step granularity preferences.

## Reference files

- `references/plan-format.md` — the structure of `Plan.md`.
- `references/dispute-format.md` — the structure of `DisputedFindings.md` for planner-vs-reviewer disagreement.
- `references/spec-amendment-style.md` — guidance on how to amend Spec.md cleanly when answering user clarifications.
