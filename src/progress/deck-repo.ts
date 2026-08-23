/**
 * S15 — decks and quick-create.
 *
 * Packs ship no decks at all, so quick-create is the only path from a fresh
 * install to something studiable — it is v1-blocking, not a convenience.
 *
 * A deck stores its member keys AND the recipe that produced them. Static, so
 * the deck never changes under the user; the recipe is kept so that when a pack
 * grows, the new matches can be offered in one press rather than the user
 * rebuilding the deck by hand.
 */

import { db } from '../database';
import { countForRecipe, entriesForRecipe } from '../dictionary/queries';
import { toDayNumber } from '../domain/ladder';
import type { DeckMember, WordKey } from '../domain/types';
import { bumpRevision, bumpRevisionInTransaction } from './revision';
import { DEFAULT_DECK_SETTINGS } from './settings-repo';
import type { DeckRecipe, DeckRow } from './schema';
import type { SessionSettings } from '../domain/session';

export type { DeckRecipe, DeckRow };

function newId(): string {
  return `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Strip any reactive Proxy wrapper so the value survives structured clone. */
function plainRecipe(recipe: DeckRecipe): DeckRecipe {
  return {
    difficulties: [...recipe.difficulties],
    contextTags: [...recipe.contextTags],
    includeSequence: recipe.includeSequence,
  };
}

export async function listDecks(): Promise<DeckRow[]> {
  return db.decks.toArray();
}

/** Grouped by language, in a stable order — Home renders one section each. */
export async function listDecksByLanguage(): Promise<Map<string, DeckRow[]>> {
  const decks = await db.decks.toArray();
  const grouped = new Map<string, DeckRow[]>();
  for (const deck of decks.sort((a, b) => a.createdOn - b.createdOn)) {
    const list = grouped.get(deck.language) ?? [];
    list.push(deck);
    grouped.set(deck.language, list);
  }
  return grouped;
}

export async function getDeck(id: string): Promise<DeckRow | undefined> {
  return db.decks.get(id);
}

export interface QuickCreateInput {
  language: string;
  name: string;
  recipe: DeckRecipe;
  tags?: string[];
}

/**
 * A readable name for a recipe, so the user is not asked to name a deck before
 * they know what is in it.
 */
export function describeRecipe(recipe: DeckRecipe): string {
  const parts: string[] = [];
  if (recipe.difficulties.length > 0) parts.push(recipe.difficulties.join(' + '));
  if (recipe.contextTags.length > 0) parts.push(recipe.contextTags.join(' + '));
  if (parts.length === 0) return 'Everything';

  const joined = parts.join(' ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * Build a deck from a recipe.
 *
 * A recipe matching nothing produces an EMPTY deck rather than a refusal — the
 * user asked for it, and an empty deck says so plainly where a silent failure
 * would leave them guessing.
 */
export async function quickCreateDeck(input: QuickCreateInput): Promise<DeckRow> {
  const entries = await entriesForRecipe(input.language, input.recipe);

  const deck: DeckRow = {
    id: newId(),
    language: input.language,
    name: input.name,
    // Everything stored is copied into a PLAIN array first. Callers in the UI
    // hand us Svelte reactive state, which is a Proxy — and IndexedDB's
    // structured clone cannot clone a Proxy, so persisting one throws
    // DataCloneError. Normalizing here protects every caller rather than
    // relying on each one to remember.
    tags: [...(input.tags ?? [])],
    memberKeys: entries.map((e) => e.key),
    recipe: plainRecipe(input.recipe),
    createdOn: toDayNumber(),
  };

  await db.decks.put(deck);
  await bumpRevision();
  return deck;
}

/** Re-exported so the deck-creation UI does not reach into `dictionary`. */
export { countForRecipe };

/** New matches a pack update brought in. */
export async function pendingAdditions(deck: DeckRow): Promise<WordKey[]> {
  const entries = await entriesForRecipe(deck.language, deck.recipe);
  const existing = new Set(deck.memberKeys);
  return entries.map((e) => e.key).filter((key) => !existing.has(key));
}

/**
 * The one-press action: take everything the recipe now matches.
 *
 * Adds only. A pack update that REMOVED words prunes nothing — absence is not an
 * operation, it is simply data that is not there, and a key left behind costs
 * nothing while making the word's return free if a later pack restores it.
 */
export async function applyPendingAdditions(deck: DeckRow): Promise<number> {
  const additions = await pendingAdditions(deck);
  if (additions.length === 0) return 0;
  await addWordsToDeck(deck.id, additions);
  return additions.length;
}

/**
 * Member keys that no longer resolve to a pack entry.
 *
 * Reported to the user as information only. Every count already comes from
 * `deckMembers`, which skips unresolvable rows, so a deck simply shrinks — but a
 * number that changes on its own needs an explanation somewhere.
 */
export async function absentMembers(deck: DeckRow): Promise<WordKey[]> {
  const rows = await db.entries.bulkGet([...deck.memberKeys]);
  return deck.memberKeys.filter((_, i) => rows[i] === undefined);
}

/** Idempotent: adding a word already in the deck changes nothing. */
export async function addWordsToDeck(
  id: string,
  keys: readonly WordKey[],
): Promise<void> {
  await mutateMembers(id, (members) => {
    for (const key of keys) members.add(key);
  });
}

/**
 * Remove words from one deck. Progress is untouched — the deck owns no progress,
 * so a word removed from its only deck keeps every level and due day it had and
 * becomes an unstudied dictionary word again.
 */
export async function removeWordsFromDeck(
  id: string,
  keys: readonly WordKey[],
): Promise<void> {
  await mutateMembers(id, (members) => {
    for (const key of keys) members.delete(key);
  });
}

async function mutateMembers(
  id: string,
  mutate: (members: Set<WordKey>) => void,
): Promise<void> {
  await db.transaction('rw', db.decks, db.settings, async () => {
    const deck = await db.decks.get(id);
    if (!deck) throw new Error('That deck no longer exists.');

    const members = new Set(deck.memberKeys);
    mutate(members);
    // Copied into a plain array for the same reason as `plainRecipe`.
    await db.decks.put({ ...deck, memberKeys: [...members] });
    await bumpRevisionInTransaction();
  });
}

export async function renameDeck(id: string, name: string, tags?: string[]): Promise<void> {
  await db.decks.update(id, { name, ...(tags ? { tags } : {}) });
  await bumpRevision();
}

export async function updateDeckSettings(
  id: string,
  patch: Partial<Pick<DeckRow, 'cardCap' | 'newWordsPerDay' | 'enabledVectors' | 'requeryMastered'>>,
): Promise<void> {
  // Same reason as `plainRecipe`: an array arriving from reactive state is a
  // Proxy, and structured clone rejects it.
  const safe = { ...patch, ...(patch.enabledVectors ? { enabledVectors: [...patch.enabledVectors] } : {}) };
  await db.decks.update(id, safe);
  await bumpRevision();
}

export async function deleteDeck(id: string): Promise<void> {
  await db.decks.delete(id);
  await bumpRevision();
}

/** Deck settings with defaults filled in, in the shape the domain expects. */
export function sessionSettingsFor(deck: DeckRow): SessionSettings {
  return {
    cardCap: deck.cardCap ?? DEFAULT_DECK_SETTINGS.cardCap,
    newWordsPerDay: deck.newWordsPerDay ?? DEFAULT_DECK_SETTINGS.newWordsPerDay,
    enabledVectors: deck.enabledVectors ?? DEFAULT_DECK_SETTINGS.enabledVectors,
    requeryMastered: deck.requeryMastered ?? DEFAULT_DECK_SETTINGS.requeryMastered,
  };
}

/** Deck members with the difficulty the session needs for weighted sampling. */
export async function deckMembers(deck: DeckRow): Promise<DeckMember[]> {
  const rows = await db.entries.bulkGet([...deck.memberKeys]);
  return rows
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((r) => ({ key: r.key, difficulty: r.difficulty }));
}
