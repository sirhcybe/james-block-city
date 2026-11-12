/**
 * Grown-up settings (spec 007): sound and voice levels. Kept apart from the game save
 * (`jbc.settings`), so resetting the save keeps the volume the grown-up chose.
 */
export const SETTINGS_KEY = 'jbc.settings';

/** 0 = off, 0.5 = quiet, 1 = loud. */
export type Level = 0 | 0.5 | 1;
export const LEVELS: Level[] = [0, 0.5, 1];

export interface Settings {
  sound: Level;
  voice: Level;
}

export const DEFAULT_SETTINGS: Settings = { sound: 1, voice: 1 };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const asLevel = (v: unknown): Level => (v === 0 || v === 0.5 || v === 1 ? v : 1);

export function loadSettings(storage: StorageLike | null): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null;
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
    return { sound: asLevel(raw.sound), voice: asLevel(raw.voice) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: StorageLike | null, s: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage blocked: the levels still apply until the page closes
  }
}

/** What "unlock everything" grants (spec 007 AC6): all badges, upgrades and job missions. */
export function unlockEverything(jobMissionIds: readonly string[]): {
  badges: string[];
  owned: string[];
  done: string[];
} {
  return {
    badges: ['cop', 'fire', 'builder'],
    owned: [
      'police-bike',
      'long-ladder',
      'giant-drum',
      'cap-cop',
      'helmet-fire',
      'hardhat-builder',
    ],
    done: [...jobMissionIds],
  };
}
