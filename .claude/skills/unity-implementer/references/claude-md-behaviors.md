# CLAUDE.md Behaviors — Implementer-Specific Notes

The full mechanism is in the **specifier** skill's `references/claude-md-behavior-section.md`. This file is the implementer-specific supplement.

## Subsection name

`### Implementer`

## When the implementer reads it

At the start of every invocation, before Phase 1.

## Rule types specific to the implementer

- **Cull conservatism:** "Never cull methods marked `protected` or `internal`, even within the changeset — they may be reflection-targets in test code."
- **Cull permissiveness:** "If a method is in an `Editor/` folder and not referenced anywhere, cull it without asking."
- **Preferred Unity idioms:** "This project uses UniTask instead of coroutines. Default to UniTask for new async code."
- **Mandatory technical-note categories:** "Always add a Technical note when introducing a new asmdef or modifying an existing one."
- **Architectural-pause triggers:** "Always pause and ask before adding a new `[SerializeField]` field — they affect Inspector layout."
- **Forbidden APIs:** "Don't use `Resources.Load` — this project uses Addressables exclusively."

## Hard limits the rules cannot override

- The "only within the changeset" rule for culling is non-negotiable. No rule can authorize culling outside the changeset.
- Reflection-aware exemption list (UnityEvent targets, `[SerializeField]`, lifecycle methods, etc.) cannot be overridden. Rules can *add* to the exemption list, never remove from it.
- Technical notes still require user confirmation before being written to Plan.md. Rules cannot grant autonomous note-writing authority.
- Architectural-ambiguity pauses still happen on the implementer's judgment. Rules can *add* specific triggers ("always pause for X"), never remove them ("never pause for Y").

If a rule attempts to override one of these, surface it to the user at startup.

## Project-specific reflection patterns

If the project uses reflection patterns the implementer wouldn't otherwise know about — custom serialization, custom message routing, code generation that produces dependent code — the user should add rules under this subsection naming them. Example:

```
- The InventoryAttribute on a method marks it as a Dynamic callback registered via Reflection at startup; methods bearing it must never be culled even if no call site is visible.
```

This is how the implementer learns project-specific footguns that aren't covered by the generic Unity reflection-aware checklist.
