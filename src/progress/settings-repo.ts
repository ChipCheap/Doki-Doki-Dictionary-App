/**
 * S14 — settings.
 *
 * Global settings live in a key/value bag; per-deck settings live on the deck
 * row itself, so a deck carries its own cadence rather than inheriting one.
 * Defaults are applied on read, so an absent value and a default value are
 * indistinguishable to callers.
 */

import { db } from '../database';
import { DEFAULT_VECTOR_IDS, type VectorId } from '../domain/vectors';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface GlobalSettings {
  /** Multiplier on the base type scale. Type size is a correctness concern
   *  here — Vietnamese tone marks are a few pixels tall. */
  textScale: number;
  /** Must come from the curated Vietnamese-capable list. */
  fontFamily: string;
  themeMode: ThemeMode;
  /** Last language studied, so the app opens where it was left. */
  currentLanguage?: string;
}

export const FONT_CHOICES: readonly string[] = Object.freeze([
  'Noto Sans',
  'Inter',
  'Roboto',
  'Open Sans',
  'Source Sans 3',
]);

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = Object.freeze({
  textScale: 1,
  fontFamily: 'Noto Sans',
  themeMode: 'system',
});

export const DEFAULT_DECK_SETTINGS = Object.freeze({
  cardCap: 20,
  /**
   * Five, not ten: one word yields one card, but a new word also generates its
   * own reviews later. Five keeps a 20-card session mostly review once the deck
   * is running.
   */
  newWordsPerDay: 5,
  enabledVectors: DEFAULT_VECTOR_IDS as readonly VectorId[],
  requeryMastered: false,
});

const GLOBAL_KEY = 'globalSettings';

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const row = await db.settings.get(GLOBAL_KEY);
  const stored = (row?.value ?? {}) as Partial<GlobalSettings>;
  return { ...DEFAULT_GLOBAL_SETTINGS, ...stored };
}

export async function updateGlobalSettings(
  patch: Partial<GlobalSettings>,
): Promise<GlobalSettings> {
  const next = { ...(await getGlobalSettings()), ...patch };
  await db.settings.put({ key: GLOBAL_KEY, value: next });
  return next;
}

/**
 * Device-local values, each under its own key and deliberately NOT inside
 * `GlobalSettings` — for the same reason backup.ts keeps its folder handle out:
 * `exportProfile` serializes global settings into every profile file, and these
 * describe THIS browser, not the learner. A dismissed install notice or a
 * declined app update means nothing on another machine.
 *
 * The keys are a closed union so a typo cannot silently read another row, and
 * so nothing here can ever collide with `globalSettings`.
 */
export type DeviceKey =
  /** Which durability notices were dismissed — see app-init.ts. */
  | 'dismissedDurabilityNotices'
  /** Fingerprint of the app update the user last said "not now" to. */
  | 'declinedUpdate';

export async function getDeviceValue(key: DeviceKey): Promise<unknown> {
  return (await db.settings.get(key))?.value;
}

export async function setDeviceValue(key: DeviceKey, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
