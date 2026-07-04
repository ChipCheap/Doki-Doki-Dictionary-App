# Probing Checklist

Concrete prompts to use during Phases 4–6. Adapt to the feature; don't ask them mechanically.

## How to probe well

- **Batch, don't drip.** If the user describes a requirement that needs five questions, ask all five together.
- **Frame as completeness, not gotchas.** "I want to make sure we've thought about X" beats "you forgot Y".
- **Don't fish for problems that don't exist.** If a feature is genuinely simple, don't pad it with edge cases that don't apply.
- **Capture the user's "no" answers explicitly.** When the user says "that case won't happen", that's not a dropped question — it's an Assumption to write into the spec.
- **Use language-appropriate examples.** The Project Context section tells you the language and stack. Frame examples in those terms — HTTP errors for a web API, panics or errors for Rust, exceptions for Python, etc.

## Happy path probes

For each requirement:

- "What triggers this — user action, scheduled event, an upstream call, something else?"
- "What does the user / the system observe when this works?"
- "Is there a sequence of steps, or does it happen in one go?"
- "Who or what initiates it — the user, an external service, an internal scheduler, an event from another part of the system?"
- "What state does the system end up in?"

## Negative path probes

For each happy path:

- "What if the precondition for this isn't met?"
- "What if the input is invalid — out of range, wrong type, missing, malformed?"
- "What if this is triggered when it shouldn't be — during maintenance, mid-transaction, while another related operation is in flight?"
- "What if it conflicts with another action happening at the same time?"
- "What's the user-visible feedback when it fails?"

## Edge case probes

- "What happens at the zero/empty case — empty collection, no records, zero quantity?"
- "What happens at the max case — full collection, max allowed value, system limits reached?"
- "What happens on the first run with no prior state?"
- "What if a referenced resource is unavailable, deleted, or in an unexpected state during the operation?"
- "What if this happens multiple times in quick succession — debounce, queue, drop, allow?"
- "What if two of these happen concurrently?"

## External dependency probes

Only relevant if the feature integrates with external systems:

- "What does the feature expect from <dependency>? Is it always available?"
- "What happens if <dependency> fails — timeout, error response, partial data, network issue?"
- "Is there a fallback behavior, or should the feature surface the failure?"
- "Are there retries, backoff, circuit breakers, or is that handled elsewhere?"

Common dependency categories to probe:
- Databases (down, slow, returning stale or partial data).
- HTTP APIs (timeout, rate-limited, returning unexpected schemas).
- Message queues (unavailable, full, returning duplicates).
- File systems (missing file, permission denied, disk full).
- Caches (cold, stale, evicted mid-operation).
- Auth providers (token expired, provider down, identity unknown).

## Boundary probes

These prevent scope drift. Ask explicitly:

- "Should this also handle <adjacent_thing>? Or is that a separate concern?"
- "Does this feature own <data_or_state>, or just read it from somewhere else?"
- "When this feature is complete, what should still be missing or done in a separate cycle?"
- "UI / API / CLI / background — which surfaces does this touch?"
- "Multi-tenant or single-tenant? Per-user or shared?"
- "Persistence — does anything need to survive restarts, deployments, version migrations?"

## When to stop probing

You've probed enough when:

- Each requirement has at least one happy path and at least one negative path described.
- Edge cases have been considered for any requirement that has obvious boundary conditions.
- Out-of-scope items have been listed explicitly when the user could reasonably have expected them included.
- The user's "no" answers and assumptions are captured.
- The user is signaling completion ("that's it", "I think that's everything", "looks good").

Don't probe past the point of diminishing returns. The planner's clarification round can catch what slipped through.

## Anti-patterns

- **Probing in series.** Asking one question, waiting for the answer, asking the next. Slow and frustrating. Batch.
- **Asking questions whose answers are obvious from what the user already said.** Read what they said. Don't make them re-state it.
- **Asking about every theoretical edge case.** Pick the cases that matter for this feature.
- **Probing instead of writing.** At some point, draft the spec from what you have and let the user react to a concrete document. Open-ended Q&A can drag on; a draft surfaces gaps faster than questions.
