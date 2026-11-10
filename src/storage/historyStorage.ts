import type { HistoryRecord, ToneId } from '../types';
import { TONE_IDS } from '../types';
import { uid } from '../engine/textUtils';
import { readJSON, STORAGE_KEYS, writeJSON } from './safeStorage';

/** Only the most recent records are kept. */
export const MAX_HISTORY = 50;

function isRecord(r: unknown): r is HistoryRecord {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    typeof x.createdAt === 'string' &&
    typeof x.original === 'string' &&
    typeof x.improved === 'string' &&
    TONE_IDS.includes(x.tone as ToneId)
  );
}

export function loadHistory(): HistoryRecord[] {
  const raw = readJSON<unknown[]>(STORAGE_KEYS.history, []);
  return Array.isArray(raw) ? raw.filter(isRecord) : [];
}

export interface HistoryInput {
  tone: ToneId;
  original: string;
  improved: string;
}

/**
 * Saves a processed message, but only when the user has enabled history.
 * Returns the stored record, or null when nothing was written.
 * Passing `id` updates an existing record instead of adding a new one.
 */
export function saveHistoryRecord(
  input: HistoryInput,
  enabled: boolean,
  id?: string,
  now: Date = new Date(),
): HistoryRecord | null {
  if (!enabled || !input.original.trim()) return null;
  const records = loadHistory();
  const existing = id ? records.find((r) => r.id === id) : undefined;
  const record: HistoryRecord = existing
    ? { ...existing, ...input }
    : { id: uid('h-'), createdAt: now.toISOString(), ...input };
  const next = [record, ...records.filter((r) => r.id !== record.id)].slice(0, MAX_HISTORY);
  writeJSON(STORAGE_KEYS.history, next);
  return record;
}

export function deleteHistoryRecord(id: string): HistoryRecord[] {
  const next = loadHistory().filter((r) => r.id !== id);
  writeJSON(STORAGE_KEYS.history, next);
  return next;
}

export function clearHistory(): void {
  writeJSON(STORAGE_KEYS.history, []);
}
