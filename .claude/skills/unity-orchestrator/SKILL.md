---
name: unity-orchestrator
description: Coordinate a planner → implementer → reviewer loop of sub-agents to implement a specified feature in a Unity C# project, with token-budget-aware checkpointing and escalation on anomalies. Use this skill whenever a feature folder containing a Spec.md exists alongside CLAUDE.md and the user is moving toward implementation — typically signaled by phrases like "let's implement this", "start the build", "kick off the cycle", "go ahead with this feature", or by the user pointing at a feature folder. Also use when the user says "continue with the last feature", "resume", or references a Handoff.md. Orchestrated mode is the default when the preconditions (CLAUDE.md, feature folder, Spec.md) are met. Do NOT use this skill if the user explicitly opts out with phrases like "implement normally", "without orchestration", "skip the orchestration", "just plan it directly", or similar — in those cases hand control back to default planning behavior.
---

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

# Unity Orchestrator

A thin coordinator for the plan → implement → review cycle. This skill owns no domain logic — it spawns role-specific sub-agents, routes their outputs between them, watches the token budget, and escalates anomalies to the user. The actual work lives in the planner, implementer, and reviewer skills.

## When this skill runs

This skill takes over by default whenever:

- `CLAUDE.md` exists at the project root.
- A feature folder containing a `Spec.md` exists next to it.
- The conversation is moving toward implementing that feature.

Two modes exist:

- **Orchestrated mode** (default) — this skill takes over, spawns sub-agents (planner, implementer, reviewer), runs the plan/implement/review loop, manages the token budget, and writes Plan.md / Handoff.md as it goes.
- **Normal mode** (explicit opt-out only) — this skill steps aside. Claude plans and implements directly in the main conversation, without sub-agents.

The user opts out of orchestrated mode with explicit phrases like "implement normally", "without orchestration", "skip the orchestration", "just plan it directly", or similar. The orchestrator does not ask which mode to use — orchestrated mode is assumed unless the user has said one of these phrases.

The orchestrated cycle runs until one of:

- The reviewer returns clean and the implementation is accepted.
- The token budget approaches the checkpoint threshold and a handoff is saved.
- An escalation condition fires and control returns to the user.
- The user interrupts mid-cycle to switch to normal mode (see "Mode switching mid-cycle" below).

## Required environment

- **Claude Code.** This skill spawns real sub-agents via the Task tool. It does not work in environments without sub-agents.
- **Pre-existing sub-agent configurations** named `planner`, `implementer`, and `reviewer`. These are assumed to exist before this skill is ever invoked. If any are missing, stop and tell the user which one to create before proceeding.
- **A feature folder** sitting next to the project's `CLAUDE.md`, named after the feature being implemented. The folder contains:
  - `Spec.md` — the agreed-upon specification (required).
  - `Handoff.md` — the saved state from a prior session (optional; present only on resume).

## Startup procedure

Follow these steps in order on every invocation.

### 0. Preliminary check: preconditions and opt-out

Before doing anything else, verify that orchestrated mode is appropriate.

**Step 0a — Check for explicit opt-out.**

If the user's message contains phrases like "implement normally", "without orchestration", "skip the orchestration", "just plan it directly", "no orchestration", "don't use orchestrated mode", or any similarly explicit opt-out, stop using this skill immediately. Hand control back to default behavior. Do not write anything to the feature folder, do not announce the handoff — just proceed as if this skill had not been consulted.

**Step 0b — Verify the folder structure.**

- Locate `CLAUDE.md` at the project root.
- Find the feature folder the user is referring to (use the disambiguation rules in step 1 if needed — feature-folder location logic is the same in both steps, just done in two parts here).
- Confirm the folder contains a `Spec.md`.

If any of these is missing — no CLAUDE.md, no identifiable feature folder, no Spec.md inside it — the orchestrator's preconditions are not met. Stop and tell the user what's missing.

**Step 0c — Proceed.**

If preconditions are met and no opt-out was detected, proceed to step 1 in orchestrated mode. Do not ask the user to confirm; the default is orchestrated mode.

### 1. Locate the feature folder

The user will either point at a feature folder explicitly or say something like "continue with the last feature." In either case:

- Find `CLAUDE.md` at the project root.
- Look at sibling directories. Identify the feature folder the user means.
- If the user said "continue with the last feature" and there is exactly one folder containing a `Handoff.md`, use it. If there are several, ask the user which one.
- If you cannot locate the folder unambiguously, ask the user before continuing.

### 2. Detect resume vs fresh start

Inside the feature folder:

- If `Handoff.md` exists → **resume mode**. Read it. It contains everything you need to pick up where the previous session left off.
- If only `Spec.md` exists → **fresh start**. The cycle begins with the planner.

In either case, also read `Spec.md` and the project's `CLAUDE.md`. The orchestrator itself keeps both available to pass to each sub-agent.

### 3. Initialize or restore loop state

Maintain this state across the session:

- `feature_name` — directory name.
- `spec_path` — path to Spec.md.
- `iteration` — current outer-loop iteration (starts at 1, increments after each reviewer pass that returned findings).
- `last_plan` — most recent plan from the planner.
- `last_implementation_summary` — what the implementer reported doing.
- `last_findings` — most recent reviewer output.
- `findings_history` — list of finding-counts per iteration, used for the descending-findings check.
- `planner_self_check_iterations` — how many planner iterations have happened *within* the current outer iteration without passing its own spec self-check.
- `status` — one of `planning`, `implementing`, `reviewing`, `complete`, `checkpointed`, `escalated`.

On fresh start, all fields are empty/default. On resume, populate from `Handoff.md`.

### 4. Run the loop

See "The loop" section below.

## The loop

The orchestrator drives one step at a time and checks the token budget between every step. The basic shape:

```
loop:
  step 1: planner   → produces a plan
  step 2: implementer → applies the plan to the code
  step 3: reviewer  → returns findings or "clean"
  if findings empty → success, exit loop
  else → loop back to step 1 with findings as additional input
```

After each step, before the next step:
1. Check for escalation conditions (see "Escalation").
2. Check the token budget (see "Token budget").
3. Update loop state.

### Step 1: Planner

Spawn the `planner` sub-agent with these inputs:

- The full `Spec.md` content.
- The project's `CLAUDE.md`.
- If this is iteration > 1: the previous plan, the implementer's summary of what was built, and the reviewer's findings.
- Any prior planner output that failed its own self-check (so the planner doesn't repeat the same mistake).

The planner's role includes its own self-check against the spec, up to 3 internal iterations. If the planner reports that after 3 self-check iterations it still cannot align with the spec, treat that as an escalation condition (see "Escalation").

Expected output: a plan, plus a self-check verdict (passed / failed-after-3-attempts).

### Step 2: Implementer

Spawn the `implementer` sub-agent with:

- The plan from step 1.
- The project's `CLAUDE.md`.
- The current state of the relevant code files (the sub-agent reads them; orchestrator does not need to pass file contents inline).
- If iteration > 1: the previous reviewer findings, so the implementer knows what was wrong last time.

Expected output: a list of files changed, plus a short summary of what was implemented. The actual code lives on disk.

### Step 3: Reviewer

Spawn the `reviewer` sub-agent with:

- The plan from step 1.
- The list of changed files and the implementer's summary.
- The project's `CLAUDE.md`.

Expected output: a finding list in the reviewer skill's format, or a clean summary. Also: which iteration of the reviewer's internal loop this was.

### Decide

- **Reviewer returned clean** → success. Write the final summary (see "Final output") and stop.
- **Reviewer returned findings** → record finding count in `findings_history`, check the descending-findings condition, increment outer-loop `iteration`, and loop back to step 1.

### Dispute resolution

There are three kinds of dispute round in the cycle. All three follow the same one-round-then-escalate pattern. The orchestrator pauses the normal flow, spawns the counterparty for a single resolution round, then either continues the flow with the surviving findings/questions or escalates remaining disagreements to the user.

The three rounds, in the order they can occur within one outer iteration:

**1. Implementer ↔ planner (Phase 2, 4, or 5 of the implementer)**

Triggered when the implementer writes `PlannerQuestions.md`. These are questions about *what* to implement (scope, intent, plan contradictions) — not technical how-to questions, which go to the user directly.

- Pause the normal flow. The implementer does not continue until questions are resolved.
- Spawn the planner with the questions file plus the current plan and spec.
- The planner answers each question, either by editing Plan.md, providing a clarification, or escalating to the user.
- After the planner responds, the implementer resumes.
- If anything remains unresolved → escalate to user.

**2. Implementer ↔ reviewer (Phase 8 of the implementer, after the reviewer has returned findings)**

Triggered when the implementer writes `ImplementerDisputedFindings.md`. Limited in scope: the implementer can only dispute what the code *actually does*, not what it *should* do.

- Pause before handing findings to the planner.
- Spawn the reviewer with the disputed findings plus the original review output.
- Reviewer concedes, holds with clarification, or holds without movement.
- Conceded findings are dropped from the set entirely — the planner never sees them.
- Held findings remain in the set and proceed to the planner's re-plan step.
- Disagreement that survives → escalate to user.

**This round runs before round 3 below.** Findings the implementer resolves should never waste the planner's time.

**3. Planner ↔ reviewer (Phase 5 of the planner, after receiving the post-implementer-dispute findings)**

Triggered when the planner writes `DisputedFindings.md`. Limited to plan/scope disagreements: the planner can argue that a finding misreads what the plan called for, but cannot relitigate what the code does (that was the implementer's round).

- Pause before the planner writes the new plan.
- Spawn the reviewer with the disputed findings plus the original review and current plan.
- Reviewer concedes, holds with clarification, or holds without movement.
- Resolution affects whether each finding feeds into the new plan.
- Disagreement that survives → escalate to user.

After round 3 resolves (or if there was no DisputedFindings.md), the planner writes the new Plan.md and the loop continues to the implementer.

**Hygiene across all three rounds:**

- One round only per dispute file. No rebuttals.
- The dispute file is deleted after resolution.
- Repeated disputes across iterations (e.g. the planner disputes findings on every iteration) are not auto-escalations, but they should be noted in the trend check — frequent disputes suggest a deeper mismatch worth surfacing.

## Token budget

The orchestrator checkpoints when the session's context-window usage approaches the limit. Claude Code surfaces context usage in the environment — read it after every sub-agent returns.

**Threshold: 85% of the context window.**

After every sub-agent step, before launching the next:

- If usage < 85% → continue.
- If usage ≥ 85% → write `Handoff.md` and stop, regardless of where in the loop you are.

When checkpointing mid-step (e.g. the planner just returned and usage is already 87%), include in the handoff: which step just completed, what the next step would have been, and any not-yet-consumed output from the step that just finished.

If usage is already ≥ 85% at the start of a session (before any sub-agent has run), tell the user the budget is too tight to make meaningful progress and ask whether to proceed anyway or end the session.

See `references/handoff-format.md` for the Handoff.md structure.

## Escalation

The orchestrator escalates to the user — does not auto-recover — when any of these fire. Escalation means: stop the loop, write a brief report explaining what happened, save a Handoff.md, and ask the user how to proceed.

The thresholds below are starting points. The user can adjust them at the beginning of a session or via a standing note in the feature folder. If the user has stated different thresholds, use theirs.

**Planner anomalies:**
- Planner returns no plan, an empty plan, or a plan that does not address the spec.
- Planner reports its own self-check failed after 3 internal iterations.

**Implementer anomalies:**
- Implementer reports it could not implement the plan.
- Implementer produced no code changes when the plan required them.
- Implementer reports it had to deviate substantially from the plan.

**Reviewer anomalies (per iteration):**
- More than ~10 findings on iteration 1.
- More than ~5 findings of severity `bug` on any iteration.

**Trend anomalies (across iterations):**
- **Findings are not descending.** Each outer iteration should have fewer findings than the previous one. If iteration N has ≥ as many findings as iteration N-1, escalate. (Exception: iteration 1 has nothing to compare against.)
- Most of iteration N+1's findings are *new* rather than carried over from iteration N — suggests the implementer is regressing.
- The same finding appears unchanged across the reviewer's internal 3-iteration cap.

**Hard cap:**
- Reviewer hits its own 3-iteration internal cap and still returns findings. (This is the reviewer's own stop condition; the orchestrator just honors it.)

See `references/escalation-report.md` for the escalation report format.

## Final output

When the reviewer signs off:

1. Confirm the implementation status: list every file the implementer changed across all iterations.
2. Write a final summary in the style of a normal post-implementation report: what was built, which spec items it satisfies, any deliberate deviations from the plan and why, and anything the user should verify manually.
3. Delete or archive `Handoff.md` — the cycle is complete and a stale handoff would mislead a future session.
4. Leave `Spec.md` in place.

## Orchestrator hygiene

- **Do no domain work yourself.** The orchestrator does not plan, implement, or review. If you find yourself reasoning about the C# code, stop and spawn the appropriate sub-agent.
- **Do not modify code files directly.** Only the implementer writes code.
- **Keep your own commentary minimal.** Between sub-agent calls, output only what the user needs to follow along: which step is next, what the last step returned at a high level, and any budget/escalation notes. Long narration burns tokens.
- **Pass full context to each sub-agent.** Sub-agents have their own context windows; do not assume they remember anything from a previous step. Give them the spec, the CLAUDE.md, and whatever prior outputs are relevant to their step.

## Mode switching mid-cycle

The user may decide partway through an orchestrated cycle that they want to switch to normal mode — for example, if the sub-agent overhead feels excessive for what the feature actually needs.

When the user signals this (phrases like "let's just do this normally", "skip the orchestration", "I'll take it from here"):

1. **Save state.** Write a `Handoff.md` describing where the cycle stopped, just as you would for a token-budget checkpoint. This preserves the option to resume orchestrated mode later.
2. **Confirm.** Tell the user what you saved and that orchestrated mode is paused. Note the path to the Handoff.md.
3. **Step aside.** Hand control back to the main conversation. Claude proceeds in normal mode from this point.

If the user later wants to resume orchestrated mode, the Handoff.md will trigger the resume path on the next invocation.

The reverse — switching from normal to orchestrated mode mid-conversation — is also fine: the user just says they want orchestrated mode, the skill runs the preliminary check, and if the preconditions are met it proceeds from step 1.

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of `CLAUDE.md` and find the `### Orchestrator` subsection. Apply any rules listed there as additional instructions on top of this skill's normal procedure.

If the section or subsection does not exist, create it with user confirmation before continuing. See `references/claude-md-behaviors.md` for the full mechanism — when to create, how to apply, how to add new rules.

Common rule types for the orchestrator: adjusted thresholds (e.g. raising the first-iteration findings ceiling), modified token-budget cutoffs, custom escalation behaviors, project-specific feature-folder conventions.

## Reference files

- `references/handoff-format.md` — the structure of `Handoff.md`, used for both saving and resuming.
- `references/escalation-report.md` — the format for the report shown to the user when an escalation fires.
- `references/agent-prompts.md` — boilerplate framing to send each sub-agent at spawn time, so they receive consistent context.
