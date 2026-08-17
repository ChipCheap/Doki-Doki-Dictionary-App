# Architecture Review Checklist

Lowest priority of the four passes, but still worth a look. Focus on issues that will make future changes hard, not on stylistic preferences about "good architecture".

## Coupling

- A class reaching deep into another class's internals (`a.b.c.d.doThing()`) — the Law of Demeter is a useful heuristic.
- Two-way references where one-way would suffice.
- Modules that know about specific other module types when an interface or abstract type would decouple them.
- Hardcoded environment names, URLs, magic IDs, configuration values sprinkled across code — collect into a constants/config module.

## Responsibility

- A class or module doing several unrelated jobs (data fetching + business logic + UI rendering + logging). Split.
- Manager / Controller / Handler classes that grow to hundreds of lines and touch every system.
- Static utility modules accumulating unrelated helpers.
- "God objects" that own state for half the application.

## State ownership

- The same piece of state mutated from multiple places without a clear owner.
- State living at the wrong layer (request-scoped state on a singleton, application-scoped state on a request-handler).
- Shared mutable state without explicit synchronization in concurrent contexts.
- Caches that no one explicitly owns or invalidates.

## Interfaces and abstractions

- Interfaces with a single implementation that has no test or planned alternate — premature abstraction; flag only if it actively obscures.
- Conversely: code that switches on a type or string enum where polymorphism or pattern matching would be cleaner.
- Generic abstractions added "in case we need it later" without a concrete second use.
- Abstractions that leak the underlying implementation through their return types or thrown errors.

## Dependency direction

- Lower-level modules importing from higher-level modules (inverted dependencies).
- Domain code depending on infrastructure code (e.g. business logic importing a specific database driver).
- Circular dependencies between modules.
- Code in the "core" layer reaching out to UI, presentation, or transport layers.

## Module boundaries

- Logic that depends on the specific internal structure of another module (e.g. accessing what should be private state).
- Cross-module references that go through "wrong" entry points (bypassing a module's public API).
- Tests that reach into module internals because the public API isn't testable.
- Packages / namespaces / folders that don't reflect actual dependency boundaries.

## Build, test, and deployment structure

- Test code, build tooling, and runtime code mixed in the same module when separation would prevent accidental dependencies.
- Production code with development-only imports (debug tools, test fixtures).
- Configuration that mixes environment-specific values with code.
- Feature flags whose state isn't clearly owned or documented.

## Schema and contracts

- API endpoints, message formats, or database schemas modified in ways that break backward compatibility, without a migration plan.
- Implicit contracts (data shapes, error formats) that aren't documented or codified.
- Versioning concerns that aren't addressed for externally-visible interfaces.

## What not to flag

- Stylistic preferences ("I'd use a builder here instead of a constructor") when the existing approach works and isn't fragile.
- Speculative future-proofing that isn't justified by the plan.
- Disagreements with established patterns in CLAUDE.md — the project's chosen patterns win.
- "This could be more elegant" without a concrete cost to leaving it as-is.
