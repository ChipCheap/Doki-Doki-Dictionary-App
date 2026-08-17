# CLAUDE.md Behaviors — Orchestrator-Specific Notes

The full mechanism for the `## Skill Behaviors` section is documented in the
**specifier** skill's `references/claude-md-behavior-section.md`. Read that for
structure, creation flow, rule application, and updates. This file adds
orchestrator specifics.

## Subsection name

`### Orchestrator`

## When it's read

At the start of every invocation, after opt-out detection and before the file
checks. If the user opted out, the section is not read — the skill steps aside.

## Rule types specific to the orchestrator

- **Threshold adjustments:** "First-iteration findings ceiling is 15, not 10."
- **Token-budget overrides:** "Checkpoint at 80% rather than 85%."
- **Default reviewer thoroughness:** "Default review to level 2 for this project."
- **Trend relaxations:** "Allow iteration N one more finding than N-1 if all
  bug-severity findings are resolved."
- **Sub-agent naming overrides:** "The reviewer sub-agent here is `code_review`."

## Hard limits the rules cannot override

- The explicit opt-out ("implement normally" always steps aside).
- The handoff mechanism (a rule may move the threshold, not remove the checkpoint).
- The escalation report when a condition fires.
- The no-tests re-ask on reviewer thoroughness — a project default may set the
  level, but with no tests the orchestrator still confirms the choice with the
  user rather than applying a surface default silently.

If a rule tries to override one of these, surface it at startup and ask the user
to revise. If two rules conflict, surface and ask which stands.

## Fresh project

If `CLAUDE.md` exists but has no `## Skill Behaviors` section, the orchestrator
creates it with user confirmation, lazily — only when about to need it.
