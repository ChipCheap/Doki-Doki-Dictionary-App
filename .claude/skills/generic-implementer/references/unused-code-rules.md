# Unused Code Rules

What to cull, what to TODO, what to leave alone. Plus the framework-aware caution principle that prevents culling members the runtime wires up invisibly.

## Scope rule (strict)

**Only within the changeset.** Files the implementer created or modified during this implementation pass are in scope. Everything else is off-limits, regardless of how obviously dead it looks. Cleaning up unrelated dead code is a separate cycle's problem.

"Modified" means actually changed in this pass. Reading a file or opening it does not put it in scope.

## Decision tree

For each apparently-unused element inside the changeset:

```
1. Is it framework-wired, runtime-reflected, or otherwise indirectly invoked?
   → YES: Leave it alone. Do not cull. Do not TODO.

2. Is it part of an interface / trait / protocol contract (must exist even if empty)?
   → YES: Leave it. Add a TODO if the body is empty.

3. Did the plan explicitly introduce it for use in this iteration?
   → YES (used in iteration): If something in this iteration uses it, it's
                              not unused. Skip.
   → YES (planned for later): Keep it. Add // TODO referencing the plan step.
                              Add to "Unused-but-required" in summary.

4. Did the plan explicitly introduce it for a future iteration?
   → YES: Keep. Add // TODO referencing the plan step.
          Add to "Unused-but-required" in summary.

5. Is it incidental — neither plan-mandated nor framework-wired — and genuinely
   unused inside the changeset?
   → YES: Cull silently. Record in summary's "Culled" list.

6. Can't classify confidently?
   → Ask the user. Do not cull. Do not TODO autonomously.
```

## Framework-aware caution

A static reader can miss a lot of wiring. Many runtimes invoke code through paths that don't appear as direct calls in source. **Do not cull anything that *might* be invoked by such a path** without verifying it isn't.

Common categories of "looks unused but isn't" — these appear in most language ecosystems in some form:

**Decorator / annotation-driven invocation.** Functions, methods, classes, or fields with a decorator or annotation are often registered or wrapped at load time. The decorator's effect may include making the element a callback target, a route handler, an event listener, a DI provider, or a serialization target. Examples by ecosystem:
- Python: `@app.route`, `@pytest.fixture`, `@dataclass`, `@property`, `@classmethod`.
- TypeScript/JavaScript: `@Injectable`, `@Component`, `@Get`, `@EventListener`.
- Java/Kotlin: `@Autowired`, `@RequestMapping`, `@EventListener`, `@Bean`.
- C#: `[Inject]`, `[HttpGet]`, `[Test]`, `[Serializable]`.
- Rust: `#[derive(...)]`, `#[test]`, `#[get(...)]` (Rocket, etc.).

**Reflection / metaprogramming.** Methods called by string name through reflection (e.g. `getattr`, `Reflect.get`, `Method.invoke`), method tables built at runtime, or members enumerated by name. If a method's name matches a convention the framework looks for, it may be called.

**Dependency injection containers.** Classes registered with a DI container are constructed by name or by interface. The constructor is "unused" by static analysis but invoked at runtime.

**Serialization, deserialization, and ORM mapping.** Fields read or written by a serializer (JSON, XML, YAML, protobuf, etc.) or an ORM mapper are referenced by name, not by direct access. Removing such a field breaks the wire format or the database mapping silently.

**Code generators.** Some code is consumed by generators that produce dependent code elsewhere. Tools like Protobuf, OpenAPI, GraphQL, code-first ORMs, or build-time plugins create or use code that won't show up as direct calls.

**Event / message handlers.** Functions registered as listeners for events, message queues, signal handlers, or pub/sub systems are dispatched by lookup, not direct call.

**Framework lifecycle hooks.** Many frameworks call lifecycle methods by name on classes that fit a contract — middleware, plugins, services, components. The contract may be implicit (a method named `init` or `start`) rather than explicit (an interface).

**Test discovery.** Test frameworks find tests by name pattern, decorator, or attribute. Test code is normally outside a changeset, but if it's inside, the same caution applies.

**Plugins / extensions / scripting hooks.** If the project exposes a plugin API or scripting interface, members exposed for those audiences may have no in-tree callers.

When something *could* be invoked indirectly — particularly anything public, decorated, named conventionally, or attached to a framework type — **do not cull, ask the user**. The cost of leaving an unused element is minor; the cost of breaking framework wiring is invisible until runtime.

The project-specific list of "looks unused but isn't" patterns lives in `CLAUDE.md`'s `### Implementer` subsection (see `claude-md-behaviors.md`). As the user learns the project's quirks, they add them there. Read that subsection at startup and treat any patterns named there as part of the exemption list.

## TODO format

For elements kept but not yet used:

```
// TODO: <reason> — see Plan.md <step ID>
```

(Use the comment syntax of the project's language: `//`, `#`, `--`, etc.)

The reason should be brief and specific:
- `// TODO: Wired in S5 next iteration — see Plan.md S5`
- `// TODO: Interface contract from IUserClient — implementation pending S4`
- `// TODO: Public API introduced for external callers — see Plan.md "Out of scope" item 2`

Every TODO must reference a plan step or out-of-scope item, so the reviewer and user can verify the justification.

## Summary output requirements

The final summary must include two relevant sections:

**Culled** — Each removed dead element:
```
- src/auth/auth-service.ts :: private readonly LEGACY_TOKEN_FIELD
- src/auth/auth-service.ts :: private legacyHandleLogin()
```

**Unused-but-required (TODOs)** — Each TODO'd kept element:
```
- src/services/user-service.ts :: swapUsers(sourceId, destId) — Plan.md S5
- src/ui/user-view.tsx :: onInspectorSubmit() — Plan.md S6
```

The user must be able to grep `// TODO:` in the codebase and cross-reference with this summary list.

## What never happens

- No silent culling of public members that *might* be framework-driven.
- No culling of code outside the changeset.
- No removal of fields used by serializers, ORMs, or wire protocols.
- No removal of lifecycle methods or framework hook methods, even if their bodies are empty.
- No automatic addition of deprecation attributes (`@deprecated`, `[Obsolete]`, etc.) as a soft cull — the choice is keep-with-TODO or cull, nothing in between.
