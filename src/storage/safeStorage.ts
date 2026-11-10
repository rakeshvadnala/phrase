/**
 * Thin wrapper around LocalStorage that never throws.
 * If storage is unavailable (private mode, blocked, quota exceeded) the app
 * keeps working with an in-memory fallback for the current session.
 */
const memory = new Map<string, string>();

function backend(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__phrase_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function isStorageAvailable(): boolean {
  return backend() !== null;
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = backend()?.getItem(key) ?? memory.get(key) ?? null;
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the value could only be kept in memory. */
export function writeJSON(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    const store = backend();
    if (!store) return false;
    store.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  try {
    backend()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const STORAGE_KEYS = {
  settings: 'phrase.settings.v1',
  customPhrases: 'phrase.customPhrases.v1',
  favourites: 'phrase.favourites.v1',
  dictionary: 'phrase.dictionary.v1',
  history: 'phrase.history.v1',
} as const;

/** Removes everything Phrase has ever stored in this browser. */
export function clearAllData(): void {
  for (const key of Object.values(STORAGE_KEYS)) removeKey(key);
}
