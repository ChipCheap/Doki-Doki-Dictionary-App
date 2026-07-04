# CLAUDE.md Behaviors — Planner-Specific Notes

The full mechanism is in the **specifier** skill's `references/claude-md-behavior-section.md`. This file is the planner-specific supplement.

## Subsection name

`### Planner`

## When the planner reads it

At the start of every invocation, before Phase 1.

## Rule types specific to the planner

- **Rationale verbosity:** "Skip rationale notes on trivial steps; only include when the choice isn't obvious."
- **Pattern preferences:** "Prefer dependency injection over service locators in this project."
- **Pattern prohibitions:** "Never propose ScriptableObject for runtime mutable state."
- **Self-check strictness:** "Treat any uncovered out-of-scope item the same as an uncovered requirement."
- **Plan-step granularity:** "Break plan steps so that no single step touches more than 3 files."

## Hard limits the rules cannot override

- The planner's spec self-check must always run. Rules can refine what counts as a gap, but cannot disable the check.
- The 3-iteration cap on the self-check loop is fixed. Rules cannot raise or lower it.
- The plan must always be written to `Plan.md` in the feature folder; rules cannot redirect output.
- Spec amendments still require user confirmation per Phase 2 — rules cannot grant autonomous spec-edit authority.

If a rule attempts to override one of these, surface it to the user at startup.

## Interaction with CLAUDE.md style rules

The planner's own procedure already treats `CLAUDE.md` as additive (alongside generic Unity/C# conventions) — that's separate from the `## Skill Behaviors` section.

Two different reads of CLAUDE.md happen at startup:
1. **The whole CLAUDE.md** as project conventions (existing behavior).
2. **The `### Planner` subsection of `## Skill Behaviors`** as procedural overrides for this skill (new behavior).

Both apply. The first informs plan content; the second informs how the planner operates.
