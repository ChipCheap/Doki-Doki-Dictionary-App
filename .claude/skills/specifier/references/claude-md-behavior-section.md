# CLAUDE.md `## Skill Behaviors` Section

A project-level mechanism for the user to refine each skill's behavior over time.
As the team learns what works, the user adds rules to `CLAUDE.md` that each skill
reads on startup and applies on top of its normal procedure. This file documents
the shared mechanism; every pipeline skill uses it.

## Section structure

Lives at the bottom of `CLAUDE.md`. One subsection per skill:

```markdown
## Skill Behaviors

These sections are read by the corresponding skills at startup and applied as
additional instructions for this project. Update them with user input over time.

### Explorer
- <rule>

### Architect
- <rule>

### Specifier
- <rule>            (covers both specification and planning rules)

### Implementer
- <rule>

### Reviewer
- <rule>

### Orchestrator
- <rule>
```

Empty subsections are valid. There is **no standalone Planner subsection** — the
specifier absorbed the planner, so plan-related rules (step granularity,
rationale-note verbosity, self-check strictness) live under `### Specifier`.

## Initial creation

If `CLAUDE.md` exists but has no `## Skill Behaviors` section, the first skill
that needs it creates the scaffold **with user confirmation** (show the proposed
empty section, wait for an OK — never create it silently). If `CLAUDE.md` itself
doesn't exist, that's a precondition failure for everything downstream — stop and
tell the user.

## How a skill reads its subsection

At the start of every invocation: locate `CLAUDE.md`, find `## Skill Behaviors`,
find the subsection matching this skill, read the bullets, and treat each as an
additional instruction on top of the normal procedure. If the subsection is
missing, create it (with confirmation); if empty, proceed with no extras.

## How rules apply

Rules can **add**, **refine**, **adjust thresholds**, or **constrain**
behaviors. They cannot override a skill's safety/hygiene rules, replace its core
procedure wholesale, or silently conflict — if two rules conflict, surface it.
If a rule conflicts with core logic, surface it at startup before proceeding.

## How rules are added or removed

**Explicit only.** When the user asks to add/change/remove a rule: identify the
subsection, propose concise imperative wording, show the before/after diff, wait
for confirmation, then write. Same flow in reverse for removal. Never write
silently. For a rule spanning several skills, ask which subsections to update and
apply it to each — don't invent a global subsection.

## A note on respect

These rules are the user's accumulated judgment about how the team works best.
Apply them carefully; if you find yourself questioning one mid-task, surface the
question rather than deviating silently.
