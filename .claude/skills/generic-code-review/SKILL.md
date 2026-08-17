---
name: generic-code-review
description: Review code changes in any software project against the plan that produced them, surfacing real defects, language-specific footguns, CLAUDE.md violations, design-framework invariant violations, architecture violations, and maintainability problems. Use this skill whenever a plan has just been implemented and the implementation needs review before the next iteration — even if the user does not explicitly say "review" or "code review". Trigger on phrases like "I just implemented the plan", "check what I changed", "look over this diff", "what did I miss", or any time a plan + resulting code change pair is presented. Activates when CLAUDE.md's Project Context section does NOT name Unity; if Unity context is present, this skill defers to unity-code-review. Output is structured findings (root cause / effect / suggested fix) designed to feed into the next planning step.
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

# Generic Code Review

A focused review skill for the plan → implement → review → re-plan loop in any software project. Each invocation is one review pass over one plan + its implementation.

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
- **The design frameworks that shaped the feature, if the project uses them** (`framework.md` project-wide, and the feature's `<Feature>.framework.md`), next to `CLAUDE.md`. These are **optional** — many projects won't have them. When present, their **Boundaries & invariants** are hard constraints the implementation must not violate, and the reviewer checks against them in step 6.
- **The architecture, if the project uses one** (`architecture.md` project-wide, and optionally `<Feature>.architecture.md`), next to `CLAUDE.md`, produced by the `architect` skill. Also **optional**. When present, its **Guidelines** and **Decisions** are constraints the implementation must conform to, and the reviewer checks against them in step 7.

If the plan or the code changes are missing, ask for them before proceeding. Do not guess at what the plan was from the code alone. Missing framework files are fine — they're optional.

## Review procedure

Follow these steps in order. Do not skip ahead.

### 0. Route Unity projects to unity-code-review

Check for Unity context:

- Is there an `Assets/` folder at the project root, or `ProjectSettings/`, or any `.unity` files?
- Does `CLAUDE.md`'s `## Project Context` section name Unity as the language/platform?

If either is true → defer to `unity-code-review`:

This looks like a Unity project. The unity-code-review skill is a better fit —
it has Unity-specific footgun checklists. Switching to that.


Do not proceed with this skill.

### 1. Read CLAUDE.md

Always read the project's `CLAUDE.md` first. It defines project-specific conventions, naming rules, architectural preferences, and forbidden patterns. In particular, read the `## Project Context` section to learn the project's language and stack — the reviewer applies language-appropriate domain knowledge throughout all four passes.

Treat CLAUDE.md as **additive**, not authoritative: in the style pass, apply generic conventions appropriate to the project's language (as recorded in `## Project Context`) first, then layer CLAUDE.md rules on top as additional requirements. CLAUDE.md does not silence generic checks — both apply, and a finding can come from either source. When a CLAUDE.md rule and a generic convention conflict, mention both in the root cause and recommend following CLAUDE.md in the suggested fix.

If `CLAUDE.md` cannot be located, note this in the output and proceed with only the generic conventions. If `## Project Context` is missing, note this — the reviewer can still proceed but will use general best-practice rather than language-specific expertise.

### 2. Read the design frameworks and architecture (if present)

Look next to `CLAUDE.md` for artifacts the upstream skills produced:

- `framework.md` / `<Feature>.framework.md` (from the `explorer` skill) — project and feature design, with **Boundaries & invariants** you'll check in step 6.
- `architecture.md` / `<Feature>.architecture.md` (from the `architect` skill) — the project's code architecture, with **Guidelines**, **Structure**, and **Decisions** you'll check in step 7.

All of these are **optional**; many projects won't have them. Read whichever exist. If none exist, note nothing and proceed; the review runs on CLAUDE.md and the plan as before.

### 3. Read the plan

Understand what the implementation was supposed to do. Identify the concrete deliverables — methods, components, behaviors, fixes — that the plan committed to.

### 4. Read the code changes

Read every changed file. Do not review snippets in isolation if the surrounding context is available — bugs often live at the boundary between changed and unchanged code.

### 5. Check plan ↔ implementation correspondence (lax)

The check is: **does the plan exist in the code, and is the code actually using what the plan described?** Be lax about scope creep — unrelated refactors or extra changes are fine and are not findings by themselves. The plan-review skill handles plan quality; this skill cares whether the plan was meaningfully realized.

Flag only:
- Plan items that are missing from the implementation.
- Plan items that are present but unused (e.g. a method was added but nothing calls it, when the plan said it would be called).
- Plan items implemented in a way that contradicts what the plan said.

### 6. Check framework invariants (if frameworks are present)

If a `framework.md` or the feature's `<Feature>.framework.md` was read in step 2, verify the implementation does not violate any **Boundaries & invariants** they declare. This is a first-class correctness check, separate from plan correspondence: a change can faithfully match the plan and still break a project-level invariant.

- For each invariant (an "always" / "never" rule), find the code paths it constrains and confirm none of them can violate it. Give special weight to project-level invariants in `framework.md` — those are hard constraints that outrank feature-level decisions.
- A violated invariant is a **bug-severity** finding. In the root cause, name the invariant and the framework file it comes from (e.g. `framework.md`), so the next plan can trace it.
- If the plan or spec itself contradicts a framework invariant (the drift entered upstream, not in the code), still flag it — note that the conflict originates in the plan/spec, and recommend routing the fix back to reconcile them rather than patching only the code.
- If no frameworks were present, skip this step — it produces no findings and no note.

Do not re-derive the design here. You are checking the code against invariants that already exist, not re-litigating whether they're the right invariants.

### 7. Check architecture conformance (if an architecture is present)

If an `architecture.md` (or the feature's `<Feature>.architecture.md`) was read in step 2, verify the implementation conforms to its **Guidelines**, **Structure**, and **Decisions**. This is distinct from the Architecture review pass below (which applies `references/architecture.md`, a generic checklist) — here you check the code against the project's *own* stated architecture.

- For each guideline and decision, confirm the changed code doesn't violate it: wrong dependency direction, code placed outside its prescribed boundary, an infrastructure decision contradicted, a separation/cohesion rule broken.
- An architecture violation is an **arch**-severity finding by default; promote it to **bug** if it breaks a boundary the architecture states as a hard "must"/"never". In the root cause, name the violated guideline/decision and its source file (`architecture.md`), so the next plan can trace it.
- **Known, approved deviations are not fresh findings.** If the implementer surfaced an architecture conflict and the user approved a deliberate deviation (documented in the plan's Technical notes or the implementer's summary), note it as a known deviation rather than flagging it anew — but still list it so it stays visible.
- If the drift originated in the plan or the architecture itself rather than the code, flag it and recommend routing back to reconcile them, rather than only patching the code.
- If no architecture was present, skip this step.

Do not re-litigate the architecture's design — you check the code against it, you don't second-guess whether the guidelines are right.

### 8. Run the review passes

Walk through the review in priority order. Each pass has its own checklist in `references/`. Read the relevant reference file when you start that pass.

1. **Correctness and bugs** — highest priority. See `references/correctness.md`.
2. **Style, conventions, readability, maintainability** — including CLAUDE.md adherence. See `references/style-and-conventions.md`.
3. **Performance** — see `references/performance.md`.
4. **Architecture** — see `references/architecture.md`.

Language- or framework-specific footguns are part of the reviewer's domain knowledge. Apply them inside the relevant pass (a missed `await` is a correctness bug; an N+1 query is a performance issue; a missing transactional boundary is an architecture concern). Use the `## Project Context` section of CLAUDE.md to know what language/stack to apply expertise for.

Do not skip lower-priority passes if higher-priority ones found issues. The goal of running this early in the cycle is to surface as much as possible in one pass so the user has less to review at the end.

### 9. Write the findings

Use the output format below. One block per finding. Order findings by severity (bugs first, then performance, then style, then architecture — except where a "lower" finding is actually a bug in disguise, in which case promote it).

If nothing is found, say so explicitly: do not pad with weak findings to seem thorough.

## Output format

Begin every output with an iteration header on its own line:

Iteration: N of 3


Then one block per finding, using this exact structure:
Finding N: <short descriptive title>

Severity: bug | style | perf | arch
Location: <RelativePath/File.cs> :: <MethodOrSymbolName> (line ~<N>)
Root cause: <what is actually wrong, mechanically — not just the symptom>
Effect: <what goes wrong at runtime, at build time, or for the next developer>
Suggested fix: <concrete change, specific enough that the next planning step can act on it>


Notes on each field:

- **Severity** uses one of those four tags. "bug" includes correctness defects (logic, null handling, concurrency, language-specific footguns that cause incorrect behavior) **and framework-invariant violations** — for those, name the violated invariant and its source framework file in the root cause. "style" covers convention/readability/maintainability findings. "perf" covers performance issues including language- or framework-specific performance footguns. "arch" covers structural/coupling concerns **and architecture-conformance violations** — for those, name the violated guideline/decision and its source file (`architecture.md`) in the root cause, and promote to "bug" if a hard architectural boundary is broken. If a finding spans categories, pick the most severe and mention the others in the root cause.
- **Location** must include both the file path and the method/symbol name. Line numbers are approximate and helpful but not required if the symbol name is unambiguous.
- **Root cause** explains the *mechanism*, not just "this is broken". Direct and explanatory.
- **Effect** describes the consequence. Be concrete: "~50ms added to every request", "NullReferenceException when the user's session has expired", "next developer will assume this is thread-safe and it isn't".
- **Suggested fix** is concrete enough to feed into the next plan. If multiple fixes are reasonable, pick the one most consistent with CLAUDE.md and mention alternatives briefly.

End the output with a short summary line:

Summary: N finding(s) — X bug, Z style, W perf, V arch.


If nothing was found:

Summary: No findings. The implementation matches the plan and no defects, style violations, or performance/architecture issues were observed in this pass.


### Stop-report block (iteration 3 with non-empty findings, or beyond iteration 3)

If this is iteration 3 and findings are non-empty, OR if the conversation indicates iteration 3 is already complete and another review is being requested without an explicit override, append this block after the summary:

Iteration cap reached. This skill caps the review loop at 3 iterations. The findings above have not yet been resolved within that budget. Recommend handing off to the user to decide:

Accept the current state and proceed.
Authorize one or more additional iterations explicitly.
Restructure the plan to address remaining findings differently.

## What not to do

- Do not nitpick formatting that a linter or formatter handles (whitespace, brace style, trailing commas). Real defects only.
- Do not rewrite the code. Suggest fixes; the next planning step decides.
- Do not flag stylistic preferences that aren't in CLAUDE.md or established convention for the project's language.
- Do not invent a finding to look thorough. An empty review is a valid review.
- Do not review the plan itself — that's a separate skill.
- Do not re-litigate the framework's design. You check the code against its invariants; you don't second-guess whether the invariants are correct.
- Do not re-litigate the architecture's design either. You check the code against its guidelines and decisions; you don't second-guess whether they're the right ones.

## Behavior overrides from CLAUDE.md

At the start of every invocation, read the `## Skill Behaviors` section of `CLAUDE.md` and find the `### Reviewer` subsection. Apply any rules listed there as additional instructions on top of this skill's normal procedure.

If the section or subsection does not exist, create it with user confirmation before continuing. See `references/claude-md-behaviors.md` for reviewer-specific notes; the shared mechanism is documented in the specifier skill's `references/claude-md-behavior-section.md`.

Common rule types for the reviewer: severity calibration for this project, project-specific patterns to flag or ignore, expected dispute disposition tendencies, performance-pass strictness.

## Reference files

Read these when you reach the corresponding review pass. They contain detailed checklists.

- `references/correctness.md` — logic bugs, null handling, edge cases, concurrency, exception handling.
- `references/style-and-conventions.md` — CLAUDE.md adherence, naming, file organization, readability heuristics.
- `references/performance.md` — allocations, hot paths, caching, batch operations.
- `references/architecture.md` — coupling, single responsibility, module boundaries, dependency direction.

Note: `framework.md` / `<Feature>.framework.md` (from the `explorer` skill) and `architecture.md` / `<Feature>.architecture.md` (from the `architect` skill) are **external inputs**, not reference files owned by this skill. See steps 2, 6, and 7 for how they're consumed. (`references/architecture.md` above is a generic checklist — a different file from the project's `architecture.md`.)