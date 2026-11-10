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

  let text = '';
  let cursor = 0;
  const applied: AppliedChange[] = [];
  for (const a of accepted) {
    if (a.option.start < cursor) {
      blocked.push(a.change.id);
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
