import { describe, expect, it } from 'vitest';
import { applyChanges } from '../src/engine/changes';
import { compareFromChanges, diffWords, summarize, tokenize } from '../src/engine/comparisonEngine';
import { analyzeText } from '../src/engine/toneEngine';
import type { Change, Segment } from '../src/types';

const join = (segments: Segment[]) => segments.map((s) => s.text).join('');
const of = (segments: Segment[], type: Segment['type']) => segments.filter((s) => s.type === type).map((s) => s.text);

describe('diffWords', () => {
  it('reconstructs both texts exactly', () => {
    const a = 'Hi team,\n\nSorry for late reply. I will check and update.';
    const b = 'Hi team,\n\nApologies for the delayed response. I will review this and share an update.';
    const d = diffWords(a, b);
    expect(join(d.original)).toBe(a);
    expect(join(d.improved)).toBe(b);
  });

  it('reports identical texts as fully equal', () => {
    const d = diffWords('Nothing changes here.', 'Nothing changes here.');
    expect(d.original).toEqual([{ type: 'equal', text: 'Nothing changes here.' }]);
    expect(d.improved).toEqual(d.original);
  });

  it('marks added words', () => {
    const d = diffWords('Send the report.', 'Send the full report today.');
    expect(of(d.improved, 'added').map((s) => s.trim())).toEqual(['full', 'today']);
    expect(of(d.original, 'removed')).toEqual([]);
  });

  it('marks removed words', () => {
    const d = diffWords('We are basically done.', 'We are done.');
    expect(of(d.original, 'removed').join('').trim()).toBe('basically');
    expect(of(d.improved, 'added')).toEqual([]);
  });

  it('marks replaced phrases on both sides', () => {
    const d = diffWords('Reply asap please.', 'Reply promptly please.');
    expect(of(d.original, 'replaced')).toEqual(['asap']);
    expect(of(d.improved, 'replaced')).toEqual(['promptly']);
  });

  it('handles empty input on either side', () => {
    expect(join(diffWords('', 'New text').improved)).toBe('New text');
    expect(of(diffWords('', 'New text').improved, 'added')).toEqual(['New text']);
    expect(of(diffWords('Old text', '').original, 'removed')).toEqual(['Old text']);
    expect(diffWords('', '')).toEqual({ original: [], improved: [] });
  });

  it('copes with very long texts without exhausting memory', () => {
    const a = 'alpha beta gamma delta '.repeat(6000);
    const b = 'alpha BETA gamma delta '.repeat(6000);
    const d = diffWords(a, b);
    expect(join(d.original)).toBe(a);
    expect(join(d.improved)).toBe(b);
  });

  it('tokenises words, spaces and punctuation separately', () => {
    expect(tokenize("Don't stop, now!")).toEqual(["Don't", ' ', 'stop', ',', ' ', 'now', '!']);
  });
});

describe('compareFromChanges', () => {
  it('classifies replaced phrases and reconstructs both texts', () => {
    const text = 'Hi, i want to know the plan. Please do the needful.';
    const result = applyChanges(text, analyzeText({ text, tone: 'professional' }));
    const c = compareFromChanges(text, result);
    expect(join(c.original)).toBe(text);
    expect(join(c.improved)).toBe(result.text);
    expect(of(c.original, 'replaced')).toEqual(['i want to know', 'Please do the needful.']);
    expect(of(c.improved, 'replaced')).toEqual(['I would like to understand', 'Could you please take the necessary action?']);
  });

  it('classifies removals', () => {
    const text = 'We are basically done.';
    const result = applyChanges(text, analyzeText({ text, tone: 'concise' }));
    const c = compareFromChanges(text, result);
    expect(of(c.original, 'removed')).toEqual([' basically']);
    expect(join(c.improved)).toBe('We are done.');
    expect(summarize(c)).toMatchObject({ removed: 1, replaced: 0, added: 0 });
  });

  it('classifies grammar corrections and pure insertions', () => {
    const text = 'Wait,what is teh plan';
    const changes: Change[] = [
      { id: 'a', source: 'grammar', label: 'Punctuation', message: '', start: 4, end: 5, originalText: ',', options: [{ text: ' ', start: 5, end: 5 }], defaultOption: 0, priority: 10 },
      { id: 'b', source: 'grammar', label: 'Typo', message: '', start: 13, end: 16, originalText: 'teh', options: [{ text: 'the', start: 13, end: 16 }], defaultOption: 0, priority: 10 },
      { id: 'c', source: 'phrase', label: 'x', message: '', start: 21, end: 21, originalText: '', options: [{ text: '?', start: 21, end: 21 }], defaultOption: 0, priority: 100 },
    ];
    const result = applyChanges(text, changes);
    expect(result.text).toBe('Wait, what is the plan?');
    const c = compareFromChanges(text, result);
    expect(of(c.improved, 'grammar')).toEqual([' ', 'the']);
    expect(of(c.original, 'grammar')).toEqual(['teh']);
    expect(of(c.improved, 'added')).toEqual(['?']);
    expect(join(c.original)).toBe(text);
  });
});

describe('applyChanges', () => {
  const text = 'abc def ghi';
  const mk = (id: string, start: number, end: number, t: string, priority: number, def = 0): Change => ({
    id, source: 'phrase', label: '', message: '', start, end, originalText: text.slice(start, end),
    options: [{ text: t, start, end }, { text: `${t}2`, start, end }], defaultOption: def, priority,
  });

  it('never mutates the original and respects rejections', () => {
    const changes = [mk('a', 0, 3, 'X', 10), mk('b', 8, 11, 'Y', 10)];
    expect(applyChanges(text, changes).text).toBe('X def Y');
    expect(applyChanges(text, changes, { a: -1 }).text).toBe('abc def Y');
    expect(applyChanges(text, changes, { a: 1 }).text).toBe('X2 def Y');
    expect(text).toBe('abc def ghi');
  });

  it('lets the higher-priority change win an overlap and reports the loser', () => {
    const changes = [mk('low', 0, 7, 'LOW', 10), mk('high', 4, 11, 'HIGH', 100)];
    const r = applyChanges(text, changes);
    expect(r.text).toBe('abc HIGH');
    expect(r.blocked).toEqual(['low']);
  });

  it('skips opt-in changes until selected', () => {
    const changes = [mk('a', 0, 3, 'X', 10, -1)];
    expect(applyChanges(text, changes).text).toBe(text);
    expect(applyChanges(text, changes, { a: 0 }).text).toBe('X def ghi');
  });
});
