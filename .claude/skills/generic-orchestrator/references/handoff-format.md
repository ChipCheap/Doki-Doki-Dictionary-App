# Handoff.md Format

The Handoff.md file serves two purposes:
1. Save state when the token budget is exhausted mid-cycle.
2. Resume input for the orchestrator in the next session.

It must contain everything needed to continue without re-reading the prior conversation.

## Location

Inside the feature folder, next to `Spec.md`. E.g.:

```
ProjectRoot/
├── CLAUDE.md
└── auth-system/
    ├── Spec.md
    └── Handoff.md
```

## Format

Use this exact structure. Fields in `<>` are placeholders.

```markdown
# Handoff: <feature_name>

**Saved at:** <ISO timestamp>
**Reason:** <"token budget" | "escalation: <short reason>" | "user requested pause">
**Resume from step:** <"planner" | "implementer" | "reviewer">

## Loop state

- **Outer iteration:** <N>
- **Planner self-check iterations within current outer iteration:** <N>
- **Status when saved:** <planning | implementing | reviewing | checkpointed | escalated>

## Findings history

| Outer iteration | Total findings | Bug findings | Notes |
|---|---|---|---|
| 1 | <N> | <N> | <short note> |
| 2 | <N> | <N> | <short note> |
| ... | | | |

## Last plan

<full text of the most recent plan from the planner, verbatim>

## Last implementation summary

<implementer's report from the most recent implement step: files changed, what was done, any deviations noted>

## Last reviewer findings

<reviewer's output verbatim, in the reviewer skill's format>

## Next intended action

<one sentence describing what the orchestrator was about to do next: e.g. "Spawn planner with iteration-2 inputs (last plan, last implementation summary, last findings)">

## Notes for resume

<anything the orchestrator should know on resume: user-adjusted thresholds, special instructions, files to be aware of>
```

## What goes here vs what doesn't

**Include:**
- All loop state needed to continue.
- The most recent plan, implementation summary, and findings — these are inputs to the next step.
- User-adjusted escalation thresholds, if any have been changed during the session.

**Do not include:**
- Full code file contents. The implementer reads files from disk; the handoff just notes which files were touched.
- Conversation transcripts. The handoff is a state document, not a log.
- Plans or findings from iterations before the most recent — they are no longer needed for the next step.

## On resume

When the orchestrator finds a Handoff.md at startup:
1. Read it fully.
2. Populate loop state from it.
3. Confirm to the user: "Resuming feature `<feature_name>`, outer iteration <N>, next step is <step>. Proceed?"
4. After user confirmation, jump directly to the next intended action.

If the Handoff.md is malformed or missing required fields, do not guess — show the user what's missing and ask whether to proceed with a fresh start.

## On completion

When the cycle completes successfully, delete or archive Handoff.md. A stale handoff would mislead a future "continue with the last feature" request.
