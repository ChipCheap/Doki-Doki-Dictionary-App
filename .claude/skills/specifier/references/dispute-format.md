# `<feature>.disputed-findings.md` Format

When the specifier (in its re-planning role) believes one or more reviewer
findings are wrong, it writes `<feature>.disputed-findings.md` — flat, next to
`CLAUDE.md`, **no folder** — instead of silently overriding. One dispute round
follows; after that, any remaining disagreement is escalated to the user.

This file is ephemeral — delete it once the dispute is resolved (by reviewer
concession, specifier concession, or user decision). It must not survive into
the next outer iteration.

## When to dispute vs accept

Dispute only with a substantive reason the finding is wrong:

- The finding says the plan called for X, but it called for Y.
- The finding flags a language/framework issue that doesn't apply here (e.g. an
  N+1 pattern in a one-shot batch job, not a request loop).
- The finding misreads the framework — the plan did the thing deliberately
  because the framework required it.

**Not** legitimate: "I don't think it's important" (severity is the reviewer's
call — accept), "the fix is inconvenient", or a style disagreement where the
plan respected CLAUDE.md. When in doubt, accept. Disputes cost a round-trip and
should be rare.

## Format

```markdown
# Disputed Findings: <feature_name>

**Outer iteration:** <N>
**Plan under discussion:** <feature>.plan.md (current)
**Created by:** specifier

## Dispute 1
**Reviewer finding (verbatim):**
<paste the full finding block — number, severity, location, root cause, effect, suggested fix>

**Specifier's position:**
<2–4 sentences: is the finding factually wrong, misapplied, or based on a
misreading of the plan or framework? Be specific; cite the plan step or framework goal.>

**What the reviewer is asked to verify:**
<one concrete question>

**If reviewer concedes:** finding dropped from this iteration.
**If reviewer holds:** escalate to user.

## Dispute 2
<same structure>
```

## After the reviewer responds

- **Concede** → drop the finding, proceed.
- **Hold with clarification** → the clarification resolves it; accept the finding.
- **Hold without movement** → escalate to the user with both positions.

The specifier does **not** get a second round. One round, then accept-or-escalate.

## Cleanup

Delete the file once all disputes are resolved. If any were escalated, leave it
until the user decides, then delete.
