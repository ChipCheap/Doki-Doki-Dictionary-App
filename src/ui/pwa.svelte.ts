/// <reference types="vite-plugin-pwa/vanillajs" />
/**
 * S29 — the live half of PWA durability: the browser's install offer, whether
 * the app is installed, and app updates.
 *
 * `listen()` runs from main.ts BEFORE the app mounts. Chromium fires
 * `beforeinstallprompt` once, early, and a listener attached later from a
 * component's onMount can simply miss it — leaving no install offer at all.
 */

import { registerSW } from 'virtual:pwa-register';
import { getDeviceValue, setDeviceValue } from '../progress/settings-repo';
import { isInstalled, requestPersistentStorage } from './app-init';

/** Chromium's install offer. Specified in WICG, shipped, and not in TS's DOM lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * How long after the service worker is ready to wait for an install offer
 * before concluding none is coming — see `durabilityNotice` in app-init.ts.
 */
const INSTALL_OFFER_GRACE_MS = 3_000;
/** Hard cap, for browsers whose service worker never becomes ready. */
const INSTALL_OFFER_CAP_MS = 10_000;

/**
 * A window left open all day never navigates, and navigation is when browsers
 * check for a new service worker. So an open app asks on its own, hourly.
 */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

class PwaState {
  installed = $state(isInstalled());
  /** Undefined until startup has asked; the notice waits for an answer. */
  persisted = $state<boolean | undefined>();
  /** True once an install offer would have arrived if the browser had one. */
  installSettled = $state(false);
  /** A new version is waiting and the user has not declined THIS one. */
  updateReady = $state(false);

  /**
   * Sticky for the page's lifetime: once the browser has offered an install,
   * it CAN install, even after that offer's one-shot event is spent. Reading
   * the event itself instead would flip the notice to "not protected" the
   * moment the user opened the install dialog.
   */
  #installOffered = $state(false);
  #installEvent: BeforeInstallPromptEvent | undefined;
  #updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
  #pendingFingerprint: string | undefined;

  get canInstall(): boolean {
    return this.#installOffered && !this.installed;
  }

  listen(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Suppresses Chromium's own mobile mini-infobar so the offer is made once,
      // by the app, with the reason stated. Desktop keeps its address-bar icon.
      event.preventDefault();
      this.#installEvent = event as BeforeInstallPromptEvent;
      this.#installOffered = true;
    });

    window.addEventListener('appinstalled', () => {
      this.#installEvent = undefined;
      this.installed = true;
      // Chromium grants persistence to installed apps; ask again now rather
      // than waiting for the next launch to find out.
      void requestPersistentStorage().then((granted) => (this.persisted = granted));
    });

    // "Open in app" from a tab switches the display mode without a reload.
    window
      .matchMedia('(display-mode: standalone)')
      .addEventListener('change', () => (this.installed = isInstalled()));

    this.#settleInstallOffer();
    this.#registerServiceWorker();
  }

  /**
   * Shows the browser's own install dialog. Must be called from a user gesture.
   * 'unavailable' when the offer is spent and the browser has not renewed it.
   */
  async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const event = this.#installEvent;
    if (!event) return 'unavailable';
    // One prompt per event: Chromium rejects a second `prompt()` on the same
    // one, and fires a fresh event later if the user declined.
    this.#installEvent = undefined;
    await event.prompt();
    return (await event.userChoice).outcome;
  }

  /** Activates the waiting version and reloads into it. */
  async applyUpdate(): Promise<void> {
    await this.#updateSW?.(true);
  }

  /**
   * Remembers which version was declined, so reloading the page does not offer
   * the same one again. A NEWER version has a different fingerprint and is
   * offered normally. Browsers still activate a waiting version once every
   * window of the app is closed, so declining postpones — it never pins an old
   * version forever.
   */
  async declineUpdate(): Promise<void> {
    this.updateReady = false;
    if (this.#pendingFingerprint) {
      await setDeviceValue('declinedUpdate', this.#pendingFingerprint);
    }
  }

  #settleInstallOffer(): void {
    const settle = (): void => {
      this.installSettled = true;
    };
    setTimeout(settle, INSTALL_OFFER_CAP_MS);
    if (!('serviceWorker' in navigator)) {
      settle();
      return;
    }
    void navigator.serviceWorker.ready.then(() => setTimeout(settle, INSTALL_OFFER_GRACE_MS));
  }

  #registerServiceWorker(): void {
    this.#updateSW = registerSW({
      onNeedRefresh: () => void this.#offerUpdate(),
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        setInterval(() => {
          if (navigator.onLine) void registration.update();
        }, UPDATE_CHECK_MS);
      },
    });
  }

  async #offerUpdate(): Promise<void> {
    this.#pendingFingerprint = await waitingVersionFingerprint();
    const declined = await getDeviceValue('declinedUpdate');
    // No fingerprint (offline, or the fetch failed) means the version cannot be
    // recognised later, so it is offered rather than silently suppressed.
    if (this.#pendingFingerprint && this.#pendingFingerprint === declined) return;
    this.updateReady = true;
  }
}

/**
 * Identifies the waiting version by hashing the deployed `sw.js`.
 *
 * The service-worker API exposes no version, but `sw.js` embeds the revision
 * of every precached file, so its hash changes exactly when the app does. It
 * is safe to fetch: the service worker does not precache itself, so this goes
 * to the network rather than returning the running version's copy.
 */
async function waitingVersionFingerprint(): Promise<string | undefined> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}sw.js`, { cache: 'no-store' });
    if (!response.ok) return undefined;
    const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

export const pwa = new PwaState();
