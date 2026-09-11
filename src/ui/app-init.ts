/**
 * S29 — startup: durability, theme, and the install prompt.
 *
 * architecture.md D7: default browser storage is evictable under disk pressure,
 * and Safari deletes script-writable storage after seven days without site
 * interaction. `persist()` exempts the origin from pressure eviction, and
 * INSTALLING the app is what exempts it from Safari's seven-day rule — which is
 * why the install prompt here is a data-safety mechanism, not decoration.
 */

import {
  getDeviceValue,
  getGlobalSettings,
  setDeviceValue,
  type GlobalSettings,
} from '../progress/settings-repo';

export interface StartupReport {
  /** True when the browser agreed not to evict this origin under pressure. */
  storagePersisted: boolean;
  /** True when the app is running as an installed PWA rather than a tab. */
  installed: boolean;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari reports installation here rather than through display-mode.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Push the user's visual settings into the CSS custom properties. */
export function applySettings(settings: GlobalSettings): void {
  const root = document.documentElement;
  root.style.setProperty('--app-text-scale', String(settings.textScale));
  // Noto Sans is the coverage backstop, so it is dropped from the tail when it
  // is already the choice — otherwise the default setting yields
  // `'Noto Sans', 'Noto Sans', ...`. The rest of the stack always stays: a
  // fallback list is not a load-failure backup, it is PER-GLYPH cover, and the
  // browser walks it whenever the chosen face lacks a character.
  const stack = [
    `'${settings.fontFamily}'`,
    ...(settings.fontFamily === 'Noto Sans' ? [] : [`'Noto Sans'`]),
    `'Segoe UI'`,
    'system-ui',
    'sans-serif',
  ];
  root.style.setProperty('--app-font', stack.join(', '));

  if (settings.themeMode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', settings.themeMode);
}

export async function startup(): Promise<StartupReport> {
  applySettings(await getGlobalSettings());

  return {
    storagePersisted: await requestPersistentStorage(),
    installed: isInstalled(),
  };
}

/**
 * Which durability notice Home shows, if any.
 *
 * - `install`: the browser offered to install the app. Installing is what earns
 *   persistent storage from Chromium browsers and exempts the origin from
 *   Safari's seven-day rule, so this is offered even when storage is already
 *   persisted — it is still the stronger guarantee, and it is the taskbar entry.
 * - `unprotected`: no install is on offer AND the browser refused `persist()`.
 *   Opera and Firefox on desktop land here: neither can install web apps at all.
 *
 * `installSettled` exists because Chromium fires `beforeinstallprompt` a moment
 * AFTER the page loads. Deciding `unprotected` before then would flash a false
 * "your progress is not protected" at every Edge and Chrome user, just before
 * the install offer replaced it.
 */
export type DurabilityNotice = 'install' | 'unprotected' | 'none';

export interface DurabilityInputs {
  installed: boolean;
  persisted: boolean;
  canInstall: boolean;
  installSettled: boolean;
  dismissed: readonly DurabilityNotice[];
}

export function durabilityNotice(inputs: DurabilityInputs): DurabilityNotice {
  const { installed, persisted, canInstall, installSettled, dismissed } = inputs;
  if (installed) return 'none';
  if (canInstall) return dismissed.includes('install') ? 'none' : 'install';
  if (!installSettled || persisted) return 'none';
  return dismissed.includes('unprotected') ? 'none' : 'unprotected';
}

/**
 * Dismissals live in IndexedDB, next to the data they warn about, and that is
 * deliberate: a browser that wipes the app's storage wipes the dismissal too, so
 * the `unprotected` notice coming back is itself the evidence of a wipe.
 */
export async function dismissedNotices(): Promise<DurabilityNotice[]> {
  const value = await getDeviceValue('dismissedDurabilityNotices');
  return Array.isArray(value)
    ? value.filter((v): v is DurabilityNotice => v === 'install' || v === 'unprotected')
    : [];
}

export async function dismissNotice(notice: DurabilityNotice): Promise<DurabilityNotice[]> {
  const next = [...new Set([...(await dismissedNotices()), notice])];
  await setDeviceValue('dismissedDurabilityNotices', next);
  return next;
}
