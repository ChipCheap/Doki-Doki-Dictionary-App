# Architecture Review Checklist

Lowest priority of the five passes, but still worth a look. Focus on issues that will make future changes hard, not on stylistic preferences about "good architecture".

## Coupling

- A class reaching deep into another class's internals (`a.b.c.d.DoThing()`) — the Law of Demeter is a useful heuristic.
- Two-way references where one-way would suffice.
- Components that know about specific other component types when an interface or event would decouple them.
- Hardcoded scene names, tags, layer names, asset paths sprinkled across code — collect into a constants/config class.

## Responsibility

- A `MonoBehaviour` doing several unrelated jobs (movement + input + UI + audio). Split.
- Manager / Controller / Handler classes that grow to hundreds of lines and touch every system.
- Static utility classes accumulating unrelated helpers.

## State ownership

- The same piece of state mutated from multiple classes without a clear owner.
- Game state living on MonoBehaviours that get destroyed on scene reload, when it should be on a `ScriptableObject` or persistent system.
- ScriptableObject state mutated at runtime — survives play mode in the editor and can corrupt saved assets. Either treat as read-only, or use a runtime copy.

## Interfaces and abstractions

- Interfaces with a single implementation that has no test or planned alternate — premature abstraction; flag only if it actively obscures.
- Conversely: code that switches on a type or string enum where polymorphism would be cleaner.
- Generic abstractions added "in case we need it later" without a concrete second use.

## Scene and prefab structure

- Logic that depends on specific GameObject hierarchy (`transform.parent.parent.GetComponent<...>()`) — fragile.
- Prefabs with required references that the scene can't satisfy.
- Cross-scene references via singletons that obscure the actual data flow.

## Assembly definitions

- Test code, editor code, and runtime code in the same assembly when separate asmdefs would isolate them.
- Circular references between asmdefs (Unity will refuse to compile, but the underlying design problem may exist in a single-asmdef project too).

## What not to flag

- Stylistic preferences ("I'd use an event here instead of a direct call") when the existing approach works and isn't fragile.
- Speculative future-proofing that isn't justified by the plan.
- Disagreements with established patterns in CLAUDE.md — the project's chosen patterns win.
