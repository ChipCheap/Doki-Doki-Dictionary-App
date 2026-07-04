# ImplementerDisputedFindings.md Format

When the implementer believes one or more reviewer findings misread *what the code actually does*, it writes `ImplementerDisputedFindings.md` in the feature folder. The orchestrator spawns the reviewer for **one** round of dispute resolution. The implementer ↔ reviewer round runs **before** the planner ↔ reviewer round, so findings the implementer can resolve never reach the planner.

This file is ephemeral — delete it once the dispute is resolved.

## When to dispute vs accept

The implementer's standing is narrow: disputes are limited to **what the code actually does**. Anything else gets routed elsewhere or accepted.

Legitimate implementer disputes:

- The finding misreads the call sites of a method ("reviewer claims `Update`; actual callers are event-driven").
- The finding flags a member as unused when it's framework-driven (decorator-registered handler, DI-injected dependency, serialized field, reflection-invoked callback).
- The finding describes a code path that's actually unreachable.
- The finding asserts code does X when it demonstrably does Y.

Not legitimate (route to planner or accept):

- "The fix would require changing the plan." → route to planner.
- "This conflicts with the spec." → route to planner.
- "I don't think this matters." → accept the finding.
- "I disagree with the reviewer's style preference." → accept (if CLAUDE.md is silent on it, the reviewer's call stands).

When in doubt, accept. Disputes cost a round-trip; they should be rare and substantive.

## Format

```markdown
# Implementer-Disputed Findings: <feature_name>

**Outer iteration:** <N>
**Plan version under discussion:** Plan.md (current)
**Created by:** implementer

## Dispute 1

**Reviewer finding (verbatim):**
<paste the full finding block from the reviewer's output: number, severity, location, root cause, effect, suggested fix>

**Implementer's position:**
<2–4 sentences. State the factual disagreement: what the code actually does, with file/line references. No speculation about intent — just the mechanics.>

**Specific evidence:**
<concrete pointers the reviewer can verify:>

- File and line: <src/services/user/user-service.ts:88>
- Caller(s) of the method in question: <list them, with file:line each>
- Or — wiring source: "Registered via @EventListener decorator in src/events/user-events.ts; invoked by the event dispatcher at runtime"

**What the implementer is asking the reviewer to verify:**
<one concrete question, e.g. "Confirm whether the call-site list at PlayerController.cs:88 is complete — if so, this method never runs from Update.">

**If reviewer concedes:** the finding is dropped before the findings reach the planner.
**If reviewer holds:** the implementer accepts. If the resolution still leaves genuine disagreement, escalate to the user.

## Dispute 2

<same structure>

...
```

## After the reviewer responds

The reviewer's response per dispute will be one of:

- **Concede** — the reviewer accepts the implementer's correction. Finding is dropped.
- **Hold with clarification** — the reviewer maintains the finding and supplies clarifying detail the implementer didn't have (e.g. "the method is also called from Player.cs:204 in `Update`"). The implementer accepts the finding.
- **Hold without movement** — the reviewer maintains the finding without further detail. If genuine disagreement remains, escalate to user.

The implementer does not get a second round. One round, then accept or escalate.

## How surviving findings flow onward

After this round:

- Findings the reviewer conceded → removed from the findings set, never seen by the planner.
- Findings the reviewer held → handed to the planner as part of the normal flow. The planner may itself dispute them in its own round (planner ↔ reviewer), but the implementer has no further say.
- Findings escalated to user → user decides. Their decision propagates to whatever step comes next.

## Cleanup

When the round is complete:

1. If all disputes were resolved (conceded or accepted), delete `ImplementerDisputedFindings.md`.
2. If any were escalated to the user, leave it in place until the user has decided; then delete.

Do not let this file survive into the next outer iteration.
