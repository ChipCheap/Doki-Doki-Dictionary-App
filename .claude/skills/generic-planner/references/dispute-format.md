# DisputedFindings.md Format

When the planner believes one or more reviewer findings are wrong, it writes `DisputedFindings.md` in the feature folder instead of silently overriding. The orchestrator spawns the reviewer for **one** round of dispute resolution; after that, any remaining disagreement is escalated to the user.

This file is ephemeral — delete it once the dispute is resolved (whether by reviewer concession, planner concession, or user decision).

## When to dispute vs accept

Dispute only when the planner has a substantive reason to believe the finding is wrong. Examples of legitimate dispute:

- The finding asserts the plan called for X, but the plan actually called for Y.
- The finding flags a language- or framework-specific issue that doesn't apply in this context (e.g. flags an N+1 query pattern when the method only runs from a one-shot batch job, not in a request loop).
- The finding misreads the spec — the planner deliberately did the thing the finding objects to because the spec required it.

Examples of **not** legitimate dispute:

- "I don't think this is important." (Not the planner's call. The reviewer is checking severity; accept it.)
- "The fix would be inconvenient." (Inconvenience is not grounds for dispute.)
- "I disagree with the reviewer's style preference." (If the planner respected CLAUDE.md and the reviewer is flagging a generic style point, accept it or escalate as out-of-scope; don't dispute.)

When in doubt, accept the finding. Disputes cost a round-trip and should be rare.

## Format

```markdown
# Disputed Findings: <feature_name>

**Outer iteration:** <N>
**Plan version under discussion:** Plan.md (current)
**Created by:** planner

## Dispute 1

**Reviewer finding (verbatim):**
<paste the full finding block from the reviewer's output, including its number, severity, location, root cause, effect, and suggested fix>

**Planner's position:**
<2–4 sentences. State whether the planner believes the finding is factually wrong, misapplied, or based on a misreading of the plan or spec. Be specific. Cite the relevant plan step or spec requirement.>

**What the planner is asking the reviewer to verify:**
<one concrete question, e.g. "Confirm that this query is only ever invoked from the nightly batch job, in which case the N+1 cost is acceptable since it runs once per day, not per request.">

**If reviewer concedes:** the finding is dropped from this iteration's set.
**If reviewer holds:** escalate to user.

## Dispute 2

<same structure>

...
```

## After the reviewer responds

The reviewer's response to disputes will look like one of:

- **Concede:** "You're right — I misread the call site. Drop finding F3." The planner drops the finding and proceeds.
- **Hold with clarification:** "The call site you mention is not the only one — see Player.cs:204 where this is also invoked from Update. Finding stands." The planner accepts the finding (the reviewer's clarification has resolved the disagreement).
- **Hold without movement:** "Finding stands." Escalate to the user with both positions presented.

The planner does **not** get a second round. One dispute round, then accept-or-escalate.

## Cleanup

When the dispute round is complete:

1. If all disputes were resolved (conceded or accepted), delete `DisputedFindings.md`.
2. If any were escalated to the user, leave the file in place until the user has decided; then delete it.

The file should not survive into the next outer iteration. A stale dispute file would confuse future runs.
