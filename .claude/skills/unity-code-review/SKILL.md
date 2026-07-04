---
name: unity-code-review
description: Review C# code changes in a Unity project against the plan that produced them, surfacing real defects, Unity-specific footguns, CLAUDE.md violations, and maintainability problems. Use this skill whenever a plan has just been implemented in a Unity C# codebase and the implementation needs review before the next iteration — even if the user does not explicitly say "review" or "code review". Trigger on phrases like "I just implemented the plan", "check what I changed", "look over this diff", "what did I miss", or any time a plan + resulting code change pair is presented in a Unity context. Output is structured findings (root cause / effect / suggested fix) designed to feed into the next planning step.
---

# Unity Code Review

A focused review skill for the plan → implement → review → re-plan loop in a Unity C# project. Each invocation is one review pass over one plan + its implementation.

## Operating context

This skill runs as part of a larger iteration cycle:

1. A plan is written.
2. The plan is implemented in code.
3. **This skill reviews the implementation against the plan.**
4. Findings feed into the next plan.
5. Repeat — up to a maximum of 3 review iterations.

A separate skill reviews plans themselves. This skill reviews **implementations**.

### Iteration tracking (enforced by this skill)

This skill caps the review loop at **3 iterations** total. Track the current iteration count explicitly:

- **At the start of every review pass, determine which iteration this is** (1, 2, or 3).
  - Check the conversation for prior reviews produced by this skill. The most direct signal is the presence of previous outputs ending with the `**Summary:**` line described below.
  - If no prior review exists in the conversation, this is **iteration 1**.
  - Otherwise, count prior reviews and add 1.
  - If the user or orchestrator explicitly states the iteration number, trust that over your own count.
- **Begin every output with a single line** stating the iteration, e.g. `**Iteration:** 2 of 3`.
- **If this is iteration 3 and findings are non-empty:** complete the normal review, then append the stop-report block described in the "Output format" section. Do not invite another iteration.
- **If this is iteration 3 and findings are empty:** still produce the normal "no findings" summary; no stop report is needed because the loop has naturally completed.
- **If the conversation indicates more than 3 iterations have already happened**, do not run the review. Output the stop-report block instead and ask the user how to proceed.

The orchestrator may still override these rules — if it explicitly asks for "iteration 4" or "one more pass", do the review and note that the cap has been exceeded by request.

## What this skill expects as input

- The plan that was executed (in whatever form the user provides — bullet list, prose, ticket, etc.).
- The code changes that resulted from executing the plan (diff, set of changed files, or pasted snippets).
- The project's `CLAUDE.md` (assumed to exist in the project root — read it before reviewing).

If any of these are missing, ask for them before proceeding. Do not guess at what the plan was from the code alone.

## Review procedure

Follow these steps in order. Do not skip ahead.

### 1. Read CLAUDE.md

Always read the project's `CLAUDE.md` first. It defines project-specific conventions, naming rules, architectural preferences, and forbidden patterns.

Treat CLAUDE.md as **additive**, not authoritative: in the style pass, apply the generic Unity/C# style and convention checks first, then layer CLAUDE.md rules on top as additional requirements. CLAUDE.md does not silence generic checks — both apply, and a finding can come from either source. When a CLAUDE.md rule and a generic convention conflict, mention both in the root cause and recommend following CLAUDE.md in the suggested fix.

If `CLAUDE.md` cannot be located, note this in the output and proceed with only the generic conventions.

### 2. Read the plan

Understand what the implementation was supposed to do. Identify the concrete deliverables — methods, components, behaviors, fixes — that the plan committed to.

### 3. Read the code changes

Read every changed file. Do not review snippets in isolation if the surrounding context is available — bugs often live at the boundary between changed and unchanged code.

### 4. Check plan ↔ implementation correspondence (lax)

The check is: **does the plan exist in the code, and is the code actually using what the plan described?** Be lax about scope creep — unrelated refactors or extra changes are fine and are not findings by themselves. The plan-review skill handles plan quality; this skill cares whether the plan was meaningfully realized.

Flag only:
- Plan items that are missing from the implementation.
- Plan items that are present but unused (e.g. a method was added but nothing calls it, when the plan said it would be called).
- Plan items implemented in a way that contradicts what the plan said.

### 5. Run the review passes

Walk through the review in priority order. Each pass has its own checklist in `references/`. Read the relevant reference file when you start that pass.

1. **Correctness and bugs** — highest priority. See `references/correctness.md`.
2. **Unity-specific issues** — interleaved with correctness because many Unity footguns are bugs disguised as style issues. See `references/unity-checklist.md`.
3. **Style, conventions, readability, maintainability** — including CLAUDE.md adherence. See `references/style-and-conventions.md`.
4. **Performance** — see `references/performance.md`.
5. **Architecture** — see `references/architecture.md`.

Do not skip lower-priority passes if higher-priority ones found issues. The goal of running this early in the cycle is to surface as much as possible in one pass so the user has less to review at the end.

### 6. Write the findings

Use the output format below. One block per finding. Order findings by severity (bugs first, then performance, then style, then architecture — except where a "lower" finding is actually a bug in disguise, in which case promote it).

If nothing is found, say so explicitly: do not pad with weak findings to seem thorough.

## Output format

Begin every output with an iteration header on its own line:

```
**Iteration:** N of 3
```

Then one block per finding, using this exact structure:

```
## Finding N: <short descriptive title>
**Severity:** bug | unity | style | perf | arch
**Location:** <RelativePath/File.cs> :: <MethodOrSymbolName> (line ~<N>)
**Root cause:** <what is actually wrong, mechanically — not just the symptom>
**Effect:** <what goes wrong at runtime, at build time, or for the next developer>
**Suggested fix:** <concrete change, specific enough that the next planning step can act on it>
```

Notes on each field:

- **Severity** uses one of those five tags. "bug" includes correctness defects. "unity" is for Unity-specific defects that aren't pure logic bugs (e.g. allocation in `Update`, missing `?.` on a destroyed object). If a finding spans categories, pick the most severe and mention the others in the root cause.
- **Location** must include both the file path and the method/symbol name. Line numbers are approximate and helpful but not required if the symbol name is unambiguous.
- **Root cause** explains the *mechanism*, not just "this is broken". Direct and explanatory.
- **Effect** describes the consequence. Be concrete: "GC spike of ~2KB per frame", "NullReferenceException when the GameObject is destroyed mid-coroutine", "next developer will assume this is thread-safe and it isn't".
- **Suggested fix** is concrete enough to feed into the next plan. If multiple fixes are reasonable, pick the one most consistent with CLAUDE.md and mention alternatives briefly.

End the output with a short summary line:

```
**Summary:** N finding(s) — X bug, Y unity, Z style, W perf, V arch.
```

If nothing was found:

```
**Summary:** No findings. The implementation matches the plan and no defects, Unity footguns, style violations, or performance/architecture issues were observed in this pass.
```

### Stop-report block (iteration 3 with non-empty findings, or beyond iteration 3)

If this is iteration 3 and findings are non-empty, OR if the conversation indicates iteration 3 is already complete and another review is being requested without an explicit override, append this block after the summary:

```
---
**Iteration cap reached.** This skill caps the review loop at 3 iterations. The findings above have not yet been resolved within that budget. Recommend handing off to the user to decide:
- Accept the current state and proceed.
- Authorize one or more additional iterations explicitly.
- Restructure the plan to address remaining findings differently.
```

## What not to do

- Do not nitpick formatting that a linter or formatter handles (whitespace, brace style, trailing commas). Real defects only.
- Do not rewrite the code. Suggest fixes; the next planning step decides.
- Do not flag stylistic preferences that aren't in CLAUDE.md or established Unity convention.
- Do not invent a finding to look thorough. An empty review is a valid review.
- Do not review the plan itself — that's a separate skill.

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of `CLAUDE.md` and find the `### Reviewer` subsection. Apply any rules listed there as additional instructions on top of this skill's normal procedure.

If the section or subsection does not exist, create it with user confirmation before continuing. See `references/claude-md-behaviors.md` for reviewer-specific notes; the shared mechanism is documented in the specifier skill's `references/claude-md-behavior-section.md`.

Common rule types for the reviewer: severity calibration for this project, project-specific Unity patterns to flag or ignore, expected dispute disposition tendencies, performance-pass strictness.

## Reference files

Read these when you reach the corresponding review pass. They contain detailed checklists.

- `references/correctness.md` — logic bugs, null handling, edge cases, concurrency, exception handling.
- `references/unity-checklist.md` — Update/FixedUpdate misuse, GetComponent in hot paths, coroutine lifetimes, serialization quirks, Unity null-equality, event unsubscription, physics call sites, allocations per frame.
- `references/style-and-conventions.md` — CLAUDE.md adherence, naming, file organization, readability heuristics.
- `references/performance.md` — allocations, hot paths, caching, batch operations.
- `references/architecture.md` — coupling, single responsibility, scene/prefab structure, asset references.
