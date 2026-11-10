import type { Segment, SegmentType } from '../types';
import type { ApplyResult } from './changes';

export interface Comparison {
  original: Segment[];
  improved: Segment[];
}

function push(list: Segment[], type: SegmentType, text: string) {
  if (!text) return;
  const last = list[list.length - 1];
  if (last && last.type === type) last.text += text;
  else list.push({ type, text });
}

/**
 * Builds the two highlighted panels from the exact changes that were applied.
 * Because the edits are known, no guessing is involved:
 *  - grammar corrections   -> "grammar"
 *  - phrase replacements   -> "replaced"
 *  - pure insertions       -> "added"
 *  - pure deletions        -> "removed"
 */
export function compareFromChanges(original: string, result: ApplyResult): Comparison {
  const left: Segment[] = [];
  const right: Segment[] = [];
  let inCursor = 0;
  let outCursor = 0;
  for (const a of result.applied) {
    push(left, 'equal', original.slice(inCursor, a.option.start));
    push(right, 'equal', result.text.slice(outCursor, a.outStart));
    const removed = original.slice(a.option.start, a.option.end);
    const added = a.option.text;
    const type: SegmentType =
      a.change.source === 'grammar' ? 'grammar' : !added ? 'removed' : !removed ? 'added' : 'replaced';
    push(left, removed ? type : 'equal', removed);
    push(right, type === 'removed' ? 'equal' : type, added);
    inCursor = a.option.end;
    outCursor = a.outEnd;
  }
  push(left, 'equal', original.slice(inCursor));
  push(right, 'equal', result.text.slice(outCursor));
  return { original: left, improved: right };
}

export function tokenize(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{N}'’_-]+|[^\s\p{L}\p{N}]/gu) ?? [];
}

/** Above this many cell comparisons the differing middle is shown as one replaced block. */
const MAX_LCS_CELLS = 4_000_000;

/**
 * Word-level diff of two arbitrary texts (longest common subsequence).
 * Used wherever only the before/after strings are known, e.g. saved history.
 */
export function diffWords(a: string, b: string): Comparison {
  const x = tokenize(a);
  const y = tokenize(b);
  let head = 0;
  while (head < x.length && head < y.length && x[head] === y[head]) head++;
  let tail = 0;
  while (tail < x.length - head && tail < y.length - head && x[x.length - 1 - tail] === y[y.length - 1 - tail]) tail++;

  const mx = x.slice(head, x.length - tail);
  const my = y.slice(head, y.length - tail);
  type Op = { type: 'equal' | 'removed' | 'added'; text: string };
  const ops: Op[] = [];

  if (mx.length * my.length > MAX_LCS_CELLS) {
    ops.push({ type: 'removed', text: mx.join('') }, { type: 'added', text: my.join('') });
  } else if (mx.length || my.length) {
    const n = mx.length;
    const m = my.length;
    const w = m + 1;
    const table = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * w + j] = mx[i] === my[j] ? table[(i + 1) * w + j + 1] + 1 : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (mx[i] === my[j]) ops.push({ type: 'equal', text: mx[i++] }), j++;
      else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) ops.push({ type: 'removed', text: mx[i++] });
      else ops.push({ type: 'added', text: my[j++] });
    }
    while (i < n) ops.push({ type: 'removed', text: mx[i++] });
    while (j < m) ops.push({ type: 'added', text: my[j++] });
  }

  // Group consecutive non-equal operations; a group with both sides is a replacement.
  const left: Segment[] = [];
  const right: Segment[] = [];
  push(left, 'equal', x.slice(0, head).join(''));
  push(right, 'equal', y.slice(0, head).join(''));
  let k = 0;
  while (k < ops.length) {
    if (ops[k].type === 'equal') {
      push(left, 'equal', ops[k].text);
      push(right, 'equal', ops[k].text);
      k++;
      continue;
    }
    let removed = '';
    let added = '';
    while (k < ops.length) {
      const op = ops[k];
      if (op.type === 'removed') removed += op.text;
      else if (op.type === 'added') added += op.text;
      else if (op.text.trim() === '' && k + 1 < ops.length && ops[k + 1].type !== 'equal') {
        // Whitespace between two edits joins them into one group for cleaner highlights.
        removed += op.text;
        added += op.text;
      } else break;
      k++;
    }
    const both = removed.trim() !== '' && added.trim() !== '';
    push(left, both ? 'replaced' : 'removed', removed);
    push(right, both ? 'replaced' : 'added', added);
  }
  push(left, 'equal', x.slice(x.length - tail).join(''));
  push(right, 'equal', y.slice(y.length - tail).join(''));
  return { original: left, improved: right };
}

/** Counts of each kind of difference, for a compact summary line. */
export function summarize(comparison: Comparison) {
  const count = (list: Segment[], type: SegmentType) => list.filter((s) => s.type === type).length;
  return {
    added: count(comparison.improved, 'added'),
    removed: count(comparison.original, 'removed'),
    replaced: count(comparison.improved, 'replaced'),
    grammar: count(comparison.improved, 'grammar') || count(comparison.original, 'grammar'),
  };
}
