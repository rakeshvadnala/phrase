import type { Change, ChangeOption, Selection } from '../types';
import { rangesOverlap } from './textUtils';

export interface AppliedChange {
  change: Change;
  option: ChangeOption;
  optionIndex: number;
  /** Range of the inserted text inside the OUTPUT string. */
  outStart: number;
  outEnd: number;
}

export interface ApplyResult {
  text: string;
  applied: AppliedChange[];
  /** Ids of changes that were selected but lost to a higher-priority overlapping change. */
  blocked: string[];
}

/** Resolves which option (if any) is active for a change under the given selection. */
export function chosenOption(change: Change, selection: Selection = {}): number {
  const picked = selection[change.id];
  const index = picked === undefined ? change.defaultOption : picked;
  return index >= 0 && index < change.options.length ? index : -1;
}

/** Phrase changes that offer a choice of wording (grammar corrections are not "versions"). */
const hasVariants = (c: Change) => c.source !== 'grammar' && c.options.length > 0;

/** How many distinct whole-message versions `selectVersion` can produce. */
export function countVersions(changes: Change[]): number {
  let max = 1;
  for (const c of changes) if (hasVariants(c)) max = Math.max(max, c.options.length + (c.defaultOption < 0 ? 1 : 0));
  return max;
}

/**
 * Builds the selection for whole-message version `version` (0 = the default).
 * Each phrase change moves on to its next wording; changes with fewer
 * wordings wrap around. Grammar choices already made are kept.
 */
export function selectVersion(changes: Change[], selection: Selection, version: number): Selection {
  const next: Selection = {};
  for (const c of changes) {
    if (!hasVariants(c)) {
      if (selection[c.id] !== undefined) next[c.id] = selection[c.id];
      continue;
    }
    if (version === 0) continue; // fall back to the default
    // Optional suggestions start "off", so their cycle has one extra position.
    const cycle = c.defaultOption < 0 ? [-1, ...c.options.keys()] : [...c.options.keys()];
    const startAt = c.defaultOption < 0 ? 0 : c.defaultOption;
    next[c.id] = cycle[(startAt + version) % cycle.length];
  }
  return next;
}

/**
 * Applies the selected changes to `original` and returns the new text.
 * The original string is never mutated; every change is expressed against it,
 * so toggling one change can never corrupt another.
 */
export function applyChanges(original: string, changes: Change[], selection: Selection = {}): ApplyResult {
  const wanted = changes
    .map((change) => ({ change, optionIndex: chosenOption(change, selection) }))
    .filter((c) => c.optionIndex >= 0)
    .sort((a, b) => b.change.priority - a.change.priority || a.change.start - b.change.start);

  const accepted: Array<{ change: Change; option: ChangeOption; optionIndex: number }> = [];
  const blocked: string[] = [];
  for (const { change, optionIndex } of wanted) {
    const option = change.options[optionIndex];
    const clash = accepted.some((a) => rangesOverlap(a.option, option) || rangesOverlap(a.change, change));
    if (clash) blocked.push(change.id);
    else accepted.push({ change, option, optionIndex });
  }
  accepted.sort((a, b) => a.option.start - b.option.start || a.option.end - b.option.end);

  // Secondary edits (e.g. sentence-final punctuation) join in where they do not collide.
  const edits = [...accepted];
  for (const a of accepted) {
    for (const extra of a.option.extra ?? []) {
      if (edits.some((e) => rangesOverlap(e.option, extra) || (e.change !== a.change && rangesOverlap(e.change, extra)))) continue;
      edits.push({ change: a.change, option: extra, optionIndex: a.optionIndex });
    }
  }
  edits.sort((a, b) => a.option.start - b.option.start || a.option.end - b.option.end);

  let text = '';
  let cursor = 0;
  const applied: AppliedChange[] = [];
  for (const a of edits) {
    if (a.option.start < cursor) {
      if (accepted.includes(a)) blocked.push(a.change.id);
      continue;
    }
    text += original.slice(cursor, a.option.start);
    const outStart = text.length;
    text += a.option.text;
    applied.push({ ...a, outStart, outEnd: text.length });
    cursor = a.option.end;
  }
  text += original.slice(cursor);
  return { text, applied, blocked };
}
