# CLAUDE.md Skill Behaviors Section

A project-level mechanism for the user to refine each skill's behavior over time. As the team learns what works for them, the user adds rules to CLAUDE.md that each skill reads on startup and applies on top of its normal procedure.

This file is the reference for how the section works. The same mechanism applies to all six skills (architect, specifier, orchestrator, planner, implementer, reviewer).

## Section structure in CLAUDE.md

The section lives at the bottom of `CLAUDE.md`. Each skill has its own subsection.

```markdown
## Skill Behaviors

These sections are read by the corresponding skills at startup and applied as additional instructions for this project. Update them with user input over time.

### Architect

- <rule 1>
- <rule 2>

### Specifier

- <rule 1>
- <rule 2>

### Orchestrator

- ...

### Planner

- ...

### Implementer

- ...

### Reviewer

- ...
```

Empty subsections are valid. A skill with no rules reads nothing extra and proceeds with default behavior.

## Initial creation

If `CLAUDE.md` exists but does not contain a `## Skill Behaviors` section, the first skill that needs to read it (typically the specifier on a new project, or any other skill on an established one) creates the section with empty subsections.

Creation requires user confirmation:

```
I noticed CLAUDE.md doesn't yet have a "Skill Behaviors" section, which is
where per-skill refinements live. I'd like to add this empty scaffold to
the bottom of CLAUDE.md:

## Skill Behaviors
### Architect
### Specifier
### Orchestrator
### Planner
### Implementer
### Reviewer

OK to add?
```

Wait for confirmation. Do not create the section silently.

If `CLAUDE.md` does not exist at all, that's a precondition failure for everything downstream — stop and tell the user.

## How a skill reads its subsection

At the start of every invocation:

1. Locate `CLAUDE.md`.
2. Find the `## Skill Behaviors` section.
3. Find the subsection matching this skill's name (Architect / Specifier / Orchestrator / Planner / Implementer / Reviewer).
4. Read the bullet list.
5. Treat each bullet as an additional instruction that applies on top of the skill's normal procedure.

If the subsection is missing, create it (with user confirmation) before continuing. If the subsection exists but is empty, proceed with no extra instructions.

## How rules apply

Rules in the subsection layer on top of the skill's logic. They can:

- **Add** behaviors — "always ask about save/load compatibility for inventory features" (specifier).
- **Refine** behaviors — "include rationale notes only when the choice isn't obvious" (planner).
- **Adjust thresholds** — "raise the first-iteration findings ceiling to 15 for this project" (orchestrator).
- **Constrain** behaviors — "don't propose ScriptableObject patterns; this project doesn't use them" (planner).

Rules cannot:

- Override the skill's safety or hygiene rules (e.g. the implementer's "never cull outside the changeset" is non-negotiable).
- Replace the skill's core procedure wholesale.
- Conflict with each other silently — if two rules conflict, surface it to the user.

If a rule conflicts with the skill's core logic, the skill should surface the conflict at startup and ask the user to resolve it before proceeding.

## How rules are added

Updates are **explicit only**. The user must say something like:

- "Update the specifier's behavior to always ask about save compatibility."
- "Add a rule for the planner: skip rationale notes on trivial steps."
- "Tell the reviewer to be stricter about allocations in this project."

When the user says one of these:

1. Identify the target subsection.
2. Propose the rule wording. Concise, imperative, project-specific.
3. Show the user the diff: the subsection before and after.
4. Wait for confirmation.
5. Write to `CLAUDE.md`.

Example:

```
You'd like to add this rule to the Specifier subsection of CLAUDE.md:

- Always ask about save/load compatibility for any inventory-related feature.

The subsection would change from:
> ### Specifier
> - (no rules yet)

To:
> ### Specifier
> - Always ask about save/load compatibility for any inventory-related feature.

Confirm to write, or tell me to revise the wording.
```

Wait for confirmation. Do not write silently.

## Removing or changing rules

Same pattern in reverse. The user says "remove the rule about save compatibility" or "change the rule about rationale notes to..." — the skill proposes the diff, shows it, and waits for confirmation.

## Cross-skill rules

Sometimes a rule applies to multiple skills (e.g. "all skills should treat 'TODO' comments containing 'BLOCKER' as high-severity"). For these, ask the user which subsections to update, then apply the rule to each. Don't invent a "global" subsection — the per-skill structure is the contract.

## Versioning

CLAUDE.md is not versioned by this mechanism. If the user wants to track history of behavior changes, they can use git. The skills don't keep a changelog of rule updates.

## A note on respect

The rules in this section represent the user's accumulated judgment about how the team works best. Apply them carefully. If you find yourself questioning a rule mid-task, don't override it silently — surface the question to the user before deviating.
