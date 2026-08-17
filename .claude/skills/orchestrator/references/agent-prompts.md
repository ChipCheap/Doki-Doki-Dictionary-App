# Agent Prompts

Sub-agents have their own context windows and remember nothing from a previous
step. The orchestrator gives each one everything at spawn time — but in a fixed
layout so the runtime's prefix cache is reused across spawns.

## The shared prefix (identical in every spawn)

Build this block once per cycle and place it **first and byte-identical** in
every implementer / reviewer / specifier spawn, in exactly this order:

```
[1] tool definitions
[2] CLAUDE.md   (full, including ## Project Context)
[3] <feature>.architecture.md  + project architecture.md   (if present)
[4] <feature>.framework.md     + project framework.md       (if present)
[5] <feature>.plan.md          (current version)
--- cache breakpoint goes at the end of [5] ---
```

Do not reorder these, do not interleave iteration-specific data, and do not
paraphrase them — pass them verbatim. A single changed byte anywhere in [1]–[5]
invalidates the cache from that point on. Everything that changes between spawns
goes in the **tail**, after the breakpoint.

Include a one-line language summary at the very top of the tail (pulled from
`## Project Context`, e.g. "TypeScript / Next.js, Node 20, Jest") so the
sub-agent doesn't have to scan CLAUDE.md for it — this line lives in the tail,
not the shared block, because it's cheap and keeps [2] pristine.

## Implementer tail

```
You are the implementer for feature "<feature_name>".
Language/stack: <one-line summary>.

## Context
- Outer iteration <N>.
- <if N > 1:> Reviewer findings to fix this iteration:
    <last_findings verbatim>
- Relevant source files are on disk; read them yourself.

## Your task
Apply <feature>.plan.md to the codebase. Return:
1. Files changed (paths).
2. Short summary per plan step (reference Gx / Sx).
3. Deliberate deviations from the plan and why.
4. Anything you could not do, and why.
5. If you have specifier-routable questions (about *what*, not *how*), write
   <feature>.specifier-questions.md and report it instead of completing.
6. Architecture conflicts: if a step or a technical necessity would offend
   <feature>.architecture.md, surface it to the user (Technical note +
   "Architecture conflicts" section) rather than silently violating or bending.
7. After receiving reviewer findings (N > 1), if you dispute any finding about
   what the code actually does, write <feature>.implementer-disputed.md and
   report it before findings reach the specifier.
```

## Reviewer tail

```
You are the reviewer for feature "<feature_name>".
Use the reviewer skill.
Language/stack: <one-line summary>.

## Implementer's report
<last_implementation_summary verbatim, including files changed>

## Review thoroughness: <1 surface | 2 moderate | 3 deep>
- 1 (surface): fast sanity checks only — each plan goal (Gx) and step (Sx) is
  traceable in the code (markers, matching method names), plan keywords appear,
  changed files match the plan's file list. Lean on the test suite for the rest.
- 2 (moderate): surface, plus full plan-vs-code correspondence and the
  framework/architecture checks. Automatic; return findings or clean.
- 3 (deep): real code understanding, WITH the user. Question implementations,
  note anything that seems off or that could hurt the project's future, and
  return one bundle of questions/observations for the user to discuss. Do NOT
  auto-resolve into findings — this bundle goes to the user.

## Context
- Outer iteration <N>. Read the changed files yourself.

## Your task
Run the review at the stated thoroughness. For levels 1–2 return findings in the
skill's standard format, or a clean summary. For level 3 return the user bundle.
```

## Specifier tail (re-plan round)

Spawned only when the reviewer returned findings at level 1–2.

```
You are the specifier for feature "<feature_name>", in re-plan mode.
Language/stack: <one-line summary>.

## Context
- Outer iteration <N>.
- Reviewer findings to fold in:
    <last_findings verbatim>
- What the implementer reported building:
    <last_implementation_summary verbatim>

## Your task
Revise the plan per your re-planning procedure:
1. Version the current plan: rename <feature>.plan.md to <feature>.plan.v<N>.md
   (flat, same layer), then write the new <feature>.plan.md.
2. For each finding: accept (revise), dispute (write
   <feature>.disputed-findings.md, one round), or out-of-scope (escalate to the
   user before writing).
3. Re-run your framework-coverage self-check on the new plan.
Return: path to the new plan, the self-check verdict, and the dispute file path
if you wrote one.
```

## Dispute-round tails (reviewer as counterparty)

- **Implementer dispute round** — reviewer receives `<feature>.implementer-disputed.md`
  plus its original findings; for each, Concede / Hold-with-clarification /
  Hold-without-movement, limited to factual claims about what the code does.
  Conceded findings drop before re-planning.
- **Specifier dispute round** — reviewer receives `<feature>.disputed-findings.md`
  plus its original findings and the current plan; same three responses, limited
  to whether a finding misreads what the plan called for.

Each is one round, responses in the disputes' numbered order, final from the
reviewer side. Put the dispute file and the original findings in the tail; the
shared prefix already carries the plan and conventions.

## Specifier questions round (implementer → specifier)

Reviewer not involved. Specifier receives `<feature>.specifier-questions.md` in
the tail; for each question: Answer-in-place (optionally add a Technical note to
the plan), Plan-revision (edit, version if substantive), or Escalate-to-user.
It does not run its full self-check unless a revision was substantive.

## What the tail never contains

- Source code contents — sub-agents read files themselves.
- Paraphrases of the plan, framework, architecture, or findings — pass verbatim.
- Conversation history beyond the most recent relevant outputs.
- Anything from the shared prefix, duplicated.

## Trim order for tight budgets (tail only)

If the budget is tight at spawn, trim the **tail** in this order — never touch the
shared prefix, or you lose the cache and pay to re-encode it:

1. Trend info (keep only the last two findings-history rows).
2. Older implementer deviation notes.
3. Older specifier self-check failure notes.

Never trim the most recent findings, the implementer's latest summary, or the
thoroughness level.
