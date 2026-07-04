# Spec.md Amendment Style

When the user answers clarifying questions in Phase 2, the planner amends Spec.md directly with the answers. The user reviews the diff and confirms before the planner proceeds to plan-writing.

The goal: amendments should be readable later by anyone — the implementer, the reviewer, a future planner on a related feature — without needing to know which parts of the spec came from the original session and which came from clarification rounds.

## Two amendment styles

Pick one consistently within a single Spec.md. If the spec already has a style, match it.

### Style A: Inline edits

Replace or expand the original requirement text in place. Best when the clarification refines or corrects existing wording.

**Before:**
> R3: The inventory updates when an item is picked up.

**After:**
> R3: The inventory updates when an item is picked up, where "picked up" means the player's collider triggers the item's pickup volume. The update is synchronous within the same frame.

### Style B: Appended clarifications section

Keep original requirements untouched and add a "## Clarifications" section at the end with numbered entries that reference the original requirements. Best when the spec is being read by multiple parties and changes need to be traceable.

**Appended:**
```
## Clarifications

**C1 (applies to R3):** "Picked up" means the player's collider triggers the item's pickup volume. The inventory update happens synchronously within the same frame.

**C2 (applies to R5):** Stacking applies only to consumable items. Equipment items do not stack regardless of identity.
```

## What not to do

- **Don't paraphrase the user's answer.** Use the user's words where possible. If their answer was conversational, tighten the phrasing but preserve the meaning.
- **Don't add scope.** The user clarified an existing requirement; that's not license to add new requirements. If a clarification reveals an unstated requirement, surface it as a new question rather than smuggling it in.
- **Don't silently fix typos or rephrase unrelated parts.** This is an amendment, not an edit pass. The user is confirming a specific change; other changes will surprise them.
- **Don't merge clarifications across requirements.** If the user answered three questions, write three clarifications (or three inline edits), not one combined note.

## Confirming the diff

After amending, show the user the change in a compact form:

```
Amended Spec.md as follows:

R3 changed from:
> The inventory updates when an item is picked up.
to:
> The inventory updates when an item is picked up, where "picked up" means...

Added C2:
> Stacking applies only to consumable items...

Confirm to proceed with planning, or tell me what to change.
```

Wait for confirmation. Do not proceed to Phase 3 until the user has confirmed.

## If the user wants to edit themselves

If the user prefers to edit Spec.md by hand instead of having the planner write the amendment:

1. Wait for them to make the edit.
2. Re-read Spec.md.
3. Confirm understanding by paraphrasing the new state of the relevant requirement back to the user.
4. Proceed.

This is the fallback, not the default. The default is planner-writes-the-amendment-and-user-confirms.
