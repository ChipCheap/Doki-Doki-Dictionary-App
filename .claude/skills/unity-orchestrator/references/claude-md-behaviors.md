# CLAUDE.md Behaviors — Orchestrator-Specific Notes

The full mechanism for the `## Skill Behaviors` section in `CLAUDE.md` is documented in the **specifier** skill's `references/claude-md-behavior-section.md`. Read that for the structure, creation flow, rule application, and update procedure.

This file captures orchestrator-specific specifics that supplement the shared mechanism.

## Subsection name

`### Orchestrator`

## When the orchestrator reads it

At the start of every invocation, after step 0a (opt-out detection) and before step 0b (folder structure verification). If the user has opted out, the behavior section is not read — the skill steps aside silently as designed.

## Rule types specific to the orchestrator

The orchestrator's subsection commonly accumulates rules in these categories:

- **Threshold adjustments:** "First-iteration findings ceiling is 15, not 10."
- **Token budget overrides:** "Trigger handoff at 80% rather than 85%."
- **Trend rule relaxations:** "Allow iteration N to have one more finding than N-1 if all bug-severity findings have been resolved."
- **Folder layout conventions:** "Feature folders are under `Specs/` rather than next to CLAUDE.md."
- **Sub-agent naming overrides:** "The reviewer sub-agent in this project is named `code_review` instead of `reviewer`."

## Hard limits the rules cannot override

These are non-negotiable regardless of any rule in the behavior section:

- The skill cannot remove the explicit opt-out behavior. Phrases like "implement normally" always step aside.
- The skill cannot remove or skip the Handoff.md mechanism. Token-budget rules can adjust the threshold, not eliminate the checkpoint.
- The skill cannot bypass the escalation report when an escalation condition fires.

If a rule attempts to override one of these, surface it to the user at startup and ask them to revise.

## Rule conflicts within the subsection

If two rules conflict (e.g. one sets the findings ceiling to 15, another to 10), surface the conflict to the user and ask which one stands.

## What happens on a fresh project

If `CLAUDE.md` exists but has no `## Skill Behaviors` section, the orchestrator creates it with user confirmation per the shared mechanism. The orchestrator does this lazily — only when about to need it — rather than eagerly at every invocation.
