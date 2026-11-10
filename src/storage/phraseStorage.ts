import type { PhraseRule, ToneId } from '../types';
import { TONE_IDS } from '../types';
import { normaliseDictionaryWord } from '../engine/spellingEngine';
import { uid } from '../engine/textUtils';
import { readJSON, STORAGE_KEYS, writeJSON } from './safeStorage';

/** User-defined phrases are stored separately from the built-in rule files. */

export interface CustomPhraseInput {
  original: string;
  replacement: string;
  tone: ToneId;
  alternatives?: string[];
  description?: string;
  context?: string;
  priority?: number;
}

function isValidRule(r: unknown): r is PhraseRule {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.original === 'string' &&
    x.original.trim() !== '' &&
    typeof x.replacement === 'string' &&
    TONE_IDS.includes(x.tone as ToneId)
  );
}

export function loadCustomPhrases(): PhraseRule[] {
  const raw = readJSON<unknown[]>(STORAGE_KEYS.customPhrases, []);
  return Array.isArray(raw) ? raw.filter(isValidRule).map((r) => ({ ...r, custom: true })) : [];
}

function save(rules: PhraseRule[]): PhraseRule[] {
  writeJSON(STORAGE_KEYS.customPhrases, rules);
  return rules;
}

/** Returns an error message, or null when the input is acceptable. */
export function validatePhraseInput(input: CustomPhraseInput, existing: PhraseRule[], ignoreId?: string): string | null {
  const original = input.original.trim();
  const replacement = input.replacement.trim();
  if (!original) return 'Enter the phrase you want to replace.';
  if (original.length > 200 || replacement.length > 300) return 'That phrase is too long.';
  if (!/[\p{L}\p{N}]/u.test(original)) return 'The phrase must contain at least one letter or number.';
  if (original.toLowerCase() === replacement.toLowerCase()) return 'The replacement must differ from the original phrase.';
  const clash = existing.some(
    (r) => r.id !== ignoreId && r.tone === input.tone && r.original.trim().toLowerCase() === original.toLowerCase(),
  );
  if (clash) return 'You already have a phrase with this wording for that tone.';
  return null;
}

function fromInput(input: CustomPhraseInput, id: string): PhraseRule {
  const alternatives = (input.alternatives ?? []).map((a) => a.trim()).filter(Boolean);
  return {
    id,
    original: input.original.trim(),
    replacement: input.replacement.trim(),
    ...(alternatives.length ? { alternatives } : {}),
    tone: input.tone,
    priority: input.priority ?? 50,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.context?.trim() ? { context: input.context.trim() } : {}),
    custom: true,
  };
}

export function addCustomPhrase(input: CustomPhraseInput): PhraseRule[] {
  const rules = loadCustomPhrases();
  const error = validatePhraseInput(input, rules);
  if (error) throw new Error(error);
  return save([fromInput(input, uid('custom-')), ...rules]);
}

export function updateCustomPhrase(id: string, input: CustomPhraseInput): PhraseRule[] {
  const rules = loadCustomPhrases();
  const error = validatePhraseInput(input, rules, id);
  if (error) throw new Error(error);
  return save(rules.map((r) => (r.id === id ? fromInput(input, id) : r)));
}

export function deleteCustomPhrase(id: string): PhraseRule[] {
  setFavourite(id, false);
  return save(loadCustomPhrases().filter((r) => r.id !== id));
}

/* ---- favourites (ids of built-in or custom phrases) ---- */

export function loadFavourites(): string[] {
  const raw = readJSON<unknown[]>(STORAGE_KEYS.favourites, []);
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export function setFavourite(id: string, favourite: boolean): string[] {
  const current = loadFavourites().filter((x) => x !== id);
  const next = favourite ? [id, ...current] : current;
  writeJSON(STORAGE_KEYS.favourites, next);
  return next;
}

/* ---- personal dictionary (words the spell-checker should accept) ---- */

export function loadDictionary(): string[] {
  const raw = readJSON<unknown[]>(STORAGE_KEYS.dictionary, []);
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export function addDictionaryWord(word: string): string[] {
  const clean = normaliseDictionaryWord(word);
  const current = loadDictionary();
  if (!clean || current.some((w) => w.toLowerCase() === clean.toLowerCase())) return current;
  const next = [...current, clean].sort((a, b) => a.localeCompare(b));
  writeJSON(STORAGE_KEYS.dictionary, next);
  return next;
}

export function removeDictionaryWord(word: string): string[] {
  const next = loadDictionary().filter((w) => w !== word);
  writeJSON(STORAGE_KEYS.dictionary, next);
  return next;
}
