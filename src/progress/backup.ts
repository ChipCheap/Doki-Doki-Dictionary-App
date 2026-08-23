/**
 * S7 — automatic backup to a folder on disk.
 *
 * architecture.md D8: backups that depend on the user remembering are not
 * backups. The File System Access API is the only way a browser can write to a
 * real folder, and it exists in Chrome and Edge only — so this is the one place
 * the architecture allows quiet degradation, because D8 scoped it that way from
 * the start. Everywhere else, manual export remains the route.
 *
 * The DIRECTORY HANDLE survives a browser restart; the PERMISSION on it does
 * not, and re-granting needs a user gesture. So this module can only ever report
 * that backups are paused — the prompt belongs to the UI.
 */

import { db } from '../database';
import { toDayNumber, type DayNumber } from '../domain/ladder';
import { exportProfile, toFileContents } from './transfer';

/**
 * The permission half of the File System Access API is not in TypeScript's DOM
 * library — it is specified, shipped in Chrome and Edge, and simply not typed.
 * Declared here rather than cast at each call site, so the shape is stated once.
 */
type PermissionMode = { mode: 'read' | 'readwrite' };

declare global {
  interface FileSystemDirectoryHandle {
    queryPermission(options: PermissionMode): Promise<PermissionState>;
    requestPermission(options: PermissionMode): Promise<PermissionState>;
  }
}

/**
 * Its own settings keys, deliberately NOT inside `GlobalSettings`.
 *
 * `exportProfile` serializes global settings into every profile file, and a
 * `FileSystemDirectoryHandle` is not JSON-serializable — it would land in each
 * exported profile as `{}` and travel to machines where it means nothing.
 */
const HANDLE_KEY = 'backupDirectoryHandle';
const LAST_BACKUP_KEY = 'lastBackupDay';

/** Backups are nudged when the newest one is older than this. */
export const BACKUP_MAX_AGE_DAYS = 7;

export type BackupStatus =
  /** No API in this browser. Manual export is the only route. */
  | 'unsupported'
  /** Supported, but no folder chosen yet. */
  | 'unconfigured'
  /** Folder chosen and writable. */
  | 'ready'
  /** Folder chosen but permission lapsed — needs a gesture to resume. */
  | 'paused';

export interface BackupState {
  status: BackupStatus;
  lastBackupDay?: DayNumber;
  folderName?: string;
}

export function isSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'showDirectoryPicker' in globalThis;
}

async function storedHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const row = await db.settings.get(HANDLE_KEY);
  const value = row?.value;
  // Structured clone preserves the handle across restarts; anything else in
  // this slot is a leftover from a hand-edited profile and is ignored.
  return value && typeof (value as FileSystemDirectoryHandle).queryPermission === 'function'
    ? (value as FileSystemDirectoryHandle)
    : undefined;
}

async function lastBackupDay(): Promise<DayNumber | undefined> {
  const row = await db.settings.get(LAST_BACKUP_KEY);
  return typeof row?.value === 'number' ? row.value : undefined;
}

/** Report the state WITHOUT prompting — safe to call on every startup. */
export async function backupState(): Promise<BackupState> {
  if (!isSupported()) return { status: 'unsupported' };

  const handle = await storedHandle();
  const last = await lastBackupDay();
  if (!handle) return { status: 'unconfigured', ...(last !== undefined ? { lastBackupDay: last } : {}) };

  const permission = await handle.queryPermission({ mode: 'readwrite' });
  return {
    status: permission === 'granted' ? 'ready' : 'paused',
    folderName: handle.name,
    ...(last !== undefined ? { lastBackupDay: last } : {}),
  };
}

/** Pick a folder. Must be called from a user gesture. */
export async function chooseFolder(): Promise<BackupState> {
  if (!isSupported()) return { status: 'unsupported' };

  const handle = await (
    globalThis as unknown as {
      showDirectoryPicker: (options: { id: string; mode: string }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker({ id: 'doki-dictionary-backups', mode: 'readwrite' });

  await db.settings.put({ key: HANDLE_KEY, value: handle });
  return backupState();
}

/** Re-grant a lapsed permission. Must be called from a user gesture. */
export async function resumeBackups(): Promise<BackupState> {
  const handle = await storedHandle();
  if (!handle) return backupState();

  await handle.requestPermission({ mode: 'readwrite' });
  return backupState();
}

export async function forgetFolder(): Promise<BackupState> {
  await db.settings.delete(HANDLE_KEY);
  return backupState();
}

/** One file per day, overwritten, so the folder does not fill with near-copies. */
function fileNameFor(day: Date): string {
  return `doki-dictionary-profile-${day.toISOString().slice(0, 10)}.json`;
}

export type BackupOutcome =
  | { wrote: true; fileName: string }
  | { wrote: false; reason: BackupStatus };

/**
 * Write a backup if one can be written.
 *
 * Never throws for an absent or lapsed permission — those are states the UI
 * reports, not failures of the caller. A genuine write error does propagate:
 * a backup that silently did not happen is the failure this exists to prevent.
 */
export async function backupNow(): Promise<BackupOutcome> {
  const state = await backupState();
  if (state.status !== 'ready') return { wrote: false, reason: state.status };

  const handle = await storedHandle();
  if (!handle) return { wrote: false, reason: 'unconfigured' };

  const fileName = fileNameFor(new Date());
  const file = await handle.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(toFileContents(await exportProfile()));
  await writable.close();

  await db.settings.put({ key: LAST_BACKUP_KEY, value: toDayNumber() });
  return { wrote: true, fileName };
}

/**
 * Startup cadence: back up when the newest one is over a week old.
 *
 * The other trigger is after every mass-edit, which the mass-edit screen calls
 * directly — that one is not about age, it is about the operation.
 */
export async function backupIfStale(): Promise<BackupOutcome> {
  const state = await backupState();
  if (state.status !== 'ready') return { wrote: false, reason: state.status };

  const last = state.lastBackupDay;
  if (last !== undefined && toDayNumber() - last < BACKUP_MAX_AGE_DAYS) {
    return { wrote: false, reason: 'ready' };
  }
  return backupNow();
}
