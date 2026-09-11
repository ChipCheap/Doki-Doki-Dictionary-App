import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../database';
import { exportProfile } from '../progress/transfer';
import {
  dismissedNotices,
  dismissNotice,
  durabilityNotice,
  type DurabilityInputs,
} from './app-init';

/** An Opera-like tab: cannot install, storage refused, offer window elapsed. */
const base: DurabilityInputs = {
  installed: false,
  persisted: false,
  canInstall: false,
  installSettled: true,
  dismissed: [],
};

describe('durabilityNotice', () => {
  it('warns when the browser can neither install nor persist', () => {
    expect(durabilityNotice(base)).toBe('unprotected');
  });

  it('offers to install whenever the browser can', () => {
    expect(durabilityNotice({ ...base, canInstall: true })).toBe('install');
  });

  it('still offers to install when storage is already persisted', () => {
    // Installing remains the stronger guarantee, and it is the taskbar entry.
    expect(durabilityNotice({ ...base, canInstall: true, persisted: true })).toBe('install');
  });

  it('says nothing once installed', () => {
    expect(durabilityNotice({ ...base, installed: true })).toBe('none');
    expect(durabilityNotice({ ...base, installed: true, canInstall: true })).toBe('none');
  });

  it('says nothing when storage is persisted and no install is offered', () => {
    expect(durabilityNotice({ ...base, persisted: true })).toBe('none');
  });

  it('never warns before an install offer has had time to arrive', () => {
    // Otherwise every Edge and Chrome user sees a false warning flash first.
    expect(durabilityNotice({ ...base, installSettled: false })).toBe('none');
  });

  it('offers an install that arrives before the window has settled', () => {
    expect(durabilityNotice({ ...base, installSettled: false, canInstall: true })).toBe('install');
  });

  it('respects each dismissal separately', () => {
    expect(durabilityNotice({ ...base, dismissed: ['unprotected'] })).toBe('none');
    expect(durabilityNotice({ ...base, canInstall: true, dismissed: ['install'] })).toBe('none');
    // Dismissing the warning must not suppress an install that becomes possible.
    expect(durabilityNotice({ ...base, canInstall: true, dismissed: ['unprotected'] })).toBe(
      'install',
    );
  });
});

describe('notice dismissal', () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
  });

  it('remembers dismissals without duplicating them', async () => {
    expect(await dismissedNotices()).toEqual([]);
    await dismissNotice('unprotected');
    await dismissNotice('unprotected');
    await dismissNotice('install');
    expect(await dismissedNotices()).toEqual(['unprotected', 'install']);
  });

  it('ignores anything unrecognised in the stored row', async () => {
    await db.settings.put({ key: 'dismissedDurabilityNotices', value: ['install', 'bogus', 3] });
    expect(await dismissedNotices()).toEqual(['install']);
  });

  it('is device-local: never written into an exported profile', async () => {
    await dismissNotice('unprotected');
    const profile = await exportProfile();
    expect(JSON.stringify(profile)).not.toContain('unprotected');
  });
});
