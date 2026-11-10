import type { Settings } from '../types';
import { TONE_IDS } from '../types';
import { readJSON, STORAGE_KEYS, writeJSON } from './safeStorage';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  dialect: 'American',
  historyEnabled: false, // history is strictly opt-in
  liveGrammarCheck: true,
  defaultTone: 'professional',
  senderName: '',
};

const THEMES = ['light', 'dark', 'system'];
const DIALECTS = ['American', 'British', 'Australian', 'Canadian', 'Indian'];

/** Loads settings, ignoring any unknown or malformed values. */
export function loadSettings(): Settings {
  const raw = readJSON<Partial<Settings>>(STORAGE_KEYS.settings, {});
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    if (THEMES.includes(raw.theme as string)) s.theme = raw.theme!;
    if (DIALECTS.includes(raw.dialect as string)) s.dialect = raw.dialect!;
    if (typeof raw.historyEnabled === 'boolean') s.historyEnabled = raw.historyEnabled;
    if (typeof raw.liveGrammarCheck === 'boolean') s.liveGrammarCheck = raw.liveGrammarCheck;
    if (TONE_IDS.includes(raw.defaultTone!)) s.defaultTone = raw.defaultTone!;
    if (typeof raw.senderName === 'string') s.senderName = raw.senderName.slice(0, 100);
  }
  return s;
}

export function saveSettings(settings: Settings): boolean {
  return writeJSON(STORAGE_KEYS.settings, settings);
}
