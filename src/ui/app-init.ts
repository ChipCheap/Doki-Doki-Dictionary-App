/**
 * S29 — startup: durability, theme, and the install prompt.
 *
 * architecture.md D7: default browser storage is evictable under disk pressure,
 * and Safari deletes script-writable storage after seven days without site
 * interaction. `persist()` exempts the origin from pressure eviction, and
 * INSTALLING the app is what exempts it from Safari's seven-day rule — which is
 * why the install prompt here is a data-safety mechanism, not decoration.
 */

import { getGlobalSettings, type GlobalSettings } from '../progress/settings-repo';

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
  root.style.setProperty(
    '--app-font',
    `'${settings.fontFamily}', 'Noto Sans', 'Segoe UI', system-ui, sans-serif`,
  );

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
