# CLAUDE.md `## Project Context` Section

A small section at the top of `CLAUDE.md` that records foundational facts about the project — primarily the language and stack — so downstream skills know what they're working with.

This section is bedrock, not refinement. Use the Skill Behaviors section for refinements that evolve over time; this section is for facts that don't change much.

## Section structure

```markdown
## Project Context

- **Language:** <e.g. "TypeScript", "Python 3.11", "Rust", "Go", "Unity / C#">
- **Stack / framework:** <e.g. "Next.js + Prisma + PostgreSQL", "FastAPI + SQLAlchemy", "Axum + SQLx", "Spring Boot">
- **Runtime:** <e.g. "Node 20", "Python 3.11", "JVM 21">
- **Test framework:** <e.g. "Jest", "pytest", "cargo test">
- **Other relevant context:** <one-line note on anything unusual — vendored dependencies, custom tooling, distributed setup, etc.>
```

Fields are optional. Only what's relevant for the project. The `Language` field is the only one that's load-bearing for skill routing.

## When to write this section

**On first run of any generic skill** if the section doesn't exist yet. The generic specifier handles this most naturally, since it has a Q&A phase at startup. Other generic skills, if they find no `## Project Context`, should stop and tell the user to run the specifier first — they should not invent the context themselves.

## How to write it

1. Ask the user the language/stack questions (the specifier does this in Step R2).
2. Compose the section based on their answer.
3. Show the proposed section to the user as a diff.
4. Wait for confirmation.
5. Write to `CLAUDE.md`, placed near the top of the file (just after the title if present, before any other major sections).

Do not write silently. CLAUDE.md is project-wide and any change should be visible.

## How skills read it

At startup, after locating CLAUDE.md, each skill:

1. Looks for the `## Project Context` section.
2. Reads the `Language` field — this is the primary fact that shapes everything downstream.
3. Reads other fields when relevant to its job (e.g. the reviewer cares about the test framework; the implementer cares about the runtime).

If the section is missing on a generic skill that's not the specifier, the skill should respond:

```
I can't find a Project Context section in CLAUDE.md. The skills need to know what language and stack the project uses before they can do their job well. Run the generic-specifier skill first, or add a Project Context section to CLAUDE.md manually.
```

Do not guess the language from file extensions or anything else — ask.

## Unity special case

If the user answers "Unity" or otherwise indicates a Unity project during specifier setup, the generic specifier defers to `unity-specifier` and lets that skill take over. The generic specifier does NOT write Unity context into CLAUDE.md in this case — the Unity specifier handles its own setup, and the user should use the Unity family of skills for the rest of the work.

If the user does write Unity into Project Context manually (or via the Unity specifier), the generic skills should defer to their Unity counterparts when invoked:

- `generic-specifier` reads `Language: Unity / C#` and hands off to `unity-specifier`.
- `generic-orchestrator` reads it and hands off to `unity-orchestrator`.
- Similarly for planner, implementer, reviewer.

This makes the two skill families mutually aware. Either can route to the other if the Project Context calls for it.

## Updating Project Context later

If the user changes language or stack mid-project (rare but possible — e.g. migrating from JavaScript to TypeScript), they can ask any skill to update `## Project Context`. Same flow: propose the change, show the diff, wait for confirmation, write. The skill detecting the change should warn that downstream skills will start applying the new conventions immediately.

## What this section is NOT

- It's not a place for per-skill rules — those go in Skill Behaviors.
- It's not a place for design decisions or architectural style — those belong in CLAUDE.md's main body.
- It's not project documentation — keep it short, factual, and machine-readable in the sense that any skill can pick out the language at a glance.
