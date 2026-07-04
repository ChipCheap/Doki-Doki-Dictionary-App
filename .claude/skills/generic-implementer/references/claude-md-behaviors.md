# CLAUDE.md Behaviors — Implementer-Specific Notes

The full mechanism is in the **specifier** skill's `references/claude-md-behavior-section.md`. This file is the implementer-specific supplement.

## Subsection name

`### Implementer`

## When the implementer reads it

At the start of every invocation, before Phase 1.

## Rule types specific to the implementer

- **Cull conservatism:** "Never cull methods marked `protected` or `internal`, even within the changeset — they may be reflection-targets in test code."
- **Cull permissiveness:** "If a method is in an `Editor/` folder and not referenced anywhere, cull it without asking."
- **Preferred language idioms:** "Prefer async/await over Promise chains. Use AbortController for cancellation."
- **Mandatory technical-note categories:** "Always add a Technical note when introducing a new database migration or modifying an existing one."
- **Architectural-pause triggers:** "Always pause and ask before adding a new public API method — they require API version coordination."
- **Forbidden APIs:** "Don't use `console.log` — this project uses the structured logger exclusively."

## Hard limits the rules cannot override

- The "only within the changeset" rule for culling is non-negotiable. No rule can authorize culling outside the changeset.
- Framework-aware exemption principles (decorator-driven invocation, DI-injected dependencies, serialized fields, lifecycle methods, etc.) cannot be overridden. Rules can *add* project-specific patterns to the exemption list, never remove from it.
- Technical notes still require user confirmation before being written to Plan.md. Rules cannot grant autonomous note-writing authority.
- Architectural-ambiguity pauses still happen on the implementer's judgment. Rules can *add* specific triggers ("always pause for X"), never remove them ("never pause for Y").

If a rule attempts to override one of these, surface it to the user at startup.

## Project-specific reflection patterns

If the project uses reflection patterns the implementer wouldn't otherwise know about — custom serialization, custom message routing, code generation that produces dependent code — the user should add rules under this subsection naming them. Example:

```
- The @JobHandler decorator marks a method as a background job target registered by the job runner at startup; methods bearing it must never be culled even if no call site is visible.
```

This is how the implementer learns project-specific footguns that aren't covered by the generic framework-aware checklist.
