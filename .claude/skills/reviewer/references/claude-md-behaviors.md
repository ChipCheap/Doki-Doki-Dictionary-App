# CLAUDE.md Behaviors — Reviewer-Specific Notes

The full mechanism is in the **specifier** skill's `references/claude-md-behavior-section.md`. This file is the reviewer-specific supplement.

## Subsection name

`### Reviewer`

## When the reviewer reads it

At the start of every invocation, before step 1 of the review procedure (the CLAUDE.md read).

## Rule types specific to the reviewer

- **Severity calibration:** "N+1 queries are 'perf' severity by default; in this project (high-traffic API), treat them as 'bug' severity."
- **Pattern-specific permissions:** "Singletons are forbidden in this project — flag any new singleton as a 'bug' severity finding regardless of context."
- **Project-specific framework patterns:** "Methods decorated with @EventHandler are wired by the event bus; do not flag them as unused."
- **Performance-pass strictness:** "Always run the performance pass even if no obvious hot path is present — this project has a strict 60fps target."
- **Dispute-disposition tendencies:** "Be slow to hold-without-movement. If the implementer or specifier disputes a finding, prefer 'hold with clarification' and provide the supporting detail."
- **Domain-specific severity bumps:** "Any finding touching the save-load system is bumped one severity level."

## Hard limits the rules cannot override

- The reviewer must always read CLAUDE.md as part of step 1 — not just the behavior subsection, but the whole file as project conventions. Rules cannot skip this read.
- The reviewer must always run all four review passes in priority order. Rules can adjust *what counts* in a pass, but cannot disable the pass.
- The reviewer must always be willing to return an empty findings list when no real defects exist. Rules cannot mandate a minimum finding count.
- The reviewer's 3-iteration internal cap is fixed. Rules cannot raise or lower it.
- The "lax" plan-correspondence check is fixed in spirit (only flag missing/unused/contradicted plan items, not scope creep). Rules can refine examples but cannot make the check strict.

If a rule attempts to override one of these, surface it to the user at startup.

## Interaction with the existing CLAUDE.md style rules

The reviewer already treats `CLAUDE.md` as additive on top of generic conventions during the style pass — that's separate from the `## Skill Behaviors` section.

Two different reads of CLAUDE.md happen at startup:
1. **The whole CLAUDE.md** as project conventions feeding the style pass and informing all other passes (existing behavior).
2. **The `### Reviewer` subsection of `## Skill Behaviors`** as procedural overrides for this skill (new behavior).

Both apply. Style-rule violations from (1) are findings; rules from (2) change how the reviewer operates while finding them.

## Dispute-handling rules

The reviewer participates in two dispute rounds per cycle:
1. Against the implementer (about what the code does).
2. Against the specifier (about what the plan called for).

Rules in this subsection can shape disposition tendencies — when to concede vs. hold — but cannot:
- Force the reviewer to concede or hold a finding without case-by-case judgment.
- Skip the dispute round entirely.
- Make the dispute round more than one round.
