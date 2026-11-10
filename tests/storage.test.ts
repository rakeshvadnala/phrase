import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHistory,
  deleteHistoryRecord,
  loadHistory,
  MAX_HISTORY,
  saveHistoryRecord,
} from '../src/storage/historyStorage';
import {
  addCustomPhrase,
  addDictionaryWord,
  deleteCustomPhrase,
  loadCustomPhrases,
  loadDictionary,
  loadFavourites,
  removeDictionaryWord,
  setFavourite,
  updateCustomPhrase,
  validatePhraseInput,
} from '../src/storage/phraseStorage';
import { clearAllData, isStorageAvailable, readJSON, STORAGE_KEYS, writeJSON } from '../src/storage/safeStorage';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/storage/settingsStorage';
import { BUILTIN_RULES } from '../src/engine/toneEngine';
import { improve } from './helpers';

beforeEach(() => {
  clearAllData();
  localStorage.clear();
});

describe('custom phrase management', () => {
  it('starts empty and adds a phrase', () => {
    expect(loadCustomPhrases()).toEqual([]);
    const rules = addCustomPhrase({ original: ' eod ', replacement: 'end of day', tone: 'professional', alternatives: ['close of business', ' '] });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ original: 'eod', replacement: 'end of day', tone: 'professional', custom: true, alternatives: ['close of business'] });
    expect(loadCustomPhrases()).toEqual(rules);
  });

  it('applies a stored custom phrase in the engine', () => {
    addCustomPhrase({ original: 'eod', replacement: 'end of day', tone: 'professional' });
    expect(improve('Share it by eod.', 'professional', loadCustomPhrases())).toBe('Share it by end of day.');
  });

  it('edits a phrase in place', () => {
    const [created] = addCustomPhrase({ original: 'eod', replacement: 'end of day', tone: 'professional' });
    const rules = updateCustomPhrase(created.id, { original: 'eod', replacement: 'close of business', tone: 'formal' });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ id: created.id, replacement: 'close of business', tone: 'formal' });
  });

  it('deletes a phrase and its favourite flag', () => {
    const [created] = addCustomPhrase({ original: 'eod', replacement: 'end of day', tone: 'professional' });
    setFavourite(created.id, true);
    expect(deleteCustomPhrase(created.id)).toEqual([]);
    expect(loadCustomPhrases()).toEqual([]);
    expect(loadFavourites()).toEqual([]);
  });

  it('rejects invalid or duplicate input', () => {
    expect(validatePhraseInput({ original: '', replacement: 'x', tone: 'polite' }, [])).toMatch(/Enter the phrase/);
    expect(validatePhraseInput({ original: '???', replacement: 'x', tone: 'polite' }, [])).toMatch(/letter or number/);
    expect(validatePhraseInput({ original: 'Same', replacement: 'same', tone: 'polite' }, [])).toMatch(/differ/);
    addCustomPhrase({ original: 'eod', replacement: 'end of day', tone: 'professional' });
    expect(() => addCustomPhrase({ original: 'EOD', replacement: 'end of the day', tone: 'professional' })).toThrow(/already have/);
    expect(() => addCustomPhrase({ original: 'EOD', replacement: 'end of the day', tone: 'formal' })).not.toThrow();
  });

  it('keeps custom phrases separate from the built-in rules', () => {
    addCustomPhrase({ original: 'eod', replacement: 'end of day', tone: 'professional' });
    const builtinIds = new Set(Object.values(BUILTIN_RULES).flat().map((r) => r.id));
    for (const r of loadCustomPhrases()) expect(builtinIds.has(r.id)).toBe(false);
    expect(Object.values(BUILTIN_RULES).flat().some((r) => r.custom)).toBe(false);
  });

  it('ignores corrupted stored data', () => {
    localStorage.setItem(STORAGE_KEYS.customPhrases, '{not json');
    expect(loadCustomPhrases()).toEqual([]);
    localStorage.setItem(STORAGE_KEYS.customPhrases, JSON.stringify([{ id: 1 }, null, 'x']));
    expect(loadCustomPhrases()).toEqual([]);
  });

  it('saves and removes favourites', () => {
    expect(setFavourite('pro-asap', true)).toEqual(['pro-asap']);
    expect(setFavourite('pro-fyi', true)).toEqual(['pro-fyi', 'pro-asap']);
    expect(setFavourite('pro-asap', true)).toEqual(['pro-asap', 'pro-fyi']);
    expect(setFavourite('pro-asap', false)).toEqual(['pro-fyi']);
    expect(loadFavourites()).toEqual(['pro-fyi']);
  });

  it('manages the personal dictionary', () => {
    expect(addDictionaryWord(' kubectl, ')).toEqual(['kubectl']);
    expect(addDictionaryWord('Kubectl')).toEqual(['kubectl']);
    expect(addDictionaryWord('Rakesh')).toEqual(['kubectl', 'Rakesh']);
    expect(removeDictionaryWord('kubectl')).toEqual(['Rakesh']);
    expect(loadDictionary()).toEqual(['Rakesh']);
  });
});

describe('history storage', () => {
  const input = { tone: 'professional' as const, original: 'pls do the needful', improved: 'Could you please take the necessary action?' };

  it('is disabled by default and stores nothing while disabled', () => {
    expect(DEFAULT_SETTINGS.historyEnabled).toBe(false);
    expect(loadSettings().historyEnabled).toBe(false);
    expect(saveHistoryRecord(input, false)).toBeNull();
    expect(loadHistory()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.history)).toBeNull();
  });

  it('stores a record with date and time when enabled', () => {
    const when = new Date('2026-11-10T09:30:00.000Z');
    const record = saveHistoryRecord(input, true, undefined, when);
    expect(record).toMatchObject({ ...input, createdAt: '2026-11-10T09:30:00.000Z' });
    expect(loadHistory()).toEqual([record]);
  });

  it('does not store empty messages', () => {
    expect(saveHistoryRecord({ ...input, original: '   ' }, true)).toBeNull();
    expect(loadHistory()).toEqual([]);
  });

  it('updates an existing record instead of duplicating it', () => {
    const record = saveHistoryRecord(input, true)!;
    const updated = saveHistoryRecord({ ...input, improved: 'Please take the necessary action.' }, true, record.id)!;
    expect(updated.id).toBe(record.id);
    expect(updated.createdAt).toBe(record.createdAt);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].improved).toBe('Please take the necessary action.');
  });

  it('keeps newest first and caps the list', () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++) saveHistoryRecord({ ...input, original: `message ${i}` }, true);
    const records = loadHistory();
    expect(records).toHaveLength(MAX_HISTORY);
    expect(records[0].original).toBe(`message ${MAX_HISTORY + 4}`);
  });

  it('deletes individual records and clears everything', () => {
    const a = saveHistoryRecord({ ...input, original: 'first' }, true)!;
    const b = saveHistoryRecord({ ...input, original: 'second' }, true)!;
    expect(deleteHistoryRecord(a.id).map((r) => r.id)).toEqual([b.id]);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe('settings storage', () => {
  it('returns defaults and round-trips changes', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    saveSettings({ ...DEFAULT_SETTINGS, theme: 'dark', historyEnabled: true, dialect: 'Indian' });
    expect(loadSettings()).toMatchObject({ theme: 'dark', historyEnabled: true, dialect: 'Indian' });
  });

  it('discards malformed values', () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ theme: 'neon', historyEnabled: 'yes', defaultTone: 'rude' }));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('missing browser storage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('falls back to memory when LocalStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(isStorageAvailable()).toBe(false);
    expect(writeJSON('phrase.test', { a: 1 })).toBe(false);
    expect(readJSON('phrase.test', null)).toEqual({ a: 1 });
    expect(() => addCustomPhrase({ original: 'eod', replacement: 'end of day', tone: 'professional' })).not.toThrow();
    expect(loadCustomPhrases()).toHaveLength(1);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
