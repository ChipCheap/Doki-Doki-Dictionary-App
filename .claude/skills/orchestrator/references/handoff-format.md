# `<feature>.handoff.md` Format

Saves state when the token budget is exhausted (or the user pauses) mid-cycle,
and is the resume input next session. It must contain everything needed to
continue without re-reading the prior conversation.

## Location & naming

Flat, next to `CLAUDE.md` — **no feature folder**:

```
ProjectRoot/
├── CLAUDE.md
├── auth-2fa.plan.md
├── auth-2fa.plan.v1.md
└── auth-2fa.handoff.md
```

## Format

```markdown
# Handoff: <feature_name>

**Saved at:** <ISO timestamp>
**Reason:** <"token budget" | "escalation: <short reason>" | "user requested pause">
**Resume from step:** <"implementer" | "reviewer" | "re-plan (specifier)">

## Loop state
- **Outer iteration:** <N>
- **Reviewer thoroughness:** <1 surface | 2 moderate | 3 deep>
- **Specifier re-plan self-checks within current outer iteration:** <N>
- **Status when saved:** <implementing | reviewing | replanning | checkpointed | escalated>

## Findings history
| Outer iteration | Total findings | Bug findings | Notes |
|---|---|---|---|
| 1 | <N> | <N> | <short note> |
| 2 | <N> | <N> | <short note> |

## Last implementation summary
<implementer's report from the most recent implement step: files changed, what
was done, deviations>

## Last reviewer findings
<reviewer's output verbatim, in the reviewer skill's format — or, for a paused
deep review, the user bundle>

## Next intended action
<one sentence: e.g. "Spawn specifier in re-plan mode with iteration-2 findings.">

## Notes for resume
<user-adjusted thresholds, chosen thoroughness rationale, special instructions,
files to be aware of>
```

The plan itself is **not** copied here — it lives in `<feature>.plan.md` on disk
(with `<feature>.plan.vN.md` versions beside it). The handoff points at it.

## What goes here vs not

**Include:** all loop state, the most recent implementation summary and findings,
user-adjusted thresholds, the chosen thoroughness level.

**Do not include:** full code file contents; conversation transcripts; plans or
findings from iterations before the most recent.

## On resume

Read it fully, restore loop state, confirm with the user
("Resuming `<feature>`, outer iteration N, next step is X, reviewer thoroughness
L. Proceed?"), then jump to the next intended action. If it's malformed, don't
guess — show what's missing and ask whether to start fresh.

## On completion

Delete `<feature>.handoff.md` when the cycle completes — a stale handoff would
mislead a future "continue with the last feature".
