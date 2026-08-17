# CLAUDE.md `## Project Context` Section

A small section near the top of `CLAUDE.md` recording foundational facts —
primarily the language and stack — so every skill knows what it's working with.
This is bedrock, not refinement (refinements live in `## Skill Behaviors`).

## Section structure

```markdown
## Project Context

- **Language:** <e.g. "TypeScript", "Python 3.11", "Rust", "Go", "Unity / C#">
- **Stack / framework:** <e.g. "Next.js + Prisma + PostgreSQL", "FastAPI + SQLAlchemy", "Unity 6">
- **Runtime:** <e.g. "Node 20", "Python 3.11", ".NET / Mono">
- **Test framework:** <e.g. "Jest", "pytest", "cargo test", "Unity Test Framework">
- **Other relevant context:** <one line on anything unusual>
```

Only the `Language` field is load-bearing for routing; the rest are optional.

## When to write it

**On first run**, if the section doesn't exist. The specifier handles this most
naturally (it has a Q&A phase at startup). Any other skill that finds no
`## Project Context` should stop and tell the user to run the specifier first —
it must not invent the context or guess from file extensions.

## How to write it

1. Ask the user the language/stack questions (the specifier does this in its
   first-run routing step).
2. Compose the section from their answer.
3. Show it as a diff and wait for confirmation.
4. Write it near the top of `CLAUDE.md`. Never write silently.

## How skills read it

At startup each skill locates `CLAUDE.md`, finds `## Project Context`, reads the
`Language` field, and reads other fields when relevant to its job (the reviewer
cares about the test framework; the implementer about the runtime).

## Unity vs generic

The pipeline skills (specifier, and by the same pattern explorer and architect)
are **single skills that route Unity vs generic internally** off this field
(and off an `Assets/`/`ProjectSettings/` folder or `.unity` files). There is no
separate Unity skill to defer to — the same skill simply proposes Unity idioms
when the project is Unity and generic idioms otherwise.

The downstream implementer and reviewer are (for now) still split into Unity and
generic variants; they read this field to select the right variant. When those
are unified later, they'll route the same internal way.

## Updating later

If the language/stack changes mid-project, any skill can update the section on
request: propose, show the diff, confirm, write — and warn that skills will
apply the new conventions immediately.
