---
name: orchestrator
description: Coordinate an implement → review loop of sub-agents to build a feature whose plan already exists, with a cache-friendly shared context, token-budget checkpointing, and escalation on anomalies. Use this skill when a plan file (name.plan.md) sits next to CLAUDE.md and the user is moving toward implementation — signalled by "let's implement this", "start the build", "kick off the cycle", "implement it", or pointing at a plan; also on "continue with the last feature", "resume", or a handoff file. The plan comes from the specifier (specify and plan are merged), so there is no separate planning step; re-planning on reviewer findings is done by re-invoking the specifier. Asks the user for a reviewer thoroughness level. Routes Unity vs generic internally. Do NOT use it if the user opts out with "implement normally", "without orchestration", "skip the orchestration", or similar — hand back to default behavior.
---

# Orchestrator

A thin coordinator for the **implement → review** cycle. It owns no domain
logic — it spawns role-specific sub-agents, routes their outputs, keeps the
shared context cache-friendly, watches the token budget, and escalates
anomalies to the user. The work lives in the implementer, reviewer, and (for
re-planning) specifier skills.

The plan already exists before this skill runs: the **specifier** produced
`<feature>.plan.md` in the specify step (specification and planning are merged).
So there is **no initial planning step** — the cycle starts at the implementer.
When the reviewer returns findings, re-planning is done by re-invoking the
**specifier** in its re-plan role, not a separate planner.

## When this skill runs

Orchestrated mode is the default whenever `CLAUDE.md` exists, a
`<feature>.plan.md` sits next to it, and the conversation is moving toward
implementing that feature. The user opts out with explicit phrases —
"implement normally", "without orchestration", "skip the orchestration", "just
do it directly" — in which case this skill steps aside silently and Claude
implements in the main conversation.

The cycle runs until the reviewer is clean and the work is accepted, the token
budget hits the checkpoint threshold (a handoff is saved), an escalation fires,
or the user switches to normal mode.

## Required environment

- **Claude Code.** This skill spawns real sub-agents. It does not work without
  them.
- **Sub-agent configurations** named `implementer`, `reviewer`, and `specifier`
  (the last used only for re-planning). If any is missing, stop and say which.
- **Flat feature files** next to `CLAUDE.md` — **no feature folder**. All files
  for a feature share its base name:
  - `<feature>.plan.md` — the plan to implement (required; from the specifier).
  - `<feature>.framework.md`, `<feature>.architecture.md` — design + guidelines
    (optional but expected).
  - `<feature>.handoff.md` — saved state from a prior session (only on resume).

## Startup procedure

### 0. Preconditions, routing, opt-out

- **0a — Opt-out.** If the user's message contains an explicit opt-out phrase,
  stop using this skill immediately; write nothing, announce nothing.
- **0b — Unity vs generic (internal).** This is one skill; it routes internally.
  Detect Unity (an `Assets/`/`ProjectSettings/` folder, `.unity` files, or
  `## Project Context` naming Unity). The `implementer`, `specifier`, and
  `reviewer` sub-agents are single skills that route Unity vs generic internally —
  spawn them by those names regardless of project type.
- **0c — Files.** Locate `CLAUDE.md`; identify the feature by its base name;
  confirm `<feature>.plan.md` exists next to it. If there's no CLAUDE.md, no
  identifiable feature, or no plan file, preconditions aren't met — stop and say
  what's missing. (No plan usually means the specify step hasn't run — point the
  user at the specifier.)
- **0d — Project Context.** Confirm `CLAUDE.md` has a `## Project Context`
  section; if not, stop and tell the user to run the specifier first. Never guess
  the language from file extensions.
- **0e — Proceed.** If preconditions hold and no opt-out was seen, proceed. Don't
  ask which mode — orchestrated is the default.

### 1. Resume vs fresh start

Look next to `CLAUDE.md` for `<feature>.handoff.md`. If present → **resume**:
read it, restore loop state, confirm the resume point with the user, jump to the
next intended action. If absent → **fresh start**: the cycle begins at the
implementer.

### 2. Reviewer thoroughness (ask before the first review)

Get the review depth from the user. Three levels:

1. **Surface** — fast automatic sanity checks only: each plan goal (Gx) and step
   (Sx) is traceable in the code (e.g. `// G3` / `// S4` markers, method names
   matching plan steps), plan keywords appear, and changed files match the plan's
   file list. No deep reasoning about whether the code is *good*.
2. **Moderate** — surface, plus the full automatic plan-vs-code correspondence
   and the framework/architecture checks the reviewer skill already does. Still
   runs without the user.
3. **Deep** — real code understanding, **with the user in the loop**. The reviewer
   questions implementations, notes anything that seems off or that could hurt the
   project's future, and plays the whole set back to the user as one bundle to
   discuss. Deep review is **not automatic** — it pauses the loop for the user
   instead of feeding straight into re-planning.

**Default is 1 (surface).** Surface leans on the test suite to do the real
checking, so **if the feature has no tests** (no test framework in Project
Context, and no test files covering the changed code), do **not** apply the
default silently — ask the user explicitly to choose a level, noting that without
tests a surface pass will miss real problems. Record the level in loop state, pass
it to every reviewer spawn, and let the user change it between iterations.

(The reviewer skill enforces these levels natively; the orchestrator passes the
level in each reviewer spawn's tail.)

### 3. Loop state

Maintain across the session: `feature_name`, `plan_path`, `iteration` (starts 1,
increments after each reviewer pass that returned findings), `review_thoroughness`
(1–3), `last_implementation_summary`, `last_findings`, `findings_history`
(count per iteration, for the descending-findings check), `replan_iterations`
(specifier re-plan self-checks within the current outer iteration), and `status`
(implementing | reviewing | replanning | complete | checkpointed | escalated).

## Shared context & caching

Every sub-agent gets its own empty context, so the orchestrator rebuilds what it
needs at each spawn. To keep that cheap, assemble a **single shared prefix** and
place it **first and byte-identical** in every spawn this cycle, in this order:

1. tool definitions
2. `CLAUDE.md` (including `## Project Context`)
3. architecture files — `<feature>.architecture.md`, project `architecture.md`
4. framework files — `<feature>.framework.md`, project `framework.md`
5. the current `<feature>.plan.md`

Only **after** this shared block comes the agent-specific tail (role, iteration
number, prior findings, dispute files, thoroughness level). Never interleave
iteration-specific data into the shared block or reorder it — one changed byte in
the prefix is a cache miss.

This ordering is what lets the runtime reuse the prefix across every
implementer / reviewer / specifier spawn: the first spawn pays to encode it, the
rest read it cheaply. The actual cache markers and duration live in the layer that
spawns sub-agents, not in this skill — Claude Code caches automatically; if you
drive the loop through your own API code, put the cache breakpoint at the end of
the shared block and use the 1-hour cache window when steps are spread out (a
human-gated deep review, for instance). The orchestrator's job is to keep the
prefix identical and front-loaded so the cache can hit. See
`references/agent-prompts.md` for the exact layout, and its trim order for tight
budgets (only the tail is ever trimmed — never the shared prefix).

## The loop

```
(plan already exists: <feature>.plan.md)
loop:
  step 1: implementer → applies <feature>.plan.md to the code
  step 2: reviewer    → findings or clean, at review_thoroughness
  if clean                       → success, write final summary, exit
  if review_thoroughness == 3    → surface the reviewer's bundle to the user, wait
  else (findings, level 1–2)     → step 3: specifier (re-plan) → revise plan, loop to step 1
```

After each step, before the next: check escalation, check the token budget,
update loop state.

### Step 1 — Implementer

Spawn the implementer variant with the shared prefix plus a tail: role, iteration
`N`, and (iteration > 1) the previous findings it must fix. It reads source files
itself. Expected back: files changed, a per-step summary, deliberate deviations,
and anything it couldn't do. It may raise scope/intent questions to the specifier
(see disputes).

### Step 2 — Reviewer

Spawn the reviewer variant with the shared prefix plus a tail: the implementer's
report and the **thoroughness level**. Levels 1–2 return findings or clean
automatically and the loop proceeds. Level 3 returns a bundle of questions and
observations; the orchestrator surfaces it to the user and **waits** — deep review
is a decision point, not an auto-loop.

### Step 3 — Re-plan (specifier)

Only when the reviewer returned findings at level 1–2. Spawn the `specifier` in
re-plan mode with the shared prefix plus the findings. It versions the plan
(`<feature>.plan.md` → `<feature>.plan.v<N>.md`, flat on the same layer), writes
the new `<feature>.plan.md`, and may raise disputes (below). Then loop to step 1.

### Dispute rounds

Three one-round-then-escalate rounds, flat-named, in the order they can occur:

1. **Implementer ↔ specifier** — implementer wrote `<feature>.specifier-questions.md`
   (questions about *what* to build). Spawn the specifier to answer (edit the plan,
   clarify, or escalate), then the implementer resumes.
2. **Implementer ↔ reviewer** — implementer wrote `<feature>.implementer-disputed.md`
   (only factual claims about what the code *does*). Spawn the reviewer; conceded
   findings are dropped before re-planning, held ones proceed. Runs **before**
   round 3.
3. **Specifier ↔ reviewer** — specifier wrote `<feature>.disputed-findings.md`
   (plan/scope disagreements only). Spawn the reviewer; resolution decides which
   findings feed the new plan.

One round per dispute file, no rebuttals; delete the file after resolution;
surviving disagreement escalates to the user. Frequent disputes across iterations
aren't auto-escalations but belong in the trend note.

## Token budget

Checkpoint at **85%** context-window usage. After every sub-agent step, before the
next: under 85% continue; at or above 85% write `<feature>.handoff.md` and stop
wherever you are. If usage is already ≥85% at session start, tell the user the
budget is too tight and ask whether to proceed or stop. See
`references/handoff-format.md`.

## Escalation

Stop the loop, write a brief report (`references/escalation-report.md`), save a
handoff, and ask the user how to proceed when any of these fire (thresholds are
starting points; user overrides win):

- **Re-plan (specifier) anomalies:** returns no revised plan, an empty plan, or a
  plan that doesn't address the findings; or reports it can't reconcile the
  findings within its own self-check cap.
- **Implementer anomalies:** couldn't implement the plan; produced no changes when
  the plan required them; had to deviate substantially.
- **Reviewer anomalies (levels 1–2, per iteration):** more than ~10 findings on
  iteration 1; more than ~5 `bug`-severity findings on any iteration. (Level 3 is
  user-gated, so these count-based auto-escalations don't apply to it.)
- **Trend anomalies:** findings not descending across iterations; most of an
  iteration's findings are new rather than carried over (regression); the same
  finding survives the reviewer's internal cap unchanged.

## Final output

When the reviewer signs off (or the user accepts a deep-review bundle): list every
file changed across all iterations; write a normal post-implementation summary
(what was built, which framework goals it satisfies, deliberate deviations and why,
anything to verify manually); delete `<feature>.handoff.md`; leave the plan and its
versions in place.

## Orchestrator hygiene

- **Do no domain work yourself** — don't plan, implement, or review; if you catch
  yourself reasoning about the code, spawn the right sub-agent.
- **Don't modify code directly** — only the implementer writes code.
- **Keep your own commentary minimal** between spawns — next step, high-level last
  result, budget/escalation notes. Long narration burns tokens.
- **Rebuild context per spawn** via the shared prefix — sub-agents remember nothing
  from a previous step.

## Mode switching mid-cycle

If the user switches to normal mode mid-cycle ("let's just do this normally", "I'll
take it from here"): save `<feature>.handoff.md`, confirm what was saved and that
orchestrated mode is paused, and step aside. The handoff triggers the resume path
next time. Switching the other way is fine too — the user asks for orchestrated
mode, the skill runs the preconditions and proceeds.

## Behavior overrides from CLAUDE.md

At the start of every invocation (after opt-out detection, before file checks),
read the `## Skill Behaviors` section of `CLAUDE.md` and find the `### Orchestrator`
subsection; apply its rules on top of this procedure. Create the section/subsection
lazily with user confirmation if needed. See `references/claude-md-behaviors.md`.
Common rule types: threshold adjustments, token-budget cutoffs, default reviewer
thoroughness for this project, custom escalation behavior.

## Reference files

- `references/agent-prompts.md` — the shared-prefix layout and per-role spawn tails.
- `references/handoff-format.md` — the structure of `<feature>.handoff.md`.
- `references/escalation-report.md` — the escalation report format.
- `references/claude-md-behaviors.md` — orchestrator-specific notes on the Skill Behaviors mechanism.
